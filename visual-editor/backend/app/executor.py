"""Workflow execution engine orchestrating Datapizza components."""
from __future__ import annotations

import inspect
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime
from typing import Any, Deque, Dict, Iterable, List, Mapping, Tuple
from uuid import uuid4

import httpx

from .models import (
    WorkflowDefinition,
    WorkflowExecutionResult,
    WorkflowExecutionStep,
    WorkflowNodeDefinition,
    WorkflowRuntimeOptions,
)
from .observability import build_metric_attributes, get_logger, get_workflow_metrics
from .runtime import (
    ComponentInvocationError,
    ComponentLoadError,
    build_component_call_kwargs,
    normalise_parameters,
    normalise_result,
    resolve_component,
)

LOCAL_MODE = "mock"
REMOTE_MODE = "real"

LOCAL_LOGGER = get_logger(component="workflow_executor", executor="local", mode=LOCAL_MODE)
REMOTE_LOGGER = get_logger(component="workflow_executor", executor="remote", mode=REMOTE_MODE)
WORKFLOW_METRICS = get_workflow_metrics()


def _record_execution_metrics(
    *,
    mode: str,
    status: str,
    duration: float,
    error_attributes: Dict[str, object] | None = None,
) -> None:
    attributes = build_metric_attributes(mode=mode, status=status)
    WORKFLOW_METRICS.executions.add(1, attributes)
    WORKFLOW_METRICS.execution_duration.record(duration, attributes)
    if status == "failure":
        error_attrs = build_metric_attributes(mode=mode, **(error_attributes or {}))
        WORKFLOW_METRICS.execution_errors.add(1, error_attrs)


def _record_step_metrics(*, mode: str, node_kind: str, status: str, duration: float) -> None:
    attributes = build_metric_attributes(mode=mode, node_kind=node_kind, status=status)
    WORKFLOW_METRICS.step_duration.record(duration, attributes)


class RemoteExecutionError(RuntimeError):
    """Raised when the remote executor cannot complete a workflow run."""


class DatapizzaWorkflowExecutor:
    """Execute workflow nodes by dynamically loading Datapizza components."""

    def __init__(self, *, node_timeout: float = 30.0, max_workers: int = 1) -> None:
        self.node_timeout = node_timeout
        self.max_workers = max_workers

    def run(
        self,
        workflow: WorkflowDefinition,
        *,
        options: WorkflowRuntimeOptions | None = None,
    ) -> WorkflowExecutionResult:
        run_id = f"run_{uuid4().hex[:8]}"
        steps: List[WorkflowExecutionStep] = []
        grouped_results: Dict[str, Dict[str, Any]] = {
            "input": {},
            "task": {},
            "output": {},
        }
        raw_results: Dict[str, Any] = {}
        status = "success"
        error_attributes: Dict[str, object] | None = None
        run_start = time.perf_counter()
        run_logger = LOCAL_LOGGER.bind(run_id=run_id)

        run_logger.info(
            "workflow_run_started",
            node_count=len(workflow.nodes),
            timeout_seconds=self.node_timeout,
            max_workers=self.max_workers,
        )

        try:
            execution_order, incoming = self._build_execution_plan(workflow)
        except ValueError as exc:
            status = "failure"
            message = f"Invalid workflow graph: {exc}"
            error_attributes = {"error_type": "invalid_workflow"}
            run_logger.exception(
                "workflow_execution_plan_failed",
                message=message,
            )
            steps.append(
                WorkflowExecutionStep(
                    nodeId="__workflow__",
                    status="failed",
                    details=message,
                )
            )
            return self._finalise_run(
                run_id=run_id,
                status=status,
                steps=steps,
                results=grouped_results,
                workflow=workflow,
                run_logger=run_logger,
                run_start=run_start,
                error_attributes=error_attributes,
            )

        for node in execution_order:
            step_logger = run_logger.bind(node_id=node.id, node_kind=node.kind)
            component_path = self._extract_component_path(node)
            if component_path is None:
                status = "failure"
                message = "node is missing a 'data.component' reference"
                error_attributes = {"error_type": "missing_component", "node_kind": node.kind}
                step_logger.error(
                    "workflow_step_missing_component",
                    message=message,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                _record_step_metrics(
                    mode=LOCAL_MODE,
                    node_kind=node.kind,
                    status="failed",
                    duration=0.0,
                )
                break

            step_logger = step_logger.bind(component=component_path)
            step_start = time.perf_counter()
            step_logger.info("workflow_step_started")

            try:
                parameters = normalise_parameters((node.data or {}).get("parameters"))
            except ComponentInvocationError as exc:
                status = "failure"
                message = str(exc)
                error_attributes = {"error_type": "invalid_parameters", "node_kind": node.kind}
                step_logger.error(
                    "workflow_step_invalid_parameters",
                    message=message,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                step_duration = time.perf_counter() - step_start
                _record_step_metrics(
                    mode=LOCAL_MODE,
                    node_kind=node.kind,
                    status="failed",
                    duration=step_duration,
                )
                break

            upstream_nodes = incoming.get(node.id, [])
            inputs_payload = {
                upstream: raw_results[upstream]
                for upstream in upstream_nodes
                if upstream in raw_results
            }
            missing_dependencies = sorted(set(upstream_nodes) - set(inputs_payload))
            if missing_dependencies:
                status = "failure"
                message = (
                    "missing upstream results from nodes: "
                    + ", ".join(missing_dependencies)
                )
                error_attributes = {
                    "error_type": "missing_dependencies",
                    "node_kind": node.kind,
                }
                step_logger.error(
                    "workflow_step_missing_dependencies",
                    message=message,
                    missing_dependencies=missing_dependencies,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                step_duration = time.perf_counter() - step_start
                _record_step_metrics(
                    mode=LOCAL_MODE,
                    node_kind=node.kind,
                    status="failed",
                    duration=step_duration,
                )
                break

            try:
                component = resolve_component(component_path)
            except ComponentLoadError as exc:
                status = "failure"
                message = str(exc)
                error_attributes = {
                    "error_type": "component_load",
                    "node_kind": node.kind,
                }
                step_logger.exception(
                    "workflow_step_component_load_failed",
                    message=message,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                step_duration = time.perf_counter() - step_start
                _record_step_metrics(
                    mode=LOCAL_MODE,
                    node_kind=node.kind,
                    status="failed",
                    duration=step_duration,
                )
                break

            try:
                result = self._invoke_component(component, parameters, inputs_payload)
            except FuturesTimeoutError:
                status = "failure"
                message = (
                    f"component execution timed out after {self.node_timeout:.1f}s"
                )
                error_attributes = {
                    "error_type": "timeout",
                    "node_kind": node.kind,
                }
                step_logger.exception(
                    "workflow_step_timeout",
                    message=message,
                    timeout_seconds=self.node_timeout,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                step_duration = time.perf_counter() - step_start
                _record_step_metrics(
                    mode=LOCAL_MODE,
                    node_kind=node.kind,
                    status="failed",
                    duration=step_duration,
                )
                break
            except ComponentInvocationError as exc:
                status = "failure"
                message = str(exc)
                error_attributes = {
                    "error_type": "invocation_error",
                    "node_kind": node.kind,
                }
                step_logger.exception(
                    "workflow_step_invocation_rejected",
                    message=message,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                step_duration = time.perf_counter() - step_start
                _record_step_metrics(
                    mode=LOCAL_MODE,
                    node_kind=node.kind,
                    status="failed",
                    duration=step_duration,
                )
                break
            except Exception as exc:  # pragma: no cover - unexpected execution error
                status = "failure"
                message = f"component raised an unexpected error: {exc}"
                error_attributes = {
                    "error_type": "unexpected_exception",
                    "node_kind": node.kind,
                }
                step_logger.exception(
                    "workflow_step_unexpected_error",
                    message=message,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                step_duration = time.perf_counter() - step_start
                _record_step_metrics(
                    mode=LOCAL_MODE,
                    node_kind=node.kind,
                    status="failed",
                    duration=step_duration,
                )
                break

            raw_results[node.id] = result
            grouped_results[node.kind][node.id] = normalise_result(result)
            steps.append(
                WorkflowExecutionStep(
                    nodeId=node.id,
                    status="completed",
                    details=f"Component '{component_path}' executed successfully",
                )
            )
            step_duration = time.perf_counter() - step_start
            _record_step_metrics(
                mode=LOCAL_MODE,
                node_kind=node.kind,
                status="completed",
                duration=step_duration,
            )
            step_logger.info(
                "workflow_step_completed",
                duration_seconds=step_duration,
            )

        return self._finalise_run(
            run_id=run_id,
            status=status,
            steps=steps,
            results=grouped_results,
            workflow=workflow,
            run_logger=run_logger,
            run_start=run_start,
            error_attributes=error_attributes,
        )

    def _finalise_run(
        self,
        *,
        run_id: str,
        status: str,
        steps: List[WorkflowExecutionStep],
        results: Dict[str, Dict[str, Any]],
        workflow: WorkflowDefinition | None,
        run_logger,
        run_start: float,
        error_attributes: Dict[str, object] | None,
    ) -> WorkflowExecutionResult:
        duration = time.perf_counter() - run_start
        step_count = len(steps)
        if status == "success":
            run_logger.info(
                "workflow_run_completed",
                duration_seconds=duration,
                step_count=step_count,
            )
        else:
            run_logger.warning(
                "workflow_run_failed",
                duration_seconds=duration,
                step_count=step_count,
                error=error_attributes,
            )
        _record_execution_metrics(
            mode=LOCAL_MODE,
            status=status,
            duration=duration,
            error_attributes=error_attributes,
        )
        return self._build_result(
            run_id,
            status=status,
            steps=steps,
            results=results,
            workflow=workflow,
        )

    def _invoke_component(
        self,
        component: Any,
        parameters: Mapping[str, Any],
        inputs: Mapping[str, Any],
    ) -> Any:
        callable_obj = component
        if inspect.isclass(callable_obj):
            callable_obj = callable_obj()

        if not callable(callable_obj):
            raise ComponentInvocationError(
                "resolved component is not callable; expected function, class or callable instance"
            )

        kwargs = build_component_call_kwargs(callable_obj, dict(parameters), dict(inputs))

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future = executor.submit(callable_obj, **kwargs)
            return future.result(timeout=self.node_timeout)

    def _build_result(
        self,
        run_id: str,
        *,
        status: str,
        steps: Iterable[WorkflowExecutionStep],
        results: Dict[str, Dict[str, Any]],
        workflow: WorkflowDefinition | None = None,
    ) -> WorkflowExecutionResult:
        outputs = {
            "completedAt": datetime.utcnow().isoformat() + "Z",
            "results": results,
        }
        if workflow is not None:
            outputs.update(
                {
                    "nodeCount": len(workflow.nodes),
                    "edgeCount": len(workflow.edges),
                }
            )
        return WorkflowExecutionResult(
            runId=run_id,
            status="success" if status == "success" else "failure",
            steps=list(steps),
            outputs=outputs,
        )

    def _build_execution_plan(
        self, workflow: WorkflowDefinition
    ) -> Tuple[List[WorkflowNodeDefinition], Dict[str, List[str]]]:
        nodes_by_id: Dict[str, WorkflowNodeDefinition] = {
            node.id: node for node in workflow.nodes
        }
        incoming_counts: Dict[str, int] = {node.id: 0 for node in workflow.nodes}
        incoming_map: Dict[str, List[str]] = defaultdict(list)
        adjacency: Dict[str, List[str]] = defaultdict(list)

        for edge in workflow.edges:
            adjacency[edge.source.nodeId].append(edge.target.nodeId)
            incoming_counts[edge.target.nodeId] += 1
            incoming_map[edge.target.nodeId].append(edge.source.nodeId)

        for node_id in nodes_by_id:
            incoming_map.setdefault(node_id, [])

        queue: Deque[str] = deque(
            node_id for node_id, count in incoming_counts.items() if count == 0
        )
        ordered_nodes: List[WorkflowNodeDefinition] = []

        while queue:
            node_id = queue.popleft()
            ordered_nodes.append(nodes_by_id[node_id])
            for downstream in adjacency.get(node_id, []):
                incoming_counts[downstream] -= 1
                if incoming_counts[downstream] == 0:
                    queue.append(downstream)

        if len(ordered_nodes) != len(workflow.nodes):
            raise ValueError("workflow contains cycles or unresolved dependencies")

        return ordered_nodes, incoming_map

    @staticmethod
    def _extract_component_path(node: WorkflowNodeDefinition) -> str | None:
        node_data = node.data or {}
        component_path = node_data.get("component")
        if component_path is None:
            return None
        if not isinstance(component_path, str) or not component_path.strip():
            return None
        return component_path


class RemoteWorkflowExecutor:
    """Forward workflow execution requests to a remote Datapizza backend."""

    def __init__(
        self,
        *,
        execution_url: str,
        timeout: float = 60.0,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        if not execution_url:
            raise ValueError("execution_url must be provided")
        self.execution_url = execution_url
        self.timeout = timeout
        self.headers = dict(headers or {})

    def run(
        self,
        workflow: WorkflowDefinition,
        *,
        options: WorkflowRuntimeOptions | None = None,
    ) -> WorkflowExecutionResult:
        run_start = time.perf_counter()
        payload: Dict[str, Any] = {"workflow": workflow.dict(by_alias=True)}
        if options:
            payload["options"] = options.dict(exclude_none=True)

        request_logger = REMOTE_LOGGER.bind(target=self.execution_url)
        request_logger.info(
            "workflow_run_dispatched",
            node_count=len(workflow.nodes),
            timeout_seconds=self.timeout,
        )

        try:
            response = httpx.post(
                self.execution_url,
                json=payload,
                headers=self.headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            duration = time.perf_counter() - run_start
            request_logger.exception(
                "workflow_run_timeout",
                duration_seconds=duration,
            )
            _record_execution_metrics(
                mode=REMOTE_MODE,
                status="failure",
                duration=duration,
                error_attributes={"error_type": "remote_timeout"},
            )
            raise RemoteExecutionError(
                f"Remote workflow execution timed out after {self.timeout:.1f}s"
            ) from exc
        except httpx.HTTPStatusError as exc:
            duration = time.perf_counter() - run_start
            status_code = exc.response.status_code
            request_logger.exception(
                "workflow_run_http_error",
                status_code=status_code,
                duration_seconds=duration,
            )
            _record_execution_metrics(
                mode=REMOTE_MODE,
                status="failure",
                duration=duration,
                error_attributes={
                    "error_type": "remote_http_error",
                    "status_code": status_code,
                },
            )
            raise RemoteExecutionError(
                f"Remote execution failed with status code {status_code}"
            ) from exc
        except httpx.HTTPError as exc:
            duration = time.perf_counter() - run_start
            request_logger.exception(
                "workflow_run_transport_error",
                duration_seconds=duration,
            )
            _record_execution_metrics(
                mode=REMOTE_MODE,
                status="failure",
                duration=duration,
                error_attributes={"error_type": "remote_transport_error"},
            )
            raise RemoteExecutionError(
                "Remote execution failed due to a transport error"
            ) from exc

        try:
            result_payload = response.json()
        except ValueError as exc:
            duration = time.perf_counter() - run_start
            request_logger.exception(
                "workflow_run_invalid_response",
                duration_seconds=duration,
            )
            _record_execution_metrics(
                mode=REMOTE_MODE,
                status="failure",
                duration=duration,
                error_attributes={"error_type": "remote_invalid_payload"},
            )
            raise RemoteExecutionError(
                "Remote execution returned an invalid JSON payload"
            ) from exc

        result = WorkflowExecutionResult.parse_obj(result_payload)
        duration = time.perf_counter() - run_start
        error_attributes: Dict[str, object] | None = None
        if result.status != "success":
            error_attributes = {"error_type": "remote_result_failure"}
            request_logger.warning(
                "workflow_run_completed_with_failure",
                duration_seconds=duration,
                run_id=result.runId,
                step_count=len(result.steps),
            )
        else:
            request_logger.info(
                "workflow_run_completed",
                duration_seconds=duration,
                run_id=result.runId,
                step_count=len(result.steps),
            )

        _record_execution_metrics(
            mode=REMOTE_MODE,
            status=result.status,
            duration=duration,
            error_attributes=error_attributes,
        )
        return result
