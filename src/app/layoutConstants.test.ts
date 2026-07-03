import { describe, expect, it } from "vitest";
import {
  clamp,
  computeCanvasInsets,
  EDITOR_DEFAULT_WIDTH,
  EDITOR_MAX_WIDTH,
  EDITOR_MIN_WIDTH
} from "./layoutConstants";

describe("clamp", () => {
  it("keeps a value inside the given bounds", () => {
    expect(clamp(100, 50, 200)).toBe(100);
    expect(clamp(10, 50, 200)).toBe(50);
    expect(clamp(500, 50, 200)).toBe(200);
  });
});

describe("layout size constants", () => {
  it("keeps the default editor width within its own min/max bounds", () => {
    expect(EDITOR_DEFAULT_WIDTH).toBeGreaterThanOrEqual(EDITOR_MIN_WIDTH);
    expect(EDITOR_DEFAULT_WIDTH).toBeLessThanOrEqual(EDITOR_MAX_WIDTH);
  });
});

describe("computeCanvasInsets", () => {
  it("returns zero insets when both panels are closed", () => {
    expect(
      computeCanvasInsets({ editorOpen: false, editorWidth: EDITOR_DEFAULT_WIDTH, diagramsOpen: false })
    ).toEqual({ left: 0, right: 0 });
  });

  it("reserves the editor width plus gap on the left when the editor is open", () => {
    const insets = computeCanvasInsets({ editorOpen: true, editorWidth: 320, diagramsOpen: false });
    expect(insets).toEqual({ left: 14 + 320 + 24, right: 0 });
  });

  it("reserves a fixed width on the right when the diagrams panel is open", () => {
    const insets = computeCanvasInsets({ editorOpen: false, editorWidth: EDITOR_DEFAULT_WIDTH, diagramsOpen: true });
    expect(insets).toEqual({ left: 0, right: 14 + 260 + 24 });
  });

  it("reserves both sides when both panels are open", () => {
    const insets = computeCanvasInsets({ editorOpen: true, editorWidth: 400, diagramsOpen: true });
    expect(insets).toEqual({ left: 14 + 400 + 24, right: 14 + 260 + 24 });
  });
});
