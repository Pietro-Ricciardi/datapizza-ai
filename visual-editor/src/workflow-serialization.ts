import { useWorkflowStore } from "./store/workflow-store";
import {
  WORKFLOW_FORMAT_VERSION,
  fromReactFlowGraph,
  toReactFlowGraph,
  type WorkflowDefinition,
  type WorkflowDefinitionExtensions,
  type WorkflowFormatVersion,
  type WorkflowMetadata,
  type WorkflowReactFlowSettings,
  type WorkflowValidationResponse,
} from "./workflow-format";

type WorkflowMetadataWithLegacyTags = Omit<WorkflowMetadata, "tags"> & {
  tags?: WorkflowMetadata["tags"] | string;
};

export type WorkflowDefinitionWithArbitraryVersion = Omit<
  WorkflowDefinition,
  "version" | "metadata"
> & {
  version: string;
  metadata: WorkflowMetadataWithLegacyTags;
};

interface WorkflowMigrationStep {
  from: string;
  to: string;
  migrate: (
    workflow: WorkflowDefinitionWithArbitraryVersion,
  ) => WorkflowDefinitionWithArbitraryVersion;
}

const WORKFLOW_MIGRATIONS: Record<string, WorkflowMigrationStep> = {
  "datapizza.workflow/preview": {
    from: "datapizza.workflow/preview",
    to: WORKFLOW_FORMAT_VERSION,
    migrate: (workflow) => {
      const migrated = cloneSerializable(workflow);
      const rawTags = migrated.metadata?.tags as unknown;

      if (Array.isArray(rawTags)) {
        migrated.metadata.tags = rawTags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
      } else if (typeof rawTags === "string") {
        migrated.metadata.tags = rawTags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
      }

      migrated.version = WORKFLOW_FORMAT_VERSION;
      return migrated;
    },
  },
  "datapizza.workflow/v0": {
    from: "datapizza.workflow/v0",
    to: WORKFLOW_FORMAT_VERSION,
    migrate: (workflow) => {
      const migrated = cloneSerializable(workflow);

      migrated.nodes = migrated.nodes.map((node) => ({
        ...node,
        label: typeof node.label === "string" && node.label.trim().length > 0 ? node.label : node.id,
      }));

      migrated.version = WORKFLOW_FORMAT_VERSION;
      return migrated;
    },
  },
};

export interface InitializeWorkflowStoreResult {
  reactFlow?: WorkflowReactFlowSettings;
  workflow: WorkflowDefinition;
}

export interface SerializeWorkflowFromStoreOptions {
  metadata: WorkflowMetadata;
  version?: WorkflowFormatVersion;
  extensions?: WorkflowDefinitionExtensions;
  /**
   * Optional React Flow UI state captured from the editor (e.g. viewport,
   * sidebars) that must be merged back into the workflow extensions when
   * serialising.
   */
  reactFlow?: WorkflowReactFlowSettings;
}

export function serializeWorkflowFromStore({
  metadata,
  version = WORKFLOW_FORMAT_VERSION,
  extensions,
  reactFlow,
}: SerializeWorkflowFromStoreOptions): WorkflowDefinition {
  const { nodes, edges } = useWorkflowStore.getState();

  return fromReactFlowGraph({
    nodes,
    edges,
    metadata,
    version,
    extensions: mergeExtensionsWithReactFlow(extensions, reactFlow),
  });
}

export function initializeWorkflowStoreFromDefinition(
  workflow: WorkflowDefinitionWithArbitraryVersion,
): InitializeWorkflowStoreResult {
  const migratedWorkflow = ensureWorkflowFormatVersion(workflow);
  const { initialize } = useWorkflowStore.getState();
  const { nodes, edges, reactFlow } = toReactFlowGraph(migratedWorkflow);

  initialize(nodes, edges);

  return { reactFlow, workflow: migratedWorkflow };
}

export function ensureWorkflowFormatVersion(
  workflow: WorkflowDefinitionWithArbitraryVersion,
): WorkflowDefinition {
  if (workflow.version === WORKFLOW_FORMAT_VERSION) {
    return cloneSerializable(workflow) as WorkflowDefinition;
  }

  const visited = new Set<string>();
  let current = cloneSerializable(workflow);

  while (current.version !== WORKFLOW_FORMAT_VERSION) {
    if (visited.has(current.version)) {
      throw new Error(`Rilevato ciclo di migrazione per la versione ${current.version}`);
    }
    visited.add(current.version);

    const step = WORKFLOW_MIGRATIONS[current.version];

    if (!step) {
      console.warn(
        `Nessuna migrazione disponibile per ${current.version}. Il workflow verrà forzato alla versione supportata ${WORKFLOW_FORMAT_VERSION}.`,
      );
      current.version = WORKFLOW_FORMAT_VERSION;
      break;
    }

    current = step.migrate(current);
  }

  return cloneSerializable({ ...current, version: WORKFLOW_FORMAT_VERSION }) as WorkflowDefinition;
}

export function validateWorkflowLocally(workflow: WorkflowDefinition): WorkflowValidationResponse {
  const issues: string[] = [];

  if (!workflow.metadata?.name || workflow.metadata.name.trim().length === 0) {
    issues.push("metadata.name: deve essere una stringa non vuota");
  }

  if (workflow.metadata?.tags) {
    const invalidTags = workflow.metadata.tags.filter((tag) => !tag || tag.trim().length === 0);
    if (invalidTags.length > 0) {
      issues.push("metadata.tags: non sono ammessi tag vuoti");
    }
  }

  const nodeIds = new Set<string>();

  workflow.nodes.forEach((node, index) => {
    if (!node.id || node.id.trim().length === 0) {
      issues.push(`nodes[${index}].id: deve essere una stringa non vuota`);
    } else if (nodeIds.has(node.id)) {
      issues.push(`nodes[${index}].id: duplicato "${node.id}"`);
    } else {
      nodeIds.add(node.id);
    }

    if (!node.label || node.label.trim().length === 0) {
      issues.push(`nodes[${index}].label: deve essere una stringa non vuota`);
    }

    if (!["input", "task", "output"].includes(node.kind)) {
      issues.push(`nodes[${index}].kind: valore non supportato "${node.kind}"`);
    }

    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) {
      issues.push(`nodes[${index}].position: coordinate non valide`);
    }
  });

  workflow.edges.forEach((edge, index) => {
    if (!edge.id || edge.id.trim().length === 0) {
      issues.push(`edges[${index}].id: deve essere una stringa non vuota`);
    }

    if (!edge.source?.nodeId || edge.source.nodeId.trim().length === 0) {
      issues.push(`edges[${index}].source.nodeId: deve essere una stringa non vuota`);
    } else if (!nodeIds.has(edge.source.nodeId)) {
      issues.push(`edges[${index}].source.nodeId: riferimento a nodo sconosciuto "${edge.source.nodeId}"`);
    }

    if (!edge.target?.nodeId || edge.target.nodeId.trim().length === 0) {
      issues.push(`edges[${index}].target.nodeId: deve essere una stringa non vuota`);
    } else if (!nodeIds.has(edge.target.nodeId)) {
      issues.push(`edges[${index}].target.nodeId: riferimento a nodo sconosciuto "${edge.target.nodeId}"`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

function cloneSerializable<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeExtensionsWithReactFlow(
  extensions: WorkflowDefinitionExtensions | undefined,
  reactFlow: WorkflowReactFlowSettings | undefined,
): WorkflowDefinitionExtensions | undefined {
  if (!extensions && !reactFlow) {
    return undefined;
  }

  const baseExtensions = extensions ? cloneSerializable(extensions) : {};

  if (reactFlow) {
    const mergedReactFlow = {
      ...(baseExtensions.reactFlow ?? {}),
      ...cloneSerializable(reactFlow),
    };

    baseExtensions.reactFlow = mergedReactFlow;
  }

  return baseExtensions;
}
