import { CrossEntry, CrossExit, Diagnostic, ParsedCellDocument } from "../domain/cellModel";
import { parseCellDsl } from "./parseCellDsl";
import { CellBlock, SourceLine, splitCells } from "./splitCells";
import { parseCrossEdge } from "./crossEdge";

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

function crossEdgeId(sourceCell: string, sourceComp: string, targetCell: string, targetComp: string, line: number) {
  return `cross-${sourceCell}-${sourceComp}-${targetCell}-${targetComp}-${line}`;
}

function cellBodySource(lines: SourceLine[]): string {
  return lines.map((entry) => entry.text).join("\n");
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
      crossEdges.push({
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
      });
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
      const sourceCell = cross.sourceCell ?? "";
      crossEdges.push({
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
      });
      return;
    }
    diagnostics.push({
      severity: "error",
      message: "Only `title`, comments, and cross-cell edges are allowed outside a cell block.",
      line: entry.line,
      column: 1
    });
  });

  return { project: { title, cells, crossEdges }, diagnostics };
}
