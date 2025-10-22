import { beforeEach, describe, expect, it } from "vitest";
import {
  WORKFLOW_FORMAT_VERSION,
  type WorkflowDefinition,
} from "./workflow-format";
import { useWorkflowStore } from "./store/workflow-store";
import {
  initializeWorkflowStoreFromDefinition,
  serializeWorkflowFromStore,
} from "./workflow-serialization";
import { createResourceReference } from "./workflow-parameters";

const workflow: WorkflowDefinition = {
  version: WORKFLOW_FORMAT_VERSION,
  metadata: {
    name: "Round trip test",
    description: "Workflow di test per validare la serializzazione.",
    tags: ["test"],
    author: { name: "Tester", email: "tester@datapizza.ai" },
    externalId: "wf-test-serialization",
    createdAt: "2024-05-01T09:30:00.000Z",
    updatedAt: "2024-05-02T15:45:00.000Z",
  },
  nodes: [
    {
      id: "input",
      kind: "input",
      label: "Input",
      position: { x: 0, y: 0 },
      data: {
        component: "datapizza.source.inline",
        parameters: { value: 42 },
      },
    },
    {
      id: "process",
      kind: "task",
      label: "Process",
      position: { x: 160, y: 0 },
      data: {
        component: "datapizza.process.identity",
      },
    },
  ],
  edges: [
    {
      id: "input-process",
      source: { nodeId: "input" },
      target: { nodeId: "process" },
      label: "payload",
    },
  ],
  extensions: {
    reactFlow: {
      viewport: { x: 0, y: 0, zoom: 1 },
      sidebarOpen: true,
      inspectorTab: "configuration",
    },
  },
};

beforeEach(() => {
  useWorkflowStore.setState({ nodes: [], edges: [] });
});

describe("workflow-serialization", () => {
  it("populates the store from a workflow definition", () => {
    const reactFlowState = initializeWorkflowStoreFromDefinition(workflow);
    const state = useWorkflowStore.getState();

    expect(state.nodes).toHaveLength(workflow.nodes.length);
    expect(state.edges).toHaveLength(workflow.edges.length);
    expect(state.nodes[0]?.data?.label).toBe("Input");
    expect(reactFlowState).toEqual(workflow.extensions?.reactFlow);
  });

  it("serialises the store into a workflow definition", () => {
    initializeWorkflowStoreFromDefinition(workflow);

    const snapshot = serializeWorkflowFromStore({
      metadata: workflow.metadata,
      version: workflow.version,
      extensions: workflow.extensions,
    });

    expect(snapshot).toEqual(workflow);
  });

  it("merges react flow state overrides when serialising", () => {
    initializeWorkflowStoreFromDefinition(workflow);

    const snapshot = serializeWorkflowFromStore({
      metadata: workflow.metadata,
      version: workflow.version,
      extensions: workflow.extensions,
      reactFlow: {
        viewport: { x: 120, y: -40, zoom: 1.5 },
        sidebarOpen: false,
        lastSelection: ["process"],
      },
    });

    expect(snapshot.extensions?.reactFlow).toEqual({
      viewport: { x: 120, y: -40, zoom: 1.5 },
      inspectorTab: "configuration",
      sidebarOpen: false,
      lastSelection: ["process"],
    });
  });

  it("normalises complex node parameters when serialising", () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: "complex",
          type: "default",
          position: { x: 0, y: 0 },
          data: {
            label: "Nodo complesso",
            component: "datapizza.complex.component",
            parameters: new Map([
              ["thresholds", new Set([0.2, 0.8])],
              [
                "metadata",
                new Map([
                  ["window", { start: new Date("2024-05-01T12:00:00.000Z"), durationMinutes: 15 }],
                  ["tags", ["raw", "ingestion"]],
                ]),
              ],
              [
                "resource",
                createResourceReference("s3://datasets/raw.csv", {
                  description: "Dataset grezzo",
                }),
              ],
            ]),
          },
        },
      ],
      edges: [],
    });

    const snapshot = serializeWorkflowFromStore({
      metadata: {
        ...workflow.metadata,
        name: "Complex parameters",
      },
      version: workflow.version,
    });

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0]?.data).toEqual({
      component: "datapizza.complex.component",
      parameters: {
        thresholds: [0.2, 0.8],
        metadata: {
          window: {
            start: "2024-05-01T12:00:00.000Z",
            durationMinutes: 15,
          },
          tags: ["raw", "ingestion"],
        },
        resource: {
          type: "resource",
          uri: "s3://datasets/raw.csv",
          description: "Dataset grezzo",
        },
      },
    });
  });
});
