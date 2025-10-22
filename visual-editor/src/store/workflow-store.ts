import { create, type StoreApi } from "zustand";
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
import {
  type WorkflowNodeKind,
  type WorkflowExecutionResult,
  type WorkflowExecutionResultStatus,
  type WorkflowExecutionStep,
  type WorkflowMetadata,
} from "../workflow-format";
import {
  validateWorkflowGraph,
  type WorkflowValidationIssueBlueprint,
  type WorkflowValidationQuickFixBlueprint,
  type WorkflowValidationReport,
  type WorkflowValidationScope,
  type WorkflowValidationSeverity,
} from "../services/workflow-validation";

type WorkflowState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
};

type WorkflowActions = {
  initialize: (nodes: Node[], edges: Edge[]) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection | Edge) => void;
  selectNode: (nodeId: string | undefined) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodeKind: (nodeId: string, kind: WorkflowNodeKind) => void;
  updateNodeParameters: (
    nodeId: string,
    parameters: Record<string, unknown> | undefined,
  ) => void;
};

type WorkflowExecutionStatus = WorkflowExecutionResultStatus | "idle";

interface WorkflowExecutionContext {
  runId?: string;
  status: WorkflowExecutionStatus;
  loading: boolean;
  error?: string;
  steps: Record<string, WorkflowExecutionStep>;
  outputs?: Record<string, unknown>;
}

type WorkflowExecutionActions = {
  startExecution: () => void;
  completeExecution: (result: WorkflowExecutionResult) => void;
  failExecution: (message: string) => void;
  resetExecution: () => void;
};

type WorkflowExecutionState = {
  execution: WorkflowExecutionContext;
};

interface WorkflowValidationQuickFix {
  id: string;
  label: string;
  description?: string;
  apply: () => void;
}

interface WorkflowValidationIssue {
  id: string;
  scope: WorkflowValidationScope;
  targetId?: string;
  severity: WorkflowValidationSeverity;
  message: string;
  description?: string;
  quickFixes?: WorkflowValidationQuickFix[];
}

interface WorkflowValidationState {
  issues: WorkflowValidationIssue[];
  errors: number;
  warnings: number;
  lastUpdatedAt: number;
}

interface WorkflowValidationActions {
  setValidationMetadata: (metadata: WorkflowMetadata | undefined) => void;
  runValidation: () => void;
}

type WorkflowValidationContextState = {
  validationMetadata?: WorkflowMetadata;
  validation: WorkflowValidationState;
};

type WorkflowStore = WorkflowState &
  WorkflowActions &
  WorkflowExecutionState &
  WorkflowExecutionActions &
  WorkflowValidationContextState &
  WorkflowValidationActions;

type StoreSet = StoreApi<WorkflowStore>["setState"];

type StoreGet = StoreApi<WorkflowStore>["getState"];

const createDefaultExecutionState = (): WorkflowExecutionContext => ({
  runId: undefined,
  status: "idle",
  loading: false,
  error: undefined,
  steps: {},
  outputs: undefined,
});

const createInitialValidationState = (): WorkflowValidationState => ({
  issues: [],
  errors: 0,
  warnings: 0,
  lastUpdatedAt: Date.now(),
});

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: undefined,
  execution: createDefaultExecutionState(),
  validationMetadata: undefined,
  validation: createInitialValidationState(),
  initialize: (nodes, edges) => {
    set(
      {
        nodes: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        selectedNodeId: undefined,
      },
    );
    get().runValidation();
  },
  setNodes: (nodes) => {
    set((state) => ({
      nodes: nodes.map((node) => ({ ...node })),
      selectedNodeId: state.selectedNodeId &&
        nodes.some((node) => node.id === state.selectedNodeId)
        ? state.selectedNodeId
        : undefined,
    }));
    get().runValidation();
  },
  setEdges: (edges) => {
    set({ edges: edges.map((edge) => ({ ...edge })) });
    get().runValidation();
  },
  onNodesChange: (changes) => {
    set((state) => {
      const nextNodes = applyNodeChanges(changes, state.nodes);
      const selectionStillValid =
        state.selectedNodeId !== undefined &&
        nextNodes.some((node) => node.id === state.selectedNodeId);

      return {
        nodes: nextNodes,
        selectedNodeId: selectionStillValid ? state.selectedNodeId : undefined,
      };
    });
    get().runValidation();
  },
  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
    get().runValidation();
  },
  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: "smoothstep",
          animated: true,
        },
        state.edges,
      ),
    }));
    get().runValidation();
  },
  selectNode: (nodeId) =>
    set(() => ({
      selectedNodeId: nodeId,
    })),
  updateNodeLabel: (nodeId, label) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                label,
              },
            }
          : node,
      ),
    }));
    get().runValidation();
  },
  updateNodeKind: (nodeId, kind) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              type: mapWorkflowKindToNodeType(kind),
            }
          : node,
      ),
    }));
    get().runValidation();
  },
  updateNodeParameters: (nodeId, parameters) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: updateNodeParametersData(node.data, parameters),
            }
          : node,
      ),
    }));
    get().runValidation();
  },
  startExecution: () =>
    set((state) => {
      const pendingSteps: Record<string, WorkflowExecutionStep> = {};
      state.nodes.forEach((node) => {
        pendingSteps[node.id] = {
          nodeId: node.id,
          status: "pending",
        };
      });

      return {
        execution: {
          runId: undefined,
          status: "idle",
          loading: true,
          error: undefined,
          outputs: undefined,
          steps: pendingSteps,
        },
      };
    }),
  completeExecution: (result) =>
    set((state) => {
      const steps = { ...state.execution.steps };
      result.steps.forEach((step) => {
        steps[step.nodeId] = step;
      });

      return {
        execution: {
          runId: result.runId,
          status: result.status,
          loading: false,
          error: undefined,
          outputs: result.outputs,
          steps,
        },
      };
    }),
  failExecution: (message) =>
    set((state) => ({
      execution: {
        ...state.execution,
        loading: false,
        status: "failure",
        error: message,
      },
    })),
  resetExecution: () => set({ execution: createDefaultExecutionState() }),
  setValidationMetadata: (metadata) => {
    set({ validationMetadata: metadata });
    get().runValidation();
  },
  runValidation: () => {
    const state = get();
    const report = validateWorkflowGraph({
      nodes: state.nodes,
      edges: state.edges,
      metadata: state.validationMetadata,
    });

    set({
      validation: {
        ...mapValidationReport(report, set, get),
        lastUpdatedAt: Date.now(),
      },
    });
  },
}));

function mapValidationReport(
  report: WorkflowValidationReport,
  set: StoreSet,
  get: StoreGet,
): Omit<WorkflowValidationState, "lastUpdatedAt"> {
  const issues = report.issues.map((issue) => mapIssue(issue, set, get));
  return {
    issues,
    errors: report.errors,
    warnings: report.warnings,
  };
}

function mapIssue(
  issue: WorkflowValidationIssueBlueprint,
  set: StoreSet,
  get: StoreGet,
): WorkflowValidationIssue {
  return {
    id: issue.id,
    scope: issue.scope,
    targetId: issue.targetId,
    severity: issue.severity,
    message: issue.message,
    description: issue.description,
    quickFixes: issue.quickFixes?.map((fix) => mapQuickFix(fix, set, get)),
  };
}

function mapQuickFix(
  fix: WorkflowValidationQuickFixBlueprint,
  set: StoreSet,
  get: StoreGet,
): WorkflowValidationQuickFix {
  switch (fix.kind) {
    case "connect-nodes":
      return {
        id: fix.id,
        label: fix.label,
        description: fix.description,
        apply: () => {
          get().onConnect({
            source: fix.payload.sourceId,
            target: fix.payload.targetId,
            sourceHandle: null,
            targetHandle: null,
          });
        },
      };
    case "generate-label":
      return {
        id: fix.id,
        label: fix.label,
        description: fix.description,
        apply: () => {
          get().updateNodeLabel(fix.payload.nodeId, fix.payload.label);
        },
      };
    case "fill-parameters":
      return {
        id: fix.id,
        label: fix.label,
        description: fix.description,
        apply: () => {
          get().updateNodeParameters(fix.payload.nodeId, fix.payload.parameters);
        },
      };
    case "remove-edge":
      return {
        id: fix.id,
        label: fix.label,
        description: fix.description,
        apply: () => {
          set((state) => ({
            edges: state.edges.filter((edge) => edge.id !== fix.payload.edgeId),
          }));
          get().runValidation();
        },
      };
    default: {
      const exhaustiveCheck: never = fix;
      console.warn("Quick-fix non riconosciuto", exhaustiveCheck);
      return {
        id: "__unsupported__",
        label: "Azione non supportata",
        description: undefined,
        apply: () => {},
      };
    }
  }
}

function mapWorkflowKindToNodeType(kind: WorkflowNodeKind): Node["type"] {
  switch (kind) {
    case "input":
      return "input";
    case "output":
      return "output";
    default:
      return "default";
  }
}

function updateNodeParametersData(
  data: Node["data"] | undefined,
  parameters: Record<string, unknown> | undefined,
): Node["data"] {
  const baseData = { ...((data ?? {}) as Record<string, unknown>) };

  if (parameters === undefined) {
    delete baseData.parameters;
    return baseData;
  }

  baseData.parameters = cloneSerializable(parameters);
  return baseData;
}

function cloneSerializable<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
