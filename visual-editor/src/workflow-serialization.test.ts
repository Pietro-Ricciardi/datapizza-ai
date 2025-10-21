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

const workflow: WorkflowDefinition = {
  version: WORKFLOW_FORMAT_VERSION,
  metadata: {
    name: "Round trip test",
    tags: ["test"],
    author: { name: "Tester" },
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
    },
  },
};

beforeEach(() => {
  useWorkflowStore.setState({ nodes: [], edges: [] });
});

describe("workflow-serialization", () => {
  it("populates the store from a workflow definition", () => {
    const viewport = initializeWorkflowStoreFromDefinition(workflow);
    const state = useWorkflowStore.getState();

    expect(state.nodes).toHaveLength(workflow.nodes.length);
    expect(state.edges).toHaveLength(workflow.edges.length);
    expect(state.nodes[0]?.data?.label).toBe("Input");
    expect(viewport).toEqual(workflow.extensions?.reactFlow?.viewport);
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
});
