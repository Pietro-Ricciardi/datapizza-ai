"""Pydantic models describing the workflow contract shared with the visual editor."""
from __future__ import annotations

from math import isfinite
from typing import Any, Dict, List, Literal, Optional, Set

from pydantic import BaseModel, EmailStr, Field, root_validator, validator

WORKFLOW_FORMAT_VERSION = "datapizza.workflow/v1"


class WorkflowMetadataAuthor(BaseModel):
    """Author information embedded in the workflow metadata."""

    name: str = Field(..., min_length=1, description="Full name of the author")
    email: Optional[EmailStr] = Field(
        default=None, description="Optional contact e-mail of the author"
    )

    @validator("name")
    def validate_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("author name cannot be blank")
        return value


class WorkflowMetadata(BaseModel):
    """Metadata describing a workflow independent from its graph."""

    name: str = Field(..., min_length=1, description="Human readable workflow name")
    description: Optional[str] = Field(
        default=None, description="Optional extended description"
    )
    tags: Optional[List[str]] = Field(
        default=None,
        description="List of categorisation tags to help searching workflows",
    )
    author: Optional[WorkflowMetadataAuthor] = Field(
        default=None, description="Author information"
    )
    externalId: Optional[str] = Field(
        default=None, description="External reference used by third party tools"
    )
    createdAt: Optional[str] = Field(
        default=None,
        description="ISO8601 timestamp describing when the workflow was created",
    )
    updatedAt: Optional[str] = Field(
        default=None,
        description="ISO8601 timestamp describing when the workflow was last updated",
    )

    @validator("name")
    def validate_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("metadata.name cannot be blank")
        return value

    @validator("tags", each_item=True)
    def validate_tags(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("tags cannot contain empty values")
        return value


class WorkflowPoint(BaseModel):
    """Represents a point in the editor canvas."""

    x: float
    y: float

    @validator("x", "y")
    def validate_coordinate(cls, value: float, field) -> float:  # type: ignore[override]
        if not isfinite(value):
            raise ValueError(f"{field.name} must be a finite number")
        return value


class WorkflowConnector(BaseModel):
    """Describes the connection between two nodes."""

    nodeId: str = Field(..., min_length=1, description="Identifier of the connected node")
    portId: Optional[str] = Field(
        default=None, description="Optional identifier of the connection port"
    )

    @validator("nodeId")
    def validate_node_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("connector.nodeId cannot be blank")
        return value

    @validator("portId")
    def validate_port_id(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.strip():
            raise ValueError("connector.portId cannot be blank when provided")
        return value


class WorkflowNodeDefinition(BaseModel):
    """Definition of a workflow node."""

    id: str = Field(..., min_length=1)
    kind: Literal["input", "task", "output"]
    label: str = Field(..., min_length=1)
    position: WorkflowPoint
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Arbitrary serialisable configuration for the node",
    )

    @validator("id", "label")
    def validate_non_empty(cls, value: str, field) -> str:  # type: ignore[override]
        if not value.strip():
            raise ValueError(f"node {field.name} cannot be blank")
        return value


class WorkflowEdgeDefinition(BaseModel):
    """Edge connecting two workflow nodes."""

    id: str = Field(..., min_length=1)
    source: WorkflowConnector
    target: WorkflowConnector
    label: Optional[str] = Field(default=None, description="Optional edge label")
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata associated with the connection",
    )

    @validator("id")
    def validate_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("edge id cannot be blank")
        return value

    @validator("label")
    def validate_label(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.strip():
            raise ValueError("edge label cannot be blank when provided")
        return value


class WorkflowReactFlowViewport(BaseModel):
    """Viewport persisted by the frontend visual editor."""

    x: float
    y: float
    zoom: float = Field(..., gt=0)

    @validator("x", "y", "zoom")
    def validate_number(cls, value: float, field) -> float:  # type: ignore[override]
        if not isfinite(value):
            raise ValueError(f"{field.name} must be a finite number")
        return value


class WorkflowReactFlowSettings(BaseModel):
    viewport: Optional[WorkflowReactFlowViewport] = None

    class Config:
        extra = "allow"


class WorkflowDefinitionExtensions(BaseModel):
    reactFlow: Optional[WorkflowReactFlowSettings] = Field(
        default=None, description="Frontend specific configuration"
    )
    backend: Optional[Dict[str, Any]] = Field(
        default=None, description="Backend execution hints"
    )

    class Config:
        extra = "allow"


class WorkflowDefinition(BaseModel):
    """Full workflow definition shared between the frontend and the backend."""

    version: Literal[WORKFLOW_FORMAT_VERSION] = Field(
        WORKFLOW_FORMAT_VERSION,
        description="Schema version for the workflow definition",
    )
    metadata: WorkflowMetadata
    nodes: List[WorkflowNodeDefinition]
    edges: List[WorkflowEdgeDefinition]
    extensions: Optional[WorkflowDefinitionExtensions] = Field(
        default=None, description="Optional extension payloads"
    )

    @root_validator
    def validate_graph(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        nodes: List[WorkflowNodeDefinition] = values.get("nodes", [])
        edges: List[WorkflowEdgeDefinition] = values.get("edges", [])

        if not nodes:
            raise ValueError("workflows must define at least one node")

        node_ids: List[str] = [node.id for node in nodes]
        seen_nodes: Set[str] = set()
        duplicated_nodes: Set[str] = set()
        for node_id in node_ids:
            if node_id in seen_nodes:
                duplicated_nodes.add(node_id)
            else:
                seen_nodes.add(node_id)
        if duplicated_nodes:
            raise ValueError(
                f"workflow contains duplicated node ids: {', '.join(sorted(duplicated_nodes))}"
            )

        edge_ids: List[str] = [edge.id for edge in edges]
        seen_edges: Set[str] = set()
        duplicated_edges: Set[str] = set()
        for edge_id in edge_ids:
            if edge_id in seen_edges:
                duplicated_edges.add(edge_id)
            else:
                seen_edges.add(edge_id)
        if duplicated_edges:
            raise ValueError(
                f"workflow contains duplicated edge ids: {', '.join(sorted(duplicated_edges))}"
            )

        available_nodes = set(node_ids)
        for edge in edges:
            if edge.source.nodeId not in available_nodes:
                raise ValueError(
                    f"edge '{edge.id}' references missing source node '{edge.source.nodeId}'"
                )
            if edge.target.nodeId not in available_nodes:
                raise ValueError(
                    f"edge '{edge.id}' references missing target node '{edge.target.nodeId}'"
                )

        return values


class WorkflowValidationResponse(BaseModel):
    valid: bool
    issues: List[str] = Field(default_factory=list)


class WorkflowExecutionStep(BaseModel):
    nodeId: str
    status: Literal["pending", "running", "completed"]
    details: Optional[str] = None


class WorkflowExecutionResult(BaseModel):
    runId: str
    status: Literal["success", "failure"]
    steps: List[WorkflowExecutionStep]
    outputs: Dict[str, Any] = Field(default_factory=dict)


class WorkflowSchemaResponse(BaseModel):
    schema: Dict[str, Any]
