"""FastAPI application exposing workflow utilities for the visual editor."""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, Tuple

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .executor import (
    DatapizzaWorkflowExecutor,
    RemoteExecutionError,
    RemoteWorkflowExecutor,
)
from .models import (
    WORKFLOW_FORMAT_VERSION,
    WorkflowDefinition,
    WorkflowExecutionResult,
    WorkflowExecutionRequest,
    WorkflowRuntimeOptions,
    WorkflowSchemaResponse,
    WorkflowValidationResponse,
)
from .observability import configure_observability, shutdown_observability
from .settings import AppSettings, get_settings, runtime_configuration

app = FastAPI(
    title="Datapizza Visual Editor Backend",
    description=(
        "Utility API used by the visual workflow editor to validate and mock the "
        "execution of workflows before they are sent to Datapizza AI."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _build_local_executor(
    node_timeout: float, max_workers: int
) -> DatapizzaWorkflowExecutor:
    """Return a cached executor instance configured with the given parameters."""

    return DatapizzaWorkflowExecutor(node_timeout=node_timeout, max_workers=max_workers)


@lru_cache(maxsize=1)
def _build_remote_executor(
    execution_url: str,
    timeout: float,
    headers_signature: Tuple[Tuple[str, str], ...],
) -> RemoteWorkflowExecutor:
    """Return a cached remote executor configured for the target service."""

    headers = dict(headers_signature)
    return RemoteWorkflowExecutor(
        execution_url=execution_url,
        timeout=timeout,
        headers=headers,
    )


@app.on_event("startup")
def _configure_runtime_environment() -> None:
    """Apply base runtime configuration as soon as the application starts."""

    configure_observability()
    get_settings().configure_base_environment()


@app.on_event("shutdown")
def _shutdown_observability() -> None:
    """Flush telemetry processors when the application stops."""

    shutdown_observability()


@app.get("/", tags=["system"])
def read_root() -> Dict[str, Any]:
    """Return basic information about the backend service."""
    return {
        "service": "datapizza-visual-editor-backend",
        "workflowVersion": WORKFLOW_FORMAT_VERSION,
    }


def _parse_workflow(payload: Dict[str, Any]) -> WorkflowDefinition:
    try:
        return WorkflowDefinition.parse_obj(payload)
    except ValidationError as exc:  # pragma: no cover - FastAPI handles coverage externally
        issues = [
            f"{'.'.join(map(str, error['loc']))}: {error['msg']}" for error in exc.errors()
        ]
        raise HTTPException(status_code=422, detail={"valid": False, "issues": issues})


def _parse_execution_request(
    payload: Dict[str, Any]
) -> Tuple[WorkflowDefinition, WorkflowRuntimeOptions | None]:
    """Support both legacy payloads and the new request contract with runtime options."""

    if "workflow" in payload or "options" in payload:
        try:
            request = WorkflowExecutionRequest.parse_obj(payload)
        except ValidationError as exc:
            issues = [
                f"{'.'.join(map(str, error['loc']))}: {error['msg']}" for error in exc.errors()
            ]
            raise HTTPException(status_code=422, detail={"valid": False, "issues": issues})
        return request.workflow, request.options

    return _parse_workflow(payload), None


def _resolve_executor(
    settings: AppSettings,
) -> DatapizzaWorkflowExecutor | RemoteWorkflowExecutor:
    mode = settings.executor_mode.lower()
    if mode == "remote":
        if not settings.remote_executor_url:
            raise HTTPException(
                status_code=500,
                detail="Remote executor URL is not configured",
            )
        headers_signature = tuple(sorted(settings.remote_executor_headers.items()))
        return _build_remote_executor(
            settings.remote_executor_url,
            settings.remote_executor_timeout,
            headers_signature,
        )
    if mode != "mock":
        raise HTTPException(
            status_code=500,
            detail=f"Unsupported executor mode '{settings.executor_mode}'",
        )
    return _build_local_executor(
        settings.executor_node_timeout, settings.executor_max_workers
    )


@app.post(
    "/workflow/import",
    response_model=WorkflowDefinition,
    tags=["workflow"],
    summary="Import a workflow definition",
)
def import_workflow(payload: Dict[str, Any] = Body(...)) -> WorkflowDefinition:
    """Validate an incoming workflow payload and normalise it."""
    workflow = _parse_workflow(payload)
    return workflow


@app.post(
    "/workflow/export",
    response_model=WorkflowDefinition,
    tags=["workflow"],
    summary="Export a validated workflow definition",
)
def export_workflow(payload: Dict[str, Any] = Body(...)) -> WorkflowDefinition:
    """Validate an outgoing workflow payload before persisting it."""
    workflow = _parse_workflow(payload)
    return workflow


@app.post(
    "/workflow/validate",
    response_model=WorkflowValidationResponse,
    tags=["workflow"],
    summary="Validate the integrity of a workflow definition",
)
def validate_workflow(payload: Dict[str, Any] = Body(...)) -> WorkflowValidationResponse:
    try:
        WorkflowDefinition.parse_obj(payload)
    except ValidationError as exc:
        issues = [f"{'.'.join(map(str, error['loc']))}: {error['msg']}" for error in exc.errors()]
        return WorkflowValidationResponse(valid=False, issues=issues)
    return WorkflowValidationResponse(valid=True, issues=[])


@app.post(
    "/workflow/execute",
    response_model=WorkflowExecutionResult,
    tags=["workflow"],
    summary="Execute a workflow using the configured executor",
)
def execute_workflow(payload: Dict[str, Any] = Body(...)) -> WorkflowExecutionResult:
    settings = get_settings()
    workflow, options = _parse_execution_request(payload)
    executor = _resolve_executor(settings)

    try:
        if isinstance(executor, DatapizzaWorkflowExecutor):
            with runtime_configuration(settings, options):
                result = executor.run(workflow, options=options)
        else:
            result = executor.run(workflow, options=options)
    except RemoteExecutionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if options:
        runtime_metadata = result.outputs.setdefault("runtime", {})
        if options.environment:
            runtime_metadata["environment"] = options.environment
        if options.configOverrides:
            runtime_metadata["configOverrides"] = dict(options.configOverrides)

    return result


@app.get(
    "/workflow/schema",
    response_model=WorkflowSchemaResponse,
    tags=["workflow"],
    summary="Expose the JSON schema used by the workflow definition",
)
def workflow_schema() -> WorkflowSchemaResponse:
    schema = WorkflowDefinition.schema(ref_template="#/components/schemas/{model}")
    return WorkflowSchemaResponse(schema=schema)
