export type WorkflowParameterPrimitive = string | number | boolean | null;

export type WorkflowParameterValue =
  | WorkflowParameterPrimitive
  | WorkflowParameterValue[]
  | { [key: string]: WorkflowParameterValue }
  | WorkflowResourceReference;

export interface WorkflowResourceReference {
  type: "resource";
  uri: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export function createResourceReference(
  uri: string,
  extras: Omit<WorkflowResourceReference, "uri" | "type"> = {},
): WorkflowResourceReference {
  return {
    type: "resource",
    uri,
    ...(extras.name ? { name: extras.name } : {}),
    ...(extras.description ? { description: extras.description } : {}),
    ...(extras.metadata ? { metadata: { ...extras.metadata } } : {}),
  };
}

export function normaliseParameters(input: unknown): Record<string, WorkflowParameterValue> {
  if (input == null) {
    return {};
  }

  if (input instanceof Map) {
    return Object.fromEntries(
      Array.from(input.entries(), ([key, value]) => [String(key), normaliseParameterValue(value)]),
    );
  }

  if (isPlainObject(input)) {
    const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      normaliseParameterValue(value),
    ]);
    return Object.fromEntries(entries);
  }

  if (Array.isArray(input)) {
    console.warn(
      "I parametri del nodo devono essere rappresentati come oggetto; array posizionali non sono supportati e verranno ignorati.",
    );
    return {};
  }

  console.warn(
    "Tipo di parametro non supportato; verrà restituito un oggetto vuoto.",
    input,
  );
  return {};
}

export function normaliseParameterValue(value: unknown): WorkflowParameterValue {
  if (value == null) {
    return null;
  }

  if (isWorkflowResourceReference(value)) {
    return {
      type: "resource",
      uri: value.uri,
      ...(value.name ? { name: value.name } : {}),
      ...(value.description ? { description: value.description } : {}),
      ...(value.metadata ? { metadata: normaliseObject(value.metadata) } : {}),
    };
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return {
      type: "resource",
      uri: value.name,
      name: value.name,
      metadata: {
        size: value.size,
        contentType: value.type,
      },
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normaliseParameterValue(entry));
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((entry) => normaliseParameterValue(entry));
  }

  if (value instanceof Map) {
    const result: Record<string, WorkflowParameterValue> = {};
    for (const [key, entry] of value.entries()) {
      result[String(key)] = normaliseParameterValue(entry);
    }
    return result;
  }

  if (isPlainObject(value)) {
    return normaliseObject(value as Record<string, unknown>);
  }

  return String(value);
}

export function normaliseNodeData(
  data: Record<string, unknown> | undefined,
): Record<string, WorkflowParameterValue> | undefined {
  if (!data) {
    return undefined;
  }

  const normalisedEntries: [string, WorkflowParameterValue][] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === "parameters") {
      const parameters = normaliseParameters(value);
      if (Object.keys(parameters).length > 0) {
        normalisedEntries.push([key, parameters]);
      } else if (value != null) {
        normalisedEntries.push([key, {}]);
      }
      continue;
    }

    const normalisedValue = normaliseParameterValue(value);
    normalisedEntries.push([key, normalisedValue]);
  }

  if (normalisedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalisedEntries);
}

function normaliseObject(value: Record<string, unknown>): Record<string, WorkflowParameterValue> {
  const result: Record<string, WorkflowParameterValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = normaliseParameterValue(entry);
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

interface WorkflowResourceReferenceLike {
  type?: string;
  kind?: string;
  uri: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

function isWorkflowResourceReference(value: unknown): value is WorkflowResourceReferenceLike {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as WorkflowResourceReferenceLike;
  if (typeof candidate.uri !== "string") {
    return false;
  }

  const marker = candidate.type ?? candidate.kind;
  return marker === "resource";
}
