import importlib.machinery
import sys
import types
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class WorkflowPoint:
    x: float
    y: float


@dataclass
class WorkflowConnector:
    nodeId: str
    portId: Optional[str] = None


@dataclass
class WorkflowNodeDefinition:
    id: str
    kind: str
    label: str
    position: WorkflowPoint
    data: Optional[Dict[str, Any]] = None


@dataclass
class WorkflowEdgeDefinition:
    id: str
    source: WorkflowConnector
    target: WorkflowConnector
    label: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class WorkflowExecutionStep:
    nodeId: str
    status: str
    details: Optional[str] = None


@dataclass
class WorkflowExecutionResult:
    runId: str
    status: str
    steps: List[WorkflowExecutionStep]
    outputs: Dict[str, Any]


@dataclass
class WorkflowDefinition:
    nodes: List[WorkflowNodeDefinition]
    edges: List[WorkflowEdgeDefinition]
    metadata: Dict[str, Any] = field(default_factory=dict)


package = types.ModuleType("app")
package.__path__ = [str(Path(__file__).resolve().parents[1])]
package.__spec__ = importlib.machinery.ModuleSpec(
    name="app", loader=None, is_package=True
)
sys.modules["app"] = package

models_module = types.ModuleType("app.models")
models_module.WorkflowPoint = WorkflowPoint
models_module.WorkflowConnector = WorkflowConnector
models_module.WorkflowNodeDefinition = WorkflowNodeDefinition
models_module.WorkflowEdgeDefinition = WorkflowEdgeDefinition
models_module.WorkflowExecutionStep = WorkflowExecutionStep
models_module.WorkflowExecutionResult = WorkflowExecutionResult
models_module.WorkflowDefinition = WorkflowDefinition
sys.modules["app.models"] = models_module
