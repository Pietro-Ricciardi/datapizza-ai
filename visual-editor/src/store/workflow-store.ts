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
  type WorkflowExecutionResult,
  type WorkflowExecutionResultStatus,
  type WorkflowExecutionStep,
} from "../workflow-format";

type WorkflowState = {
  nodes: Node[];
  edges: Edge[];
};

type WorkflowActions = {
  initialize: (nodes: Node[], edges: Edge[]) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection | Edge) => void;
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
  execution: createDefaultExecutionState(),
  initialize: (nodes, edges) =>
    set({
      nodes: nodes.map((node) => ({ ...node })),
      edges: edges.map((edge) => ({ ...edge })),
    }),
  setNodes: (nodes) => set({ nodes: nodes.map((node) => ({ ...node })) }),
  setEdges: (edges) => set({ edges: edges.map((edge) => ({ ...edge })) }),
  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),
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
