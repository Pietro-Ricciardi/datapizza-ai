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

export const useWorkflowStore = create<WorkflowState & WorkflowActions>((set) => ({
  nodes: [],
  edges: [],
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
}));
