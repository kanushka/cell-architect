export type NodeShape = "circle" | "rect";

/** Component and external nodes are circles; everything else (gateways) is a box. */
export function shapeForNodeType(type: string | undefined): NodeShape {
  return type === "component" || type === "external" ? "circle" : "rect";
}

export interface NodeRect {
  /** Absolute top-left position. */
  x: number;
  y: number;
  width: number;
  height: number;
  shape: NodeShape;
}

export interface FloatingAnchors {
  /** Source anchor on the source node perimeter. */
  sx: number;
  sy: number;
  /** Target anchor on the target node perimeter. */
  tx: number;
  ty: number;
}

interface Center {
  cx: number;
  cy: number;
}

function center(node: NodeRect): Center {
  return { cx: node.x + node.width / 2, cy: node.y + node.height / 2 };
}

/**
 * Distance from a node center to its perimeter along the unit direction (dx, dy).
 * Circles use the radius; boxes use the nearest border crossing.
 */
function perimeterDistance(node: NodeRect, dx: number, dy: number): number {
  if (node.shape === "circle") {
    return node.width / 2;
  }

  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  return Math.min(scaleX, scaleY);
}

export function getFloatingAnchors(source: NodeRect, target: NodeRect): FloatingAnchors {
  const { cx: scx, cy: scy } = center(source);
  const { cx: tcx, cy: tcy } = center(target);

  const deltaX = tcx - scx;
  const deltaY = tcy - scy;
  const length = Math.hypot(deltaX, deltaY);

  if (length === 0) {
    return { sx: scx, sy: scy, tx: tcx, ty: tcy };
  }

  const ux = deltaX / length;
  const uy = deltaY / length;

  const sourceReach = perimeterDistance(source, ux, uy);
  const targetReach = perimeterDistance(target, ux, uy);

  return {
    sx: scx + ux * sourceReach,
    sy: scy + uy * sourceReach,
    tx: tcx - ux * targetReach,
    ty: tcy - uy * targetReach
  };
}
