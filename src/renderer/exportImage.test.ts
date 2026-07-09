import { describe, expect, it } from "vitest";
import { computeExportTransform } from "./exportImage";

describe("computeExportTransform", () => {
  it("scales a wide diagram to fit width and centers it with padding", () => {
    const bounds = { x: 0, y: 0, width: 800, height: 400 };
    const t = computeExportTransform(bounds, { width: 1000, height: 1000, padding: 0.1 });
    expect(t.zoom).toBeCloseTo(1, 5);
    expect(t.x).toBeCloseTo(100, 5);
    expect(t.y).toBeCloseTo(300, 5);
  });
  it("never scales above 1x (no upscaling blur)", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const t = computeExportTransform(bounds, { width: 1000, height: 1000, padding: 0 });
    expect(t.zoom).toBeLessThanOrEqual(1);
  });
  it("offsets by the bounds origin so off-origin diagrams are captured", () => {
    const bounds = { x: 200, y: 100, width: 400, height: 400 };
    const t = computeExportTransform(bounds, { width: 400, height: 400, padding: 0 });
    expect(t.zoom).toBeCloseTo(1, 5);
    expect(t.x).toBeCloseTo(-200, 5);
    expect(t.y).toBeCloseTo(-100, 5);
  });
});
