import type { JSONSchemaType } from "ajv";

export type ComponentParameters = Record<string, unknown>;

export type ComponentSchema = JSONSchemaType<ComponentParameters>;

export type ComponentSchemaMap = Record<string, ComponentSchema>;

export const COMPONENT_SCHEMAS: ComponentSchemaMap = {
  "datapizza.source.dataset": {
    type: "object",
    properties: {
      format: { type: "string", minLength: 1 },
      path: { type: "string", minLength: 1 },
    },
    required: ["format"],
    additionalProperties: false,
  },
  "datapizza.features.build": {
    type: "object",
    properties: {
      encoder: { type: "string", minLength: 1 },
      normalize: { type: "boolean" },
    },
    required: ["encoder"],
    additionalProperties: false,
  },
  "datapizza.training.fit": {
    type: "object",
    properties: {
      algorithm: { type: "string", minLength: 1 },
      maxIterations: { type: "integer", minimum: 1 },
    },
    required: ["algorithm"],
    additionalProperties: false,
  },
  "datapizza.deployment.push": {
    type: "object",
    properties: {
      environment: { type: "string", minLength: 1 },
      strategy: { type: "string", minLength: 1 },
    },
    required: ["environment"],
    additionalProperties: false,
  },
  "datapizza.etl.extract.csv": {
    type: "object",
    properties: {
      delimiter: { type: "string", minLength: 1, maxLength: 1 },
      encoding: { type: "string", minLength: 1 },
    },
    required: ["delimiter"],
    additionalProperties: false,
  },
  "datapizza.etl.transform.clean": {
    type: "object",
    properties: {
      dropNulls: { type: "boolean" },
      deduplicate: { type: "boolean" },
    },
    required: ["dropNulls"],
    additionalProperties: false,
  },
  "datapizza.etl.transform.enrich": {
    type: "object",
    properties: {
      lookup: { type: "string", minLength: 1 },
    },
    required: ["lookup"],
    additionalProperties: false,
  },
  "datapizza.etl.load.warehouse": {
    type: "object",
    properties: {
      table: { type: "string", minLength: 1 },
      mode: { type: "string", minLength: 1 },
    },
    required: ["table"],
    additionalProperties: false,
  },
  "datapizza.orchestrator.cron": {
    type: "object",
    properties: {
      schedule: { type: "string", minLength: 1 },
      timezone: { type: "string", minLength: 1 },
    },
    required: ["schedule"],
    additionalProperties: false,
  },
  "datapizza.orchestrator.branch": {
    type: "object",
    properties: {
      strategy: { type: "string", minLength: 1 },
    },
    required: ["strategy"],
    additionalProperties: false,
  },
  "datapizza.orchestrator.notify": {
    type: "object",
    properties: {
      channel: { type: "string", minLength: 1 },
      priority: { type: "string", minLength: 1 },
    },
    required: ["channel"],
    additionalProperties: false,
  },
  "datapizza.tasks.cleaning": {
    type: "object",
    properties: {
      resource: { type: "string", minLength: 1 },
    },
    required: ["resource"],
    additionalProperties: false,
  },
  "datapizza.tasks.enrichment": {
    type: "object",
    properties: {
      resource: { type: "string", minLength: 1 },
    },
    required: ["resource"],
    additionalProperties: false,
  },
} satisfies ComponentSchemaMap;

export function getComponentSchema(component: string): ComponentSchema | undefined {
  return COMPONENT_SCHEMAS[component];
}
