import { CrossEntry, CrossExit } from "../domain/cellModel";
import { splitLabel } from "./labels";

export type DirTokenResult =
  | { exit: CrossExit; entry: CrossEntry }
  | { error: "bare-south" | "bad-token" };

const outbound = new Set<CrossExit>(["east", "south"]);
const inbound = new Set<CrossEntry>(["west", "north"]);

export function parseDirToken(token: string | undefined): DirTokenResult {
  if (!token) { return { exit: "east", entry: "west" }; }
  const parts = token.split("-");
  const exit = parts[0] as CrossExit;
  if (!outbound.has(exit)) { return { error: "bad-token" }; }
  if (parts.length === 1) {
    if (exit === "south") { return { error: "bare-south" }; }
    return { exit, entry: "west" };
  }
  if (parts.length !== 2) { return { error: "bad-token" }; }
  const entry = parts[1] as CrossEntry;
  if (!inbound.has(entry)) { return { error: "bad-token" }; }
  return { exit, entry };
}

export interface ParsedCrossEdge {
  sourceCell: string | null;
  sourceComp: string;
  targetCell: string;
  targetComp: string;
  exit: CrossExit;
  entry: CrossEntry;
  label?: string;
  line: number;
}

export type CrossEdgeParse = ParsedCrossEdge | { error: "bare-south" | "bad-token"; line: number } | null;

function qualified(token: string): { cell: string; comp: string } | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) { return null; }
  return { cell: token.slice(0, dot), comp: token.slice(dot + 1) };
}

export function parseCrossEdge(statement: string, line: number): CrossEdgeParse {
  const { body, label } = splitLabel(statement);
  const arrow = body.split(/\s*->\s*/);
  if (arrow.length !== 2 || !arrow[0] || !arrow[1]) { return null; }

  const rightTokens = arrow[1].trim().split(/\s+/);
  let dirToken: string | undefined;
  let targetToken: string;
  if (rightTokens.length === 2) { dirToken = rightTokens[0]; targetToken = rightTokens[1]; }
  else if (rightTokens.length === 1) { targetToken = rightTokens[0]; }
  else { return null; }

  const target = qualified(targetToken);
  if (!target) { return null; }

  const leftToken = arrow[0].trim();
  const source = qualified(leftToken);

  const dir = parseDirToken(dirToken);
  if ("error" in dir) { return { error: dir.error, line }; }

  return {
    sourceCell: source ? source.cell : null,
    sourceComp: source ? source.comp : leftToken,
    targetCell: target.cell,
    targetComp: target.comp,
    exit: dir.exit, entry: dir.entry, label, line
  };
}
