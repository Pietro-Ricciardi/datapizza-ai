"""Configuration helpers for the visual editor backend runtime."""
from __future__ import annotations

import json
import os
import sys
from contextlib import contextmanager
from functools import lru_cache
from typing import Dict, Iterator, List, Optional, Tuple, TYPE_CHECKING

from pydantic import BaseModel, BaseSettings, Field, validator

if TYPE_CHECKING:  # pragma: no cover - imported for type checking only
    from .models import WorkflowRuntimeOptions


RUNTIME_CONFIG_ENV_VAR = "DATAPIZZA_RUNTIME_CONFIG_OVERRIDES"


class RuntimeEnvironmentConfig(BaseModel):
    """Declarative configuration for a runtime profile."""

    component_search_paths: List[str] = Field(default_factory=list)
    environment_variables: Dict[str, str] = Field(default_factory=dict)
    credentials: Dict[str, str] = Field(default_factory=dict)

    @validator("component_search_paths", pre=True)
    def _validate_paths(cls, value: Optional[object]) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [item for item in value.split(":") if item]
        return list(value)

    @validator("environment_variables", "credentials", pre=True)
    def _validate_mapping(cls, value: Optional[object]) -> Dict[str, str]:
        if value is None or value == "":
            return {}
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("expected JSON object for runtime mapping") from exc
            if not isinstance(parsed, dict):
                raise ValueError("runtime mapping must decode to a dictionary")
            return {str(key): str(val) for key, val in parsed.items()}
        return {str(key): str(val) for key, val in dict(value).items()}


class AppSettings(BaseSettings):
    """Application settings resolved from environment variables or .env files."""

    component_search_paths: List[str] = Field(default_factory=list, env="DATAPIZZA_COMPONENT_PATHS")
    environment_variables: Dict[str, str] = Field(default_factory=dict, env="DATAPIZZA_ENVIRONMENT_VARIABLES")
    credentials: Dict[str, str] = Field(default_factory=dict, env="DATAPIZZA_CREDENTIALS")
    runtime_environments: Dict[str, RuntimeEnvironmentConfig] = Field(
        default_factory=dict, env="DATAPIZZA_RUNTIME_ENVIRONMENTS"
    )
    executor_node_timeout: float = Field(30.0, env="DATAPIZZA_EXECUTOR_NODE_TIMEOUT")
    executor_max_workers: int = Field(1, env="DATAPIZZA_EXECUTOR_MAX_WORKERS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @validator("component_search_paths", pre=True)
    def _validate_component_search_paths(cls, value: Optional[object]) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [item for item in value.split(":") if item]
        return list(value)

    @validator("environment_variables", "credentials", pre=True)
    def _validate_env_mapping(cls, value: Optional[object]) -> Dict[str, str]:
        if value is None or value == "":
            return {}
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("expected JSON object for environment mapping") from exc
            if not isinstance(parsed, dict):
                raise ValueError("environment mapping must decode to a dictionary")
            return {str(key): str(val) for key, val in parsed.items()}
        return {str(key): str(val) for key, val in dict(value).items()}

    def configure_base_environment(self) -> None:
        """Make sure process-wide search paths and environment variables are applied."""

        for path in self.component_search_paths:
            self._ensure_path(path)
        self._apply_environment({**self.environment_variables, **self.credentials}, override=False)

    def build_runtime_overrides(
        self, options: "WorkflowRuntimeOptions | None"
    ) -> Tuple[List[str], Dict[str, str], Dict[str, str], Dict[str, object]]:
        """Merge runtime profiles and per-request options into concrete overrides."""

        paths: List[str] = []
        env_vars: Dict[str, str] = {}
        credentials: Dict[str, str] = {}
        config_overrides: Dict[str, object] = {}

        if options and options.environment:
            profile = self.runtime_environments.get(options.environment)
            if profile:
                paths.extend(profile.component_search_paths)
                env_vars.update(profile.environment_variables)
                credentials.update(profile.credentials)

        if options:
            if options.componentSearchPaths:
                paths.extend(options.componentSearchPaths)
            if options.environmentVariables:
                env_vars.update(options.environmentVariables)
            if options.credentials:
                credentials.update(options.credentials)
            if options.configOverrides:
                config_overrides = dict(options.configOverrides)

        return paths, env_vars, credentials, config_overrides

    @staticmethod
    def _ensure_path(path: str) -> None:
        normalised = os.path.abspath(path)
        if normalised and normalised not in sys.path:
            sys.path.insert(0, normalised)

    @staticmethod
    def _apply_environment(values: Dict[str, str], *, override: bool) -> None:
        for key, value in values.items():
            if value is None:
                continue
            if override or key not in os.environ:
                os.environ[key] = str(value)


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Return an application settings instance cached for the process lifecycle."""

    settings = AppSettings()
    return settings


@contextmanager
def runtime_configuration(
    settings: AppSettings, options: "WorkflowRuntimeOptions | None"
) -> Iterator[None]:
    """Context manager temporarily applying runtime overrides for workflow execution."""

    paths, env_vars, credentials, config_overrides = settings.build_runtime_overrides(options)

    inserted_paths: List[str] = []
    for path in paths:
        normalised = os.path.abspath(path)
        if normalised and normalised not in sys.path:
            sys.path.insert(0, normalised)
            inserted_paths.append(normalised)

    previous_env: Dict[str, Optional[str]] = {}
    updates = {**env_vars, **credentials}
    for key, value in updates.items():
        if value is None:
            continue
        previous_env[key] = os.environ.get(key)
        os.environ[key] = str(value)

    if config_overrides:
        previous_env[RUNTIME_CONFIG_ENV_VAR] = os.environ.get(RUNTIME_CONFIG_ENV_VAR)
        os.environ[RUNTIME_CONFIG_ENV_VAR] = json.dumps(config_overrides)

    try:
        yield
    finally:
        for key, value in previous_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        for path in inserted_paths:
            try:
                sys.path.remove(path)
            except ValueError:  # pragma: no cover - defensive cleanup
                continue
