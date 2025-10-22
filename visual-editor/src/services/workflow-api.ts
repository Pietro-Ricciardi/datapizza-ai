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

export interface ExecuteWorkflowOptions {
  signal?: AbortSignal;
  baseUrl?: string;
}

export interface ValidateWorkflowOptions {
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

export async function executeWorkflow(
  payload: ExecuteWorkflowPayload,
  { signal, baseUrl }: ExecuteWorkflowOptions = {},
): Promise<WorkflowExecutionResult> {
  const endpoint = `${resolveBaseUrl(baseUrl)}/workflow/execute`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    const issues = errorPayload?.issues;
    const message =
      issues && issues.length > 0
        ? `Impossibile eseguire il workflow: ${issues.join("; ")}`
        : `Impossibile eseguire il workflow (status ${response.status})`;
    throw new WorkflowApiError(message, response.status, errorPayload);
  }

  const data = (await response.json()) as WorkflowExecutionResult;
  return data;
}

export async function validateWorkflowDefinition(
  workflow: WorkflowDefinition,
  { signal, baseUrl }: ValidateWorkflowOptions = {},
): Promise<WorkflowValidationResponse> {
  const endpoint = `${resolveBaseUrl(baseUrl)}/workflow/validate`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(workflow),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    const issues = errorPayload?.issues;
    const message =
      issues && issues.length > 0
        ? `Impossibile validare il workflow: ${issues.join("; ")}`
        : `Impossibile validare il workflow (status ${response.status})`;
    throw new WorkflowApiError(message, response.status, errorPayload);
  }

  const data = (await response.json()) as WorkflowValidationResponse;
  return data;
}
