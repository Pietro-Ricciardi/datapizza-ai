"""In-memory orchestration of workflow runs for the mock backend."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock, Thread
from typing import Dict, List, Optional
from uuid import uuid4

from .executor import DatapizzaWorkflowExecutor, RemoteWorkflowExecutor
from .models import (
    WorkflowDefinition,
    WorkflowExecutionResult,
    WorkflowExecutionStep,
    WorkflowRunLogEntry,
    WorkflowRunLogResponse,
    WorkflowRunStatusResponse,
    WorkflowRunStepStatus,
    WorkflowRunSummary,
    WorkflowRuntimeOptions,
)
from .observability import get_logger

RUN_LOGGER = get_logger(component="workflow_run_store")


def _utc_timestamp() -> str:
    return datetime.utcnow().isoformat() + "Z"


@dataclass
class _StepState:
    node_id: str
    status: str = "pending"
    details: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    def to_model(self) -> WorkflowRunStepStatus:
        return WorkflowRunStepStatus(
            nodeId=self.node_id,
            status=self.status,  # type: ignore[arg-type]
            details=self.details,
            startedAt=self.started_at,
            completedAt=self.completed_at,
        )


@dataclass
class _RunRecord:
    run_id: str
    workflow: WorkflowDefinition
    options: Optional[WorkflowRuntimeOptions]
    workflow_name: str
    status: str = "running"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    archived: bool = False
    result: Optional[WorkflowExecutionResult] = None
    error: Optional[str] = None
    steps: Dict[str, _StepState] = field(default_factory=dict)
    logs: List[WorkflowRunLogEntry] = field(default_factory=list)
    next_sequence: int = 0

    def to_status(self) -> WorkflowRunStatusResponse:
        return WorkflowRunStatusResponse(
            runId=self.run_id,
            status=self.status,  # type: ignore[arg-type]
            createdAt=self.created_at.isoformat() + "Z",
            updatedAt=self.updated_at.isoformat() + "Z",
            workflowName=self.workflow_name,
            archived=self.archived,
            steps=[state.to_model() for state in self.steps.values()],
            result=self.result,
            error=self.error,
        )

    def to_summary(self) -> WorkflowRunSummary:
        return WorkflowRunSummary(
            runId=self.run_id,
            status=self.status,  # type: ignore[arg-type]
            createdAt=self.created_at.isoformat() + "Z",
            updatedAt=self.updated_at.isoformat() + "Z",
            workflowName=self.workflow_name,
            archived=self.archived,
        )


ExecutionBackend = DatapizzaWorkflowExecutor | RemoteWorkflowExecutor


class WorkflowRunStore:
    """Keep track of workflow executions to support polling from the UI."""

    def __init__(self) -> None:
        self._runs: Dict[str, _RunRecord] = {}
        self._lock = Lock()

    def start_run(
        self,
        workflow: WorkflowDefinition,
        options: Optional[WorkflowRuntimeOptions],
        executor: ExecutionBackend,
    ) -> WorkflowRunStatusResponse:
        run_id = f"run_{uuid4().hex[:8]}"
        snapshot = workflow.copy(deep=True)
        options_snapshot = options.copy(deep=True) if options is not None else None
        steps = {
            node.id: _StepState(node_id=node.id)
            for node in snapshot.nodes
        }

        record = _RunRecord(
            run_id=run_id,
            workflow=snapshot,
            options=options_snapshot,
            workflow_name=snapshot.metadata.name,
            steps=steps,
        )

        with self._lock:
            self._runs[run_id] = record

        thread = Thread(
            target=self._execute_run,
            args=(run_id, executor),
            name=f"workflow-run-{run_id}",
            daemon=True,
        )
        thread.start()

        RUN_LOGGER.info("workflow_run_enqueued", run_id=run_id)
        return record.to_status()

    def retry_run(
        self,
        run_id: str,
        executor: ExecutionBackend,
    ) -> WorkflowRunStatusResponse:
        record = self._get_run(run_id)
        return self.start_run(record.workflow, record.options, executor)

    def archive_run(self, run_id: str) -> WorkflowRunSummary:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                raise KeyError(run_id)
            record.archived = True
            record.updated_at = datetime.utcnow()
            RUN_LOGGER.info("workflow_run_archived", run_id=run_id)
            return record.to_summary()

    def get_status(self, run_id: str) -> WorkflowRunStatusResponse:
        record = self._get_run(run_id)
        return record.to_status()

    def list_runs(self, *, include_archived: bool = True) -> List[WorkflowRunSummary]:
        with self._lock:
            runs = [
                record.to_summary()
                for record in self._runs.values()
                if include_archived or not record.archived
            ]
        runs.sort(key=lambda summary: summary.createdAt, reverse=True)
        return runs

    def get_logs(
        self, run_id: str, *, after: Optional[int] = None
    ) -> WorkflowRunLogResponse:
        record = self._get_run(run_id)
        start = after if after is not None else -1
        logs = [
            log.copy()
            for log in record.logs
            if log.sequence > start
        ]
        return WorkflowRunLogResponse(
            runId=run_id,
            logs=logs,
            nextCursor=record.next_sequence,
        )

    def _get_run(self, run_id: str) -> _RunRecord:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                raise KeyError(run_id)
            return record

    def _execute_run(self, run_id: str, executor: ExecutionBackend) -> None:
        def emit(event: Dict[str, object]) -> None:
            event_type = event.get("type")
            if event_type == "step":
                self._update_step(
                    run_id,
                    node_id=str(event["nodeId"]),
                    status=str(event["status"]),
                    details=event.get("details"),
                    timestamp=str(event.get("timestamp", _utc_timestamp())),
                )
            elif event_type == "log":
                self._append_log(
                    run_id,
                    message=str(event.get("message", "")),
                    level=str(event.get("level", "info")),
                    node_id=event.get("nodeId"),
                    timestamp=str(event.get("timestamp", _utc_timestamp())),
                )

        self._append_log(
            run_id,
            message="Avvio esecuzione workflow",
            level="info",
            node_id=None,
            timestamp=_utc_timestamp(),
        )

        try:
            record = self._get_run(run_id)
            result = executor.run(
                record.workflow,
                options=record.options,
                observer=emit,
            )
            self._finalise_run(run_id, result)
        except Exception as exc:  # pragma: no cover - defensive fallback
            RUN_LOGGER.exception("workflow_run_unexpected_failure", run_id=run_id)
            self._fail_run(run_id, str(exc))

    def _update_step(
        self,
        run_id: str,
        *,
        node_id: str,
        status: str,
        details,
        timestamp: str,
    ) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return
            step = record.steps.get(node_id)
            if step is None:
                step = _StepState(node_id=node_id)
                record.steps[node_id] = step
            step.status = status
            if details:
                step.details = str(details)
            if status == "running" and step.started_at is None:
                step.started_at = timestamp
            if status in {"completed", "failed"}:
                step.completed_at = step.completed_at or timestamp
                if status == "failed" and record.error is None and isinstance(details, str):
                    record.error = details
            record.updated_at = datetime.utcnow()

    def _append_log(
        self,
        run_id: str,
        *,
        message: str,
        level: str,
        node_id,
        timestamp: str,
    ) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return
            record.next_sequence += 1
            log_entry = WorkflowRunLogEntry(
                id=f"log_{uuid4().hex[:10]}",
                sequence=record.next_sequence,
                timestamp=timestamp,
                message=message,
                level=level,  # type: ignore[arg-type]
                nodeId=str(node_id) if node_id is not None else None,
            )
            record.logs.append(log_entry)
            record.updated_at = datetime.utcnow()

    def _finalise_run(self, run_id: str, result: WorkflowExecutionResult) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return
            record.result = result
            record.status = result.status
            record.updated_at = datetime.utcnow()
            for step in result.steps:
                self._sync_step(record, step)
            if result.status == "success":
                message = "Esecuzione completata con successo"
                level = "info"
            else:
                message = "Esecuzione terminata con errori"
                level = "error"
                if record.error is None:
                    record.error = "Workflow terminato con errori"
        self._append_log(
            run_id,
            message=message,
            level=level,
            node_id=None,
            timestamp=_utc_timestamp(),
        )

    def _fail_run(self, run_id: str, error_message: str) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return
            record.status = "failure"
            record.error = error_message
            record.updated_at = datetime.utcnow()
        self._append_log(
            run_id,
            message=error_message,
            level="error",
            node_id=None,
            timestamp=_utc_timestamp(),
        )

    @staticmethod
    def _sync_step(record: _RunRecord, step: WorkflowExecutionStep) -> None:
        state = record.steps.get(step.nodeId)
        if state is None:
            state = _StepState(node_id=step.nodeId)
            record.steps[step.nodeId] = state
        state.status = step.status
        state.details = step.details
        if step.status == "completed" and state.completed_at is None:
            state.completed_at = _utc_timestamp()
        if step.status == "failed" and state.completed_at is None:
            state.completed_at = _utc_timestamp()
            if record.error is None and step.details:
                record.error = step.details

