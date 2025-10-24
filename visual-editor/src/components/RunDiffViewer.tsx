import { useMemo } from "react";
import { diff } from "jsondiffpatch";
import type { WorkflowRunHistoryItem } from "../store/workflow-store";

export interface RunDiffViewerTranslations {
  title: string;
  empty: string;
  error: string;
  noChanges: string;
  baseLabel: string;
  targetLabel: string;
  metadataHeading: string;
  metadataEnvironment: string;
  metadataDataset: string;
}

interface RunDiffViewerProps {
  baseRun?: WorkflowRunHistoryItem;
  targetRun?: WorkflowRunHistoryItem;
  translations: RunDiffViewerTranslations;
}

interface ParsedRunSnapshot {
  comparable: Record<string, unknown>;
  error?: Error;
}

function parseRunSnapshot(run: WorkflowRunHistoryItem | undefined): ParsedRunSnapshot | undefined {
  if (!run) {
    return undefined;
  }

  try {
    const definition = JSON.parse(run.snapshot.definition) as unknown;
    const options = run.snapshot.options ? (JSON.parse(run.snapshot.options) as unknown) : undefined;
    const result = run.snapshot.result ? (JSON.parse(run.snapshot.result) as unknown) : undefined;
    const comparable: Record<string, unknown> = {
      runId: run.runId,
      workflowName: run.workflowName,
      status: run.status,
      definition,
      options,
      result,
      metadata: run.metadata ?? {},
    };

    return { comparable };
  } catch (error) {
    const parsedError = error instanceof Error ? error : new Error(String(error));
    return {
      comparable: {},
      error: parsedError,
    };
  }
}

function renderMetadata(
  run: WorkflowRunHistoryItem,
  translations: Pick<
    RunDiffViewerTranslations,
    "metadataHeading" | "metadataEnvironment" | "metadataDataset"
  >,
): JSX.Element {
  return (
    <div className="history-diff__metadata">
      <h4>{translations.metadataHeading}</h4>
      <dl>
        <div>
          <dt>{translations.metadataEnvironment}</dt>
          <dd>{run.metadata?.environment ?? "—"}</dd>
        </div>
        <div>
          <dt>{translations.metadataDataset}</dt>
          <dd>{run.metadata?.datasetUri ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function RunDiffViewer({
  baseRun,
  targetRun,
  translations,
}: RunDiffViewerProps): JSX.Element {
  const parsedBase = useMemo(() => parseRunSnapshot(baseRun), [baseRun]);
  const parsedTarget = useMemo(() => parseRunSnapshot(targetRun), [targetRun]);

  if (!baseRun || !targetRun) {
    return <p className="muted-copy">{translations.empty}</p>;
  }

  if (parsedBase?.error || parsedTarget?.error) {
    return (
      <p className="inline-feedback inline-feedback--error">{translations.error}</p>
    );
  }

  const delta = useMemo(() => {
    if (!parsedBase?.comparable || !parsedTarget?.comparable) {
      return undefined;
    }
    const computed = diff(parsedBase.comparable, parsedTarget.comparable);
    return computed ?? null;
  }, [parsedBase, parsedTarget]);

  if (delta === null) {
    return <p className="muted-copy">{translations.noChanges}</p>;
  }

  if (!delta) {
    return <p className="inline-feedback inline-feedback--error">{translations.error}</p>;
  }

  return (
    <section className="history-diff" aria-label={translations.title}>
      <h3>{translations.title}</h3>
      <div className="history-diff__summary">
        <div>
          <h4>{translations.baseLabel}</h4>
          <p>
            <strong>{baseRun.workflowName}</strong>
          </p>
          <p className="muted-copy">{baseRun.runId}</p>
          {renderMetadata(baseRun, translations)}
        </div>
        <div>
          <h4>{translations.targetLabel}</h4>
          <p>
            <strong>{targetRun.workflowName}</strong>
          </p>
          <p className="muted-copy">{targetRun.runId}</p>
          {renderMetadata(targetRun, translations)}
        </div>
      </div>
      <pre className="code-block history-diff__code">{JSON.stringify(delta, null, 2)}</pre>
    </section>
  );
}

export default RunDiffViewer;
