import sys
import types
from datetime import datetime

import pytest

from app.executor import DatapizzaWorkflowExecutor
from app.models import (
    WorkflowDefinition,
    WorkflowNodeDefinition,
    WorkflowPoint,
    WorkflowConnector,
)


def make_workflow(nodes, edges=None):
    workflow = WorkflowDefinition(nodes=nodes, edges=edges or [], metadata={"name": "Test Workflow"})
    return workflow


def test_executor_successful_run(monkeypatch):
    module_name = "datapizza.tests.executor"
    module = types.ModuleType(module_name)

    def component(parameters, inputs):
        return {
            "echo": parameters["message"],
            "inputs": inputs,
            "timestamp": datetime(2024, 1, 1, 0, 0, 0),
        }

    module.Component = component
    monkeypatch.setitem(sys.modules, module_name, module)
    if "datapizza" not in sys.modules:
        monkeypatch.setitem(sys.modules, "datapizza", types.ModuleType("datapizza"))

    executor = DatapizzaWorkflowExecutor()

    node = WorkflowNodeDefinition(
        id="task-1",
        kind="task",
        label="Task",
        position=WorkflowPoint(x=0, y=0),
        data={
            "component": f"{module_name}.Component",
            "parameters": {"message": "hello"},
        },
    )

    result = executor.run(make_workflow([node]))

    assert result.status == "success"
    assert result.outputs["results"]["task"]["task-1"]["echo"] == "hello"
    assert (
        result.outputs["results"]["task"]["task-1"]["timestamp"]
        == "2024-01-01 00:00:00"
    )
    assert result.steps[0].status == "completed"


def test_executor_missing_component_path():
    executor = DatapizzaWorkflowExecutor()

    node = WorkflowNodeDefinition(
        id="task-1",
        kind="task",
        label="Task",
        position=WorkflowPoint(x=0, y=0),
        data={},
    )

    result = executor.run(make_workflow([node]))

    assert result.status == "failure"
    assert result.steps[0].status == "failed"
    assert "missing a 'data.component'" in result.steps[0].details


def test_executor_propagates_component_load_error(monkeypatch):
    executor = DatapizzaWorkflowExecutor()

    node = WorkflowNodeDefinition(
        id="task-1",
        kind="task",
        label="Task",
        position=WorkflowPoint(x=0, y=0),
        data={"component": "datapizza.unknown.Missing"},
    )

    result = executor.run(make_workflow([node]))

    assert result.status == "failure"
    assert result.steps[0].status == "failed"
    assert "unable to import module" in result.steps[0].details


def test_executor_propagates_parameter_validation_error(monkeypatch):
    module_name = "datapizza.tests.validation"
    module = types.ModuleType(module_name)

    def component():
        return "ok"

    module.Component = component
    monkeypatch.setitem(sys.modules, module_name, module)
    if "datapizza" not in sys.modules:
        monkeypatch.setitem(sys.modules, "datapizza", types.ModuleType("datapizza"))

    executor = DatapizzaWorkflowExecutor()

    node = WorkflowNodeDefinition(
        id="task-1",
        kind="task",
        label="Task",
        position=WorkflowPoint(x=0, y=0),
        data={
            "component": f"{module_name}.Component",
            "parameters": ["unexpected"],
        },
    )

    result = executor.run(make_workflow([node]))

    assert result.status == "failure"
    assert result.steps[0].status == "failed"
    assert "parameters must be expressed as a mapping" in result.steps[0].details


def test_executor_reports_missing_upstream_results(monkeypatch):
    module_name = "datapizza.tests.requires_inputs"
    module = types.ModuleType(module_name)

    def component(inputs):
        return inputs

    module.Component = component
    monkeypatch.setitem(sys.modules, module_name, module)
    if "datapizza" not in sys.modules:
        monkeypatch.setitem(sys.modules, "datapizza", types.ModuleType("datapizza"))

    executor = DatapizzaWorkflowExecutor()

    node = WorkflowNodeDefinition(
        id="task-1",
        kind="task",
        label="Downstream",
        position=WorkflowPoint(x=0, y=1),
        data={
            "component": f"{module_name}.Component",
            "parameters": {},
        },
    )

    def fake_execution_plan(_self, workflow):
        return [node], {node.id: ["missing-upstream"]}

    monkeypatch.setattr(
        DatapizzaWorkflowExecutor,
        "_build_execution_plan",
        fake_execution_plan,
    )

    result = executor.run(make_workflow([node]))

    assert result.status == "failure"
    assert result.steps[-1].status == "failed"
    assert "missing upstream results" in result.steps[-1].details
