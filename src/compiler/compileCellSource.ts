import {
  BoundaryDirection,
  CellDiagramModel,
  CompileResult,
  Diagnostic,
  ExternalNode,
  ParsedComponent,
  ParsedEdge
} from "../domain/cellModel";
import { parseCellDsl } from "../parser/parseCellDsl";

const boundaryDirections = new Set<string>(["north", "east", "south", "west"]);
const inboundDirections = new Set<string>(["north", "west"]);
const outboundDirections = new Set<string>(["east", "south"]);

function edgeId(direction: string, source: string, target: string, line: number) {
  return `${direction}-${source}-${target}-${line}`;
}

function isBoundaryDirection(value: string): value is BoundaryDirection {
  return boundaryDirections.has(value);
}

function directionLabel(direction: string) {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

function createLookup(items: Array<ParsedComponent | ExternalNode>) {
  const lookup = new Map<string, string>();
  const duplicates = new Set<string>();

  items.forEach((item) => {
    [item.id, item.label].filter(Boolean).forEach((key) => {
      const name = String(key);
      if (lookup.has(name) && lookup.get(name) !== item.id) {
        duplicates.add(name);
        lookup.delete(name);
        return;
      }

      if (!duplicates.has(name)) {
        lookup.set(name, item.id);
      }
    });
  });

  return lookup;
}

function normalizeEdge(
  edge: ParsedEdge,
  componentLookup: Map<string, string>,
  externalLookup: Map<string, string>,
  externalMap: Map<string, ExternalNode>
): ParsedEdge {
  const source =
    edge.kind === "exposure" && isBoundaryDirection(edge.source)
      ? edge.source
      : componentLookup.get(edge.source) ?? externalLookup.get(edge.source) ?? edge.source;
  const target =
    edge.kind === "exposure" && isBoundaryDirection(edge.target)
      ? edge.target
      : componentLookup.get(edge.target) ?? externalLookup.get(edge.target) ?? edge.target;
  const sourceExternal = externalMap.get(externalLookup.get(edge.source) ?? edge.source);
  const targetExternal = externalMap.get(externalLookup.get(edge.target) ?? edge.target);

  if (edge.kind === "internal" && sourceExternal && !targetExternal) {
    return {
      ...edge,
      id: edgeId(sourceExternal.direction, sourceExternal.id, target, edge.line),
      source: sourceExternal.id,
      target,
      direction: sourceExternal.direction,
      kind: "inbound"
    };
  }

  if (edge.kind === "internal" && targetExternal && !sourceExternal) {
    return {
      ...edge,
      id: edgeId(targetExternal.direction, source, targetExternal.id, edge.line),
      source,
      target: targetExternal.id,
      direction: targetExternal.direction,
      kind: "outbound"
    };
  }

  return {
    ...edge,
    source,
    target
  };
}

function validateEdgeDirection(edge: ParsedEdge): Diagnostic[] {
  if (edge.kind === "inbound" && !inboundDirections.has(edge.direction)) {
    return [
      {
        severity: "error",
        message: `${directionLabel(edge.direction)} boundary connections must flow out of the cell.`,
        line: edge.line,
        column: 1
      }
    ];
  }

  if (edge.kind === "outbound" && !outboundDirections.has(edge.direction)) {
    return [
      {
        severity: "error",
        message: `${directionLabel(edge.direction)} boundary connections must flow into the cell.`,
        line: edge.line,
        column: 1
      }
    ];
  }

  if (edge.kind !== "exposure") {
    return [];
  }

  const startsAtGateway = edge.source === edge.direction && isBoundaryDirection(edge.source);
  const endsAtGateway = edge.target === edge.direction && isBoundaryDirection(edge.target);

  if (startsAtGateway && !inboundDirections.has(edge.direction)) {
    return [
      {
        severity: "error",
        message: `${directionLabel(edge.direction)} boundary connections must flow out of the cell. Use "${edge.target} -> ${edge.direction}".`,
        line: edge.line,
        column: 1
      }
    ];
  }

  if (endsAtGateway && !outboundDirections.has(edge.direction)) {
    return [
      {
        severity: "error",
        message: `${directionLabel(edge.direction)} boundary connections must flow into the cell. Use "${edge.direction} -> ${edge.source}".`,
        line: edge.line,
        column: 1
      }
    ];
  }

  return [];
}

function inferredComponents(components: ParsedComponent[], edges: ParsedEdge[]) {
  const componentMap = new Map<string, ParsedComponent>(components.map((component) => [component.id, component]));

  function ensureComponent(id: string) {
    if (!componentMap.has(id)) {
      componentMap.set(id, { id });
    }
  }

  edges.forEach((edge) => {
    if (edge.kind === "internal") {
      ensureComponent(edge.source);
      ensureComponent(edge.target);
      return;
    }

    if (edge.kind === "inbound") {
      ensureComponent(edge.target);
      return;
    }

    if (edge.kind === "outbound" || edge.kind === "exposure") {
      if (isBoundaryDirection(edge.source)) {
        ensureComponent(edge.target);
      } else {
        ensureComponent(edge.source);
      }
    }
  });

  return Array.from(componentMap.values());
}

export function compileCellSource(source: string): CompileResult {
  const parsed = parseCellDsl(source);
  const componentLookup = createLookup(parsed.document.components);
  const declaredExternalMap = new Map<string, ExternalNode>(
    parsed.document.externals.map((external) => [external.id, external])
  );
  const externalLookup = createLookup(parsed.document.externals);
  const normalizedEdges = parsed.document.edges.map((edge) =>
    normalizeEdge(edge, componentLookup, externalLookup, declaredExternalMap)
  );
  const components = inferredComponents(parsed.document.components, normalizedEdges);
  const diagnostics = [...parsed.diagnostics, ...normalizedEdges.flatMap(validateEdgeDirection)];

  if (diagnostics.length > 0) {
    return { model: null, diagnostics };
  }

  const externalMap = new Map<string, ExternalNode>(declaredExternalMap);

  normalizedEdges.forEach((edge) => {
    if (edge.kind === "inbound" && edge.direction !== "internal") {
      externalMap.set(edge.source, externalMap.get(edge.source) ?? { id: edge.source, direction: edge.direction, line: edge.line });
    }

    if (edge.kind === "outbound" && edge.direction !== "internal") {
      externalMap.set(edge.target, externalMap.get(edge.target) ?? { id: edge.target, direction: edge.direction, line: edge.line });
    }
  });

  const model: CellDiagramModel = {
    title: parsed.document.title,
    version: parsed.document.version,
    components,
    externals: Array.from(externalMap.values()),
    edges: normalizedEdges
  };

  return { model, diagnostics: [] };
}
