"""FastAPI application exposing workflow utilities for the visual editor."""
from __future__ import annotations

from typing import Any, Dict

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .executor import MockWorkflowExecutor
from .models import (
    WORKFLOW_FORMAT_VERSION,
    WorkflowDefinition,
    WorkflowExecutionResult,
    WorkflowSchemaResponse,
    WorkflowValidationResponse,
)

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

_executor = MockWorkflowExecutor()


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
    summary="Execute a workflow using the mock executor",
)
def execute_workflow(payload: Dict[str, Any] = Body(...)) -> WorkflowExecutionResult:
    workflow = _parse_workflow(payload)
    return _executor.run(workflow)


@app.get(
    "/workflow/schema",
    response_model=WorkflowSchemaResponse,
    tags=["workflow"],
    summary="Expose the JSON schema used by the workflow definition",
)
def workflow_schema() -> WorkflowSchemaResponse:
    schema = WorkflowDefinition.schema(ref_template="#/components/schemas/{model}")
    return WorkflowSchemaResponse(schema=schema)
