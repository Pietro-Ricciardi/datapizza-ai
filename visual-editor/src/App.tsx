import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "reactflow";
import "./App.css";
import "reactflow/dist/style.css";
import {
  WORKFLOW_FORMAT_VERSION,
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
import { NodeInspector } from "./components/NodeInspector";
import {
  NODE_TEMPLATES,
  WORKFLOW_TEMPLATES,
  WORKFLOW_TEMPLATE_CATEGORIES,
  groupNodeTemplatesByCategory,
  type NodeTemplate,
  type WorkflowTemplate,
} from "./data/workflow-templates";

const NODE_TEMPLATE_MIME = "application/datapizza-workflow-node-template";

type ThemeMode = "light" | "dark";

type SidebarSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
};

type AppHeaderProps = {
  onExport: () => void;
  onToggleTheme: () => void;
  onToggleLibrary: () => void;
  theme: ThemeMode;
  activeTemplate: WorkflowTemplate;
};

type LibraryDrawerProps = {
  open: boolean;
  templates: WorkflowTemplate[];
  activeTemplateId: string;
  nodeGroups: ReturnType<typeof groupNodeTemplatesByCategory>;
  onClose: () => void;
  onApplyTemplate: (templateId: string) => void;
  onNodeDragStart: (event: DragEvent<HTMLElement>, template: NodeTemplate) => void;
};

const statusLabels: Record<string, string> = {
  idle: "In attesa",
  pending: "In coda",
  running: "In esecuzione",
  completed: "Completato",
  failed: "Fallito",
};

const initialTemplate = WORKFLOW_TEMPLATES[0];

const getPreferredTheme = (): ThemeMode => {
  if (typeof window !== "undefined") {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (prefersDark?.matches) {
      return "dark";
    }
  }
  return "light";
};

const mapWorkflowKindToNodeType = (kind: NodeTemplate["kind"]): Node["type"] => {
  switch (kind) {
    case "input":
      return "input";
    case "output":
      return "output";
    default:
      return "default";
  }
};

const cloneTemplateData = (
  data: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  if (!data) {
    return {};
  }
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
};

const createUniqueNodeId = (baseId: string, nodes: Node[]): string => {
  if (!nodes.some((node) => node.id === baseId)) {
    return baseId;
  }

  let suffix = 1;
  let candidate = `${baseId}-${suffix}`;

  while (nodes.some((node) => node.id === candidate)) {
    suffix += 1;
    candidate = `${baseId}-${suffix}`;
  }

  return candidate;
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

function AppHeader({
  onExport,
  onToggleTheme,
  onToggleLibrary,
  theme,
  activeTemplate,
}: AppHeaderProps) {
  const categoryInfo =
    WORKFLOW_TEMPLATE_CATEGORIES[activeTemplate.category] ??
    ({ label: activeTemplate.category, description: "" } as const);
  return (
    <header className="app__header" role="banner">
      <div className="app__header-layout">
        <div className="app__header-copy">
          <h1>Workflow Visual Editor</h1>
          <p>
            Crea, orchestra e testa pipeline di machine learning con un canvas
            interattivo e pannelli contestuali pensati per team data-driven.
          </p>
          <p className="app__header-template" aria-live="polite">
            <span className="app__header-template-icon" aria-hidden>
              {activeTemplate.icon}
            </span>
            <span>
              Template attivo: <strong>{activeTemplate.name}</strong>
            </span>
            <span className="template-category-badge">{categoryInfo.label}</span>
          </p>
        </div>
        <div className="app__header-actions">
          <button
            className="button button--ghost"
            type="button"
            onClick={onToggleLibrary}
          >
            Catalogo workflow
          </button>
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

function LibraryDrawer({
  open,
  templates,
  activeTemplateId,
  nodeGroups,
  onClose,
  onApplyTemplate,
  onNodeDragStart,
}: LibraryDrawerProps) {
  return (
    <aside
      className={`library-drawer${open ? " library-drawer--open" : ""}`}
      aria-hidden={!open}
      aria-label="Catalogo template e nodi preconfigurati"
      role="dialog"
    >
      <div className="library-drawer__header">
        <div>
          <p className="library-drawer__eyebrow">Libreria</p>
          <h2 className="library-drawer__title">Workflow e nodi preconfigurati</h2>
        </div>
        <button
          className="button button--ghost library-drawer__close"
          type="button"
          onClick={onClose}
          aria-label="Chiudi catalogo"
        >
          Chiudi
        </button>
      </div>
      <div className="library-drawer__content">
        <section className="library-drawer__section">
          <header>
            <h3>Workflow predefiniti</h3>
            <p>Applica un template per reimpostare rapidamente nodi ed archi.</p>
          </header>
          <div className="template-grid">
            {templates.map((template) => {
              const category =
                WORKFLOW_TEMPLATE_CATEGORIES[template.category] ??
                ({ label: template.category, description: "" } as const);
              const isActive = template.id === activeTemplateId;
              return (
                <article
                  key={template.id}
                  className={`template-card${isActive ? " template-card--active" : ""}`}
                >
                  <div className="template-card__header">
                    <span className="template-card__icon" aria-hidden>
                      {template.icon}
                    </span>
                    <div>
                      <h4>{template.name}</h4>
                      <p>{template.description}</p>
                    </div>
                  </div>
                  <div className="template-card__footer">
                    <span className="template-card__badge">{category.label}</span>
                    <button
                      className="button button--ghost template-card__action"
                      type="button"
                      onClick={() => onApplyTemplate(template.id)}
                    >
                      {isActive ? "Ricarica" : "Applica"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <section className="library-drawer__section">
          <header>
            <h3>Nodi preconfigurati</h3>
            <p>Trascina i nodi nel canvas per arricchire il workflow corrente.</p>
          </header>
          <div className="node-template-groups">
            {Object.entries(nodeGroups).map(([categoryKey, nodes]) => {
              if (nodes.length === 0) {
                return null;
              }
              const category =
                WORKFLOW_TEMPLATE_CATEGORIES[
                  categoryKey as keyof typeof WORKFLOW_TEMPLATE_CATEGORIES
                ] ?? { label: categoryKey, description: "" };
              return (
                <div key={categoryKey} className="node-template-group">
                  <div className="node-template-group__header">
                    <span className="node-template-group__badge">{category.label}</span>
                    <p>{category.description}</p>
                  </div>
                  <div className="node-template-list">
                    {nodes.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className="node-template"
                        draggable
                        onDragStart={(event) => onNodeDragStart(event, node)}
                      >
                        <span className="node-template__icon" aria-hidden>
                          {node.icon}
                        </span>
                        <span className="node-template__content">
                          <span className="node-template__title">{node.label}</span>
                          <span className="node-template__description">{node.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}

function WorkflowApp(): JSX.Element {
  const { project, fitView, setViewport } = useReactFlow();

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const execution = useWorkflowStore((state) => state.execution);
  const startExecution = useWorkflowStore((state) => state.startExecution);
  const completeExecution = useWorkflowStore((state) => state.completeExecution);
  const failExecution = useWorkflowStore((state) => state.failExecution);
  const resetExecution = useWorkflowStore((state) => state.resetExecution);

  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const templateMap = useMemo(
    () => new Map<string, WorkflowTemplate>(WORKFLOW_TEMPLATES.map((template) => [template.id, template])),
    [],
  );
  const nodeTemplateMap = useMemo(
    () => new Map<string, NodeTemplate>(NODE_TEMPLATES.map((template) => [template.id, template])),
    [],
  );
  const nodeTemplateGroups = useMemo(() => groupNodeTemplatesByCategory(), []);

  const [activeTemplateId, setActiveTemplateId] = useState(initialTemplate.id);
  const activeTemplate = useMemo(
    () => templateMap.get(activeTemplateId) ?? initialTemplate,
    [activeTemplateId, templateMap],
  );
  const templateCategoryInfo = useMemo(
    () =>
      WORKFLOW_TEMPLATE_CATEGORIES[activeTemplate.category] ?? {
        label: activeTemplate.category,
        description: "",
      },
    [activeTemplate.category],
  );

  const [workflowMetadata, setWorkflowMetadata] = useState<WorkflowMetadata>(
    initialTemplate.definition.metadata,
  );
  const [runtimeEnvironment, setRuntimeEnvironment] = useState(
    initialTemplate.runtimeDefaults?.environment ?? "",
  );
  const [datasetUri, setDatasetUri] = useState(initialTemplate.runtimeDefaults?.datasetUri ?? "");

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

  const loadTemplate = useCallback(
    (template: WorkflowTemplate) => {
      setWorkflowMetadata(template.definition.metadata);
      setRuntimeEnvironment(template.runtimeDefaults?.environment ?? "");
      setDatasetUri(template.runtimeDefaults?.datasetUri ?? "");
      resetExecution();

      const reactFlowState = initializeWorkflowStoreFromDefinition(template.definition);

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          if (reactFlowState?.viewport) {
            setViewport(reactFlowState.viewport);
          } else {
            fitView({ padding: 0.2 });
          }
        });
      }
    },
    [fitView, resetExecution, setDatasetUri, setRuntimeEnvironment, setViewport, setWorkflowMetadata],
  );

  useEffect(() => {
    loadTemplate(activeTemplate);
  }, [activeTemplate, loadTemplate]);

  const onDropNodeTemplate = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const templateId = event.dataTransfer.getData(NODE_TEMPLATE_MIME);
      if (!templateId) {
        return;
      }
      const template = nodeTemplateMap.get(templateId);
      if (!template) {
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();
      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newId = createUniqueNodeId(template.id, nodes);
      const data = cloneTemplateData(template.data);

      const newNode: Node = {
        id: newId,
        type: mapWorkflowKindToNodeType(template.kind),
        position,
        data: {
          ...data,
          label: template.label,
        },
      };

      setNodes([...nodes, newNode]);
      selectNode(newId);
    },
    [nodeTemplateMap, nodes, project, selectNode, setNodes],
  );

  const onDragOverNodeTemplate = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onNodeTemplateDragStart = useCallback(
    (event: DragEvent<HTMLElement>, template: NodeTemplate) => {
      event.dataTransfer.setData(NODE_TEMPLATE_MIME, template.id);
      event.dataTransfer.effectAllowed = "copyMove";
    },
    [],
  );

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

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  const exportWorkflow = useCallback(() => {
    const snapshot = serializeWorkflowFromStore({
      metadata: {
        ...workflowMetadata,
        updatedAt: new Date().toISOString(),
      },
      version: WORKFLOW_FORMAT_VERSION,
    });

    console.info("Workflow serializzato", snapshot);
  }, [workflowMetadata]);

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
  }, [
    datasetUri,
    runtimeEnvironment,
    workflowMetadata,
    startExecution,
    completeExecution,
    failExecution,
  ]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  const toggleLibrary = useCallback(() => {
    setIsLibraryOpen((open) => !open);
  }, []);

  const applyTemplate = useCallback(
    (templateId: string) => {
      const template = templateMap.get(templateId);
      if (!template) {
        return;
      }
      if (templateId === activeTemplateId) {
        loadTemplate(template);
      } else {
        setActiveTemplateId(templateId);
      }
      setIsLibraryOpen(false);
    },
    [activeTemplateId, loadTemplate, templateMap],
  );

  return (
    <div className="app" data-theme={theme}>
      {isLibraryOpen ? (
        <div
          className="library-drawer__backdrop"
          role="presentation"
          onClick={() => setIsLibraryOpen(false)}
        />
      ) : null}
      <AppHeader
        onExport={exportWorkflow}
        onToggleTheme={toggleTheme}
        onToggleLibrary={toggleLibrary}
        theme={theme}
        activeTemplate={activeTemplate}
      />
      <LibraryDrawer
        open={isLibraryOpen}
        templates={WORKFLOW_TEMPLATES}
        activeTemplateId={activeTemplateId}
        nodeGroups={nodeTemplateGroups}
        onClose={() => setIsLibraryOpen(false)}
        onApplyTemplate={applyTemplate}
        onNodeDragStart={onNodeTemplateDragStart}
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
            onSelectionChange={({ nodes: nextNodes }) => {
              const nextSelected = nextNodes[0];
              selectNode(nextSelected ? nextSelected.id : undefined);
            }}
            onPaneClick={() => selectNode(undefined)}
            proOptions={{ hideAttribution: true }}
            onDrop={onDropNodeTemplate}
            onDragOver={onDragOverNodeTemplate}
          >
            <MiniMap zoomable pannable />
            <Controls showInteractive={false} />
            <Background gap={16} color="var(--color-border-subtle)" />
          </ReactFlow>
        </section>
        <aside className="app__sidebar" aria-label="Pannello laterale del workflow">
          <SidebarSection
            id="template-info"
            title="Dettagli template"
            description="Riferimenti rapidi al template attivo e alle sue note principali."
          >
            <div className="template-summary">
              <span className="template-summary__icon" aria-hidden>
                {activeTemplate.icon}
              </span>
              <div className="template-summary__content">
                <strong>{workflowMetadata.name}</strong>
                <span className="template-category-badge">
                  {templateCategoryInfo.label}
                </span>
              </div>
            </div>
            {workflowMetadata.description ? (
              <p className="muted-copy">{workflowMetadata.description}</p>
            ) : null}
            <dl className="meta-grid">
              {workflowMetadata.author ? (
                <div>
                  <dt>Autore</dt>
                  <dd>{workflowMetadata.author.name}</dd>
                </div>
              ) : null}
              {workflowMetadata.tags && workflowMetadata.tags.length > 0 ? (
                <div>
                  <dt>Tag</dt>
                  <dd>{workflowMetadata.tags.join(", ")}</dd>
                </div>
              ) : null}
              {workflowMetadata.createdAt ? (
                <div>
                  <dt>Creato il</dt>
                  <dd>{new Date(workflowMetadata.createdAt).toLocaleDateString()}</dd>
                </div>
              ) : null}
            </dl>
          </SidebarSection>
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

          <SidebarSection
            id="node-details"
            title="Dettagli nodo"
            description="Seleziona un nodo dal canvas per modificarne label, tipo e parametri JSON."
          >
            {selectedNode ? (
              <NodeInspector node={selectedNode} />
            ) : (
              <p className="muted-copy">
                Nessun nodo selezionato. Clicca su un nodo nel canvas per visualizzare i dettagli.
              </p>
            )}
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
                Nessun output disponibile. Avvia un'esecuzione per visualizzare i risultati.
              </p>
            )}
          </SidebarSection>
        </aside>
      </main>
    </div>
  );
}

function App(): JSX.Element {
  return (
    <ReactFlowProvider>
      <WorkflowApp />
    </ReactFlowProvider>
  );
}

export default App;
