import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "reactflow";
import {
  type WorkflowNodeKind,
  type WorkflowExecutionResult,
  type WorkflowExecutionResultStatus,
  type WorkflowExecutionStep,
} from "../workflow-format";

type WorkflowState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
};

type WorkflowActions = {
  initialize: (nodes: Node[], edges: Edge[]) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection | Edge) => void;
  selectNode: (nodeId: string | undefined) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodeKind: (nodeId: string, kind: WorkflowNodeKind) => void;
  updateNodeParameters: (
    nodeId: string,
    parameters: Record<string, unknown> | undefined,
  ) => void;
};

type WorkflowExecutionStatus = WorkflowExecutionResultStatus | "idle";

interface WorkflowExecutionContext {
  runId?: string;
  status: WorkflowExecutionStatus;
  loading: boolean;
  error?: string;
  steps: Record<string, WorkflowExecutionStep>;
  outputs?: Record<string, unknown>;
}

type WorkflowExecutionActions = {
  startExecution: () => void;
  completeExecution: (result: WorkflowExecutionResult) => void;
  failExecution: (message: string) => void;
  resetExecution: () => void;
};

type WorkflowExecutionState = {
  execution: WorkflowExecutionContext;
};

const createDefaultExecutionState = (): WorkflowExecutionContext => ({
  runId: undefined,
  status: "idle",
  loading: false,
  error: undefined,
  steps: {},
  outputs: undefined,
});

export const useWorkflowStore = create<
  WorkflowState & WorkflowActions & WorkflowExecutionState & WorkflowExecutionActions
>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: undefined,
  execution: createDefaultExecutionState(),
  initialize: (nodes, edges) =>
    set({
      nodes: nodes.map((node) => ({ ...node })),
      edges: edges.map((edge) => ({ ...edge })),
      selectedNodeId: undefined,
    }),
  setNodes: (nodes) =>
    set((state) => ({
      nodes: nodes.map((node) => ({ ...node })),
      selectedNodeId: state.selectedNodeId &&
        nodes.some((node) => node.id === state.selectedNodeId)
        ? state.selectedNodeId
        : undefined,
    })),
  setEdges: (edges) => set({ edges: edges.map((edge) => ({ ...edge })) }),
  onNodesChange: (changes) =>
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.nodes);
      const selectionStillValid =
        state.selectedNodeId !== undefined &&
        nextNodes.some((node) => node.id === state.selectedNodeId);

      return {
        nodes: nextNodes,
        selectedNodeId: selectionStillValid ? state.selectedNodeId : undefined,
      };
    }),
  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: "smoothstep",
          animated: true,
        },
        state.edges,
      ),
    })),
  selectNode: (nodeId) =>
    set(() => ({
      selectedNodeId: nodeId,
    })),
  updateNodeLabel: (nodeId, label) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                label,
              },
            }
          : node,
      ),
    })),
  updateNodeKind: (nodeId, kind) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              type: mapWorkflowKindToNodeType(kind),
            }
          : node,
      ),
    })),
  updateNodeParameters: (nodeId, parameters) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: updateNodeParametersData(node.data, parameters),
            }
          : node,
      ),
    })),
  startExecution: () =>
    set((state) => {
      const pendingSteps: Record<string, WorkflowExecutionStep> = {};
      state.nodes.forEach((node) => {
        pendingSteps[node.id] = {
          nodeId: node.id,
          status: "pending",
        };
      });

      return {
        execution: {
          runId: undefined,
          status: "idle",
          loading: true,
          error: undefined,
          outputs: undefined,
          steps: pendingSteps,
        },
      };
    }),
  completeExecution: (result) =>
    set((state) => {
      const steps = { ...state.execution.steps };
      result.steps.forEach((step) => {
        steps[step.nodeId] = step;
      });

      return {
        execution: {
          runId: result.runId,
          status: result.status,
          loading: false,
          error: undefined,
          outputs: result.outputs,
          steps,
        },
      };
    }),
  failExecution: (message) =>
    set((state) => ({
      execution: {
        ...state.execution,
        loading: false,
        status: "failure",
        error: message,
      },
    })),
  resetExecution: () => set({ execution: createDefaultExecutionState() }),
}));

function mapWorkflowKindToNodeType(kind: WorkflowNodeKind): Node["type"] {
  switch (kind) {
    case "input":
      return "input";
    case "output":
      return "output";
    default:
      return "default";
  }
}

function updateNodeParametersData(
  data: Node["data"] | undefined,
  parameters: Record<string, unknown> | undefined,
): Node["data"] {
  const baseData = { ...((data ?? {}) as Record<string, unknown>) };

  if (parameters === undefined) {
    delete baseData.parameters;
    return baseData;
  }

  baseData.parameters = cloneSerializable(parameters);
  return baseData;
}

function cloneSerializable<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
