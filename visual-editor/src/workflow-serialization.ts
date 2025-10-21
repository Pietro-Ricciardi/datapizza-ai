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
} from "./workflow-format";

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
  workflow: WorkflowDefinition,
): WorkflowReactFlowSettings | undefined {
  const { initialize } = useWorkflowStore.getState();
  const { nodes, edges, reactFlow } = toReactFlowGraph(workflow);

  initialize(nodes, edges);

  return reactFlow;
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
