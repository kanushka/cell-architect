export const PANEL_EDGE_OFFSET = 14;
export const CANVAS_INSET_GAP = 24;
export const DIAGRAMS_PANEL_WIDTH = 260;

export const EDITOR_MIN_WIDTH = 260;
export const EDITOR_MAX_WIDTH = 560;
export const EDITOR_DEFAULT_WIDTH = 416;

export const EDITOR_MIN_HEIGHT = 240;
export const EDITOR_MAX_HEIGHT = 720;
export const EDITOR_DEFAULT_HEIGHT = 720;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function shouldUseTabbedWorkbench({
  screenWidth,
  editorWidth
}: {
  screenWidth: number;
  editorWidth: number;
}) {
  return editorWidth * 2.5 >= screenWidth;
}

export interface CanvasInsets {
  left: number;
  right: number;
}

export function computeCanvasInsets({
  editorOpen,
  editorWidth,
  diagramsOpen,
  layoutMode = "desktop"
}: {
  editorOpen: boolean;
  editorWidth: number;
  diagramsOpen: boolean;
  layoutMode?: "desktop" | "mobile";
}): CanvasInsets {
  if (layoutMode === "mobile") {
    return { left: 0, right: 0 };
  }

  return {
    left: editorOpen ? PANEL_EDGE_OFFSET + editorWidth + CANVAS_INSET_GAP : 0,
    right: diagramsOpen ? PANEL_EDGE_OFFSET + DIAGRAMS_PANEL_WIDTH + CANVAS_INSET_GAP : 0
  };
}
