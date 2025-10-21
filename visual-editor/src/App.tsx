import { useCallback } from "react";
import type { Connection, Edge, Node } from "reactflow";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "./App.css";
import "reactflow/dist/style.css";

const initialNodes: Node[] = [
  {
    id: "start",
    type: "input",
    position: { x: 0, y: 0 },
    data: { label: "Inizio" },
  },
  {
    id: "prepare",
    position: { x: 0, y: 120 },
    data: { label: "Prepara dati" },
  },
  {
    id: "train",
    position: { x: 0, y: 240 },
    data: { label: "Allena modello" },
  },
  {
    id: "deploy",
    type: "output",
    position: { x: 0, y: 380 },
    data: { label: "Deploy" },
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "start", target: "prepare" },
  { id: "e2", source: "prepare", target: "train" },
  { id: "e3", source: "train", target: "deploy" },
];

function App(): JSX.Element {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Edge | Connection) =>
      setEdges((existingEdges) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
          },
          existingEdges,
        ),
      ),
    [setEdges],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>Workflow Visual Editor</h1>
        <p>
          Questo esempio utilizza React Flow per rappresentare un workflow di
          machine learning. Aggiungi nodi e connessioni per modellare i tuoi
          processi.
        </p>
      </header>
      <main className="app__content">
        <ReactFlow
          className="workflow-canvas"
          style={{ width: "100%", height: "100%" }}
          fitView
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap zoomable pannable />
          <Controls showInteractive={false} />
          <Background gap={16} color="#e5e7eb" />
        </ReactFlow>
      </main>
    </div>
  );
}

export default App;
