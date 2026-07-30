import LZString from "lz-string";
import type { Node, XYPosition } from "@xyflow/react";
import type { BoundaryDirection } from "../domain/cellModel";

export const PORTABLE_LAYOUT_PREFIX = "# @layout=";

const INTERNAL_PADDING = 72;
const COMPONENT_SIZE = 112;
const EXTERNAL_SIZE = 106;

type LayoutKind = "component" | "external" | "shared-external";

export type CustomNodePosition =
  | { kind: "component"; cellId: string; x: number; y: number }
  | { kind: "external"; cellId: string; side: BoundaryDirection; offset: number }
  | { kind: "shared-external"; x: number; y: number };

export interface CustomLayout {
  version: 1;
  sourceFingerprint: string;
  nodes: Record<string, CustomNodePosition>;
}

export interface PortableCellSource {
  source: string;
  layout: CustomLayout | null;
  layoutError: boolean;
}

interface LayoutNodeData extends Record<string, unknown> {
  layoutKind?: LayoutKind | "cell" | "gateway";
  cellId?: string;
  direction?: BoundaryDirection;
  width?: number;
  height?: number;
}

function cleanSource(source: string) {
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !line.startsWith(PORTABLE_LAYOUT_PREFIX))
    .join("\n")
    .trimEnd();
}

export function fingerprintSource(source: string) {
  const normalized = cleanSource(source);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function createCustomLayout(source: string): CustomLayout {
  return { version: 1, sourceFingerprint: fingerprintSource(source), nodes: {} };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

function nodeData(node: Node): LayoutNodeData {
  return node.data as LayoutNodeData;
}

function findCell(nodes: Node[], cellId: string) {
  return nodes.find((node) => node.id === `cell-${cellId}`);
}

function cellSize(cell: Node) {
  const data = nodeData(cell);
  return {
    width: Number(data.width) || Number(cell.width) || 0,
    height: Number(data.height) || Number(cell.height) || 0
  };
}

function constrainComponent(position: XYPosition, cell: Node) {
  const { width, height } = cellSize(cell);
  return {
    x: clamp(position.x, cell.position.x + INTERNAL_PADDING, cell.position.x + width - INTERNAL_PADDING - COMPONENT_SIZE),
    y: clamp(position.y, cell.position.y + INTERNAL_PADDING, cell.position.y + height - INTERNAL_PADDING - COMPONENT_SIZE)
  };
}

function boxesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function projectOutsideCell(position: XYPosition, cell: Node): XYPosition {
  const { width, height } = cellSize(cell);
  const nodeBox = { ...position, width: EXTERNAL_SIZE, height: EXTERNAL_SIZE };
  const cellBox = { ...cell.position, width, height };
  if (!boxesOverlap(nodeBox, cellBox)) {
    return position;
  }

  const candidates = [
    { x: cell.position.x - EXTERNAL_SIZE, y: position.y },
    { x: cell.position.x + width, y: position.y },
    { x: position.x, y: cell.position.y - EXTERNAL_SIZE },
    { x: position.x, y: cell.position.y + height }
  ];

  return candidates.reduce((nearest, candidate) => {
    const nearestDistance = Math.hypot(nearest.x - position.x, nearest.y - position.y);
    const candidateDistance = Math.hypot(candidate.x - position.x, candidate.y - position.y);
    return candidateDistance < nearestDistance ? candidate : nearest;
  });
}

function constrainSharedExternal(position: XYPosition, nodes: Node[]) {
  const cells = nodes.filter((node) => nodeData(node).layoutKind === "cell");
  let constrained = position;

  // Pushing a node out of one cell can push it into another, so passes repeat
  // until the position stops moving. The pass count stays bounded as a
  // safety net, but settling usually takes one or two -- without the early
  // exit this runs the full O(cells^2) every time, for every node.
  for (let pass = 0; pass < Math.max(1, cells.length * 2); pass += 1) {
    const before = constrained;
    cells.forEach((cell) => {
      constrained = projectOutsideCell(constrained, cell);
    });
    if (constrained.x === before.x && constrained.y === before.y) {
      break;
    }
  }

  return constrained;
}

export function isCustomLayoutNode(node: Node) {
  const kind = nodeData(node).layoutKind;
  return kind === "component" || kind === "external" || kind === "shared-external";
}

export function captureCustomPosition(
  current: CustomLayout | null,
  source: string,
  draggedNode: Node,
  baseNodes: Node[]
): CustomLayout | null {
  const data = nodeData(draggedNode);
  const kind = data.layoutKind;
  if (kind !== "component" && kind !== "external" && kind !== "shared-external") {
    return current;
  }

  const layout = current ?? createCustomLayout(source);
  let entry: CustomNodePosition;

  if (kind === "component") {
    if (!data.cellId) {
      return current;
    }
    const cell = findCell(baseNodes, data.cellId);
    if (!cell) {
      return current;
    }
    const position = constrainComponent(draggedNode.position, cell);
    entry = {
      kind,
      cellId: data.cellId,
      x: rounded(position.x - cell.position.x),
      y: rounded(position.y - cell.position.y)
    };
  } else if (kind === "external") {
    if (!data.cellId || !data.direction) {
      return current;
    }
    const cell = findCell(baseNodes, data.cellId);
    if (!cell) {
      return current;
    }
    const { width, height } = cellSize(cell);
    const horizontal = data.direction === "north" || data.direction === "south";
    const available = horizontal ? width - EXTERNAL_SIZE : height - EXTERNAL_SIZE;
    const along = horizontal
      ? draggedNode.position.x - cell.position.x
      : draggedNode.position.y - cell.position.y;
    entry = {
      kind,
      cellId: data.cellId,
      side: data.direction,
      offset: rounded(clamp(available > 0 ? along / available : 0.5, 0, 1))
    };
  } else {
    const position = constrainSharedExternal(draggedNode.position, baseNodes);
    entry = { kind, x: rounded(position.x), y: rounded(position.y) };
  }

  return {
    ...layout,
    sourceFingerprint: fingerprintSource(source),
    nodes: { ...layout.nodes, [draggedNode.id]: entry }
  };
}

export function applyCustomLayout(baseNodes: Node[], layout: CustomLayout | null): Node[] {
  if (!layout) {
    return baseNodes;
  }

  return baseNodes.map((node) => {
    const entry = layout.nodes[node.id];
    const data = nodeData(node);
    if (!entry || entry.kind !== data.layoutKind) {
      return node;
    }

    if (entry.kind === "component") {
      if (entry.cellId !== data.cellId) {
        return node;
      }
      const cell = findCell(baseNodes, entry.cellId);
      if (!cell) {
        return node;
      }
      const position = constrainComponent({ x: cell.position.x + entry.x, y: cell.position.y + entry.y }, cell);
      return { ...node, position };
    }

    if (entry.kind === "external") {
      if (entry.cellId !== data.cellId || entry.side !== data.direction) {
        return node;
      }
      const cell = findCell(baseNodes, entry.cellId);
      if (!cell) {
        return node;
      }
      const { width, height } = cellSize(cell);
      const offset = clamp(entry.offset, 0, 1);
      const position = { ...node.position };
      if (entry.side === "north" || entry.side === "south") {
        position.x = cell.position.x + offset * (width - EXTERNAL_SIZE);
      } else {
        position.y = cell.position.y + offset * (height - EXTERNAL_SIZE);
      }
      return { ...node, position };
    }

    return { ...node, position: constrainSharedExternal({ x: entry.x, y: entry.y }, baseNodes) };
  });
}

function isDirection(value: unknown): value is BoundaryDirection {
  return value === "north" || value === "east" || value === "south" || value === "west";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCustomPosition(value: unknown): value is CustomNodePosition {
  if (!value || typeof value !== "object") {
    return false;
  }
  const position = value as Partial<CustomNodePosition>;
  if (position.kind === "component") {
    return typeof position.cellId === "string" && isFiniteNumber(position.x) && isFiniteNumber(position.y);
  }
  if (position.kind === "external") {
    return (
      typeof position.cellId === "string" &&
      isDirection(position.side) &&
      isFiniteNumber(position.offset) &&
      position.offset >= 0 &&
      position.offset <= 1
    );
  }
  return position.kind === "shared-external" && isFiniteNumber(position.x) && isFiniteNumber(position.y);
}

function isCustomLayout(value: unknown): value is CustomLayout {
  if (!value || typeof value !== "object") {
    return false;
  }
  const layout = value as Partial<CustomLayout>;
  return (
    layout.version === 1 &&
    typeof layout.sourceFingerprint === "string" &&
    Boolean(layout.nodes) &&
    typeof layout.nodes === "object" &&
    !Array.isArray(layout.nodes) &&
    Object.values(layout.nodes).every(isCustomPosition)
  );
}

function encodeLayout(layout: CustomLayout) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(layout));
}

function decodeLayout(payload: string): CustomLayout | null {
  try {
    const decoded = LZString.decompressFromEncodedURIComponent(payload);
    if (!decoded) {
      return null;
    }
    const parsed: unknown = JSON.parse(decoded);
    return isCustomLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializePortableSource(source: string, layout: CustomLayout | null) {
  if (!layout && !source.includes(PORTABLE_LAYOUT_PREFIX)) {
    return source;
  }
  const clean = cleanSource(source);
  if (!layout || Object.keys(layout.nodes).length === 0) {
    return clean;
  }
  const portableLayout = { ...layout, sourceFingerprint: fingerprintSource(clean) };
  return `${clean}\n${PORTABLE_LAYOUT_PREFIX}${encodeLayout(portableLayout)}`;
}

export function parsePortableSource(portableSource: string): PortableCellSource {
  const lines = portableSource.replace(/\r\n/g, "\n").split("\n");
  const metadataLines = lines.filter((line) => line.startsWith(PORTABLE_LAYOUT_PREFIX));
  if (metadataLines.length === 0) {
    return { source: portableSource, layout: null, layoutError: false };
  }
  const source = lines
    .filter((line) => !line.startsWith(PORTABLE_LAYOUT_PREFIX))
    .join("\n")
    .trimEnd();
  const payload = metadataLines.at(-1)!.slice(PORTABLE_LAYOUT_PREFIX.length);
  const layout = decodeLayout(payload);
  if (!layout || metadataLines.length > 1 || layout.sourceFingerprint !== fingerprintSource(source)) {
    return { source, layout: null, layoutError: true };
  }
  return { source, layout, layoutError: false };
}
