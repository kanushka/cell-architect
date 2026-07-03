import {
  BoundaryDirection,
  CellDiagramModel,
  CompileResult,
  Diagnostic,
  ParsedEdge
} from "../domain/cellModel";
import { parseCellDsl } from "../parser/parseCellDsl";

function endpointColumn(lineText: string, endpoint: string) {
  const index = lineText.indexOf(endpoint);
  return index === -1 ? 1 : index + 1;
}

function validateEdge(edge: ParsedEdge, componentIds: Set<string>, lines: string[]): Diagnostic[] {
  const lineText = lines[edge.line - 1] ?? "";

  if (edge.kind === "internal") {
    const diagnostics: Diagnostic[] = [];

    if (!componentIds.has(edge.source)) {
      diagnostics.push({
        severity: "error",
        message: `Internal dependency source "${edge.source}" is not a defined component.`,
        line: edge.line,
        column: endpointColumn(lineText, edge.source)
      });
    }

    if (!componentIds.has(edge.target)) {
      diagnostics.push({
        severity: "error",
        message: `Internal dependency target "${edge.target}" is not a defined component.`,
        line: edge.line,
        column: endpointColumn(lineText, edge.target)
      });
    }

    return diagnostics;
  }

  if (edge.kind === "inbound" && !componentIds.has(edge.target)) {
    return [
      {
        severity: "error",
        message: `Inbound dependency target "${edge.target}" is not a defined component.`,
        line: edge.line,
        column: endpointColumn(lineText, edge.target)
      }
    ];
  }

  if (edge.kind === "outbound" && !componentIds.has(edge.source)) {
    return [
      {
        severity: "error",
        message: `Outbound dependency source "${edge.source}" is not a defined component.`,
        line: edge.line,
        column: endpointColumn(lineText, edge.source)
      }
    ];
  }

  if (edge.kind === "exposure" && !componentIds.has(edge.source)) {
    return [
      {
        severity: "error",
        message: `Gateway exposure source "${edge.source}" is not a defined component.`,
        line: edge.line,
        column: endpointColumn(lineText, edge.source)
      }
    ];
  }

  return [];
}

export function compileCellSource(source: string): CompileResult {
  const parsed = parseCellDsl(source);
  const componentIds = new Set(parsed.document.components.map((component) => component.id));
  const lines = source.split(/\r?\n/);
  const diagnostics = [
    ...parsed.diagnostics,
    ...parsed.document.edges.flatMap((edge) => validateEdge(edge, componentIds, lines))
  ];

  if (diagnostics.length > 0) {
    return { model: null, diagnostics };
  }

  const externalMap = new Map<string, BoundaryDirection>();

  parsed.document.edges.forEach((edge) => {
    if (edge.kind === "inbound" && edge.direction !== "internal") {
      externalMap.set(edge.source, edge.direction);
    }

    if (edge.kind === "outbound" && edge.direction !== "internal") {
      externalMap.set(edge.target, edge.direction);
    }
  });

  const model: CellDiagramModel = {
    title: parsed.document.title,
    version: parsed.document.version,
    components: parsed.document.components,
    externals: Array.from(externalMap.entries()).map(([id, direction]) => ({ id, direction })),
    edges: parsed.document.edges
  };

  return { model, diagnostics: [] };
}
