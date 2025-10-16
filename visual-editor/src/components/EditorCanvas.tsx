import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type Viewport
} from "reactflow";

import "reactflow/dist/style.css";

export type EditorCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onInit?: (instance: ReactFlowInstance) => void;
};

const backgroundVariant = BackgroundVariant.Dots;
const fitViewOptions = { padding: 0.3 } as const;

export function EditorCanvas({ nodes, edges, onInit }: EditorCanvasProps): React.JSX.Element {
  const defaultViewport = useMemo<Viewport>(
    () => ({ x: 0, y: 0, zoom: 0.85 }),
    []
  );

  return (
    <section className="editor-canvas" aria-label="Editor canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.1}
        maxZoom={2.5}
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        elevateNodesOnSelect
        proOptions={{ hideAttribution: true }}
        onInit={onInit}
      >
        <Background color="#334155" gap={28} variant={backgroundVariant} />
        <MiniMap pannable zoomable />
        <Controls showInteractive />
      </ReactFlow>
    </section>
  );
}
