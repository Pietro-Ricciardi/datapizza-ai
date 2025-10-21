import { useCallback } from "react";
import type { Connection, Edge } from "reactflow";
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
import {
  WORKFLOW_FORMAT_VERSION,
  fromReactFlowGraph,
  toReactFlowGraph,
  type WorkflowDefinition,
  type WorkflowMetadata,
} from "./workflow-format";

const workflowMetadata: WorkflowMetadata = {
  name: "ML Pipeline Demo",
  description:
    "Esempio di pipeline di machine learning composto da fasi sequenziali.",
  tags: ["demo", "ml"],
  author: { name: "Datapizza" },
  createdAt: "2024-01-01T00:00:00.000Z",
};

const initialWorkflow: WorkflowDefinition = {
  version: WORKFLOW_FORMAT_VERSION,
  metadata: workflowMetadata,
  nodes: [
    {
      id: "start",
      kind: "input",
      label: "Inizio",
      position: { x: 0, y: 0 },
    },
    {
      id: "prepare",
      kind: "task",
      label: "Prepara dati",
      position: { x: 0, y: 120 },
      data: {
        component: "datapizza.preprocessing.prepare",
        parameters: { strategy: "standardize" },
      },
    },
    {
      id: "train",
      kind: "task",
      label: "Allena modello",
      position: { x: 0, y: 240 },
      data: {
        component: "datapizza.training.fit",
        parameters: { algorithm: "xgboost" },
      },
    },
    {
      id: "deploy",
      kind: "output",
      label: "Deploy",
      position: { x: 0, y: 380 },
      data: {
        component: "datapizza.deployment.push",
        parameters: { environment: "staging" },
      },
    },
  ],
  edges: [
    { id: "e1", source: { nodeId: "start" }, target: { nodeId: "prepare" } },
    { id: "e2", source: { nodeId: "prepare" }, target: { nodeId: "train" } },
    { id: "e3", source: { nodeId: "train" }, target: { nodeId: "deploy" } },
  ],
};

const { nodes: initialNodes, edges: initialEdges } = toReactFlowGraph(initialWorkflow);

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

  const exportWorkflow = useCallback(() => {
    const snapshot = fromReactFlowGraph({
      nodes,
      edges,
      metadata: {
        ...workflowMetadata,
        updatedAt: new Date().toISOString(),
      },
    });

    console.info("Workflow serializzato", snapshot);
  }, [edges, nodes]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Workflow Visual Editor</h1>
        <p>
          Questo esempio utilizza React Flow per rappresentare un workflow di
          machine learning. Aggiungi nodi e connessioni per modellare i tuoi
          processi.
        </p>
        <button className="app__export" type="button" onClick={exportWorkflow}>
          Esporta workflow in console
        </button>
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
