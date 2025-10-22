import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { Node } from "reactflow";
import { type WorkflowNodeKind } from "../workflow-format";
import { useWorkflowStore, workflowSelectors } from "../store/workflow-store";
import { validateComponentParameters } from "../services/workflow-validation";

type NodeInspectorProps = {
  node: Node;
};

type FieldError = string | undefined;

type KindOption = {
  value: WorkflowNodeKind;
  label: string;
};

const KIND_OPTIONS: KindOption[] = [
  { value: "input", label: "Input" },
  { value: "task", label: "Task" },
  { value: "output", label: "Output" },
];

function getNodeLabel(node: Node): string {
  const label = (node.data as Record<string, unknown> | undefined)?.label;
  return typeof label === "string" ? label : node.id;
}

function getNodeKind(node: Node): WorkflowNodeKind {
  switch (node.type) {
    case "input":
      return "input";
    case "output":
      return "output";
    default:
      return "task";
  }
}

function formatParameters(value: unknown): string {
  if (!value) {
    return "{}";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.warn("Impossibile serializzare i parametri del nodo", error);
    return "{}";
  }
}

function parseParameters(source: string): Record<string, unknown> | undefined {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (parsed === null) {
    return undefined;
  }
  if (Array.isArray(parsed)) {
    throw new Error("I parametri devono essere un oggetto JSON.");
  }
  if (typeof parsed !== "object") {
    throw new Error("I parametri devono essere rappresentati come oggetto.");
  }

  return parsed as Record<string, unknown>;
}

export function NodeInspector({ node }: NodeInspectorProps): JSX.Element {
  const updateNodeLabel = useWorkflowStore(workflowSelectors.updateNodeLabel);
  const updateNodeKind = useWorkflowStore(workflowSelectors.updateNodeKind);
  const updateNodeParameters = useWorkflowStore(workflowSelectors.updateNodeParameters);
  const nodeValidationErrors = useWorkflowStore(workflowSelectors.nodeValidationErrors);

  const [label, setLabel] = useState(() => getNodeLabel(node));
  const [labelError, setLabelError] = useState<FieldError>();
  const [kind, setKind] = useState<WorkflowNodeKind>(() => getNodeKind(node));
  const [parametersSource, setParametersSource] = useState(() =>
    formatParameters((node.data as Record<string, unknown> | undefined)?.parameters),
  );
  const [parametersError, setParametersError] = useState<FieldError>();

  const schemaErrors = useMemo(() => {
    const errors = nodeValidationErrors[node.id];
    if (!errors || errors.length === 0) {
      return undefined;
    }
    return `Parametri non validi: ${errors.join(" ")}`;
  }, [node.id, nodeValidationErrors]);

  const component = useMemo(() => {
    const data = node.data as Record<string, unknown> | undefined;
    return typeof data?.component === "string" ? data.component : undefined;
  }, [node.data]);

  useEffect(() => {
    setLabel(getNodeLabel(node));
    setLabelError(undefined);
    setKind(getNodeKind(node));
    setParametersSource(
      formatParameters((node.data as Record<string, unknown> | undefined)?.parameters),
    );
    setParametersError(undefined);
  }, [node]);

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLabel(value);
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setLabelError("L'etichetta è obbligatoria.");
      return;
    }
    setLabelError(undefined);
    updateNodeLabel(node.id, trimmed);
  };

  const handleKindChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextKind = event.target.value as WorkflowNodeKind;
    setKind(nextKind);
    updateNodeKind(node.id, nextKind);
  };

  const handleParametersBlur = () => {
    try {
      const parsed = parseParameters(parametersSource);
      if (component) {
        const validation = validateComponentParameters(component, parsed ?? {});
        if (!validation.valid) {
          setParametersError(`Parametri non validi: ${validation.errors.join(" ")}`);
          return;
        }
      }
      setParametersError(undefined);
      updateNodeParameters(node.id, parsed);
    } catch (error) {
      const detail =
        error instanceof Error && error.message ? error.message : "verificare il JSON.";
      setParametersError(`Parametri non validi: ${detail}`);
    }
  };

  return (
    <div className="node-inspector" aria-live="polite">
      <div className="node-inspector__field">
        <label className="form-field" htmlFor="node-label">
          <span className="form-field__label">Label nodo</span>
          <input
            id="node-label"
            className="form-field__input"
            type="text"
            value={label}
            onChange={handleLabelChange}
            placeholder="es. Estrai features"
            required
          />
        </label>
        {labelError ? <p className="inline-feedback inline-feedback--error">{labelError}</p> : null}
      </div>

      <div className="node-inspector__field">
        <label className="form-field" htmlFor="node-kind">
          <span className="form-field__label">Tipo logico</span>
          <select
            id="node-kind"
            className="form-field__input"
            value={kind}
            onChange={handleKindChange}
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="node-inspector__field">
        <span className="form-field__label">Componente associato</span>
        <p className="node-inspector__component" aria-live="polite">
          {component ?? "Nessun componente configurato"}
        </p>
      </div>

      <div className="node-inspector__field">
        <label className="form-field" htmlFor="node-parameters">
          <span className="form-field__label">Parametri (JSON)</span>
          <textarea
            id="node-parameters"
            className="form-field__textarea"
            value={parametersSource}
            onChange={(event) => setParametersSource(event.target.value)}
            onBlur={handleParametersBlur}
            spellCheck={false}
            rows={8}
          />
        </label>
        {parametersError || schemaErrors ? (
          <p className="inline-feedback inline-feedback--error">
            {parametersError ?? schemaErrors}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default NodeInspector;
