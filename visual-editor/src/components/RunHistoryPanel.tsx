import { useEffect, useMemo, useState } from "react";
import type { WorkflowRunHistoryItem } from "../store/workflow-store";

export type TimelineFilter = "all" | "running" | "success" | "failure" | "archived";

export interface RunHistoryPanelTranslations {
  filterAll: string;
  filterRunning: string;
  filterSuccess: string;
  filterFailure: string;
  filterArchived: string;
  emptyHistory: string;
  compareButton: string;
  compareDisabled: string;
  compareSelectionLabel: (count: number) => string;
  resetSelection: string;
  selectForCompare: (runId: string) => string;
  archivedBadge: string;
}

interface RunHistoryPanelProps {
  runs: WorkflowRunHistoryItem[];
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  selectedRunId?: string;
  onSelectRun: (runId: string) => void;
  onRetry: (run: WorkflowRunHistoryItem) => void;
  onDownload: (run: WorkflowRunHistoryItem) => void;
  onArchive: (run: WorkflowRunHistoryItem) => void;
  onCompare: (runs: [WorkflowRunHistoryItem, WorkflowRunHistoryItem]) => void;
  translations: RunHistoryPanelTranslations;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  running: "In esecuzione",
  success: "Completato",
  failure: "Fallito",
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function RunHistoryPanel({
  runs,
  filter,
  onFilterChange,
  selectedRunId,
  onSelectRun,
  onRetry,
  onDownload,
  onArchive,
  onCompare,
  translations,
}: RunHistoryPanelProps): JSX.Element {
  const [selection, setSelection] = useState<string[]>([]);

  useEffect(() => {
    setSelection((current) => current.filter((runId) => runs.some((run) => run.runId === runId)));
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (filter === "all") {
      return runs;
    }
    if (filter === "archived") {
      return runs.filter((run) => run.archived);
    }
    return runs.filter((run) => run.status === filter && !run.archived);
  }, [filter, runs]);

  const selectionSummary = translations.compareSelectionLabel(selection.length);
  const canCompare = selection.length === 2;

  const toggleSelection = (runId: string) => {
    setSelection((current) => {
      if (current.includes(runId)) {
        return current.filter((id) => id !== runId);
      }
      if (current.length === 2) {
        return [current[1], runId];
      }
      return [...current, runId];
    });
  };

  const handleCompare = () => {
    if (!canCompare) {
      return;
    }
    const [firstId, secondId] = selection;
    const firstRun = runs.find((run) => run.runId === firstId);
    const secondRun = runs.find((run) => run.runId === secondId);
    if (firstRun && secondRun) {
      onCompare([firstRun, secondRun]);
    }
  };

  const handleResetSelection = () => {
    setSelection([]);
  };

  return (
    <div className="history-timeline">
      <div className="history-timeline__filters" role="toolbar" aria-label="Filtri cronologia esecuzioni">
        <button
          type="button"
          className={`history-timeline__filter-button${filter === "all" ? " history-timeline__filter-button--active" : ""}`}
          onClick={() => onFilterChange("all")}
          aria-pressed={filter === "all"}
        >
          {translations.filterAll}
        </button>
        <button
          type="button"
          className={`history-timeline__filter-button${filter === "running" ? " history-timeline__filter-button--active" : ""}`}
          onClick={() => onFilterChange("running")}
          aria-pressed={filter === "running"}
        >
          {translations.filterRunning}
        </button>
        <button
          type="button"
          className={`history-timeline__filter-button${filter === "success" ? " history-timeline__filter-button--active" : ""}`}
          onClick={() => onFilterChange("success")}
          aria-pressed={filter === "success"}
        >
          {translations.filterSuccess}
        </button>
        <button
          type="button"
          className={`history-timeline__filter-button${filter === "failure" ? " history-timeline__filter-button--active" : ""}`}
          onClick={() => onFilterChange("failure")}
          aria-pressed={filter === "failure"}
        >
          {translations.filterFailure}
        </button>
        <button
          type="button"
          className={`history-timeline__filter-button${filter === "archived" ? " history-timeline__filter-button--active" : ""}`}
          onClick={() => onFilterChange("archived")}
          aria-pressed={filter === "archived"}
        >
          {translations.filterArchived}
        </button>
      </div>

      <div className="history-timeline__toolbar" aria-live="polite">
        <span className="history-timeline__selection-info">{selectionSummary}</span>
        <div className="history-timeline__compare-actions">
          <button
            type="button"
            className="history-timeline__action-button"
            onClick={handleResetSelection}
            disabled={selection.length === 0}
          >
            {translations.resetSelection}
          </button>
          <button
            type="button"
            className="history-timeline__action-button history-timeline__action-button--primary"
            onClick={handleCompare}
            disabled={!canCompare}
            title={!canCompare ? translations.compareDisabled : undefined}
          >
            {translations.compareButton}
          </button>
        </div>
      </div>

      <table className="history-timeline__table">
        <thead>
          <tr>
            <th scope="col" aria-label="Seleziona run" />
            <th scope="col">Stato</th>
            <th scope="col">Workflow</th>
            <th scope="col">Avviata</th>
            <th scope="col">Ultimo aggiornamento</th>
            <th scope="col" aria-label="Azioni" />
          </tr>
        </thead>
        <tbody>
          {filteredRuns.length === 0 ? (
            <tr className="history-timeline__row">
              <td colSpan={6}>{translations.emptyHistory}</td>
            </tr>
          ) : (
            filteredRuns.map((run) => {
              const statusLabel = getStatusLabel(run.status);
              const rowActive = selectedRunId === run.runId;
              const isSelected = selection.includes(run.runId);
              return (
                <tr
                  key={run.runId}
                  className={`history-timeline__row${rowActive ? " history-timeline__row--active" : ""}`}
                  onClick={() => onSelectRun(run.runId)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={rowActive}
                >
                  <td>
                    <input
                      type="checkbox"
                      aria-label={translations.selectForCompare(run.runId)}
                      checked={isSelected}
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleSelection(run.runId);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td>
                    <span className={`history-timeline__status history-timeline__status--${run.status}`}>
                      {statusLabel}
                    </span>
                    {run.archived ? (
                      <span className="history-timeline__archived-badge">{translations.archivedBadge}</span>
                    ) : null}
                  </td>
                  <td>
                    <div className="history-timeline__title">
                      <strong>{run.workflowName}</strong>
                      <span className="history-timeline__run-id">{run.runId}</span>
                    </div>
                  </td>
                  <td>{formatDate(run.createdAt)}</td>
                  <td>{formatDate(run.updatedAt)}</td>
                  <td>
                    <div className="history-timeline__actions" role="group" aria-label={`Azioni per la run ${run.runId}`}>
                      <button
                        type="button"
                        className="history-timeline__action-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRetry(run);
                        }}
                        disabled={run.status === "running"}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="history-timeline__action-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDownload(run);
                        }}
                        disabled={!run.result}
                      >
                        Artefatti
                      </button>
                      <button
                        type="button"
                        className="history-timeline__action-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onArchive(run);
                        }}
                        disabled={run.archived}
                      >
                        Archivia
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RunHistoryPanel;
