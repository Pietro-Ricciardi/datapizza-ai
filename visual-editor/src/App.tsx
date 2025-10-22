import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow } from "reactflow";
import "./App.css";
import "reactflow/dist/style.css";
import {
  WORKFLOW_FORMAT_VERSION,
  type WorkflowDefinition,
  type WorkflowMetadata,
  type WorkflowRuntimeOptions,
} from "./workflow-format";
import { useWorkflowStore } from "./store/workflow-store";
import {
  initializeWorkflowStoreFromDefinition,
  serializeWorkflowFromStore,
} from "./workflow-serialization";
import { createResourceReference } from "./workflow-parameters";
import { executeWorkflow, WorkflowApiError } from "./services/workflow-api";

const workflowMetadata: WorkflowMetadata = {
  name: "ML Pipeline Demo",
  description:
    "Esempio di pipeline di machine learning composto da fasi sequenziali.",
  tags: ["demo", "ml"],
  author: { name: "Datapizza", email: "editor@datapizza.ai" },
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

const statusLabels: Record<string, string> = {
  idle: "In attesa",
  pending: "In coda",
  running: "In esecuzione",
  completed: "Completato",
  failed: "Fallito",
};

function App(): JSX.Element {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const execution = useWorkflowStore((state) => state.execution);
  const startExecution = useWorkflowStore((state) => state.startExecution);
  const completeExecution = useWorkflowStore((state) => state.completeExecution);
  const failExecution = useWorkflowStore((state) => state.failExecution);

  const [runtimeEnvironment, setRuntimeEnvironment] = useState("development");
  const [datasetUri, setDatasetUri] = useState("s3://datasets/ml-pipeline.csv");

  useEffect(() => {
    initializeWorkflowStoreFromDefinition(initialWorkflow);
  }, []);

  const exportWorkflow = useCallback(() => {
    const snapshot = serializeWorkflowFromStore({
      metadata: {
        ...workflowMetadata,
        updatedAt: new Date().toISOString(),
      },
      version: WORKFLOW_FORMAT_VERSION,
    });

    console.info("Workflow serializzato", snapshot);
  }, []);

  const workflowStatusLabel = useMemo(() => {
    if (execution.loading) {
      return "In esecuzione";
    }
    if (execution.status in statusLabels) {
      return statusLabels[execution.status];
    }
    return statusLabels.idle;
  }, [execution.loading, execution.status]);

  const nodeStatuses = useMemo(() => {
    return nodes.map((node) => {
      const step = execution.steps[node.id];
      const status = step?.status ?? (execution.loading ? "pending" : "idle");
      const label = statusLabels[status] ?? statusLabels.idle;
      return {
        id: node.id,
        label: typeof node.data?.label === "string" ? node.data.label : node.id,
        status,
        labelText: label,
        details: step?.details,
      };
    });
  }, [nodes, execution.steps, execution.loading]);

  const runWorkflow = useCallback(async () => {
    startExecution();

    try {
      const snapshot = serializeWorkflowFromStore({
        metadata: {
          ...workflowMetadata,
          updatedAt: new Date().toISOString(),
        },
        version: WORKFLOW_FORMAT_VERSION,
      });

      const trimmedEnvironment = runtimeEnvironment.trim();
      const overrides: Record<string, unknown> = {};
      const trimmedDataset = datasetUri.trim();
      if (trimmedDataset) {
        overrides.dataset = createResourceReference(trimmedDataset);
      }

      const runtimeOptions: WorkflowRuntimeOptions = {};
      if (trimmedEnvironment) {
        runtimeOptions.environment = trimmedEnvironment;
      }
      if (Object.keys(overrides).length > 0) {
        runtimeOptions.configOverrides = overrides;
      }

      const result = await executeWorkflow({
        workflow: snapshot,
        ...(Object.keys(runtimeOptions).length > 0 ? { options: runtimeOptions } : {}),
      });

      completeExecution(result);
    } catch (error) {
      console.error("Errore durante l'esecuzione del workflow", error);
      const message =
        error instanceof WorkflowApiError
          ? error.message
          : "Errore imprevisto durante l'esecuzione del workflow";
      failExecution(message);
    }
  }, [runtimeEnvironment, datasetUri, startExecution, completeExecution, failExecution]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Workflow Visual Editor</h1>
        <p>
          Questo esempio utilizza React Flow per rappresentare un workflow di
          machine learning. Aggiungi nodi e connessioni per modellare i tuoi
          processi e verifica il comportamento del backend mock.
        </p>
        <div className="app__actions">
          <button className="app__export" type="button" onClick={exportWorkflow}>
            Esporta workflow in console
          </button>
        </div>
      </header>
      <main className="app__content">
        <section className="app__canvas">
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
        </section>
        <aside className="app__sidebar">
          <section className="execution-panel">
            <h2>Esegui workflow</h2>
            <p>
              Il backend FastAPI disponibile in <code>/workflow/execute</code>
              consente di testare il caricamento dei parametri e la serializzazione
              completa del workflow.
            </p>
            <div className="execution-panel__controls">
              <label className="execution-panel__label" htmlFor="runtime-environment">
                Ambiente runtime
              </label>
              <input
                id="runtime-environment"
                className="execution-panel__input"
                type="text"
                value={runtimeEnvironment}
                onChange={(event) => setRuntimeEnvironment(event.target.value)}
                placeholder="es. staging"
              />

              <label className="execution-panel__label" htmlFor="dataset-uri">
                Dataset sorgente (URI)
              </label>
              <input
                id="dataset-uri"
                className="execution-panel__input"
                type="text"
                value={datasetUri}
                onChange={(event) => setDatasetUri(event.target.value)}
                placeholder="es. s3://bucket/path"
              />

              <button
                className="execution-panel__run"
                type="button"
                onClick={runWorkflow}
                disabled={execution.loading}
              >
                {execution.loading ? "Esecuzione in corso..." : "Esegui workflow"}
              </button>
              {execution.error ? (
                <p className="execution-panel__error">{execution.error}</p>
              ) : null}
            </div>

            <dl className="execution-panel__meta">
              <div>
                <dt>Stato</dt>
                <dd>{workflowStatusLabel}</dd>
              </div>
              {execution.runId ? (
                <div>
                  <dt>Run ID</dt>
                  <dd>{execution.runId}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="execution-status">
            <h3>Stato dei nodi</h3>
            <ul>
              {nodeStatuses.map((node) => (
                <li
                  key={node.id}
                  className={`execution-status__item execution-status__item--${node.status}`}
                >
                  <div className="execution-status__header">
                    <span className="execution-status__name">{node.label}</span>
                    <span className={`execution-status__badge execution-status__badge--${node.status}`}>
                      {node.labelText}
                    </span>
                  </div>
                  {node.details ? (
                    <p className="execution-status__details">{node.details}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="execution-output">
            <h3>Output esecuzione</h3>
            {execution.outputs ? (
              <pre>{JSON.stringify(execution.outputs, null, 2)}</pre>
            ) : (
              <p>Nessun output disponibile. Avvia un'esecuzione per visualizzare i risultati.</p>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;
