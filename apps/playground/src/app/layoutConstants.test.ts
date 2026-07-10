import { describe, expect, it } from "vitest";
import {
  clamp,
  computeCanvasInsets,
  EDITOR_DEFAULT_HEIGHT,
  EDITOR_DEFAULT_WIDTH,
  EDITOR_MAX_HEIGHT,
  EDITOR_MAX_WIDTH,
  EDITOR_MIN_HEIGHT,
  EDITOR_MIN_WIDTH,
  shouldUseTabbedWorkbench
} from "./layoutConstants";

describe("clamp", () => {
  it("keeps a value inside the given bounds", () => {
    expect(clamp(100, 50, 200)).toBe(100);
    expect(clamp(10, 50, 200)).toBe(50);
    expect(clamp(500, 50, 200)).toBe(200);
  });
});

describe("layout size constants", () => {
  it("sets the default editor size to the expanded authoring layout", () => {
    expect(EDITOR_DEFAULT_WIDTH).toBe(416);
    expect(EDITOR_DEFAULT_HEIGHT).toBe(720);
  });

  it("keeps the default editor size within its own min/max bounds", () => {
    expect(EDITOR_DEFAULT_WIDTH).toBeGreaterThanOrEqual(EDITOR_MIN_WIDTH);
    expect(EDITOR_DEFAULT_WIDTH).toBeLessThanOrEqual(EDITOR_MAX_WIDTH);
    expect(EDITOR_DEFAULT_HEIGHT).toBeGreaterThanOrEqual(EDITOR_MIN_HEIGHT);
    expect(EDITOR_DEFAULT_HEIGHT).toBeLessThanOrEqual(EDITOR_MAX_HEIGHT);
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

  it("does not reserve desktop panel space in mobile layout", () => {
    const insets = computeCanvasInsets({
      editorOpen: true,
      editorWidth: 400,
      diagramsOpen: true,
      layoutMode: "mobile"
    });
    expect(insets).toEqual({ left: 0, right: 0 });
  });
});

describe("shouldUseTabbedWorkbench", () => {
  it("uses the original desktop workbench when the screen is wider than 2.5 editor widths", () => {
    expect(shouldUseTabbedWorkbench({ screenWidth: 1200, editorWidth: EDITOR_DEFAULT_WIDTH })).toBe(false);
  });

  it("uses the tabbed workbench when the screen is not wider than 2.5 editor widths", () => {
    expect(shouldUseTabbedWorkbench({ screenWidth: 1040, editorWidth: EDITOR_DEFAULT_WIDTH })).toBe(true);
    expect(shouldUseTabbedWorkbench({ screenWidth: 1024, editorWidth: EDITOR_DEFAULT_WIDTH })).toBe(true);
  });

  it("accounts for the current resized editor width", () => {
    expect(shouldUseTabbedWorkbench({ screenWidth: 1180, editorWidth: 560 })).toBe(true);
    expect(shouldUseTabbedWorkbench({ screenWidth: 1180, editorWidth: 416 })).toBe(false);
  });
});
