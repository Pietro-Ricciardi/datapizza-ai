import { describe, expect, it } from "vitest";
import YAML from "yaml";
import {
  WORKFLOW_FORMAT_VERSION,
  fromReactFlowGraph,
  isWorkflowDefinition,
  toReactFlowGraph,
  type WorkflowDefinition,
} from "./workflow-format";

const sampleWorkflow: WorkflowDefinition = {
  version: WORKFLOW_FORMAT_VERSION,
  metadata: {
    name: "Data preparation",
    description: "Dimostrazione di workflow completo",
    tags: ["demo", "ml"],
    category: "ml",
    icon: "🤖",
    author: { name: "Datapizza", email: "editor@datapizza.ai" },
    externalId: "wf-demo-001",
    createdAt: "2024-04-01T09:00:00.000Z",
    updatedAt: "2024-04-02T10:00:00.000Z",
  },
  nodes: [
    {
      id: "source",
      kind: "input",
      label: "Carica dataset",
      position: { x: 20, y: 40 },
      data: {
        component: "datapizza.source.file.load",
        parameters: { format: "csv" },
      },
    },
    {
      id: "transform",
      kind: "task",
      label: "Trasforma",
      position: { x: 220, y: 40 },
      data: {
        component: "datapizza.transform.normalize",
        parameters: { strategy: "zscore" },
      },
    },
    {
      id: "sink",
      kind: "output",
      label: "Persisti",
      position: { x: 420, y: 40 },
      data: {
        component: "datapizza.sink.write",
        parameters: { destination: "s3://bucket" },
      },
    },
  ],
  edges: [
    {
      id: "source-transform",
      source: { nodeId: "source", portId: "out" },
      target: { nodeId: "transform", portId: "in" },
      label: "dataset",
      metadata: { optional: false },
    },
    {
      id: "transform-sink",
      source: { nodeId: "transform" },
      target: { nodeId: "sink" },
    },
  ],
  extensions: {
    reactFlow: {
      viewport: {
        x: 100,
        y: 200,
        zoom: 1.25,
      },
      sidebarOpen: false,
      inspectorTab: "preview",
    },
    backend: {
      queue: "ml-default",
    },
  },
};

describe("workflow-format", () => {
  it("converts workflow definitions into React Flow structures", () => {
    const graph = toReactFlowGraph(sampleWorkflow);

    expect(graph.nodes).toHaveLength(sampleWorkflow.nodes.length);
    expect(graph.edges).toHaveLength(sampleWorkflow.edges.length);
    expect(graph.viewport).toEqual(sampleWorkflow.extensions?.reactFlow?.viewport);
    expect(graph.reactFlow).toEqual(sampleWorkflow.extensions?.reactFlow);

    const [inputNode] = graph.nodes;
    expect(inputNode?.type).toBe("input");
    expect(inputNode?.data?.label).toBe(sampleWorkflow.nodes[0]?.label);
    expect(inputNode?.data?.component).toBe("datapizza.source.file.load");

    const [firstEdge] = graph.edges;
    expect(firstEdge?.sourceHandle).toBe("out");
    expect(firstEdge?.targetHandle).toBe("in");
    expect(firstEdge?.data?.label).toBe("dataset");
  });

  it("round-trips React Flow graphs back to workflow definitions", () => {
    const graph = toReactFlowGraph(sampleWorkflow);

    const rebuilt = fromReactFlowGraph({
      nodes: graph.nodes,
      edges: graph.edges,
      metadata: sampleWorkflow.metadata,
      version: sampleWorkflow.version,
      extensions: sampleWorkflow.extensions,
    });

    expect(rebuilt).toEqual(sampleWorkflow);
  });

  it("remains JSON and YAML serialisable", () => {
    const json = JSON.stringify(sampleWorkflow);
    const parsedJson = JSON.parse(json) as WorkflowDefinition;
    expect(parsedJson).toEqual(sampleWorkflow);

    const yamlText = YAML.stringify(sampleWorkflow);
    const parsedYaml = YAML.parse(yamlText) as WorkflowDefinition;
    expect(parsedYaml).toEqual(sampleWorkflow);
  });

  it("validates definitions", () => {
    expect(isWorkflowDefinition(sampleWorkflow)).toBe(true);
    const invalidWorkflow = {
      ...sampleWorkflow,
      version: "datapizza.workflow/v0",
    } as unknown;

    expect(isWorkflowDefinition(invalidWorkflow)).toBe(false);
  });
});
