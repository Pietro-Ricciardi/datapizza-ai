"""Mock workflow execution engine used by the FastAPI backend."""
from __future__ import annotations

from datetime import datetime
from typing import Iterable
from uuid import uuid4

from .models import (
    WorkflowDefinition,
    WorkflowExecutionResult,
    WorkflowExecutionStep,
)


class MockWorkflowExecutor:
    """Very small in-memory executor used for local development."""

    def run(self, workflow: WorkflowDefinition) -> WorkflowExecutionResult:
        run_id = f"run_{uuid4().hex[:8]}"
        steps = list(self._simulate_steps(workflow))
        statuses = {step.status for step in steps}
        status = "success" if "pending" not in statuses else "failure"
        outputs = {
            "completedAt": datetime.utcnow().isoformat() + "Z",
            "nodeCount": len(workflow.nodes),
            "edgeCount": len(workflow.edges),
        }
        return WorkflowExecutionResult(
            runId=run_id,
            status=status,
            steps=steps,
            outputs=outputs,
        )

    def _simulate_steps(self, workflow: WorkflowDefinition) -> Iterable[WorkflowExecutionStep]:
        for node in workflow.nodes:
            yield WorkflowExecutionStep(
                nodeId=node.id,
                status="running",
                details=(
                    "Simulated execution entry point"
                    if node.kind == "input"
                    else "Simulated task execution"
                ),
            )
            yield WorkflowExecutionStep(
                nodeId=node.id,
                status="completed",
                details=(
                    "Input node preparation completed"
                    if node.kind == "input"
                    else "Node execution finished"
                ),
            )

        if not workflow.nodes:
            yield WorkflowExecutionStep(
                nodeId="__empty__",
                status="pending",
                details="Workflow does not contain any node to execute",
            )
