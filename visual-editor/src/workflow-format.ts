import type { Edge, Node } from "reactflow";

/**
 * Workflow definition version supported by the visual editor. The value is used
 * both in the exported payloads and in the backend contract to guarantee
 * backwards compatibility when the schema evolves.
 */
export const WORKFLOW_FORMAT_VERSION = "datapizza.workflow/v1" as const;
export type WorkflowFormatVersion = typeof WORKFLOW_FORMAT_VERSION;

export type WorkflowNodeKind = "input" | "task" | "output";

/**
 * Metadata describing the workflow independently from its graphical
 * representation. All fields must stay JSON/YAML serialisable to ensure that
 * the format can travel between the frontend editor and the backend executor.
 */
export interface WorkflowMetadata {
  name: string;
  description?: string;
  tags?: string[];
  author?: {
    name: string;
    email?: string;
  };
  externalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowPoint {
  x: number;
  y: number;
}

export interface WorkflowConnector {
  nodeId: string;
  portId?: string;
}

export interface WorkflowNodeDefinition {
  id: string;
  kind: WorkflowNodeKind;
  label: string;
  position: WorkflowPoint;
  /**
   * Arbitrary configuration payload associated with the node. The structure is
   * consumed by the backend executor and must remain serialisable.
   */
  data?: Record<string, unknown>;
}

export interface WorkflowEdgeDefinition {
  id: string;
  source: WorkflowConnector;
  target: WorkflowConnector;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowReactFlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkflowDefinitionExtensions {
  /**
   * Frontend specific settings used to restore the editor UI (e.g. viewport).
   */
  reactFlow?: {
    viewport?: WorkflowReactFlowViewport;
    [key: string]: unknown;
  };
  /** Backend specific hints such as execution targets or scheduling options. */
  backend?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowDefinition {
  version: WorkflowFormatVersion;
  metadata: WorkflowMetadata;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  extensions?: WorkflowDefinitionExtensions;
}

export interface FromReactFlowParams {
  nodes: Node[];
  edges: Edge[];
  metadata: WorkflowMetadata;
  version?: WorkflowFormatVersion;
  extensions?: WorkflowDefinitionExtensions;
}

export interface ToReactFlowResult {
  nodes: Node[];
  edges: Edge[];
  viewport?: WorkflowReactFlowViewport;
}

export interface WorkflowGraphSnapshot {
  nodes: Node[];
  edges: Edge[];
}

const DEFAULT_NODE_TYPE: Node["type"] = "default";

function cloneSerializable<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function toReactFlowGraph(workflow: WorkflowDefinition): ToReactFlowResult {
  const nodes: Node[] = workflow.nodes.map((node) => {
    const nodeData = cloneSerializable(node.data ?? {});
    return {
      id: node.id,
      type:
        node.kind === "input"
          ? "input"
          : node.kind === "output"
          ? "output"
          : DEFAULT_NODE_TYPE,
      position: { ...node.position },
      data: { ...nodeData, label: node.label },
    } satisfies Node;
  });

  const edges: Edge[] = workflow.edges.map((edge) => {
    const metadata = cloneSerializable(edge.metadata ?? {});

    return {
      id: edge.id,
      source: edge.source.nodeId,
      target: edge.target.nodeId,
      sourceHandle: edge.source.portId,
      targetHandle: edge.target.portId,
      data: {
        ...metadata,
        ...(edge.label ? { label: edge.label } : {}),
      },
    } satisfies Edge;
  });

  return {
    nodes,
    edges,
    viewport: workflow.extensions?.reactFlow?.viewport,
  };
}

export function fromReactFlowGraph({
  nodes,
  edges,
  metadata,
  version = WORKFLOW_FORMAT_VERSION,
  extensions,
}: FromReactFlowParams): WorkflowDefinition {
  const workflowNodes: WorkflowNodeDefinition[] = nodes.map((node) => {
    const nodeData = cloneSerializable(node.data ?? {});
    const { label, ...rest } = nodeData as Record<string, unknown> & {
      label?: unknown;
    };

    return {
      id: node.id,
      kind: node.type === "input" ? "input" : node.type === "output" ? "output" : "task",
      label: typeof label === "string" ? label : node.id,
      position: { x: node.position.x, y: node.position.y },
      data: Object.keys(rest).length > 0 ? rest : undefined,
    } satisfies WorkflowNodeDefinition;
  });

  const workflowEdges: WorkflowEdgeDefinition[] = edges.map((edge) => {
    const edgeData = cloneSerializable(edge.data ?? {});
    const { label, ...rest } = edgeData as Record<string, unknown> & {
      label?: unknown;
    };

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
    } satisfies WorkflowEdgeDefinition;
  });

  return {
    version,
    metadata: cloneSerializable(metadata),
    nodes: workflowNodes,
    edges: workflowEdges,
    ...(extensions ? { extensions: cloneSerializable(extensions) } : {}),
  } satisfies WorkflowDefinition;
}

export function isWorkflowDefinition(value: unknown): value is WorkflowDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkflowDefinition>;

  const hasValidMetadata =
    typeof candidate.metadata === "object" &&
    candidate.metadata !== null &&
    typeof (candidate.metadata as WorkflowMetadata).name === "string";

  const hasValidExtensions =
    candidate.extensions === undefined || typeof candidate.extensions === "object";

  return (
    candidate.version === WORKFLOW_FORMAT_VERSION &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges) &&
    hasValidMetadata &&
    hasValidExtensions
  );
}
