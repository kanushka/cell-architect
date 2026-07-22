import { describe, expect, it } from "vitest";
import { getFloatingAnchors, shapeForNodeType, type NodeRect } from "./floatingGeometry";

function circle(x: number, y: number, size: number): NodeRect {
  return { x, y, width: size, height: size, shape: "circle" };
}

function rect(x: number, y: number, width: number, height: number): NodeRect {
  return { x, y, width, height, shape: "rect" };
}

describe("getFloatingAnchors", () => {
  it("anchors two circles on the perimeter along the center-to-center line", () => {
    // Two 100px circles, centers at (50,50) and (250,50): purely horizontal.
    const source = circle(0, 0, 100);
    const target = circle(200, 0, 100);

    const { sx, sy, tx, ty } = getFloatingAnchors(source, target);

    // Source exits at its right edge, target enters at its left edge.
    expect(sx).toBeCloseTo(100);
    expect(sy).toBeCloseTo(50);
    expect(tx).toBeCloseTo(200);
    expect(ty).toBeCloseTo(50);
  });

  it("places the circle anchor on the perimeter for a diagonal connection", () => {
    // 100px circle centered at (50,50), radius 50. Target up and to the right.
    const source = circle(0, 0, 100);
    const target = circle(400, -300, 100);

    const { sx, sy } = getFloatingAnchors(source, target);

    // Anchor must sit exactly on the circle: distance from center == radius.
    const dist = Math.hypot(sx - 50, sy - 50);
    expect(dist).toBeCloseTo(50);
    // And it points toward the target (right and up from center).
    expect(sx).toBeGreaterThan(50);
    expect(sy).toBeLessThan(50);
  });

  it("anchors a box node on its border facing the other node", () => {
    // Small 40px box centered at (20,20); circle target straight to the right (center y=20).
    const source = rect(0, 0, 40, 40);
    const target = circle(200, -30, 100);

    const { sx, sy } = getFloatingAnchors(source, target);

    // Exits at the box's right border, vertically centered.
    expect(sx).toBeCloseTo(40);
    expect(sy).toBeCloseTo(20);
  });

  it("treats component and external nodes as circles and gateways as boxes", () => {
    expect(shapeForNodeType("component")).toBe("circle");
    expect(shapeForNodeType("external")).toBe("circle");
    expect(shapeForNodeType("gateway")).toBe("rect");
    expect(shapeForNodeType(undefined)).toBe("rect");
  });

  it("does not divide by zero when centers coincide", () => {
    const source = circle(0, 0, 100);
    const target = circle(0, 0, 100);

    const anchors = getFloatingAnchors(source, target);

    expect(Number.isFinite(anchors.sx)).toBe(true);
    expect(Number.isFinite(anchors.sy)).toBe(true);
    expect(Number.isFinite(anchors.tx)).toBe(true);
    expect(Number.isFinite(anchors.ty)).toBe(true);
  });
});
