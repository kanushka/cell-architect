import { Diagnostic } from "../domain/cellModel";

export interface SourceLine {
  text: string;
  line: number;
}

export interface CellBlock {
  id: string;
  label?: string;
  headerLine: number;
  lines: SourceLine[];
}

export interface SplitResult {
  implicit: boolean;
  cells: CellBlock[];
  topLevel: SourceLine[];
  diagnostics: Diagnostic[];
}

const headerPattern = /^cell\s+(\S+)(?:\s+as\s+(?:"([^"]*)"|(\S+)))?\s*\{$/;

export function splitCells(source: string): SplitResult {
  const rawLines = source.split(/\r?\n/);
  const hasBlocks = rawLines.some(
    (line) => /^\s*cell\s+\S+.*\{\s*$/.test(line) || /^\s*}\s*$/.test(line)
  );

  if (!hasBlocks) {
    const lines = rawLines
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter((entry) => entry.text.length > 0);
    return { implicit: true, cells: [{ id: "main", headerLine: 0, lines }], topLevel: [], diagnostics: [] };
  }

  const cells: CellBlock[] = [];
  const topLevel: SourceLine[] = [];
  const diagnostics: Diagnostic[] = [];
  let current: CellBlock | null = null;

  for (let index = 0; index < rawLines.length; index++) {
    const line = index + 1;
    const trimmed = rawLines[index].trim();
    if (trimmed.length === 0) { continue; }

    const header = headerPattern.exec(trimmed);
    if (header) {
      if (current) {
        diagnostics.push({ severity: "error", message: "Nested cells are not supported.", line, column: 1 });
        continue;
      }
      current = { id: header[1], label: (header[2] || header[3]) || undefined, headerLine: line, lines: [] };
      continue;
    }

    if (!current && /^cell\s/.test(trimmed)) {
      diagnostics.push({ severity: "error", message: 'Malformed cell header. Use: cell <id> [as "label"] {', line, column: 1 });
      continue;
    }

    if (trimmed === "}") {
      if (!current) {
        diagnostics.push({ severity: "error", message: "Unexpected closing brace.", line, column: 1 });
        continue;
      }
      cells.push(current);
      current = null;
      continue;
    }

    if (current) { current.lines.push({ text: trimmed, line }); }
    else { topLevel.push({ text: trimmed, line }); }
  }

  if (current) {
    diagnostics.push({ severity: "error", message: "Unbalanced braces: a cell block was not closed.", line: current.headerLine, column: 1 });
  }

  return { implicit: false, cells, topLevel, diagnostics };
}
