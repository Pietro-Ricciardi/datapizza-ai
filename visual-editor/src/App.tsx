import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
  validateWorkflowLocally,
  type WorkflowDefinitionWithArbitraryVersion,
} from "./workflow-serialization";
import { createResourceReference } from "./workflow-parameters";
import {
  executeWorkflow,
  validateWorkflowDefinition,
  WorkflowApiError,
} from "./services/workflow-api";
import { NodeInspector } from "./components/NodeInspector";
import {
  NODE_TEMPLATES,
  WORKFLOW_TEMPLATES,
  WORKFLOW_TEMPLATE_CATEGORIES,
  groupNodeTemplatesByCategory,
  type NodeTemplate,
  type WorkflowTemplate,
} from "./data/workflow-templates";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const NODE_TEMPLATE_MIME = "application/datapizza-workflow-node-template";

type ThemeMode = "light" | "dark";

type SidebarSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
};

type AppHeaderProps = {
  onToggleExportMenu: () => void;
  onImport: () => void;
  onToggleTheme: () => void;
  onToggleLibrary: () => void;
  theme: ThemeMode;
  activeTemplate: WorkflowTemplate;
  templateSource: "template" | "import";
  workflowName: string;
  workflowIcon?: string;
  exportMenuOpen: boolean;
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

type ExportFormat = "json" | "yaml";

interface ValidationState {
  status: "idle" | "loading" | "success" | "error";
  source?: "remote" | "local";
  valid?: boolean;
  issues: string[];
  message?: string;
}

type ImportWorkflowDialogProps = {
  open: boolean;
  onClose: () => void;
  onImportFile: (file: File) => Promise<void>;
  importing: boolean;
  error?: string;
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

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

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
  onToggleExportMenu,
  onImport,
  onToggleTheme,
  onToggleLibrary,
  theme,
  activeTemplate,
  templateSource,
  workflowName,
  workflowIcon,
  exportMenuOpen,
}: AppHeaderProps) {
  const categoryInfo =
    WORKFLOW_TEMPLATE_CATEGORIES[activeTemplate.category] ??
    ({ label: activeTemplate.category, description: "" } as const);
  const headerIcon =
    templateSource === "import"
      ? workflowIcon || "📥"
      : activeTemplate.icon;
  const badgeLabel = templateSource === "import" ? "Import manuale" : categoryInfo.label;
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
              {headerIcon}
            </span>
            <span>
              {templateSource === "import" ? (
                <>
                  Workflow importato: <strong>{workflowName}</strong>
                </>
              ) : (
                <>
                  Template attivo: <strong>{activeTemplate.name}</strong>
                </>
              )}
            </span>
            <span className="template-category-badge">{badgeLabel}</span>
          </p>
          {templateSource === "template" ? (
            <p className="muted-copy" aria-live="polite">
              Workflow corrente: <strong>{workflowName}</strong>
            </p>
          ) : null}
        </div>
        <div className="app__header-actions">
          <button
            className="button button--ghost"
            type="button"
            onClick={onToggleLibrary}
          >
            Catalogo workflow
          </button>
          <button className="button button--ghost" type="button" onClick={onImport}>
            Importa workflow
          </button>
          <button className="button button--ghost" type="button" onClick={onToggleTheme}>
            Modalità {theme === "light" ? "scura" : "chiara"}
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={onToggleExportMenu}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
            data-export-toggle="true"
          >
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

function ImportWorkflowDialog({
  open,
  onClose,
  onImportFile,
  importing,
  error,
}: ImportWorkflowDialogProps) {
  const onFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      await onImportFile(file);
      event.target.value = "";
    },
    [onImportFile],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
      <div className="modal__content">
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">Importazione</p>
            <h2 id="import-dialog-title">Carica un workflow esistente</h2>
          </div>
          <button className="button button--ghost" type="button" onClick={onClose}>
            Chiudi
          </button>
        </div>
        <p className="modal__description">
          Seleziona un file <strong>.json</strong>, <strong>.yaml</strong> o <strong>.yml</strong>. Il contenuto verrà migrato alla
          versione supportata e caricato nel canvas.
        </p>
        <label className="form-field" htmlFor="workflow-file">
          <span className="form-field__label">Definizione workflow</span>
          <input
            id="workflow-file"
            type="file"
            className="form-field__input"
            accept="application/json,application/x-yaml,.json,.yaml,.yml"
            onChange={onFileChange}
            disabled={importing}
          />
        </label>
        {importing ? <p className="muted-copy">Analisi del file in corso...</p> : null}
        {error ? <p className="inline-feedback inline-feedback--error">{error}</p> : null}
        <p className="muted-copy">
          Suggerimento: esporta dal backend Datapizza o riutilizza un file creato con questo editor per mantenere compatibili i
          componenti.
        </p>
      </div>
    </div>
  );
}

function WorkflowApp(): JSX.Element {
  const { project, fitView, setViewport, getViewport } = useReactFlow();

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
  const [templateSource, setTemplateSource] = useState<"template" | "import">("template");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | undefined>(undefined);
  const [validationState, setValidationState] = useState<ValidationState>({ status: "idle", issues: [] });

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
      setTemplateSource("template");
      setWorkflowMetadata(template.definition.metadata);
      setRuntimeEnvironment(template.runtimeDefaults?.environment ?? "");
      setDatasetUri(template.runtimeDefaults?.datasetUri ?? "");
      resetExecution();
      setValidationState({ status: "idle", issues: [] });
      setImportError(undefined);
      setIsExportMenuOpen(false);
      setIsImportDialogOpen(false);

      const { reactFlow: reactFlowState } = initializeWorkflowStoreFromDefinition(template.definition);

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
    [
      fitView,
      resetExecution,
      setDatasetUri,
      setRuntimeEnvironment,
      setViewport,
      setWorkflowMetadata,
      setTemplateSource,
      setValidationState,
      setImportError,
      setIsExportMenuOpen,
      setIsImportDialogOpen,
    ],
  );

  useEffect(() => {
    loadTemplate(activeTemplate);
  }, [activeTemplate, loadTemplate]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(target) &&
        !target.closest('[data-export-toggle="true"]')
      ) {
        setIsExportMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isExportMenuOpen]);

  const createWorkflowSnapshot = useCallback(() => {
    return serializeWorkflowFromStore({
      metadata: {
        ...workflowMetadata,
        updatedAt: new Date().toISOString(),
      },
      version: WORKFLOW_FORMAT_VERSION,
      reactFlow: { viewport: getViewport() },
    });
  }, [getViewport, workflowMetadata]);

  const downloadWorkflow = useCallback(
    (format: ExportFormat) => {
      if (typeof document === "undefined") {
        return;
      }

      const snapshot = createWorkflowSnapshot();
      const content =
        format === "json" ? JSON.stringify(snapshot, null, 2) : stringifyYaml(snapshot);
      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "application/x-yaml",
      });
      const baseName = slugify(workflowMetadata.name || "workflow");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${baseName || "workflow"}-${timestamp}.${format}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
      setIsExportMenuOpen(false);
    },
    [createWorkflowSnapshot, workflowMetadata.name],
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setImportError(undefined);

      try {
        const fileContents = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(fileContents) as unknown;
        } catch (jsonError) {
          try {
            parsed = parseYaml(fileContents);
          } catch (yamlError) {
            throw new Error(
              "Impossibile analizzare il file. Assicurati che sia un JSON o YAML valido.",
            );
          }
        }

        if (!parsed || typeof parsed !== "object") {
          throw new Error("Il file non contiene una definizione di workflow valida.");
        }

        const candidate = parsed as Record<string, unknown>;
        const version = typeof candidate.version === "string" ? candidate.version : WORKFLOW_FORMAT_VERSION;
        const definition = {
          ...candidate,
          version,
        } as WorkflowDefinitionWithArbitraryVersion;

        const { workflow: migratedWorkflow, reactFlow } = initializeWorkflowStoreFromDefinition(definition);
        setWorkflowMetadata(migratedWorkflow.metadata);

        const backendExtensions = migratedWorkflow.extensions?.backend;
        if (backendExtensions && typeof backendExtensions === "object") {
          const backendData = backendExtensions as Record<string, unknown>;
          const envValue = backendData.environment;
          setRuntimeEnvironment(typeof envValue === "string" ? envValue : "");
          const datasetValue = backendData.datasetUri ?? backendData.datasetURI;
          setDatasetUri(typeof datasetValue === "string" ? datasetValue : "");
        } else {
          setRuntimeEnvironment("");
          setDatasetUri("");
        }

        resetExecution();
        setTemplateSource("import");
        setValidationState({ status: "idle", issues: [] });
        setIsExportMenuOpen(false);

        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            if (reactFlow?.viewport) {
              setViewport(reactFlow.viewport);
            } else {
              fitView({ padding: 0.2 });
            }
          });
        }

        setIsImportDialogOpen(false);
      } catch (error) {
        console.error("Impossibile importare il workflow", error);
        const message =
          error instanceof Error
            ? error.message
            : "Impossibile importare il workflow: formato non riconosciuto";
        setImportError(message);
      } finally {
        setIsImporting(false);
      }
    },
    [
      fitView,
      resetExecution,
      setDatasetUri,
      setRuntimeEnvironment,
      setTemplateSource,
      setValidationState,
      setViewport,
      setWorkflowMetadata,
      setIsExportMenuOpen,
      setIsImportDialogOpen,
    ],
  );

  const toggleExportMenu = useCallback(() => {
    setIsExportMenuOpen((open) => !open);
  }, []);

  const openImportDialog = useCallback(() => {
    setImportError(undefined);
    setIsImportDialogOpen(true);
    setIsExportMenuOpen(false);
  }, [setImportError, setIsExportMenuOpen]);

  const closeImportDialog = useCallback(() => {
    if (!isImporting) {
      setIsImportDialogOpen(false);
    }
  }, [isImporting]);

  const validateWorkflow = useCallback(async () => {
    const snapshot = createWorkflowSnapshot();
    setValidationState({ status: "loading", issues: [] });

    try {
      const response = await validateWorkflowDefinition(snapshot);
      setValidationState({
        status: response.valid ? "success" : "error",
        valid: response.valid,
        issues: response.issues,
        source: "remote",
        message: response.valid
          ? "Validazione completata dal backend FastAPI."
          : "Il backend ha rilevato delle incongruenze nella definizione.",
      });
    } catch (error) {
      if (error instanceof WorkflowApiError) {
        setValidationState({
          status: "error",
          valid: false,
          issues: error.payload?.issues ?? [],
          source: "remote",
          message: error.message,
        });
        return;
      }

      const fallback = validateWorkflowLocally(snapshot);
      setValidationState({
        status: fallback.valid ? "success" : "error",
        valid: fallback.valid,
        issues: fallback.issues,
        source: "local",
        message: fallback.valid
          ? "Validazione locale completata (fallback)."
          : "Problemi rilevati dalla validazione locale (fallback).",
      });
    }
  }, [createWorkflowSnapshot]);

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

  const runWorkflow = useCallback(async () => {
    startExecution();

    try {
      const snapshot = createWorkflowSnapshot();

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
    createWorkflowSnapshot,
    runtimeEnvironment,
    startExecution,
    completeExecution,
    failExecution,
  ]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  const toggleLibrary = useCallback(() => {
    setIsLibraryOpen((open) => !open);
    setIsExportMenuOpen(false);
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
          onClick={() => {
            setIsLibraryOpen(false);
            setIsExportMenuOpen(false);
          }}
        />
      ) : null}
      <AppHeader
        onToggleExportMenu={toggleExportMenu}
        onImport={openImportDialog}
        onToggleTheme={toggleTheme}
        onToggleLibrary={toggleLibrary}
        theme={theme}
        activeTemplate={activeTemplate}
        templateSource={templateSource}
        workflowName={workflowMetadata.name}
        workflowIcon={workflowMetadata.icon}
        exportMenuOpen={isExportMenuOpen}
      />
      {isExportMenuOpen ? (
        <div
          ref={exportMenuRef}
          className="export-menu"
          role="menu"
          aria-label="Formati di esportazione del workflow"
        >
          <button
            type="button"
            className="export-menu__item"
            onClick={() => downloadWorkflow("json")}
          >
            Scarica JSON
          </button>
          <button
            type="button"
            className="export-menu__item"
            onClick={() => downloadWorkflow("yaml")}
          >
            Scarica YAML
          </button>
        </div>
      ) : null}
      <ImportWorkflowDialog
        open={isImportDialogOpen}
        onClose={closeImportDialog}
        onImportFile={handleImportFile}
        importing={isImporting}
        error={importError}
      />
      <LibraryDrawer
        open={isLibraryOpen}
        templates={WORKFLOW_TEMPLATES}
        activeTemplateId={activeTemplateId}
        nodeGroups={nodeTemplateGroups}
        onClose={() => {
          setIsLibraryOpen(false);
          setIsExportMenuOpen(false);
        }}
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
                {templateSource === "import"
                  ? workflowMetadata.icon ?? "📥"
                  : activeTemplate.icon}
              </span>
              <div className="template-summary__content">
                <strong>{workflowMetadata.name}</strong>
                <span className="template-category-badge">
                  {templateSource === "import" ? "Import manuale" : templateCategoryInfo.label}
                </span>
              </div>
            </div>
            {templateSource === "import" ? (
              <p className="muted-copy">
                Definizione caricata da file. Il workflow è stato migrato automaticamente alla versione
                {" "}
                <strong>{WORKFLOW_FORMAT_VERSION}</strong>.
              </p>
            ) : null}
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
            id="workflow-validation"
            title="Validazione workflow"
            description="Verifica la definizione corrente con il backend FastAPI o con un fallback locale."
          >
            <div className="validation-actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={validateWorkflow}
                disabled={validationState.status === "loading"}
              >
                {validationState.status === "loading" ? "Validazione in corso..." : "Valida definizione"}
              </button>
            </div>
            {validationState.status === "idle" ? (
              <p className="muted-copy">
                Avvia la validazione per ottenere un riepilogo degli eventuali problemi strutturali e semantici del workflow.
              </p>
            ) : validationState.status === "loading" ? (
              <p className="muted-copy">Analisi della definizione in corso...</p>
            ) : (
              <div className="validation-result">
                <p
                  className={`inline-feedback ${
                    validationState.valid ? "inline-feedback--success" : "inline-feedback--error"
                  }`}
                >
                  {validationState.message ??
                    (validationState.valid
                      ? "La definizione è stata validata correttamente."
                      : "La definizione contiene alcune incongruenze.")}
                  {validationState.source ? (
                    <span className="validation-result__source">
                      {validationState.source === "remote"
                        ? " (risposta backend)"
                        : " (validator locale)"}
                    </span>
                  ) : null}
                </p>
                {!validationState.valid && validationState.issues.length > 0 ? (
                  <ul className="validation-issues">
                    {validationState.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
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
