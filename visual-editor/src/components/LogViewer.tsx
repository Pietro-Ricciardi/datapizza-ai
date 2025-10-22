import { FixedSizeList } from "react-window";
import type { CSSProperties } from "react";
import type { WorkflowRunLogEntry } from "../services/workflow-api";

const ROW_HEIGHT = 64;

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
        {entry.nodeId ? <span>• Nodo {entry.nodeId}</span> : null}
        <span>• #{entry.sequence}</span>
      </div>
      <p className="log-viewer__message">{entry.message}</p>
    </div>
  );
};

export function LogViewer({
  logs,
  loading = false,
  emptyMessage = "Nessun log disponibile per l'esecuzione selezionata.",
}: LogViewerProps): JSX.Element {
  const hasLogs = logs.length > 0;

  return (
    <div className="log-viewer">
      {hasLogs ? (
        <FixedSizeList
          className="log-viewer__list"
          height={ROW_HEIGHT * Math.min(logs.length, 6)}
          width="100%"
          itemCount={logs.length}
          itemSize={ROW_HEIGHT}
          itemData={logs}
        >
          {LogRow}
        </FixedSizeList>
      ) : (
        <p className="muted-copy">{emptyMessage}</p>
      )}
      {loading ? <p className="muted-copy">Caricamento log in corso...</p> : null}
    </div>
  );
}

export default LogViewer;
