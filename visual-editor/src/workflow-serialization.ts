import { useWorkflowStore } from "./store/workflow-store";
import {
  WORKFLOW_FORMAT_VERSION,
  fromReactFlowGraph,
  toReactFlowGraph,
  type WorkflowDefinition,
  type WorkflowDefinitionExtensions,
  type WorkflowFormatVersion,
  type WorkflowMetadata,
  type WorkflowReactFlowViewport,
} from "./workflow-format";

export interface SerializeWorkflowFromStoreOptions {
  metadata: WorkflowMetadata;
  version?: WorkflowFormatVersion;
  extensions?: WorkflowDefinitionExtensions;
}

export function serializeWorkflowFromStore({
  metadata,
  version = WORKFLOW_FORMAT_VERSION,
  extensions,
}: SerializeWorkflowFromStoreOptions): WorkflowDefinition {
  const { nodes, edges } = useWorkflowStore.getState();

  return fromReactFlowGraph({
    nodes,
    edges,
    metadata,
    version,
    extensions,
  });
}

export function initializeWorkflowStoreFromDefinition(
  workflow: WorkflowDefinition,
): WorkflowReactFlowViewport | undefined {
  const { initialize } = useWorkflowStore.getState();
  const { nodes, edges, viewport } = toReactFlowGraph(workflow);

  initialize(nodes, edges);

  return viewport;
}
