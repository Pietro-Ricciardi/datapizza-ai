import React from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node
} from "reactflow";

import "reactflow/dist/style.css";

export type EditorCanvasProps = {
  nodes: Node[];
  edges: Edge[];
};

export function EditorCanvas({ nodes, edges }: EditorCanvasProps): React.JSX.Element {
  return (
    <section className="editor-canvas" aria-label="Editor canvas">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <MiniMap />
        <Controls showInteractive={false} />
      </ReactFlow>
    </section>
  );
}
