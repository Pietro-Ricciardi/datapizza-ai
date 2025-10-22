import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { WorkflowValidationSeverity } from "../services/workflow-validation";

export type ValidationNodeVariant = "input" | "task" | "output";

export interface ValidationNodeData extends Record<string, unknown> {
  label?: string;
  validationSummary?: {
    severity: WorkflowValidationSeverity;
    count: number;
    messages: string[];
  };
}

interface BaseValidationNodeProps extends NodeProps<ValidationNodeData> {
  variant: ValidationNodeVariant;
}

function getLabel(id: string, data: ValidationNodeData | undefined): string {
  const label = data?.label;
  if (typeof label === "string" && label.trim().length > 0) {
    return label;
  }
  return id;
}

function getBadgeLabel(severity: WorkflowValidationSeverity): string {
  return severity === "error" ? "Errore" : "Avviso";
}

function BaseValidationNode({ id, data, selected, variant }: BaseValidationNodeProps): JSX.Element {
  const summary = data?.validationSummary;
  const label = getLabel(id, data);
  const tooltip = summary ? summary.messages.join("\n") : undefined;
  const classes = [
    "workflow-node",
    `workflow-node--${variant}`,
    selected ? "workflow-node--selected" : undefined,
    summary ? `workflow-node--has-${summary.severity}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} title={tooltip} aria-label={summary ? `${label}: ${summary.messages.join(". ")}` : label}>
      {variant !== "input" ? <Handle type="target" position={Position.Left} /> : null}
      <div className="workflow-node__body">
        <span className="workflow-node__label">{label}</span>
        {summary ? (
          <span
            className={`workflow-node__badge workflow-node__badge--${summary.severity}`}
            role="status"
            aria-label={`${getBadgeLabel(summary.severity)}: ${summary.count}`}
          >
            {summary.severity === "error" ? "⛔" : "⚠️"}
            <span className="workflow-node__badge-count">{summary.count}</span>
          </span>
        ) : null}
      </div>
      {variant !== "output" ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

export const InputValidationNode = memo((props: NodeProps<ValidationNodeData>) => (
  <BaseValidationNode {...props} variant="input" />
));
InputValidationNode.displayName = "InputValidationNode";

export const TaskValidationNode = memo((props: NodeProps<ValidationNodeData>) => (
  <BaseValidationNode {...props} variant="task" />
));
TaskValidationNode.displayName = "TaskValidationNode";

export const OutputValidationNode = memo((props: NodeProps<ValidationNodeData>) => (
  <BaseValidationNode {...props} variant="output" />
));
OutputValidationNode.displayName = "OutputValidationNode";
