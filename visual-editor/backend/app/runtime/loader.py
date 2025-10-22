"""Helpers to dynamically load and invoke Datapizza workflow components."""
from __future__ import annotations

import dataclasses
import importlib
import inspect
import logging
from collections.abc import Mapping, Sequence
from typing import Any, Callable, Dict

logger = logging.getLogger(__name__)


class ComponentLoadError(RuntimeError):
    """Raised when a component cannot be loaded from the given path."""


class ComponentInvocationError(RuntimeError):
    """Raised when a component cannot be invoked with the provided payload."""


def resolve_component(path: str) -> Any:
    """Resolve a dotted path into a Python object within the ``datapizza`` namespace."""

    if not path or not isinstance(path, str):
        raise ComponentLoadError("component path must be a non-empty string")

    if not path.startswith("datapizza."):
        raise ComponentLoadError(
            "component resolution is restricted to the 'datapizza' namespace"
        )

    module_path, _, attribute = path.rpartition(".")
    if not module_path or not attribute:
        raise ComponentLoadError(
            f"'{path}' is not a valid fully-qualified component reference"
        )

    try:
        module = importlib.import_module(module_path)
    except Exception as exc:  # pragma: no cover - importlib error formatting
        raise ComponentLoadError(
            f"unable to import module '{module_path}': {exc}"
        ) from exc

    try:
        component = getattr(module, attribute)
    except AttributeError as exc:
        raise ComponentLoadError(
            f"module '{module_path}' does not expose attribute '{attribute}'"
        ) from exc

    return component


def normalise_parameters(parameters: Any) -> Dict[str, Any]:
    """Ensure component parameters are expressed as a JSON-compatible mapping."""

    if parameters is None:
        return {}

    if isinstance(parameters, Mapping):
        return {str(key): value for key, value in parameters.items()}

    raise ComponentInvocationError("component parameters must be expressed as a mapping")


def normalise_result(result: Any) -> Any:
    """Best-effort conversion of component results into JSON-serialisable objects."""

    if isinstance(result, Mapping):
        return {str(key): normalise_result(value) for key, value in result.items()}

    if isinstance(result, Sequence) and not isinstance(result, (str, bytes, bytearray)):
        return [normalise_result(value) for value in result]

    if dataclasses.is_dataclass(result):
        return normalise_result(dataclasses.asdict(result))

    if hasattr(result, "dict") and callable(result.dict):  # pydantic models, etc.
        return normalise_result(result.dict())

    if hasattr(result, "model_dump") and callable(result.model_dump):
        return normalise_result(result.model_dump())

    if hasattr(result, "_asdict") and callable(result._asdict):  # namedtuple
        return normalise_result(result._asdict())

    if isinstance(result, (str, bytes, bytearray, int, float, bool)) or result is None:
        return result

    if hasattr(result, "__dict__"):
        return {
            key: normalise_result(value)
            for key, value in vars(result).items()
            if not key.startswith("_")
        }

    return str(result)


def build_component_call_kwargs(
    callable_obj: Callable[..., Any],
    parameters: Dict[str, Any],
    inputs: Dict[str, Any],
) -> Dict[str, Any]:
    """Return keyword arguments compatible with the callable signature."""

    signature = inspect.signature(callable_obj)
    accepts_var_keyword = any(
        param.kind == inspect.Parameter.VAR_KEYWORD
        for param in signature.parameters.values()
    )

    kwargs: Dict[str, Any] = {}

    if "context" in signature.parameters:
        kwargs["context"] = {"parameters": parameters, "inputs": inputs}
    if "payload" in signature.parameters and "payload" not in kwargs:
        kwargs["payload"] = {"parameters": parameters, "inputs": inputs}
    if "inputs" in signature.parameters:
        kwargs["inputs"] = inputs
    if "upstream" in signature.parameters and "upstream" not in kwargs:
        kwargs["upstream"] = inputs
    if "parameters" in signature.parameters:
        kwargs["parameters"] = parameters

    for name, value in parameters.items():
        if name in kwargs:
            continue
        if name in signature.parameters or accepts_var_keyword:
            kwargs[name] = value

    if not kwargs and parameters and not signature.parameters:
        raise ComponentInvocationError(
            "component does not accept parameters but configuration was provided"
        )

    return kwargs
