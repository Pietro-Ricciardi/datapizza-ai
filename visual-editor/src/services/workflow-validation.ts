import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { Edge, Node } from "reactflow";
import type { WorkflowMetadata } from "../workflow-format";
import { COMPONENT_SCHEMAS } from "../data/component-schemas";

export type WorkflowValidationSeverity = "error" | "warning";
export type WorkflowValidationScope = "workflow" | "node" | "edge";

export type WorkflowValidationQuickFixBlueprint =
  | {
      id: string;
      label: string;
      kind: "connect-nodes";
      description?: string;
      payload: { sourceId: string; targetId: string };
    }
  | {
      id: string;
      label: string;
      kind: "generate-label";
      description?: string;
      payload: { nodeId: string; label: string };
    }
  | {
      id: string;
      label: string;
      kind: "fill-parameters";
      description?: string;
      payload: { nodeId: string; parameters: Record<string, unknown> };
    }
  | {
      id: string;
      label: string;
      kind: "remove-edge";
      description?: string;
      payload: { edgeId: string };
    };

export interface WorkflowValidationIssueBlueprint {
  id: string;
  scope: WorkflowValidationScope;
  targetId?: string;
  severity: WorkflowValidationSeverity;
  message: string;
  description?: string;
  quickFixes?: WorkflowValidationQuickFixBlueprint[];
}

export interface WorkflowValidationContext {
  nodes: Node[];
  edges: Edge[];
  metadata?: WorkflowMetadata;
}

export interface WorkflowValidationReport {
  issues: WorkflowValidationIssueBlueprint[];
  warnings: number;
  errors: number;
  nodeValidationErrors: NodeValidationErrorMap;
}

type NodeValidationSummary = {
  incoming: Edge[];
  outgoing: Edge[];
};

export type NodeValidationErrorMap = Record<string, string[]>;

type ComponentValidator = ValidateFunction<Record<string, unknown>>;

const ajv = new Ajv({ allErrors: true, strict: false });

const validatorCache: Map<string, ComponentValidator> = new Map();

type DegreeMap = Map<string, NodeValidationSummary>;

type NodeMap = Map<string, Node>;

const DEFAULT_PARAMETERS_PLACEHOLDER: Record<string, unknown> = { placeholder: "TODO" };

export function validateWorkflowGraph({
  nodes,
  edges,
  metadata,
}: WorkflowValidationContext): WorkflowValidationReport {
  const issues: WorkflowValidationIssueBlueprint[] = [];
  const nodeMap: NodeMap = new Map(nodes.map((node) => [node.id, node]));
  const degrees: DegreeMap = buildDegreeMap(nodes, edges);
  let counter = 0;

  const nextIssueId = (prefix: string) => `${prefix}-${counter++}`;

  evaluateMetadata(metadata, () => nextIssueId("metadata"), issues);
  evaluateEdges(edges, nodeMap, () => nextIssueId("edge"), issues);
  evaluateNodes(nodes, degrees, nodeMap, () => nextIssueId("node"), issues);
  const nodeValidationErrors = evaluateNodeSchemas(
    nodes,
    () => nextIssueId("schema"),
    issues,
  );

  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const errors = issues.filter((issue) => issue.severity === "error").length;

  return { issues, warnings, errors, nodeValidationErrors };
}

export type ComponentValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] };

export function validateComponentParameters(
  component: string,
  parameters: Record<string, unknown>,
): ComponentValidationResult {
  const validator = getComponentValidator(component);
  if (!validator) {
    return { valid: true, errors: [] };
  }

  const payload = parameters ?? {};
  const valid = validator(payload);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const formatted = formatAjvErrors(validator.errors);
  return {
    valid: false,
    errors: formatted.length > 0 ? formatted : ["Parametri non validi."],
  };
}

function evaluateMetadata(
  metadata: WorkflowMetadata | undefined,
  idFactory: () => string,
  issues: WorkflowValidationIssueBlueprint[],
): void {
  if (!metadata) {
    issues.push({
      id: idFactory(),
      scope: "workflow",
      severity: "error",
      message: "Metadati mancanti: impossibile serializzare il workflow.",
      description:
        "La definizione corrente non ha metadati associati. Importa o seleziona un template valido per continuare.",
    });
    return;
  }

  const trimmedName = metadata.name?.trim();
  if (!trimmedName) {
    issues.push({
      id: idFactory(),
      scope: "workflow",
      severity: "error",
      message: "Il campo metadata.name è obbligatorio.",
      description:
        "Imposta un nome descrittivo per il workflow: verrà utilizzato durante l'esportazione e nelle richieste al backend.",
    });
  }

  if (Array.isArray(metadata.tags) && metadata.tags.some((tag) => !tag || tag.trim().length === 0)) {
    issues.push({
      id: idFactory(),
      scope: "workflow",
      severity: "warning",
      message: "Sono presenti tag vuoti nei metadati.",
      description:
        "Rimuovi i tag vuoti o contenenti solo spazi: il catalogo utilizza i tag per indicizzare i workflow nelle librerie.",
    });
  }

  if (metadata.category && metadata.category.trim().length === 0) {
    issues.push({
      id: idFactory(),
      scope: "workflow",
      severity: "warning",
      message: "Categoria del workflow vuota.",
      description:
        "Specificare una categoria facilita la ricerca del workflow nelle librerie e nei cataloghi Datapizza.",
    });
  }
}

function evaluateEdges(
  edges: Edge[],
  nodeMap: NodeMap,
  idFactory: () => string,
  issues: WorkflowValidationIssueBlueprint[],
): void {
  edges.forEach((edge) => {
    const edgePrefix = `edge:${edge.id}`;

    if (!nodeMap.has(edge.source)) {
      issues.push({
        id: idFactory(),
        scope: "edge",
        targetId: edge.id,
        severity: "error",
        message: `L'arco collega un nodo sorgente inesistente (${edge.source}).`,
        description: "Rimuovi l'arco o aggiorna il collegamento verso un nodo valido.",
        quickFixes: [
          {
            id: `${edgePrefix}:remove`,
            label: "Rimuovi arco",
            kind: "remove-edge",
            payload: { edgeId: edge.id },
          },
        ],
      });
    }

    if (!nodeMap.has(edge.target)) {
      issues.push({
        id: idFactory(),
        scope: "edge",
        targetId: edge.id,
        severity: "error",
        message: `L'arco collega un nodo destinazione inesistente (${edge.target}).`,
        description: "Rimuovi l'arco o collegalo a un nodo presente nel grafo.",
        quickFixes: [
          {
            id: `${edgePrefix}:remove`,
            label: "Rimuovi arco",
            kind: "remove-edge",
            payload: { edgeId: edge.id },
          },
        ],
      });
    }

    if (edge.source === edge.target) {
      issues.push({
        id: idFactory(),
        scope: "edge",
        targetId: edge.id,
        severity: "warning",
        message: "L'arco crea un loop sullo stesso nodo.",
        description: "I loop possono generare cicli non gestiti durante l'esecuzione del workflow.",
        quickFixes: [
          {
            id: `${edgePrefix}:remove`,
            label: "Rimuovi arco",
            kind: "remove-edge",
            payload: { edgeId: edge.id },
          },
        ],
      });
    }
  });
}

function evaluateNodes(
  nodes: Node[],
  degrees: DegreeMap,
  nodeMap: NodeMap,
  idFactory: () => string,
  issues: WorkflowValidationIssueBlueprint[],
): void {
  nodes.forEach((node) => {
    const summary = degrees.get(node.id) ?? { incoming: [], outgoing: [] };
    const label = extractNodeLabel(node);
    const nodePrefix = `node:${node.id}`;

    if (!label) {
      issues.push({
        id: idFactory(),
        scope: "node",
        targetId: node.id,
        severity: "error",
        message: "Nodo senza etichetta visibile.",
        description: "Imposta una label per identificare facilmente il blocco all'interno del canvas.",
        quickFixes: [
          {
            id: `${nodePrefix}:label`,
            label: "Usa ID come label",
            kind: "generate-label",
            payload: { nodeId: node.id, label: node.id },
          },
        ],
      });
    }

    const nodeKind = determineNodeKind(node);
    const data = (node.data ?? {}) as Record<string, unknown>;

    if (nodeKind !== "input" && summary.incoming.length === 0) {
      const severity: WorkflowValidationSeverity = nodeKind === "output" ? "error" : "warning";
      const message =
        nodeKind === "output"
          ? "Il nodo di output non riceve dati in ingresso."
          : "Il nodo non ha collegamenti in ingresso.";
      issues.push({
        id: idFactory(),
        scope: "node",
        targetId: node.id,
        severity,
        message,
        description:
          "Collega il nodo a un predecessore per assicurare che la pipeline possa essere eseguita sequenzialmente.",
        quickFixes: buildConnectionQuickFix(
          node,
          nodeMap,
          summary,
          nodePrefix,
          "incoming",
        ),
      });
    }

    if (nodeKind !== "output" && summary.outgoing.length === 0) {
      const severity: WorkflowValidationSeverity = nodeKind === "input" ? "error" : "warning";
      const message =
        nodeKind === "input"
          ? "Il nodo di input non instrada i dati verso alcun passaggio successivo."
          : "Il nodo non ha collegamenti in uscita.";
      issues.push({
        id: idFactory(),
        scope: "node",
        targetId: node.id,
        severity,
        message,
        description:
          "Collega il nodo a un successore per garantire che il grafo possa essere percorso dal motore di esecuzione.",
        quickFixes: buildConnectionQuickFix(
          node,
          nodeMap,
          summary,
          nodePrefix,
          "outgoing",
        ),
      });
    }

    if (nodeKind === "task") {
      const parameters = extractNodeParameters(data.parameters);
      if (!parameters || Object.keys(parameters).length === 0) {
        issues.push({
          id: idFactory(),
          scope: "node",
          targetId: node.id,
          severity: "warning",
          message: "Il nodo task non ha parametri configurati.",
          description:
            "Definisci i parametri per evitare esecuzioni incomplete. Puoi partire da un segnaposto modificabile.",
          quickFixes: [
            {
              id: `${nodePrefix}:parameters`,
              label: "Imposta parametri placeholder",
              kind: "fill-parameters",
              payload: { nodeId: node.id, parameters: DEFAULT_PARAMETERS_PLACEHOLDER },
            },
          ],
        });
      }
    }

    if (nodeKind === "input" && summary.incoming.length > 0) {
      issues.push({
        id: idFactory(),
        scope: "node",
        targetId: node.id,
        severity: "warning",
        message: "Il nodo di input riceve connessioni in ingresso.",
        description: "Per convenzione i nodi di input dovrebbero solo emettere dati verso il resto del grafo.",
      });
    }

    if (nodeKind === "output" && summary.outgoing.length > 0) {
      issues.push({
        id: idFactory(),
        scope: "node",
        targetId: node.id,
        severity: "warning",
        message: "Il nodo di output ha connessioni in uscita.",
        description: "I nodi terminali dovrebbero solo raccogliere l'output finale senza generare ulteriori collegamenti.",
      });
    }
  });
}

function evaluateNodeSchemas(
  nodes: Node[],
  idFactory: () => string,
  issues: WorkflowValidationIssueBlueprint[],
): NodeValidationErrorMap {
  const errorMap: NodeValidationErrorMap = {};

  nodes.forEach((node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const component = typeof data.component === "string" ? data.component : undefined;
    if (!component) {
      return;
    }

    const parameters = extractNodeParameters(data.parameters) ?? {};
    const validation = validateComponentParameters(component, parameters);
    if (!validation.valid) {
      errorMap[node.id] = validation.errors;
      const [first, ...rest] = validation.errors;
      const message = first
        ? `Parametri non validi per ${component}: ${first}`
        : `Parametri non validi per ${component}.`;
      issues.push({
        id: idFactory(),
        scope: "node",
        targetId: node.id,
        severity: "error",
        message,
        description: rest.length > 0 ? rest.join(" ") : undefined,
      });
    }
  });

  return errorMap;
}

function buildDegreeMap(nodes: Node[], edges: Edge[]): DegreeMap {
  const map: DegreeMap = new Map();
  nodes.forEach((node) => {
    map.set(node.id, { incoming: [], outgoing: [] });
  });

  edges.forEach((edge) => {
    const sourceSummary = map.get(edge.source);
    if (sourceSummary) {
      sourceSummary.outgoing.push(edge);
    }
    const targetSummary = map.get(edge.target);
    if (targetSummary) {
      targetSummary.incoming.push(edge);
    }
  });

  return map;
}

function extractNodeLabel(node: Node): string {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const label = data.label;
  if (typeof label === "string") {
    return label.trim();
  }
  if (typeof node.id === "string") {
    return node.id.trim();
  }
  return "";
}

function extractNodeParameters(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function determineNodeKind(node: Node): "input" | "output" | "task" {
  switch (node.type) {
    case "input":
      return "input";
    case "output":
      return "output";
    default:
      return "task";
  }
}

type ConnectionDirection = "incoming" | "outgoing";

function getComponentValidator(component: string): ComponentValidator | undefined {
  if (validatorCache.has(component)) {
    return validatorCache.get(component);
  }

  const schema = COMPONENT_SCHEMAS[component];
  if (!schema) {
    return undefined;
  }

  const validator = ajv.compile(schema);
  validatorCache.set(component, validator);
  return validator;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => formatAjvError(error));
}

function formatAjvError(error: ErrorObject): string {
  const path = extractErrorPath(error);

  switch (error.keyword) {
    case "required": {
      const missing = (error.params as { missingProperty: string }).missingProperty;
      return `Manca il campo obbligatorio "${missing}".`;
    }
    case "type": {
      const expected = (error.params as { type: string }).type;
      return `Il campo "${path}" deve essere di tipo ${expected}.`;
    }
    case "minLength": {
      const limit = (error.params as { limit: number }).limit;
      return `Il campo "${path}" deve contenere almeno ${limit} caratteri.`;
    }
    case "maxLength": {
      const limit = (error.params as { limit: number }).limit;
      return `Il campo "${path}" può contenere al massimo ${limit} caratteri.`;
    }
    case "minimum": {
      const limit = (error.params as { limit: number }).limit;
      return `Il campo "${path}" deve essere maggiore o uguale a ${limit}.`;
    }
    case "additionalProperties": {
      const property = (error.params as { additionalProperty: string }).additionalProperty;
      return `Il campo "${property}" non è supportato dal componente.`;
    }
    default:
      return error.message ? `Parametri non validi: ${error.message}.` : "Parametri non validi.";
  }
}

function extractErrorPath(error: ErrorObject): string {
  if (error.instancePath && error.instancePath.length > 1) {
    return error.instancePath.slice(1).replace(/\//g, ".");
  }

  if (typeof (error.params as { missingProperty?: string }).missingProperty === "string") {
    return (error.params as { missingProperty: string }).missingProperty;
  }

  if (
    typeof (error.params as { additionalProperty?: string }).additionalProperty === "string"
  ) {
    return (error.params as { additionalProperty: string }).additionalProperty;
  }

  return "parametri";
}

function buildConnectionQuickFix(
  node: Node,
  nodeMap: NodeMap,
  summary: NodeValidationSummary,
  nodePrefix: string,
  direction: ConnectionDirection,
): WorkflowValidationQuickFixBlueprint[] | undefined {
  const candidate = findClosestConnectableNode(node, nodeMap, summary, direction);
  if (!candidate) {
    return undefined;
  }

  if (direction === "outgoing") {
    return [
      {
        id: `${nodePrefix}:connect:${candidate.id}`,
        label: `Collega a ${candidate.id}`,
        kind: "connect-nodes",
        payload: { sourceId: node.id, targetId: candidate.id },
        description: "Crea rapidamente un arco verso il nodo più vicino non ancora collegato.",
      },
    ];
  }

  return [
    {
      id: `${nodePrefix}:connect:${candidate.id}`,
      label: `Collega da ${candidate.id}`,
      kind: "connect-nodes",
      payload: { sourceId: candidate.id, targetId: node.id },
      description: "Crea rapidamente un arco dal nodo più vicino non ancora collegato.",
    },
  ];
}

function findClosestConnectableNode(
  reference: Node,
  nodeMap: NodeMap,
  summary: NodeValidationSummary,
  direction: ConnectionDirection,
): Node | undefined {
  let shortestDistance = Number.POSITIVE_INFINITY;
  let bestCandidate: Node | undefined;

  const blockedTargets = new Set<string>(
    direction === "outgoing"
      ? summary.outgoing.map((edge) => edge.target)
      : summary.incoming.map((edge) => edge.source),
  );

  nodeMap.forEach((candidate) => {
    if (candidate.id === reference.id) {
      return;
    }
    if (blockedTargets.has(candidate.id)) {
      return;
    }

    const dx = (candidate.position?.x ?? 0) - (reference.position?.x ?? 0);
    const dy = (candidate.position?.y ?? 0) - (reference.position?.y ?? 0);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0 || !Number.isFinite(distance)) {
      return;
    }

    if (distance < shortestDistance) {
      shortestDistance = distance;
      bestCandidate = candidate;
    }
  });

  return bestCandidate;
}
