import { useMemo } from "react";
import type { WorkflowRunHistoryItem } from "../store/workflow-store";

export type TimelineFilter = "all" | "running" | "success" | "failure" | "archived";

interface ExecutionHistoryTimelineProps {
  runs: WorkflowRunHistoryItem[];
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  selectedRunId?: string;
  onSelectRun: (runId: string) => void;
  onRetry: (run: WorkflowRunHistoryItem) => void;
  onDownload: (run: WorkflowRunHistoryItem) => void;
  onArchive: (run: WorkflowRunHistoryItem) => void;
}

const FILTER_OPTIONS: { label: string; value: TimelineFilter }[] = [
  { label: "Tutte", value: "all" },
  { label: "In corso", value: "running" },
  { label: "Completate", value: "success" },
  { label: "Fallite", value: "failure" },
  { label: "Archiviate", value: "archived" },
];

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

export function ExecutionHistoryTimeline({
  runs,
  filter,
  onFilterChange,
  selectedRunId,
  onSelectRun,
  onRetry,
  onDownload,
  onArchive,
}: ExecutionHistoryTimelineProps): JSX.Element {
  const filteredRuns = useMemo(() => {
    if (filter === "all") {
      return runs;
    }
    if (filter === "archived") {
      return runs.filter((run) => run.archived);
    }
    return runs.filter((run) => run.status === filter && !run.archived);
  }, [filter, runs]);

  return (
    <div className="history-timeline">
      <div className="history-timeline__filters" role="toolbar" aria-label="Filtri cronologia esecuzioni">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`history-timeline__filter-button${filter === option.value ? " history-timeline__filter-button--active" : ""}`}
            onClick={() => onFilterChange(option.value)}
            aria-pressed={filter === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
      <table className="history-timeline__table">
        <thead>
          <tr>
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
              <td colSpan={5}>Nessuna esecuzione registrata.</td>
            </tr>
          ) : (
            filteredRuns.map((run) => {
              const statusLabel = getStatusLabel(run.status);
              const rowActive = selectedRunId === run.runId;
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
                    <span className={`history-timeline__status history-timeline__status--${run.status}`}>
                      {statusLabel}
                    </span>
                    {run.archived ? (
                      <span className="history-timeline__archived-badge">Archiviato</span>
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

export default ExecutionHistoryTimeline;
