import type { Edge, Node } from "reactflow";

export const WORKFLOW_FORMAT_VERSION = "datapizza.workflow/v1" as const;

export type WorkflowNodeKind = "input" | "task" | "output";

export interface WorkflowMetadata {
  name: string;
  description?: string;
  tags?: string[];
  author?: {
    name: string;
    email?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowPoint {
  x: number;
  y: number;
}

export interface WorkflowNodeDefinition {
  id: string;
  kind: WorkflowNodeKind;
  label: string;
  position: WorkflowPoint;
  data?: Record<string, unknown>;
}

export interface WorkflowConnector {
  nodeId: string;
  portId?: string;
}

export interface WorkflowEdgeDefinition {
  id: string;
  source: WorkflowConnector;
  target: WorkflowConnector;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  version: typeof WORKFLOW_FORMAT_VERSION;
  metadata: WorkflowMetadata;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
}

export interface FromReactFlowParams {
  nodes: Node[];
  edges: Edge[];
  metadata: WorkflowMetadata;
  version?: typeof WORKFLOW_FORMAT_VERSION;
}

export interface ToReactFlowResult {
  nodes: Node[];
  edges: Edge[];
}

export function toReactFlowGraph(workflow: WorkflowDefinition): ToReactFlowResult {
  const nodes: Node[] = workflow.nodes.map((node) => ({
    id: node.id,
    type: node.kind === "input" ? "input" : node.kind === "output" ? "output" : "default",
    position: { ...node.position },
    data: { ...(node.data ?? {}), label: node.label },
  }));

  const edges: Edge[] = workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source.nodeId,
    target: edge.target.nodeId,
    sourceHandle: edge.source.portId,
    targetHandle: edge.target.portId,
    data: {
      ...(edge.metadata ?? {}),
      ...(edge.label ? { label: edge.label } : {}),
    },
  }));

  return { nodes, edges };
}

export function fromReactFlowGraph({
  nodes,
  edges,
  metadata,
  version = WORKFLOW_FORMAT_VERSION,
}: FromReactFlowParams): WorkflowDefinition {
  const workflowNodes: WorkflowNodeDefinition[] = nodes.map((node) => {
    const nodeData = (node.data ?? {}) as Record<string, unknown> & {
      label?: unknown;
    };

    const { label, ...rest } = nodeData;

    return {
      id: node.id,
      kind: node.type === "input" ? "input" : node.type === "output" ? "output" : "task",
      label: typeof label === "string" ? label : node.id,
      position: { x: node.position.x, y: node.position.y },
      data: Object.keys(rest).length > 0 ? rest : undefined,
    };
  });

  const workflowEdges: WorkflowEdgeDefinition[] = edges.map((edge) => {
    const edgeData = (edge.data ?? {}) as Record<string, unknown> & {
      label?: unknown;
    };

    const { label, ...rest } = edgeData;

    return {
      id: edge.id,
      source: {
        nodeId: edge.source,
        portId: edge.sourceHandle ?? undefined,
      },
      target: {
        nodeId: edge.target,
        portId: edge.targetHandle ?? undefined,
      },
      label: typeof label === "string" ? label : undefined,
      metadata: Object.keys(rest).length > 0 ? rest : undefined,
    };
  });

  return {
    version,
    metadata,
    nodes: workflowNodes,
    edges: workflowEdges,
  };
}

export function isWorkflowDefinition(value: unknown): value is WorkflowDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkflowDefinition>;
  return (
    candidate.version === WORKFLOW_FORMAT_VERSION &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges) &&
    typeof candidate.metadata === "object" &&
    candidate.metadata !== null &&
    typeof (candidate.metadata as WorkflowMetadata).name === "string"
  );
}
