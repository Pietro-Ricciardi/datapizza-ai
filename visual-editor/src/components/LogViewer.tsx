import { FixedSizeList } from "react-window";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { WorkflowRunLogEntry, WorkflowRunLogLevel } from "../services/workflow-api";

const ROW_HEIGHT = 64;

const LOG_LEVEL_LABEL: Record<WorkflowRunLogLevel, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
};

const COMPONENT_ALL = "__all__";

interface LogViewerProps {
  logs: WorkflowRunLogEntry[];
  loading?: boolean;
  emptyMessage?: string;
}

interface VirtualizedRowProps {
  index: number;
  style: CSSProperties;
  data: WorkflowRunLogEntry[];
}

const LogRow = ({
  index,
  style,
  data,
}: VirtualizedRowProps): JSX.Element => {
  const entry = data[index];
  const levelClass = `log-viewer__row--${entry.level}`;
  const timestamp = new Date(entry.timestamp);
  const formattedTime = Number.isNaN(timestamp.getTime())
    ? entry.timestamp
    : timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className={`log-viewer__row ${levelClass}`} style={style}>
      <div className="log-viewer__meta">
        <time dateTime={entry.timestamp}>{formattedTime}</time>
        {entry.source ? <span>• {entry.source}</span> : null}
        {entry.nodeId ? <span>• Nodo {entry.nodeId}</span> : null}
        <span>• #{entry.sequence}</span>
      </div>
      <p className="log-viewer__message">{entry.message}</p>
    </div>
  );
};

function getComponentKey(entry: WorkflowRunLogEntry): string {
  if (entry.source) {
    return `source:${entry.source}`;
  }
  if (entry.nodeId) {
    return `node:${entry.nodeId}`;
  }
  return "general";
}

function getComponentLabel(entry: WorkflowRunLogEntry): string {
  if (entry.source) {
    return entry.source;
  }
  if (entry.nodeId) {
    return `Nodo ${entry.nodeId}`;
  }
  return "Sistema";
}

export function LogViewer({
  logs,
  loading = false,
  emptyMessage = "Nessun log disponibile per l'esecuzione selezionata.",
}: LogViewerProps): JSX.Element {
  const [levelFilters, setLevelFilters] = useState<Record<WorkflowRunLogLevel, boolean>>({
    info: true,
    warning: true,
    error: true,
  });
  const [componentFilter, setComponentFilter] = useState<string>(COMPONENT_ALL);

  useEffect(() => {
    if (componentFilter === COMPONENT_ALL) {
      return;
    }
    const stillAvailable = logs.some((entry) => getComponentKey(entry) === componentFilter);
    if (!stillAvailable) {
      setComponentFilter(COMPONENT_ALL);
    }
  }, [componentFilter, logs]);

  const availableComponents = useMemo(() => {
    const options = new Map<string, string>();
    logs.forEach((entry) => {
      const key = getComponentKey(entry);
      const label = getComponentLabel(entry);
      if (!options.has(key)) {
        options.set(key, label);
      }
    });
    return Array.from(options.entries());
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (!levelFilters[entry.level]) {
        return false;
      }
      if (componentFilter !== COMPONENT_ALL && getComponentKey(entry) !== componentFilter) {
        return false;
      }
      return true;
    });
  }, [logs, levelFilters, componentFilter]);

  const hasLogs = filteredLogs.length > 0;
  const hasAvailableLogs = logs.length > 0;

  const handleToggleLevel = (level: WorkflowRunLogLevel) => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const handleExport = () => {
    const ndjson = filteredLogs.map((entry) => JSON.stringify(entry)).join("\n");
    const blob = new Blob([ndjson], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `workflow-logs-${timestamp}.ndjson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="log-viewer">
      <div className="log-viewer__toolbar">
        <div className="log-viewer__filters">
          <div className="log-viewer__level-filters" role="group" aria-label="Filtra per livello">
            {Object.entries(LOG_LEVEL_LABEL).map(([level, label]) => (
              <label key={level} className="log-viewer__level-option">
                <input
                  type="checkbox"
                  checked={levelFilters[level as WorkflowRunLogLevel]}
                  onChange={() => handleToggleLevel(level as WorkflowRunLogLevel)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <label className="log-viewer__component-filter">
            <span>Componente</span>
            <select value={componentFilter} onChange={(event) => setComponentFilter(event.target.value)}>
              <option value={COMPONENT_ALL}>Tutti i componenti</option>
              {availableComponents.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="button button--ghost log-viewer__export"
          onClick={handleExport}
          disabled={!hasAvailableLogs}
        >
          Esporta log
        </button>
      </div>
      {hasLogs ? (
        <FixedSizeList
          className="log-viewer__list"
          height={ROW_HEIGHT * Math.min(filteredLogs.length, 6)}
          width="100%"
          itemCount={filteredLogs.length}
          itemSize={ROW_HEIGHT}
          itemData={filteredLogs}
          itemKey={(index) => filteredLogs[index].id}
        >
          {LogRow}
        </FixedSizeList>
      ) : (
        <p className="muted-copy">
          {hasAvailableLogs ? "Nessun log corrisponde ai filtri selezionati." : emptyMessage}
        </p>
      )}
      {loading ? <p className="muted-copy">Caricamento log in corso...</p> : null}
    </div>
  );
}

export default LogViewer;
