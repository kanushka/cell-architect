import { CrossEntry, CrossExit, Diagnostic, ParsedCellDocument } from "../domain/cellModel";
import { isCellDslStatement, parseCellDsl } from "./parseCellDsl";
import { CellBlock, SourceLine, splitCells } from "./splitCells";
import { ParsedCrossEdge, parseCrossEdge } from "./crossEdge";

export interface ParsedCell {
  id: string;
  label?: string;
  document: ParsedCellDocument;
}

export interface ParsedCrossEdgeResolved {
  id: string;
  sourceCell: string;
  sourceComp: string;
  targetCell: string;
  targetComp: string;
  exit: CrossExit;
  entry: CrossEntry;
  mode: "connected" | "decoupled";
  label?: string;
  line: number;
}

export interface ParsedProject {
  title?: string;
  cells: ParsedCell[];
  crossEdges: ParsedCrossEdgeResolved[];
}

export interface ParseProjectResult {
  project: ParsedProject;
  diagnostics: Diagnostic[];
}

export const MIXED_CELL_MODE_DIAGNOSTIC_CODE = "mixed-cell-mode";
export const MIXED_CELL_MODE_MESSAGE =
  "This document uses cell blocks. Components and local dependencies must be inside a named cell.";

function mixedCellModeDiagnostic(line: number): Diagnostic {
  return {
    severity: "error",
    code: MIXED_CELL_MODE_DIAGNOSTIC_CODE,
    message: MIXED_CELL_MODE_MESSAGE,
    line,
    column: 1
  };
}

function crossEdgeId(sourceCell: string, sourceComp: string, targetCell: string, targetComp: string, line: number) {
  return `cross-${sourceCell}-${sourceComp}-${targetCell}-${targetComp}-${line}`;
}

function cellBodySource(lines: SourceLine[]): string {
  if (lines.length === 0) {
    return "";
  }
  const parts: string[] = [];
  let cursor = 1;
  lines.forEach((entry) => {
    while (cursor < entry.line) {
      parts.push("");
      cursor++;
    }
    parts.push(entry.text);
    cursor = entry.line + 1;
  });
  return parts.join("\n");
}

function buildResolvedEdge(cross: ParsedCrossEdge, sourceCell: string): ParsedCrossEdgeResolved {
  return {
    id: crossEdgeId(sourceCell, cross.sourceComp, cross.targetCell, cross.targetComp, cross.line),
    sourceCell,
    sourceComp: cross.sourceComp,
    targetCell: cross.targetCell,
    targetComp: cross.targetComp,
    exit: cross.exit,
    entry: cross.entry,
    mode: cross.exit === "east" ? "connected" : "decoupled",
    label: cross.label,
    line: cross.line
  };
}

function directionErrorMessage(error: "bare-south" | "bad-token"): string {
  return error === "bare-south"
    ? "A south cross-cell link needs an explicit entry, e.g. `south-north`. Use `east` for a connected link."
    : "Invalid cross-cell direction. Exit must be east or south; entry must be west or north.";
}

export function parseProject(source: string): ParseProjectResult {
  const split = splitCells(source);
  const diagnostics: Diagnostic[] = [...split.diagnostics];
  const crossEdges: ParsedCrossEdgeResolved[] = [];

  const cells: ParsedCell[] = split.cells.map((block: CellBlock) => {
    const keptLines: SourceLine[] = [];
    block.lines.forEach((entry) => {
      const cross = parseCrossEdge(entry.text, entry.line);
      if (cross === null) {
        keptLines.push(entry);
        return;
      }
      if ("error" in cross) {
        diagnostics.push({ severity: "error", message: directionErrorMessage(cross.error), line: cross.line, column: 1 });
        return;
      }
      const sourceCell = cross.sourceCell ?? block.id;
      crossEdges.push(buildResolvedEdge(cross, sourceCell));
    });

    const parsed = parseCellDsl(cellBodySource(keptLines));
    diagnostics.push(...parsed.diagnostics);
    return { id: block.id, label: block.label, document: parsed.document };
  });

  let title: string | undefined = split.implicit ? cells[0]?.document.title : undefined;

  split.topLevel.forEach((entry) => {
    if (entry.text.startsWith("title ")) {
      title = entry.text.slice("title ".length).trim() || undefined;
      return;
    }
    if (entry.text.startsWith("#") || entry.text.startsWith("//")) {
      return;
    }
    const cross = parseCrossEdge(entry.text, entry.line);
    if (cross && "error" in cross) {
      diagnostics.push({ severity: "error", message: directionErrorMessage(cross.error), line: cross.line, column: 1 });
      return;
    }
    if (cross) {
      if (!cross.sourceCell) {
        diagnostics.push(mixedCellModeDiagnostic(cross.line));
        return;
      }
      crossEdges.push(buildResolvedEdge(cross, cross.sourceCell));
      return;
    }
    diagnostics.push(
      isCellDslStatement(entry.text)
        ? mixedCellModeDiagnostic(entry.line)
        : {
            severity: "error",
            message: "Only `title`, comments, and cross-cell edges are allowed outside a cell block.",
            line: entry.line,
            column: 1
          }
    );
  });

  return { project: { title, cells, crossEdges }, diagnostics };
}
