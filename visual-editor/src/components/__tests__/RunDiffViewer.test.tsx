import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunDiffViewer } from "../RunDiffViewer";
import type { WorkflowRunHistoryItem } from "../../store/workflow-store";

const baseTranslations = {
  title: "Diff",
  empty: "Seleziona due run",
  error: "Errore di diff",
  noChanges: "Nessuna differenza",
  baseLabel: "Run di riferimento",
  targetLabel: "Run di confronto",
  metadataHeading: "Metadati",
  metadataEnvironment: "Ambiente",
  metadataDataset: "Dataset",
};

function createHistoryItem(
  overrides: Partial<WorkflowRunHistoryItem> & {
    snapshot?: WorkflowRunHistoryItem["snapshot"];
  } = {},
): WorkflowRunHistoryItem {
  const definition = overrides.definition ?? ({} as WorkflowRunHistoryItem["definition"]);
  const result = overrides.result ?? ({} as WorkflowRunHistoryItem["result"]);
  const base: WorkflowRunHistoryItem = {
    runId: "run-1",
    status: "success",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:05:00.000Z",
    workflowName: "Pipeline",
    archived: false,
    definition,
    options: undefined,
    result,
    metadata: { environment: "staging", datasetUri: "s3://bucket" },
    snapshot: {
      definition: JSON.stringify({ version: 1, nodes: [] }),
      options: undefined,
      result: JSON.stringify({ outputs: { accuracy: 0.8 } }),
    },
    error: undefined,
  };
  if (overrides.snapshot) {
    base.snapshot = overrides.snapshot;
  }
  return {
    ...base,
    ...overrides,
  };
}

describe("RunDiffViewer", () => {
  it("mostra il diff JSON quando le run differiscono", () => {
    const baseRun = createHistoryItem({
      runId: "run-a",
      metadata: { environment: "staging" },
    });
    const targetRun = createHistoryItem({
      runId: "run-b",
      metadata: { environment: "production" },
      snapshot: {
        definition: JSON.stringify({ version: 1, nodes: [] }),
        options: undefined,
        result: JSON.stringify({ outputs: { accuracy: 0.95 } }),
      },
    });

    render(
      <RunDiffViewer
        baseRun={baseRun}
        targetRun={targetRun}
        translations={baseTranslations}
      />,
    );

    screen.getByText(baseTranslations.baseLabel);
    const diffOutput = screen.getByText(
      (content) =>
        content.includes('"environment"') &&
        content.includes('"staging"') &&
        content.includes('"production"'),
    );
    expect(diffOutput.textContent).toContain("production");
  });

  it("mostra un messaggio quando non ci sono differenze", () => {
    const run = createHistoryItem({ runId: "run-c" });
    render(
      <RunDiffViewer
        baseRun={run}
        targetRun={run}
        translations={baseTranslations}
      />,
    );

    screen.getByText(baseTranslations.noChanges);
  });

  it("gestisce errori di parsing segnalando il problema", () => {
    const baseRun = createHistoryItem({
      snapshot: {
        definition: "{invalid",
        options: undefined,
        result: undefined,
      },
    });
    const targetRun = createHistoryItem({ runId: "run-d" });

    render(
      <RunDiffViewer
        baseRun={baseRun}
        targetRun={targetRun}
        translations={baseTranslations}
      />,
    );

    screen.getByText(baseTranslations.error);
  });
});
