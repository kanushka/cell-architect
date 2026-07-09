import { CellModel, CrossEdge, Diagnostic, ExternalNode, ProjectCompileResult, ProjectModel } from "../domain/cellModel";
import { parseProject, ParsedCrossEdgeResolved } from "../parser/parseProject";
import { compileCellDocument } from "./compileCellSource";

function resolveCrossEdges(
  parsed: ParsedCrossEdgeResolved[],
  cellsById: Map<string, CellModel>
): { edges: CrossEdge[]; diagnostics: Diagnostic[] } {
  const edges: CrossEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  parsed.forEach((edge) => {
    if (!cellsById.has(edge.sourceCell)) {
      diagnostics.push({ severity: "error", message: `Unknown cell "${edge.sourceCell}".`, line: edge.line, column: 1 });
      return;
    }
    if (!cellsById.has(edge.targetCell)) {
      diagnostics.push({ severity: "error", message: `Unknown cell "${edge.targetCell}".`, line: edge.line, column: 1 });
      return;
    }
    edges.push({
      id: edge.id,
      sourceCell: edge.sourceCell,
      sourceComp: edge.sourceComp,
      targetCell: edge.targetCell,
      targetComp: edge.targetComp,
      exit: edge.exit,
      entry: edge.entry,
      mode: edge.mode,
      label: edge.label,
      line: edge.line
    });
  });
  return { edges, diagnostics };
}

export function compileProject(source: string): ProjectCompileResult {
  const { project, diagnostics: parseDiagnostics } = parseProject(source);
  const diagnostics: Diagnostic[] = [...parseDiagnostics];

  const cells: CellModel[] = project.cells.map((cell) => {
    const compiled = compileCellDocument(cell.document);
    diagnostics.push(...compiled.diagnostics);
    return {
      id: cell.id,
      label: cell.label,
      version: cell.document.version,
      components: compiled.components,
      externals: compiled.externals,
      edges: compiled.edges
    };
  });

  // Group externals by id across all cells; used by >=2 cells => shared.
  const usage = new Map<string, { cells: Set<string>; node: ExternalNode }>();
  cells.forEach((cell) => {
    cell.externals.forEach((ext) => {
      const entry = usage.get(ext.id) ?? { cells: new Set<string>(), node: ext };
      entry.cells.add(cell.id);
      if (!entry.node.label && ext.label) { entry.node = { ...entry.node, label: ext.label }; }
      if (!entry.node.type && ext.type) { entry.node = { ...entry.node, type: ext.type }; }
      usage.set(ext.id, entry);
    });
  });

  const sharedIds = new Set(Array.from(usage.entries()).filter(([, v]) => v.cells.size >= 2).map(([id]) => id));
  const sharedExternals: ExternalNode[] = Array.from(sharedIds).map((id) => usage.get(id)!.node);
  const scopedCells: CellModel[] = cells.map((cell) => ({
    ...cell,
    externals: cell.externals.filter((ext) => !sharedIds.has(ext.id))
  }));

  const cellsById = new Map(scopedCells.map((cell) => [cell.id, cell]));
  const { edges: crossEdges, diagnostics: crossDiagnostics } = resolveCrossEdges(project.crossEdges, cellsById);
  diagnostics.push(...crossDiagnostics);

  if (diagnostics.length > 0) {
    return { model: null, diagnostics };
  }

  const model: ProjectModel = { title: project.title, cells: scopedCells, crossEdges, sharedExternals };
  return { model, diagnostics: [] };
}
