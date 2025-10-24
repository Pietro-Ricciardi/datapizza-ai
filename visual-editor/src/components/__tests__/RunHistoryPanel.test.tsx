import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RunHistoryPanel, type RunHistoryPanelTranslations } from "../RunHistoryPanel";
import type { WorkflowRunHistoryItem } from "../../store/workflow-store";

const translations: RunHistoryPanelTranslations = {
  filterAll: "Tutte",
  filterRunning: "In corso",
  filterSuccess: "Completate",
  filterFailure: "Fallite",
  filterArchived: "Archiviate",
  emptyHistory: "Nessuna run",
  compareButton: "Confronta",
  compareDisabled: "Seleziona due run da confrontare.",
  compareSelectionLabel: (count) => `${count} selezioni`,
  resetSelection: "Azzera",
  selectForCompare: (runId) => `Seleziona ${runId}`,
  archivedBadge: "Archiviato",
};

function createRun(id: string, overrides: Partial<WorkflowRunHistoryItem> = {}): WorkflowRunHistoryItem {
  return {
    runId: id,
    status: "success",
    createdAt: "2024-01-01T10:00:00.000Z",
    updatedAt: "2024-01-01T10:05:00.000Z",
    workflowName: `Workflow ${id}`,
    archived: false,
    definition: {} as WorkflowRunHistoryItem["definition"],
    options: undefined,
    result: undefined,
    metadata: undefined,
    snapshot: {
      definition: JSON.stringify({ version: 1 }),
      options: undefined,
      result: undefined,
    },
    error: undefined,
    ...overrides,
  };
}

describe("RunHistoryPanel", () => {
  it("abilita il confronto dopo la selezione di due run", async () => {
    const user = userEvent.setup();
    const runs = [createRun("run-1"), createRun("run-2"), createRun("run-3")];
    const onCompare = vi.fn();

    render(
      <RunHistoryPanel
        runs={runs}
        filter="all"
        onFilterChange={() => undefined}
        selectedRunId={undefined}
        onSelectRun={() => undefined}
        onRetry={() => undefined}
        onDownload={() => undefined}
        onArchive={() => undefined}
        onCompare={onCompare}
        translations={translations}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const compareButton = screen.getByRole("button", { name: /confronta/i });

    expect(compareButton.hasAttribute("disabled")).toBe(true);

    await user.click(checkboxes[0]);
    screen.getByText("1 selezioni");

    await user.click(checkboxes[1]);
    expect(compareButton.hasAttribute("disabled")).toBe(false);

    await user.click(compareButton);
    expect(onCompare).toHaveBeenCalledTimes(1);
    const [firstArg] = onCompare.mock.calls[0];
    expect(firstArg[0].runId).toBe("run-1");
    expect(firstArg[1].runId).toBe("run-2");
  });

});
