"""Observability helpers for the visual editor backend."""
from __future__ import annotations

import logging
import os
import sys
import threading
from dataclasses import dataclass
from typing import Dict, Optional

import structlog
from opentelemetry import metrics
from opentelemetry.metrics import Counter, Histogram
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
)


_STRUCTLOG_LOCK = threading.Lock()
_STRUCTLOG_CONFIGURED = False
_METER_PROVIDER_LOCK = threading.Lock()
_METER_PROVIDER: Optional[MeterProvider] = None
_WORKFLOW_METRICS: Optional["WorkflowMetrics"] = None


@dataclass(frozen=True)
class WorkflowMetrics:
    """Collection of instruments used to describe workflow executions."""

    executions: Counter
    execution_duration: Histogram
    step_duration: Histogram
    execution_errors: Counter


def configure_observability() -> None:
    """Initialise structured logging and OpenTelemetry metrics."""

    global _STRUCTLOG_CONFIGURED, _METER_PROVIDER

    if not _STRUCTLOG_CONFIGURED:
        with _STRUCTLOG_LOCK:
            if not _STRUCTLOG_CONFIGURED:
                logging.basicConfig(
                    level=logging.INFO,
                    stream=sys.stdout,
                    format="%(message)s",
                )
                structlog.configure(
                    processors=[
                        structlog.contextvars.merge_contextvars,
                        structlog.processors.add_log_level,
                        structlog.processors.TimeStamper(fmt="iso"),
                        structlog.processors.EventRenamer("message"),
                        structlog.processors.dict_tracebacks,
                        structlog.processors.JSONRenderer(),
                    ],
                    wrapper_class=structlog.stdlib.BoundLogger,
                    logger_factory=structlog.stdlib.LoggerFactory(),
                    cache_logger_on_first_use=True,
                )
                _STRUCTLOG_CONFIGURED = True

    if _METER_PROVIDER is None:
        with _METER_PROVIDER_LOCK:
            if _METER_PROVIDER is None:
                if os.environ.get("DATAPIZZA_DISABLE_METRICS_EXPORTER") == "1":
                    provider = MeterProvider()
                else:
                    reader = PeriodicExportingMetricReader(
                        ConsoleMetricExporter(), export_interval_millis=60000
                    )
                    provider = MeterProvider(metric_readers=[reader])
                metrics.set_meter_provider(provider)
                _METER_PROVIDER = provider


def shutdown_observability() -> None:
    """Flush telemetry buffers and release background resources."""

    global _METER_PROVIDER, _WORKFLOW_METRICS

    provider = _METER_PROVIDER
    if provider is None:
        return

    with _METER_PROVIDER_LOCK:
        try:
            provider.shutdown()
        except ValueError as exc:  # pragma: no cover - console exporter teardown
            if "I/O operation on closed file" not in str(exc):
                raise
        _METER_PROVIDER = None
        _WORKFLOW_METRICS = None


def get_logger(*, component: str | None = None, **initial_values: object) -> structlog.stdlib.BoundLogger:
    """Return a structlog logger bound to the given component name."""

    configure_observability()
    logger = structlog.get_logger(component or "visual-editor")
    if initial_values:
        logger = logger.bind(**initial_values)
    return logger


def get_workflow_metrics() -> WorkflowMetrics:
    """Return lazily-initialised workflow execution metrics instruments."""

    global _WORKFLOW_METRICS

    configure_observability()

    if _WORKFLOW_METRICS is None:
        meter = metrics.get_meter("datapizza.visual_editor.backend")
        _WORKFLOW_METRICS = WorkflowMetrics(
            executions=meter.create_counter(
                name="workflow_executions_total",
                description="Total number of workflow executions",
            ),
            execution_duration=meter.create_histogram(
                name="workflow_execution_duration_seconds",
                description="Distribution of workflow execution durations",
                unit="s",
            ),
            step_duration=meter.create_histogram(
                name="workflow_step_duration_seconds",
                description="Distribution of individual workflow step durations",
                unit="s",
            ),
            execution_errors=meter.create_counter(
                name="workflow_execution_errors_total",
                description="Total number of workflow executions that raised errors",
            ),
        )

    return _WORKFLOW_METRICS


def build_metric_attributes(**overrides: object) -> Dict[str, object]:
    """Helper to build metric attributes without mutating shared dictionaries."""

    return {key: value for key, value in overrides.items() if value is not None}
