import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

type ThemeMode = "light" | "dark";

const getPreferredTheme = (): ThemeMode => {
  if (typeof window !== "undefined") {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (prefersDark?.matches) {
      return "dark";
    }
  }
  return "light";
};

type SidebarSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
};

function SidebarSection({ title, description, children, id }: SidebarSectionProps) {
  return (
    <section className="sidebar-section" id={id}>
      <header className="sidebar-section__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="sidebar-section__body">{children}</div>
    </section>
  );
}

type AppHeaderProps = {
  onExport: () => void;
  onToggleTheme: () => void;
  theme: ThemeMode;
};

function AppHeader({ onExport, onToggleTheme, theme }: AppHeaderProps) {
  return (
    <header className="app__header" role="banner">
      <div className="app__header-layout">
        <div className="app__header-copy">
          <h1>Workflow Visual Editor</h1>
          <p>
            Crea, orchestra e testa pipeline di machine learning con un canvas
            interattivo e pannelli contestuali pensati per team data-driven.
          </p>
        </div>
        <div className="app__header-actions">
          <button className="button button--ghost" type="button" onClick={onToggleTheme}>
            Modalità {theme === "light" ? "scura" : "chiara"}
          </button>
          <button className="button button--primary" type="button" onClick={onExport}>
            Esporta workflow
          </button>
        </div>
      </div>
    </header>
  );
}

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
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());

  useEffect(() => {
    initializeWorkflowStoreFromDefinition(initialWorkflow);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(listener);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", listener);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(listener);
      }
    };
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

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  return (
    <div className="app" data-theme={theme}>
      <AppHeader
        onExport={exportWorkflow}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      <main className="app__layout">
        <section className="app__canvas" aria-label="Canvas del workflow">
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
            <Background gap={16} color="var(--color-border-subtle)" />
          </ReactFlow>
        </section>
        <aside className="app__sidebar" aria-label="Pannello laterale del workflow">
          <SidebarSection
            id="workflow-runner"
            title="Esegui workflow"
            description="Invia il grafo corrente al backend FastAPI per verificarne la serializzazione e le opzioni runtime."
          >
            <div className="form-grid">
              <label className="form-field" htmlFor="runtime-environment">
                <span className="form-field__label">Ambiente runtime</span>
                <input
                  id="runtime-environment"
                  className="form-field__input"
                  type="text"
                  value={runtimeEnvironment}
                  onChange={(event) => setRuntimeEnvironment(event.target.value)}
                  placeholder="es. staging"
                  autoComplete="off"
                />
              </label>
              <label className="form-field" htmlFor="dataset-uri">
                <span className="form-field__label">Dataset sorgente (URI)</span>
                <input
                  id="dataset-uri"
                  className="form-field__input"
                  type="text"
                  value={datasetUri}
                  onChange={(event) => setDatasetUri(event.target.value)}
                  placeholder="es. s3://bucket/path"
                  autoComplete="off"
                />
              </label>
              <button
                className="button button--accent"
                type="button"
                onClick={runWorkflow}
                disabled={execution.loading}
              >
                {execution.loading ? "Esecuzione in corso..." : "Esegui workflow"}
              </button>
            </div>
            {execution.error ? (
              <p className="inline-feedback inline-feedback--error">{execution.error}</p>
            ) : null}
            <dl className="meta-grid">
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
          </SidebarSection>

          <SidebarSection title="Stato dei nodi">
            <ul className="status-list">
              {nodeStatuses.map((node) => (
                <li
                  key={node.id}
                  className={`status-list__item status-list__item--${node.status}`}
                >
                  <div className="status-list__header">
                    <span className="status-list__name">{node.label}</span>
                    <span className={`status-badge status-badge--${node.status}`}>
                      {node.labelText}
                    </span>
                  </div>
                  {node.details ? (
                    <p className="status-list__details">{node.details}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Output esecuzione">
            {execution.outputs ? (
              <pre className="code-block">{JSON.stringify(execution.outputs, null, 2)}</pre>
            ) : (
              <p className="muted-copy">
                Nessun output disponibile. Avvia un'esecuzione per visualizzare i
                risultati.
              </p>
            )}
          </SidebarSection>
        </aside>
      </main>
    </div>
  );
}

export default App;
