"""Workflow execution engine orchestrating Datapizza components."""
from __future__ import annotations

import inspect
import logging
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime
from typing import Any, Deque, Dict, Iterable, List, Mapping, Tuple
from uuid import uuid4

from .models import (
    WorkflowDefinition,
    WorkflowExecutionResult,
    WorkflowExecutionStep,
    WorkflowNodeDefinition,
)
from .runtime import (
    ComponentInvocationError,
    ComponentLoadError,
    build_component_call_kwargs,
    normalise_parameters,
    normalise_result,
    resolve_component,
)

logger = logging.getLogger(__name__)


class DatapizzaWorkflowExecutor:
    """Execute workflow nodes by dynamically loading Datapizza components."""

    def __init__(self, *, node_timeout: float = 30.0, max_workers: int = 1) -> None:
        self.node_timeout = node_timeout
        self.max_workers = max_workers

    def run(self, workflow: WorkflowDefinition) -> WorkflowExecutionResult:
        run_id = f"run_{uuid4().hex[:8]}"
        steps: List[WorkflowExecutionStep] = []
        grouped_results: Dict[str, Dict[str, Any]] = {
            "input": {},
            "task": {},
            "output": {},
        }
        raw_results: Dict[str, Any] = {}
        status = "success"

        try:
            execution_order, incoming = self._build_execution_plan(workflow)
        except ValueError as exc:
            message = f"Invalid workflow graph: {exc}"
            logger.exception("Unable to prepare workflow execution: %s", message)
            steps.append(
                WorkflowExecutionStep(
                    nodeId="__workflow__",
                    status="failed",
                    details=message,
                )
            )
            return self._build_result(
                run_id,
                status="failure",
                steps=steps,
                results=grouped_results,
                workflow=workflow,
            )

        for node in execution_order:
            component_path = self._extract_component_path(node)
            if component_path is None:
                status = "failure"
                message = "node is missing a 'data.component' reference"
                logger.error("Workflow node '%s' failed: %s", node.id, message)
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                break

            try:
                component = resolve_component(component_path)
            except ComponentLoadError as exc:
                status = "failure"
                message = str(exc)
                logger.exception("Unable to resolve component '%s': %s", component_path, message)
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                break

            try:
                parameters = normalise_parameters((node.data or {}).get("parameters"))
            except ComponentInvocationError as exc:
                status = "failure"
                message = str(exc)
                logger.error(
                    "Invalid parameters for node '%s' component '%s': %s",
                    node.id,
                    component_path,
                    message,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                break

            upstream_nodes = incoming.get(node.id, [])
            inputs_payload = {upstream: raw_results[upstream] for upstream in upstream_nodes if upstream in raw_results}
            missing_dependencies = sorted(set(upstream_nodes) - set(inputs_payload))
            if missing_dependencies:
                status = "failure"
                message = (
                    "missing upstream results from nodes: "
                    + ", ".join(missing_dependencies)
                )
                logger.error("Node '%s' cannot run: %s", node.id, message)
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                break

            try:
                result = self._invoke_component(component, parameters, inputs_payload)
            except FuturesTimeoutError:
                status = "failure"
                message = (
                    f"component execution timed out after {self.node_timeout:.1f}s"
                )
                logger.exception(
                    "Node '%s' component '%s' timed out after %ss",
                    node.id,
                    component_path,
                    self.node_timeout,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                break
            except ComponentInvocationError as exc:
                status = "failure"
                message = str(exc)
                logger.exception(
                    "Node '%s' component '%s' rejected invocation: %s",
                    node.id,
                    component_path,
                    message,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
                )
                break
            except Exception as exc:  # pragma: no cover - unexpected execution error
                status = "failure"
                message = f"component raised an unexpected error: {exc}"
                logger.exception(
                    "Node '%s' component '%s' failed with an unexpected error",
                    node.id,
                    component_path,
                )
                steps.append(
                    WorkflowExecutionStep(
                        nodeId=node.id,
                        status="failed",
                        details=message,
                    )
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

        if status == "failure":
            logger.warning(
                "Workflow run '%s' failed after %d step(s)",
                run_id,
                len(steps),
            )
            return self._build_result(
                run_id,
                status=status,
                steps=steps,
                results=grouped_results,
                workflow=workflow,
            )

        logger.info(
            "Workflow run '%s' completed successfully with %d step(s)",
            run_id,
            len(steps),
        )
        return self._build_result(
            run_id,
            status=status,
            steps=steps,
            results=grouped_results,
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
