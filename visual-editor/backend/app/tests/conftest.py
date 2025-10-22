import importlib.machinery
import os
import sys
import types
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest

os.environ.setdefault("DATAPIZZA_DISABLE_METRICS_EXPORTER", "1")

try:
    import structlog  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - test double for optional dependency
    class _BoundLogger:
        def bind(self, **_kwargs):
            return self

        def info(self, *_, **__):
            return None

        def warning(self, *_, **__):
            return None

        def exception(self, *_, **__):
            return None

        def error(self, *_, **__):
            return None

    class _LoggerFactory:
        def __call__(self, *_, **__):
            return _BoundLogger()

    structlog = types.ModuleType("structlog")
    structlog.stdlib = types.SimpleNamespace(
        BoundLogger=_BoundLogger,
        LoggerFactory=_LoggerFactory,
    )
    structlog.contextvars = types.SimpleNamespace(
        merge_contextvars=lambda event_dict: event_dict
    )
    structlog.processors = types.SimpleNamespace(
        add_log_level=lambda logger, method_name, event_dict: event_dict,
        TimeStamper=lambda fmt=None: (
            lambda logger, method_name, event_dict: event_dict
        ),
        EventRenamer=lambda new_name: (
            lambda logger, method_name, event_dict: event_dict
        ),
        dict_tracebacks=lambda logger, method_name, event_dict: event_dict,
        JSONRenderer=lambda: (
            lambda logger, method_name, event_dict: event_dict
        ),
    )

    def _noop_configure(**_kwargs):
        return None

    def _get_logger(*_args, **_kwargs):
        return _BoundLogger()

    structlog.configure = _noop_configure
    structlog.get_logger = _get_logger
    sys.modules["structlog"] = structlog


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

    @classmethod
    def parse_obj(cls, payload: Dict[str, Any]):
        steps = [
            step
            if isinstance(step, WorkflowExecutionStep)
            else WorkflowExecutionStep(**step)
            for step in payload.get("steps", [])
        ]
        return cls(
            runId=payload.get("runId", "remote"),
            status=payload.get("status", "success"),
            steps=steps,
            outputs=payload.get("outputs", {}),
        )


@dataclass
class WorkflowRuntimeOptions:
    environment: Optional[str] = None
    componentSearchPaths: List[str] = field(default_factory=list)
    environmentVariables: Dict[str, str] = field(default_factory=dict)
    credentials: Dict[str, str] = field(default_factory=dict)
    configOverrides: Dict[str, Any] = field(default_factory=dict)

    def dict(self, *_, exclude_none: bool = False, **__):
        payload = {
            "environment": self.environment,
            "componentSearchPaths": self.componentSearchPaths,
            "environmentVariables": self.environmentVariables,
            "credentials": self.credentials,
            "configOverrides": self.configOverrides,
        }
        if exclude_none:
            return {k: v for k, v in payload.items() if v not in (None, [], {})}
        return payload


@dataclass
class WorkflowDefinition:
    nodes: List[WorkflowNodeDefinition]
    edges: List[WorkflowEdgeDefinition]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def dict(self, *_, **__):
        return asdict(self)


def _install_fake_app_package():
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
    models_module.WorkflowRuntimeOptions = WorkflowRuntimeOptions
    models_module.WorkflowDefinition = WorkflowDefinition
    sys.modules["app.models"] = models_module

    return package


_install_fake_app_package()


@pytest.fixture(autouse=True, scope="session")
def ensure_app_package():
    return sys.modules["app"]
