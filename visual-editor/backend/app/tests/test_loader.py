import sys
import types
from dataclasses import dataclass

import pytest
from pydantic import BaseModel

from app.runtime.loader import (
    ComponentInvocationError,
    ComponentLoadError,
    build_component_call_kwargs,
    normalise_parameters,
    normalise_result,
    resolve_component,
)


def test_resolve_component_dynamic_import(monkeypatch):
    module_name = "datapizza.tests.sample"
    component_name = "Example"
    module = types.ModuleType(module_name)

    class Example:
        pass

    module.Example = Example
    monkeypatch.setitem(sys.modules, module_name, module)
    if "datapizza" not in sys.modules:
        monkeypatch.setitem(sys.modules, "datapizza", types.ModuleType("datapizza"))

    resolved = resolve_component(f"{module_name}.{component_name}")

    assert resolved is Example


@pytest.mark.parametrize(
    "path, error_message",
    [
        ("", "component path must be a non-empty string"),
        (
            "invalid.module",
            "component resolution is restricted to the 'datapizza' namespace",
        ),
        (
            "datapizza.",
            "'datapizza.' is not a valid fully-qualified component reference",
        ),
    ],
)
def test_resolve_component_rejects_invalid_paths(path, error_message):
    with pytest.raises(ComponentLoadError, match=error_message):
        resolve_component(path)


def test_resolve_component_missing_attribute(monkeypatch):
    module_name = "datapizza.tests.missing"
    module = types.ModuleType(module_name)
    monkeypatch.setitem(sys.modules, module_name, module)
    if "datapizza" not in sys.modules:
        monkeypatch.setitem(sys.modules, "datapizza", types.ModuleType("datapizza"))

    with pytest.raises(
        ComponentLoadError,
        match="module 'datapizza.tests.missing' does not expose attribute 'unknown'",
    ):
        resolve_component(f"{module_name}.unknown")


def test_normalise_parameters_accepts_mapping():
    params = normalise_parameters({"a": 1, 2: "b"})

    assert params == {"a": 1, "2": "b"}


def test_normalise_parameters_rejects_non_mapping():
    with pytest.raises(ComponentInvocationError, match="must be expressed as a mapping"):
        normalise_parameters(["not", "a", "mapping"])


@dataclass
class ExampleDataclass:
    value: int


class ExampleModel(BaseModel):
    value: int


def test_normalise_result_handles_known_types():
    payload = {
        "dict": {"nested": ExampleDataclass(2)},
        "list": [ExampleModel(value=3)],
        "tuple": (1, 2),
        "bytes": b"data",
        "object": ExampleDataclass(4),
    }

    normalised = normalise_result(payload)

    assert normalised == {
        "dict": {"nested": {"value": 2}},
        "list": [{"value": 3}],
        "tuple": [1, 2],
        "bytes": b"data",
        "object": {"value": 4},
    }


def sample_callable(context, parameters, inputs, custom="ok"):
    return context, parameters, inputs, custom


def test_build_component_call_kwargs_injects_known_arguments():
    kwargs = build_component_call_kwargs(
        sample_callable,
        {"custom": "value", "other": 1},
        {"node": {"result": "x"}},
    )

    assert kwargs == {
        "context": {"parameters": {"custom": "value", "other": 1}, "inputs": {"node": {"result": "x"}}},
        "parameters": {"custom": "value", "other": 1},
        "inputs": {"node": {"result": "x"}},
        "custom": "value",
    }
    assert "other" not in kwargs


def test_build_component_call_kwargs_rejects_extra_parameters():
    def bare_callable():
        return None

    with pytest.raises(
        ComponentInvocationError,
        match="component does not accept parameters but configuration was provided",
    ):
        build_component_call_kwargs(bare_callable, {"unexpected": 1}, {})
