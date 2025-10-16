import { nanoid } from "nanoid/non-secure";
import { create } from "zustand";
import type { Edge, Node } from "reactflow";

export type EditorState = {
  nodes: Node[];
  edges: Edge[];
  addNode: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  nodes: [
    {
      id: "entry",
      type: "input",
      position: { x: 50, y: 150 },
      data: { label: "HTTP Trigger" }
    }
  ],
  edges: [],
  addNode: () =>
    set((state) => {
      const id = nanoid(6);
      const newNode: Node = {
        id,
        position: { x: 250 + state.nodes.length * 40, y: 150 },
        data: { label: `Node ${id}` }
      };

      return { nodes: [...state.nodes, newNode], edges: state.edges };
    })
}));
