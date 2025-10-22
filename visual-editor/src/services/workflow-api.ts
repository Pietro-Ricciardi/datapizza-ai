import {
  type WorkflowDefinition,
  type WorkflowExecutionResult,
  type WorkflowRuntimeOptions,
  type WorkflowValidationResponse,
} from "../workflow-format";

export interface ExecuteWorkflowPayload {
  workflow: WorkflowDefinition;
  options?: WorkflowRuntimeOptions;
}

export type WorkflowRunStatus = "pending" | "running" | "success" | "failure";

export interface WorkflowRunStepStatus {
  nodeId: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowRunStatusResponse {
  runId: string;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
  workflowName: string;
  archived: boolean;
  steps: WorkflowRunStepStatus[];
  result?: WorkflowExecutionResult;
  error?: string;
}

export type WorkflowRunSummary = Omit<
  WorkflowRunStatusResponse,
  "steps" | "result" | "error"
>;

export type WorkflowRunLogLevel = "info" | "warning" | "error";

export interface WorkflowRunLogEntry {
  id: string;
  sequence: number;
  timestamp: string;
  message: string;
  level: WorkflowRunLogLevel;
  nodeId?: string;
  source?: string;
}

export interface WorkflowRunLogResponse {
  runId: string;
  logs: WorkflowRunLogEntry[];
  nextCursor: number;
}

interface WorkflowRunLogMetadataPayload {
  timestamp?: string;
  level?: string;
  source?: string;
}

interface WorkflowRunLogEntryPayload {
  id: string;
  sequence: number;
  message: string;
  timestamp?: string;
  level?: string;
  nodeId?: string;
  source?: string;
  metadata?: WorkflowRunLogMetadataPayload | null;
}

interface WorkflowRunLogResponsePayload {
  runId: string;
  logs: WorkflowRunLogEntryPayload[];
  nextCursor: number;
}

const LOG_LEVELS: readonly WorkflowRunLogLevel[] = ["info", "warning", "error"] as const;

function normalizeLogLevel(value?: string | null): WorkflowRunLogLevel {
  if (value && LOG_LEVELS.includes(value as WorkflowRunLogLevel)) {
    return value as WorkflowRunLogLevel;
  }
  return "info";
}

function normalizeLogEntry(payload: WorkflowRunLogEntryPayload): WorkflowRunLogEntry {
  const metadata = payload.metadata ?? {};
  const timestamp = metadata.timestamp ?? payload.timestamp ?? new Date().toISOString();
  const source = metadata.source ?? payload.source;
  const level = normalizeLogLevel(metadata.level ?? payload.level);

  return {
    id: payload.id,
    sequence: payload.sequence,
    message: payload.message,
    nodeId: payload.nodeId,
    timestamp,
    level,
    source,
  };
}

export interface ExecuteWorkflowOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  streaming?: boolean;
  pollIntervalMs?: number;
  onStatusUpdate?: (status: WorkflowRunStatusResponse) => void;
  onLogs?: (chunk: WorkflowRunLogResponse) => void;
}

export interface ValidateWorkflowOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

export interface WorkflowRunLogsOptions {
  after?: number;
  signal?: AbortSignal;
  baseUrl?: string;
}

export interface ListWorkflowRunsOptions {
  includeArchived?: boolean;
  signal?: AbortSignal;
  baseUrl?: string;
}

export interface RetryWorkflowRunOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

export interface ArchiveWorkflowRunOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

export interface WorkflowApiErrorPayload {
  valid?: boolean;
  issues?: string[];
  detail?: unknown;
}

export class WorkflowApiError extends Error {
  public readonly status: number;

  public readonly payload?: WorkflowApiErrorPayload;

  constructor(message: string, status: number, payload?: WorkflowApiErrorPayload) {
    super(message);
    this.name = "WorkflowApiError";
    this.status = status;
    this.payload = payload;
  }
}

function resolveBaseUrl(explicit?: string): string {
  if (explicit) {
    return explicit.replace(/\/?$/, "");
  }

  const envBaseUrl = import.meta.env.VITE_WORKFLOW_API_BASE_URL as string | undefined;
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/?$/, "");
  }

  return "http://localhost:8000";
}

async function parseErrorPayload(response: Response): Promise<WorkflowApiErrorPayload | undefined> {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return (await response.json()) as WorkflowApiErrorPayload;
    } catch (error) {
      console.warn("Impossibile analizzare il payload JSON dell'errore", error);
    }
  }

  try {
    const text = await response.text();
    if (text) {
      return { detail: text };
    }
  } catch (error) {
    console.warn("Impossibile leggere il payload dell'errore", error);
  }

  return undefined;
}

async function requestJson<T>(
  endpoint: string,
  init: RequestInit,
  errorContext: string,
): Promise<T> {
  const response = await fetch(endpoint, init);
  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    const issues = errorPayload?.issues;
    const message =
      issues && issues.length > 0
        ? `${errorContext}: ${issues.join("; ")}`
        : `${errorContext} (status ${response.status})`;
    throw new WorkflowApiError(message, response.status, errorPayload);
  }

  return (await response.json()) as T;
}

function buildJsonHeaders(additional?: HeadersInit): HeadersInit {
  return {
    accept: "application/json",
    "content-type": "application/json",
    ...(additional ?? {}),
  };
}

async function waitFor(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    if (signal?.aborted) {
      throw new DOMException("Operazione annullata", "AbortError");
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Operazione annullata", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }
  });
}

export async function executeWorkflow(
  payload: ExecuteWorkflowPayload,
  {
    signal,
    baseUrl,
    streaming = false,
    pollIntervalMs = 1000,
    onStatusUpdate,
    onLogs,
  }: ExecuteWorkflowOptions = {},
): Promise<WorkflowExecutionResult> {
  const endpointBase = resolveBaseUrl(baseUrl);

  if (!streaming) {
    return requestJson<WorkflowExecutionResult>(
      `${endpointBase}/workflow/execute`,
      {
        method: "POST",
        headers: buildJsonHeaders(),
        body: JSON.stringify(payload),
        signal,
      },
      "Impossibile eseguire il workflow",
    );
  }

  const startStatus = await requestJson<WorkflowRunStatusResponse>(
    `${endpointBase}/workflow/runs`,
    {
      method: "POST",
      headers: buildJsonHeaders(),
      body: JSON.stringify(payload),
      signal,
    },
    "Impossibile avviare l'esecuzione del workflow",
  );

  onStatusUpdate?.(startStatus);
  let lastStatus = startStatus;

  if ((startStatus.status === "success" || startStatus.status === "failure") && startStatus.result) {
    return startStatus.result;
  }

  let cursor: number | undefined;

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Operazione annullata", "AbortError");
    }

    const logs = await fetchWorkflowRunLogs(startStatus.runId, { baseUrl, signal, after: cursor });
    cursor = logs.nextCursor;
    onLogs?.(logs);

    if (signal?.aborted) {
      throw new DOMException("Operazione annullata", "AbortError");
    }

    const status = await fetchWorkflowRunStatus(startStatus.runId, { baseUrl, signal });
    onStatusUpdate?.(status);
    lastStatus = status;

    if ((status.status === "success" || status.status === "failure") && status.result) {
      return status.result;
    }

    await waitFor(pollIntervalMs, signal);
  }

  throw new WorkflowApiError("Impossibile ottenere il risultato dell'esecuzione", 500);
}

export async function validateWorkflowDefinition(
  workflow: WorkflowDefinition,
  { signal, baseUrl }: ValidateWorkflowOptions = {},
): Promise<WorkflowValidationResponse> {
  return requestJson<WorkflowValidationResponse>(
    `${resolveBaseUrl(baseUrl)}/workflow/validate`,
    {
      method: "POST",
      headers: buildJsonHeaders(),
      body: JSON.stringify(workflow),
      signal,
    },
    "Impossibile validare il workflow",
  );
}

export async function fetchWorkflowRunStatus(
  runId: string,
  { baseUrl, signal }: RetryWorkflowRunOptions = {},
): Promise<WorkflowRunStatusResponse> {
  const endpoint = `${resolveBaseUrl(baseUrl)}/workflow/runs/${encodeURIComponent(runId)}`;
  return requestJson<WorkflowRunStatusResponse>(
    endpoint,
    {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    },
    "Impossibile ottenere lo stato del workflow",
  );
}

export async function fetchWorkflowRunLogs(
  runId: string,
  { after, baseUrl, signal }: WorkflowRunLogsOptions = {},
): Promise<WorkflowRunLogResponse> {
  const endpoint = new URL(
    `${resolveBaseUrl(baseUrl)}/workflow/runs/${encodeURIComponent(runId)}/logs`,
  );
  if (typeof after === "number") {
    endpoint.searchParams.set("after", String(after));
  }

  const response = await requestJson<WorkflowRunLogResponsePayload>(
    endpoint.toString(),
    {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    },
    "Impossibile recuperare i log dell'esecuzione",
  );

  return {
    runId: response.runId,
    nextCursor: response.nextCursor,
    logs: response.logs.map(normalizeLogEntry),
  };
}

export async function listWorkflowRuns({
  includeArchived = false,
  signal,
  baseUrl,
}: ListWorkflowRunsOptions = {}): Promise<WorkflowRunSummary[]> {
  const endpoint = new URL(`${resolveBaseUrl(baseUrl)}/workflow/runs`);
  if (includeArchived) {
    endpoint.searchParams.set("include_archived", "true");
  }

  return requestJson<WorkflowRunSummary[]>(
    endpoint.toString(),
    {
      method: "GET",
      headers: { accept: "application/json" },
      signal,
    },
    "Impossibile elencare le esecuzioni",
  );
}

export async function retryWorkflowRun(
  runId: string,
  { signal, baseUrl }: RetryWorkflowRunOptions = {},
): Promise<WorkflowRunStatusResponse> {
  const endpoint = `${resolveBaseUrl(baseUrl)}/workflow/runs/${encodeURIComponent(runId)}/retry`;
  return requestJson<WorkflowRunStatusResponse>(
    endpoint,
    {
      method: "POST",
      headers: buildJsonHeaders(),
      signal,
    },
    "Impossibile riavviare l'esecuzione",
  );
}

export async function archiveWorkflowRun(
  runId: string,
  { signal, baseUrl }: ArchiveWorkflowRunOptions = {},
): Promise<WorkflowRunSummary> {
  const endpoint = `${resolveBaseUrl(baseUrl)}/workflow/runs/${encodeURIComponent(runId)}/archive`;
  return requestJson<WorkflowRunSummary>(
    endpoint,
    {
      method: "POST",
      headers: buildJsonHeaders(),
      signal,
    },
    "Impossibile archiviare l'esecuzione",
  );
}

