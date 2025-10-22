import {
  WORKFLOW_FORMAT_VERSION,
  type WorkflowDefinition,
  type WorkflowMetadata,
  type WorkflowNodeKind,
} from "../workflow-format";

export type WorkflowTemplateCategory = "ml" | "etl" | "orchestration";

export interface WorkflowTemplateRuntimeDefaults {
  environment?: string;
  datasetUri?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkflowTemplateCategory;
  icon: string;
  definition: WorkflowDefinition;
  runtimeDefaults?: WorkflowTemplateRuntimeDefaults;
}

export interface NodeTemplate {
  id: string;
  label: string;
  kind: WorkflowNodeKind;
  description: string;
  icon: string;
  category: WorkflowTemplateCategory;
  data?: Record<string, unknown>;
  tags?: string[];
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: "dataset-loader",
    label: "Carica dataset",
    kind: "input",
    description: "Legge dati grezzi da bucket S3 o data lake.",
    icon: "🗂️",
    category: "ml",
    tags: ["ml", "dataset", "ingestion"],
    data: {
      component: "datapizza.source.dataset",
      parameters: { format: "parquet" },
    },
  },
  {
    id: "feature-engineering",
    label: "Feature engineering",
    kind: "task",
    description: "Applica trasformazioni e scaling alle feature numeriche.",
    icon: "🧮",
    category: "ml",
    tags: ["ml", "features", "preprocessing"],
    data: {
      component: "datapizza.features.build",
      parameters: { encoder: "onehot" },
    },
  },
  {
    id: "model-training",
    label: "Training modello",
    kind: "task",
    description: "Allena un modello supervisionato su dataset curato.",
    icon: "🤖",
    category: "ml",
    tags: ["ml", "training", "model"],
    data: {
      component: "datapizza.training.fit",
      parameters: { algorithm: "lightgbm" },
    },
  },
  {
    id: "model-serving",
    label: "Servizio modello",
    kind: "output",
    description: "Distribuisce il modello allenato su endpoint managed.",
    icon: "🚀",
    category: "ml",
    tags: ["ml", "serving", "deployment"],
    data: {
      component: "datapizza.deployment.push",
      parameters: { environment: "production" },
    },
  },
  {
    id: "extract-csv",
    label: "Estrai CSV",
    kind: "input",
    description: "Recupera file CSV da storage esterno.",
    icon: "📥",
    category: "etl",
    tags: ["etl", "csv", "ingestion"],
    data: {
      component: "datapizza.etl.extract.csv",
      parameters: { delimiter: ";" },
    },
  },
  {
    id: "transform-clean",
    label: "Pulizia record",
    kind: "task",
    description: "Normalizza e filtra record duplicati prima del load.",
    icon: "🧹",
    category: "etl",
    tags: ["etl", "cleaning", "quality"],
    data: {
      component: "datapizza.etl.transform.clean",
      parameters: { dropNulls: true },
    },
  },
  {
    id: "load-warehouse",
    label: "Carica in warehouse",
    kind: "output",
    description: "Scrive i dati trasformati su un data warehouse.",
    icon: "🏛️",
    category: "etl",
    tags: ["etl", "warehouse", "load"],
    data: {
      component: "datapizza.etl.load.warehouse",
      parameters: { table: "analytics.events" },
    },
  },
  {
    id: "schedule-dag",
    label: "Pianifica DAG",
    kind: "input",
    description: "Nodo iniziale cron per orchestrare pipeline complesse.",
    icon: "🕒",
    category: "orchestration",
    tags: ["orchestration", "schedule", "cron"],
    data: {
      component: "datapizza.orchestrator.cron",
      parameters: { schedule: "0 * * * *" },
    },
  },
  {
    id: "trigger-branch",
    label: "Trigger branch",
    kind: "task",
    description: "Attiva esecuzioni parallele su rami condizionali.",
    icon: "🌿",
    category: "orchestration",
    tags: ["orchestration", "branch", "events"],
    data: {
      component: "datapizza.orchestrator.branch",
      parameters: { strategy: "fan-out" },
    },
  },
  {
    id: "notify-team",
    label: "Notifica team",
    kind: "output",
    description: "Invia notifiche Slack/Email a fine job.",
    icon: "📣",
    category: "orchestration",
    tags: ["orchestration", "notification", "communication"],
    data: {
      component: "datapizza.orchestrator.notify",
      parameters: { channel: "#data-platform" },
    },
  },
];

const normalizeText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export interface TemplateCatalogFilterState {
  searchQuery: string;
  selectedTags: string[];
}

const matchesSearch = (fields: string[], query: string): boolean => {
  if (!query) {
    return true;
  }
  const normalizedQuery = normalizeText(query);
  return fields.some((field) => normalizeText(field).includes(normalizedQuery));
};

const matchesTags = (tags: string[], selectedTags: string[]): boolean => {
  if (selectedTags.length === 0) {
    return true;
  }
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  return selectedTags.every((tag) => tagSet.has(tag.toLowerCase()));
};

export const getWorkflowTemplateTags = (template: WorkflowTemplate): string[] => {
  const tags = new Set<string>();
  tags.add(template.category);
  const metadataTags = template.definition.metadata.tags ?? [];
  metadataTags.forEach((tag) => tags.add(tag));
  return Array.from(tags);
};

export const getNodeTemplateTags = (template: NodeTemplate): string[] => {
  const tags = new Set<string>();
  tags.add(template.category);
  template.tags?.forEach((tag) => tags.add(tag));
  return Array.from(tags);
};

export function filterWorkflowTemplates(
  templates: WorkflowTemplate[],
  { searchQuery, selectedTags }: TemplateCatalogFilterState,
): WorkflowTemplate[] {
  return templates.filter((template) => {
    const tags = getWorkflowTemplateTags(template);
    const searchableFields = [template.name, template.description];
    return matchesSearch(searchableFields, searchQuery) && matchesTags(tags, selectedTags);
  });
}

export function filterNodeTemplates(
  templates: NodeTemplate[],
  { searchQuery, selectedTags }: TemplateCatalogFilterState,
): NodeTemplate[] {
  return templates.filter((template) => {
    const tags = getNodeTemplateTags(template);
    const searchableFields = [template.label, template.description];
    return matchesSearch(searchableFields, searchQuery) && matchesTags(tags, selectedTags);
  });
}

export function getTemplateCatalogTags(
  templates: WorkflowTemplate[],
  nodeTemplates: NodeTemplate[],
): Map<string, number> {
  const tagCount = new Map<string, number>();
  const register = (tag: string) => {
    const normalized = tag.toLowerCase();
    tagCount.set(normalized, (tagCount.get(normalized) ?? 0) + 1);
  };

  templates.forEach((template) => {
    getWorkflowTemplateTags(template).forEach(register);
  });
  nodeTemplates.forEach((template) => {
    getNodeTemplateTags(template).forEach(register);
  });

  return tagCount;
}

const createTemplateDefinition = (
  metadata: WorkflowMetadata,
  nodes: WorkflowDefinition["nodes"],
  edges: WorkflowDefinition["edges"],
): WorkflowDefinition => ({
  version: WORKFLOW_FORMAT_VERSION,
  metadata,
  nodes,
  edges,
});

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "ml-standard-pipeline",
    name: "Pipeline ML supervisionata",
    description:
      "Pipeline end-to-end con preparazione feature, training e deploy in staging.",
    category: "ml",
    icon: "🤖",
    runtimeDefaults: {
      environment: "staging",
      datasetUri: "s3://datasets/ml/pipeline.csv",
    },
    definition: createTemplateDefinition(
      {
        name: "ML Pipeline Demo",
        description:
          "Esempio di pipeline di machine learning composto da fasi sequenziali.",
        tags: ["demo", "ml"],
        category: "ml",
        icon: "🤖",
        author: { name: "Datapizza", email: "editor@datapizza.ai" },
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      [
        {
          id: "start",
          kind: "input",
          label: "Inizio",
          position: { x: -120, y: 0 },
        },
        {
          id: "prepare",
          kind: "task",
          label: "Prepara dati",
          position: { x: -120, y: 120 },
          data: {
            component: "datapizza.preprocessing.prepare",
            parameters: { strategy: "standardize" },
          },
        },
        {
          id: "train",
          kind: "task",
          label: "Allena modello",
          position: { x: -120, y: 240 },
          data: {
            component: "datapizza.training.fit",
            parameters: { algorithm: "xgboost" },
          },
        },
        {
          id: "evaluate",
          kind: "task",
          label: "Valuta modello",
          position: { x: -120, y: 360 },
          data: {
            component: "datapizza.evaluation.metrics",
            parameters: { metric: "f1" },
          },
        },
        {
          id: "deploy",
          kind: "output",
          label: "Deploy",
          position: { x: -120, y: 500 },
          data: {
            component: "datapizza.deployment.push",
            parameters: { environment: "staging" },
          },
        },
      ],
      [
        { id: "e1", source: { nodeId: "start" }, target: { nodeId: "prepare" } },
        { id: "e2", source: { nodeId: "prepare" }, target: { nodeId: "train" } },
        { id: "e3", source: { nodeId: "train" }, target: { nodeId: "evaluate" } },
        { id: "e4", source: { nodeId: "evaluate" }, target: { nodeId: "deploy" } },
      ],
    ),
  },
  {
    id: "etl-daily-refresh",
    name: "ETL refresh giornaliero",
    description:
      "Job notturno per ingestione CSV, normalizzazione e scrittura su warehouse.",
    category: "etl",
    icon: "🛠️",
    runtimeDefaults: {
      environment: "production",
      datasetUri: "s3://landing-zone/daily-export.csv",
    },
    definition: createTemplateDefinition(
      {
        name: "ETL Batch",
        description:
          "Processo ETL giornaliero con estrazione da storage e load in warehouse.",
        tags: ["etl", "batch"],
        category: "etl",
        icon: "🛠️",
        author: { name: "Datapizza", email: "dataops@datapizza.ai" },
        createdAt: "2024-02-12T07:00:00.000Z",
      },
      [
        {
          id: "extract",
          kind: "input",
          label: "Estrai CSV",
          position: { x: 0, y: 0 },
          data: {
            component: "datapizza.etl.extract.csv",
            parameters: { delimiter: "," },
          },
        },
        {
          id: "clean",
          kind: "task",
          label: "Pulisci record",
          position: { x: 0, y: 140 },
          data: {
            component: "datapizza.etl.transform.clean",
            parameters: { dropNulls: true, deduplicate: true },
          },
        },
        {
          id: "enrich",
          kind: "task",
          label: "Arricchisci",
          position: { x: 0, y: 280 },
          data: {
            component: "datapizza.etl.transform.enrich",
            parameters: { lookup: "dim.customers" },
          },
        },
        {
          id: "load",
          kind: "output",
          label: "Carica warehouse",
          position: { x: 0, y: 420 },
          data: {
            component: "datapizza.etl.load.warehouse",
            parameters: { table: "mart.daily_metrics" },
          },
        },
      ],
      [
        { id: "etl-1", source: { nodeId: "extract" }, target: { nodeId: "clean" } },
        { id: "etl-2", source: { nodeId: "clean" }, target: { nodeId: "enrich" } },
        { id: "etl-3", source: { nodeId: "enrich" }, target: { nodeId: "load" } },
      ],
    ),
  },
  {
    id: "orchestration-event-driven",
    name: "Orchestrazione event-driven",
    description:
      "Gestisce fan-out condizionale e notifiche al termine di pipeline orchestrate.",
    category: "orchestration",
    icon: "🪄",
    runtimeDefaults: {
      environment: "development",
      datasetUri: "",
    },
    definition: createTemplateDefinition(
      {
        name: "Event Driven DAG",
        description:
          "Workflow di orchestrazione che reagisce ad eventi e notifica il team.",
        tags: ["orchestration", "events"],
        category: "orchestration",
        icon: "🪄",
        author: { name: "Datapizza", email: "platform@datapizza.ai" },
        createdAt: "2024-03-05T12:00:00.000Z",
      },
      [
        {
          id: "schedule",
          kind: "input",
          label: "Schedulatore",
          position: { x: -200, y: 0 },
          data: {
            component: "datapizza.orchestrator.cron",
            parameters: { schedule: "*/30 * * * *" },
          },
        },
        {
          id: "trigger",
          kind: "task",
          label: "Trigger eventi",
          position: { x: 0, y: 0 },
          data: {
            component: "datapizza.orchestrator.branch",
            parameters: { strategy: "conditional" },
          },
        },
        {
          id: "branch-a",
          kind: "task",
          label: "Branch A",
          position: { x: 200, y: -120 },
          data: {
            component: "datapizza.tasks.cleaning",
            parameters: { resource: "queue-a" },
          },
        },
        {
          id: "branch-b",
          kind: "task",
          label: "Branch B",
          position: { x: 200, y: 120 },
          data: {
            component: "datapizza.tasks.enrichment",
            parameters: { resource: "queue-b" },
          },
        },
        {
          id: "notify",
          kind: "output",
          label: "Notifica finale",
          position: { x: 400, y: 0 },
          data: {
            component: "datapizza.orchestrator.notify",
            parameters: { channel: "#data-platform" },
          },
        },
      ],
      [
        { id: "orc-1", source: { nodeId: "schedule" }, target: { nodeId: "trigger" } },
        { id: "orc-2", source: { nodeId: "trigger" }, target: { nodeId: "branch-a" } },
        { id: "orc-3", source: { nodeId: "trigger" }, target: { nodeId: "branch-b" } },
        { id: "orc-4", source: { nodeId: "branch-a" }, target: { nodeId: "notify" } },
        { id: "orc-5", source: { nodeId: "branch-b" }, target: { nodeId: "notify" } },
      ],
    ),
  },
];

export const WORKFLOW_TEMPLATE_CATEGORIES: Record<
  WorkflowTemplateCategory,
  { label: string; description: string }
> = {
  ml: {
    label: "Machine Learning",
    description: "Addestra, valuta e distribuisci modelli supervisionati.",
  },
  etl: {
    label: "ETL",
    description: "Estrai, trasforma e carica dataset su storage analitici.",
  },
  orchestration: {
    label: "Orchestrazione",
    description: "Coordina job paralleli, scheduling e notifiche di piattaforma.",
  },
};

export function groupNodeTemplatesByCategory(
  templates: NodeTemplate[] = NODE_TEMPLATES,
): Record<WorkflowTemplateCategory, NodeTemplate[]> {
  return templates.reduce<Record<WorkflowTemplateCategory, NodeTemplate[]>>(
    (accumulator, template) => {
      const bucket = accumulator[template.category] ?? [];
      bucket.push(template);
      accumulator[template.category] = bucket;
      return accumulator;
    },
    { ml: [], etl: [], orchestration: [] },
  );
}
