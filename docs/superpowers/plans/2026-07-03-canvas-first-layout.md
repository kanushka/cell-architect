# Canvas-First Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the divided sidebar/split-pane workbench with a full-bleed React Flow canvas where every control (hamburger menu, resizable code editor, diagrams panel, share button, zoom/fit controls, info popover) floats on top as an overlay, Excalidraw-style.

**Architecture:** `App.tsx` becomes a thin composition root holding UI state (which overlays are open, editor size) and computing pixel insets for the canvas. `DiagramCanvas` gains an `insets` prop and an internal `FitViewController` that calls React Flow's imperative `fitView({ padding })` whenever the insets or the active model change, so the diagram always centers in whatever space isn't covered by a floating panel. New presentational components (`AppMenu`, `EditorPanel`, `DiagramsPanel`, `ShareButton`, `InfoPanel`) replace the old sidebar/toolbar/pane-header markup.

**Tech Stack:** React 18, TypeScript, `@xyflow/react` v12 (React Flow), Vitest + Testing Library, existing `SourceEditor` (CodeMirror), `lucide-react` icons.

**Reference spec:** [docs/superpowers/specs/2026-07-03-canvas-first-layout-design.md](../specs/2026-07-03-canvas-first-layout-design.md)

---

## Verified technical facts (do not re-derive, just use)

- `@xyflow/react`'s `fitViewOptions.padding` accepts `{ top?, right?, bottom?, left? }`, each as `"<number>px"` or `"<number>%"` (checked in `node_modules/@xyflow/system/dist/esm/types/general.d.ts`).
- The `fitView` boolean prop on `<ReactFlow>` only queues a fit **once**, at store creation (`getInitialState`). It does **not** re-fire when the `nodes`/`edges` props change later. The imperative `useReactFlow().fitView()` call goes through the exact same `fitViewQueued` mechanism (waits for `nodesInitialized` internally), so it's safe to call directly without extra guards.
- `useReactFlow()` and `useViewport()` are both valid inside any component rendered as a child of `<ReactFlow>` (same pattern the library's own `<Controls>` uses internally).
- The project's real repo is `https://github.com/kanushka/cell-architect` (from `git remote -v`) — use this exact URL in the Info panel, do not invent another one.

---

## File Structure

New files:
- `src/app/layoutConstants.ts` — sizing constants, `clamp`, `computeCanvasInsets`
- `src/app/layoutConstants.test.ts`
- `src/app/AppMenu.tsx` — hamburger button + dropdown (New / Import / Guide)
- `src/app/AppMenu.test.tsx`
- `src/app/EditorPanel.tsx` — floating collapsible/resizable editor card
- `src/app/EditorPanel.test.tsx`
- `src/app/DiagramsPanel.tsx` — right-side diagram list with row actions
- `src/app/DiagramsPanel.test.tsx`
- `src/app/ShareButton.tsx` — disabled button + tooltip
- `src/app/ShareButton.test.tsx`
- `src/app/InfoPanel.tsx` — info button + popover
- `src/app/InfoPanel.test.tsx`
- `src/renderer/DiagramCanvas.test.tsx` — insets/fit/zoom-control tests (didn't exist before)

Modified files:
- `src/renderer/DiagramCanvas.tsx` — add `insets` prop, `FitViewController`, custom `ZoomControls` (replaces `<Controls/>`)
- `src/app/App.tsx` — full rewrite of composition/layout
- `src/app/App.test.tsx` — full rewrite for the new structure
- `src/app/styles.css` — replace split-pane rules with overlay positioning
- `src/app/styles.test.ts` — update assertions for new selectors

---

### Task 1: Layout constants and utilities

**Files:**
- Create: `src/app/layoutConstants.ts`
- Test: `src/app/layoutConstants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/layoutConstants.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/layoutConstants.test.ts`
Expected: FAIL with "Cannot find module './layoutConstants'"

- [ ] **Step 3: Write the implementation**

```ts
// src/app/layoutConstants.ts
export const PANEL_EDGE_OFFSET = 14;
export const CANVAS_INSET_GAP = 24;
export const DIAGRAMS_PANEL_WIDTH = 260;

export const EDITOR_MIN_WIDTH = 260;
export const EDITOR_MAX_WIDTH = 560;
export const EDITOR_DEFAULT_WIDTH = 320;

export const EDITOR_MIN_HEIGHT = 240;
export const EDITOR_MAX_HEIGHT = 720;
export const EDITOR_DEFAULT_HEIGHT = 420;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export interface CanvasInsets {
  left: number;
  right: number;
}

export function computeCanvasInsets({
  editorOpen,
  editorWidth,
  diagramsOpen
}: {
  editorOpen: boolean;
  editorWidth: number;
  diagramsOpen: boolean;
}): CanvasInsets {
  return {
    left: editorOpen ? PANEL_EDGE_OFFSET + editorWidth + CANVAS_INSET_GAP : 0,
    right: diagramsOpen ? PANEL_EDGE_OFFSET + DIAGRAMS_PANEL_WIDTH + CANVAS_INSET_GAP : 0
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/layoutConstants.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/layoutConstants.ts src/app/layoutConstants.test.ts
git commit -m "feat(layout): add canvas inset and sizing constants"
```

---

### Task 2: DiagramCanvas recenters on inset changes, not on focus clicks

**Files:**
- Modify: `src/renderer/DiagramCanvas.tsx`
- Create: `src/renderer/DiagramCanvas.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/renderer/DiagramCanvas.test.tsx
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileCellSource } from "../compiler/compileCellSource";

export const fitViewSpy = vi.fn();
export const zoomInSpy = vi.fn();
export const zoomOutSpy = vi.fn();

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...actual,
    useReactFlow: () => ({ fitView: fitViewSpy, zoomIn: zoomInSpy, zoomOut: zoomOutSpy }),
    useViewport: () => ({ x: 0, y: 0, zoom: 1 })
  };
});

import { DiagramCanvas } from "./DiagramCanvas";

function buildModel(source: string) {
  const compiled = compileCellSource(source);
  if (!compiled.model) {
    throw new Error("expected a valid model");
  }
  return compiled.model;
}

describe("DiagramCanvas insets", () => {
  beforeEach(() => {
    fitViewSpy.mockClear();
    zoomInSpy.mockClear();
    zoomOutSpy.mockClear();
  });

  it("defaults to zero padding when no insets are supplied", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} />);

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "0px", right: "0px" })
      })
    );
  });

  it("reserves left/right padding matching the open overlay panels", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} insets={{ left: 260, right: 220 }} />);

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "260px", right: "220px" })
      })
    );
  });

  it("re-fits with new padding when insets change", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { rerender } = render(<DiagramCanvas model={model} insets={{ left: 260, right: 0 }} />);
    fitViewSpy.mockClear();

    rerender(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} />);

    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "0px", right: "0px" })
      })
    );
  });

  it("does not re-fit on a re-render where the model and insets are unchanged", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { rerender } = render(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} />);
    fitViewSpy.mockClear();

    rerender(<DiagramCanvas model={model} insets={{ left: 0, right: 0 }} />);

    expect(fitViewSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/DiagramCanvas.test.tsx`
Expected: FAIL — `insets` prop doesn't exist yet / `fitViewSpy` never called with the expected padding shape (current code calls `fitView` via the `fitView` boolean prop path, not the padding object shape asserted here).

- [ ] **Step 3: Modify `DiagramCanvas.tsx`**

Add imports (extend the existing `@xyflow/react` import) and the new controller component. Replace the top of the file's imports:

```tsx
import {
  Background,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  getBezierPath
} from "@xyflow/react";
```

Add this after the `sameConnectionIds` function and before `interface DiagramCanvasProps`:

```tsx
export interface DiagramCanvasInsets {
  left: number;
  right: number;
}

const DEFAULT_INSETS: DiagramCanvasInsets = { left: 0, right: 0 };
const FIT_VIEW_VERTICAL_PADDING = "40px";

function buildFitPadding(insets: DiagramCanvasInsets) {
  return {
    top: FIT_VIEW_VERTICAL_PADDING,
    bottom: FIT_VIEW_VERTICAL_PADDING,
    left: `${insets.left}px`,
    right: `${insets.right}px`
  };
}

function FitViewController({ insets, model }: { insets: DiagramCanvasInsets; model: CellDiagramModel }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    fitView({ padding: buildFitPadding(insets), duration: 200 });
    // model is only used to re-trigger the fit when the diagram data itself changes
    // (switching documents), not on every re-render (e.g. focus-click highlighting).
  }, [insets.left, insets.right, fitView, model]);

  return null;
}
```

Update the props interface and component signature:

```tsx
interface DiagramCanvasProps {
  model: CellDiagramModel | null;
  insets?: DiagramCanvasInsets;
}

export function DiagramCanvas({ model, insets = DEFAULT_INSETS }: DiagramCanvasProps) {
```

Inside the JSX, remove `fitView` and `fitViewOptions={{ padding: 0.18 }}` from the `<ReactFlow>` props, and add `<FitViewController>` as the first child:

```tsx
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.25}
        maxZoom={1.35}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => setActiveConnections(getConnectionIdsForNode(node.id))}
        onPaneClick={() => setActiveConnections([])}
      >
        <FitViewController insets={insets} model={model} />
        <Background color="#cbd5e1" gap={22} />
        <Controls showInteractive={false} />
```

(Leave the rest of the render — `<Controls>`, focus hint, etc. — unchanged for this task; `<Controls>` is replaced in Task 3.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/DiagramCanvas.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: All existing tests still PASS (App.test.tsx doesn't assert on `fitView`/`fitViewOptions` props directly, so it should be unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/DiagramCanvas.tsx src/renderer/DiagramCanvas.test.tsx
git commit -m "feat(canvas): recenter diagram around open overlay panels via fitView insets"
```

---

### Task 3: Custom zoom/fit control cluster with live zoom percentage

**Files:**
- Modify: `src/renderer/DiagramCanvas.tsx`
- Modify: `src/renderer/DiagramCanvas.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/renderer/DiagramCanvas.test.tsx` (new `describe` block, same file, same imports/mocks already in place from Task 2):

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
```

(Update the existing `import { render } from "@testing-library/react";` line to the one above — `fireEvent` and `screen` are needed by the new tests.)

```tsx
describe("DiagramCanvas zoom controls", () => {
  it("shows the current zoom level as a percentage", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("wires the zoom in, zoom out, and fit buttons to the React Flow instance", () => {
    const model = buildModel("component API service\nnorth -> API");
    render(<DiagramCanvas model={model} insets={{ left: 10, right: 20 }} />);
    fitViewSpy.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Fit diagram to view" }));

    expect(zoomInSpy).toHaveBeenCalledTimes(1);
    expect(zoomOutSpy).toHaveBeenCalledTimes(1);
    expect(fitViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        padding: expect.objectContaining({ left: "10px", right: "20px" })
      })
    );
  });

  it("no longer renders the default React Flow controls widget", () => {
    const model = buildModel("component API service\nnorth -> API");
    const { container } = render(<DiagramCanvas model={model} />);

    expect(container.querySelector(".react-flow__controls")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/DiagramCanvas.test.tsx`
Expected: FAIL — no "100%" text, no "Zoom in"/"Zoom out"/"Fit diagram to view" buttons yet, and `.react-flow__controls` still renders from the existing `<Controls>`.

- [ ] **Step 3: Modify `DiagramCanvas.tsx`**

Update the `@xyflow/react` import to drop `Controls` and add `useViewport`:

```tsx
import {
  Background,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  getBezierPath
} from "@xyflow/react";
```

Add a `lucide-react` import at the top of the file:

```tsx
import { Maximize2, Minus, Plus } from "lucide-react";
```

Add the `ZoomControls` component right after `FitViewController`:

```tsx
function ZoomControls({ insets }: { insets: DiagramCanvasInsets }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="zoom-controls">
      <button type="button" className="zoom-controls__button" aria-label="Zoom out" onClick={() => zoomOut()}>
        <Minus size={14} />
      </button>
      <span className="zoom-controls__level">{Math.round(zoom * 100)}%</span>
      <button type="button" className="zoom-controls__button" aria-label="Zoom in" onClick={() => zoomIn()}>
        <Plus size={14} />
      </button>
      <button
        type="button"
        className="zoom-controls__button zoom-controls__button--fit"
        aria-label="Fit diagram to view"
        onClick={() => fitView({ padding: buildFitPadding(insets), duration: 200 })}
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
```

Replace `<Controls showInteractive={false} />` with:

```tsx
        <ZoomControls insets={insets} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/DiagramCanvas.test.tsx`
Expected: PASS (7 tests total)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: All tests PASS. (`App.test.tsx` doesn't reference `.react-flow__controls`, so no regression there.)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/DiagramCanvas.tsx src/renderer/DiagramCanvas.test.tsx
git commit -m "feat(canvas): replace default React Flow controls with a custom zoom/fit cluster"
```

---

### Task 4: AppMenu (hamburger menu)

**Files:**
- Create: `src/app/AppMenu.tsx`
- Create: `src/app/AppMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/AppMenu.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppMenu } from "./AppMenu";

describe("AppMenu", () => {
  it("opens the dropdown and triggers the selected action, then closes", async () => {
    const user = userEvent.setup();
    const onNewDocument = vi.fn();

    render(
      <AppMenu
        onNewDocument={onNewDocument}
        onImportClick={vi.fn()}
        onOpenGuide={vi.fn()}
        disableCreateActions={false}
      />
    );

    expect(screen.queryByRole("menuitem", { name: "New diagram" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    expect(screen.getByRole("menuitem", { name: "New diagram" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "New diagram" }));
    expect(onNewDocument).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "New diagram" })).not.toBeInTheDocument();
  });

  it("disables New and Import when the document limit is reached", async () => {
    const user = userEvent.setup();
    render(
      <AppMenu onNewDocument={vi.fn()} onImportClick={vi.fn()} onOpenGuide={vi.fn()} disableCreateActions />
    );

    await user.click(screen.getByRole("button", { name: "Open main menu" }));

    expect(screen.getByRole("menuitem", { name: "New diagram" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Import .cell" })).toBeDisabled();
  });

  it("triggers the guide action and closes the menu", async () => {
    const user = userEvent.setup();
    const onOpenGuide = vi.fn();

    render(
      <AppMenu onNewDocument={vi.fn()} onImportClick={vi.fn()} onOpenGuide={onOpenGuide} disableCreateActions={false} />
    );

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "DSL Guide" }));

    expect(onOpenGuide).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "DSL Guide" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/AppMenu.test.tsx`
Expected: FAIL with "Cannot find module './AppMenu'"

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/AppMenu.tsx
import { BookOpen, FilePlus2, Menu, Upload } from "lucide-react";
import { useState } from "react";

interface AppMenuProps {
  onNewDocument: () => void;
  onImportClick: () => void;
  onOpenGuide: () => void;
  disableCreateActions: boolean;
}

export function AppMenu({ onNewDocument, onImportClick, onOpenGuide, disableCreateActions }: AppMenuProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <div className="app-menu">
      <button
        type="button"
        className="app-menu__trigger icon-button"
        aria-label="Open main menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Menu size={18} />
      </button>
      {open ? (
        <div className="app-menu__dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={disableCreateActions}
            onClick={() => handleSelect(onNewDocument)}
          >
            <FilePlus2 size={15} />
            <span>New diagram</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disableCreateActions}
            onClick={() => handleSelect(onImportClick)}
          >
            <Upload size={15} />
            <span>Import .cell</span>
          </button>
          <button type="button" role="menuitem" onClick={() => handleSelect(onOpenGuide)}>
            <BookOpen size={15} />
            <span>DSL Guide</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/AppMenu.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/AppMenu.tsx src/app/AppMenu.test.tsx
git commit -m "feat(app): add hamburger AppMenu with New/Import/Guide actions"
```

---

### Task 5: EditorPanel — collapsible floating card

**Files:**
- Create: `src/app/EditorPanel.tsx`
- Create: `src/app/EditorPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/EditorPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Diagnostic } from "../domain/cellModel";
import { EDITOR_DEFAULT_WIDTH } from "./layoutConstants";
import { EditorPanel } from "./EditorPanel";

function renderPanel(overrides: Partial<Parameters<typeof EditorPanel>[0]> = {}) {
  const props = {
    documentName: "Order System",
    onDocumentNameChange: vi.fn(),
    source: "component API service\n",
    onSourceChange: vi.fn(),
    diagnostics: [] as Diagnostic[],
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    width: EDITOR_DEFAULT_WIDTH,
    onWidthChange: vi.fn(),
    ...overrides
  };
  render(<EditorPanel {...props} />);
  return props;
}

describe("EditorPanel", () => {
  it("shows the document name, source editor, and diagnostics when expanded", () => {
    renderPanel();

    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");
    expect(screen.getByLabelText("Cell DSL source")).toBeInTheDocument();
    expect(screen.getByText("No parser issues. The diagram is generated from this source.")).toBeInTheDocument();
  });

  it("lists parser diagnostics instead of the success message when present", () => {
    renderPanel({
      diagnostics: [{ severity: "error", message: "Unexpected token", line: 3, column: 5 }]
    });

    expect(screen.getByText("Unexpected token")).toBeInTheDocument();
    expect(screen.getByText("Line 3, col 5")).toBeInTheDocument();
    expect(screen.queryByText("No parser issues. The diagram is generated from this source.")).not.toBeInTheDocument();
  });

  it("hides the editor body when collapsed and shows the expand control", () => {
    renderPanel({ collapsed: true });

    expect(screen.queryByLabelText("Cell DSL source")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand editor" })).toBeInTheDocument();
  });

  it("calls onToggleCollapsed when the collapse/expand control is clicked", async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    await user.click(screen.getByRole("button", { name: "Collapse editor" }));
    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("calls onDocumentNameChange and onSourceChange when edited", async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    await user.clear(screen.getByLabelText("Diagram name"));
    await user.type(screen.getByLabelText("Diagram name"), "X");
    expect(props.onDocumentNameChange).toHaveBeenCalled();

    await user.type(screen.getByLabelText("Cell DSL source"), "!");
    expect(props.onSourceChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/EditorPanel.test.tsx`
Expected: FAIL with "Cannot find module './EditorPanel'"

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/EditorPanel.tsx
import { ChevronDown, ChevronUp } from "lucide-react";
import { Diagnostic } from "../domain/cellModel";
import { SourceEditor } from "./SourceEditor";

interface EditorPanelProps {
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  source: string;
  onSourceChange: (source: string) => void;
  diagnostics: Diagnostic[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export function EditorPanel({
  documentName,
  onDocumentNameChange,
  source,
  onSourceChange,
  diagnostics,
  collapsed,
  onToggleCollapsed,
  width
}: EditorPanelProps) {
  return (
    <div
      className={collapsed ? "editor-panel editor-panel--collapsed" : "editor-panel"}
      style={{ width }}
    >
      <div className="editor-panel__header">
        <input
          aria-label="Diagram name"
          className="editor-panel__name"
          value={documentName}
          onChange={(event) => onDocumentNameChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={collapsed ? "Expand editor" : "Collapse editor"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {collapsed ? null : (
        <>
          <SourceEditor value={source} onChange={onSourceChange} />
          <div className="editor-panel__diagnostics">
            {diagnostics.length === 0 ? (
              <p>No parser issues. The diagram is generated from this source.</p>
            ) : (
              diagnostics.map((diagnostic) => (
                <p key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}`}>
                  <strong>
                    Line {diagnostic.line}, col {diagnostic.column}
                  </strong>
                  {diagnostic.message}
                </p>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

Note: `onWidthChange` is accepted in the props interface but intentionally unused in this task's render — it's wired up by the resize handle in Task 6. Destructure it as `_onWidthChange`-free by simply not destructuring it yet is not possible without a lint error for an unused required prop; to keep this task's build clean, destructure it but reference it in a no-op way is not idiomatic either. Instead, omit `onWidthChange`/`width` from the interface and render entirely in this task, and add both in Task 6 along with the handle. Use a static width from CSS only for now:

Replace the interface and function signature above with this simpler version for Task 5 (no `width`/`onWidthChange` yet):

```tsx
interface EditorPanelProps {
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  source: string;
  onSourceChange: (source: string) => void;
  diagnostics: Diagnostic[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function EditorPanel({
  documentName,
  onDocumentNameChange,
  source,
  onSourceChange,
  diagnostics,
  collapsed,
  onToggleCollapsed
}: EditorPanelProps) {
  return (
    <div className={collapsed ? "editor-panel editor-panel--collapsed" : "editor-panel"}>
      <div className="editor-panel__header">
        <input
          aria-label="Diagram name"
          className="editor-panel__name"
          value={documentName}
          onChange={(event) => onDocumentNameChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={collapsed ? "Expand editor" : "Collapse editor"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {collapsed ? null : (
        <>
          <SourceEditor value={source} onChange={onSourceChange} />
          <div className="editor-panel__diagnostics">
            {diagnostics.length === 0 ? (
              <p>No parser issues. The diagram is generated from this source.</p>
            ) : (
              diagnostics.map((diagnostic) => (
                <p key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}`}>
                  <strong>
                    Line {diagnostic.line}, col {diagnostic.column}
                  </strong>
                  {diagnostic.message}
                </p>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

Also update the test file's `renderPanel` helper (Step 1) to drop `width`/`onWidthChange` from the default props object, since this task's component doesn't accept them yet:

```tsx
function renderPanel(overrides: Partial<Parameters<typeof EditorPanel>[0]> = {}) {
  const props = {
    documentName: "Order System",
    onDocumentNameChange: vi.fn(),
    source: "component API service\n",
    onSourceChange: vi.fn(),
    diagnostics: [] as Diagnostic[],
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    ...overrides
  };
  render(<EditorPanel {...props} />);
  return props;
}
```

And drop the now-unused `EDITOR_DEFAULT_WIDTH` import from the test file for this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/EditorPanel.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/EditorPanel.tsx src/app/EditorPanel.test.tsx
git commit -m "feat(app): add collapsible floating EditorPanel"
```

---

### Task 6: EditorPanel — resizable width and height

**Files:**
- Modify: `src/app/EditorPanel.tsx`
- Modify: `src/app/EditorPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Re-add `width`/`onWidthChange` to the `renderPanel` helper in `src/app/EditorPanel.test.tsx` (restore the version from Task 5's Step 1, including the `EDITOR_DEFAULT_WIDTH` import), then append:

```tsx
import { fireEvent } from "@testing-library/react";
```

(add to the existing `@testing-library/react` import line)

```tsx
describe("EditorPanel resizing", () => {
  it("resizes width and height by dragging the resize handle", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 300, clientY: 300 });
    fireEvent.mouseMove(window, { clientX: 340, clientY: 260 });
    fireEvent.mouseUp(window);

    expect(onWidthChange).toHaveBeenLastCalledWith(360);
  });

  it("clamps the resized width to the configured maximum", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 5000, clientY: 0 });
    fireEvent.mouseUp(window);

    expect(onWidthChange).toHaveBeenLastCalledWith(560);
  });

  it("clamps the resized width to the configured minimum", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: -5000, clientY: 0 });
    fireEvent.mouseUp(window);

    expect(onWidthChange).toHaveBeenLastCalledWith(260);
  });

  it("stops resizing after mouseup", () => {
    const onWidthChange = vi.fn();
    renderPanel({ width: 320, onWidthChange });

    const handle = screen.getByRole("separator", { name: "Resize editor panel" });
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.mouseUp(window);
    onWidthChange.mockClear();

    fireEvent.mouseMove(window, { clientX: 100, clientY: 0 });
    expect(onWidthChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/EditorPanel.test.tsx`
Expected: FAIL — no `width`/`onWidthChange` props and no resize handle exist yet.

- [ ] **Step 3: Modify `EditorPanel.tsx`**

Replace the whole file with:

```tsx
// src/app/EditorPanel.tsx
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Diagnostic } from "../domain/cellModel";
import {
  clamp,
  EDITOR_DEFAULT_HEIGHT,
  EDITOR_MAX_HEIGHT,
  EDITOR_MAX_WIDTH,
  EDITOR_MIN_HEIGHT,
  EDITOR_MIN_WIDTH
} from "./layoutConstants";
import { SourceEditor } from "./SourceEditor";

interface EditorPanelProps {
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  source: string;
  onSourceChange: (source: string) => void;
  diagnostics: Diagnostic[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

interface DragState {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

export function EditorPanel({
  documentName,
  onDocumentNameChange,
  source,
  onSourceChange,
  diagnostics,
  collapsed,
  onToggleCollapsed,
  width,
  onWidthChange
}: EditorPanelProps) {
  const [height, setHeight] = useState(EDITOR_DEFAULT_HEIGHT);
  const dragStateRef = useRef<DragState | null>(null);

  function handleResizeMove(event: MouseEvent) {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    const nextWidth = clamp(dragState.startWidth + (event.clientX - dragState.startX), EDITOR_MIN_WIDTH, EDITOR_MAX_WIDTH);
    const nextHeight = clamp(
      dragState.startHeight + (event.clientY - dragState.startY),
      EDITOR_MIN_HEIGHT,
      EDITOR_MAX_HEIGHT
    );

    onWidthChange(nextWidth);
    setHeight(nextHeight);
  }

  function handleResizeEnd() {
    dragStateRef.current = null;
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
  }

  function handleResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, startWidth: width, startHeight: height };
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
  }

  return (
    <div
      className={collapsed ? "editor-panel editor-panel--collapsed" : "editor-panel"}
      style={{ width, height: collapsed ? undefined : height }}
    >
      <div className="editor-panel__header">
        <input
          aria-label="Diagram name"
          className="editor-panel__name"
          value={documentName}
          onChange={(event) => onDocumentNameChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={collapsed ? "Expand editor" : "Collapse editor"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {collapsed ? null : (
        <>
          <SourceEditor value={source} onChange={onSourceChange} />
          <div className="editor-panel__diagnostics">
            {diagnostics.length === 0 ? (
              <p>No parser issues. The diagram is generated from this source.</p>
            ) : (
              diagnostics.map((diagnostic) => (
                <p key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}`}>
                  <strong>
                    Line {diagnostic.line}, col {diagnostic.column}
                  </strong>
                  {diagnostic.message}
                </p>
              ))
            )}
          </div>
          <div
            className="editor-panel__resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize editor panel"
            onMouseDown={handleResizeStart}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/EditorPanel.test.tsx`
Expected: PASS (9 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/app/EditorPanel.tsx src/app/EditorPanel.test.tsx
git commit -m "feat(app): make EditorPanel resizable via a drag handle"
```

---

### Task 7: DiagramsPanel — right-side diagram list

**Files:**
- Create: `src/app/DiagramsPanel.tsx`
- Create: `src/app/DiagramsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/DiagramsPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DiagramDocument } from "../storage/documentRepository";
import { DiagramsPanel } from "./DiagramsPanel";

function buildDocument(overrides: Partial<DiagramDocument> = {}): DiagramDocument {
  return {
    id: "doc-1",
    name: "Order System",
    source: "component API service\n",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("DiagramsPanel", () => {
  it("lists documents and selects one on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const documents = [buildDocument(), buildDocument({ id: "doc-2", name: "Untitled Cell" })];

    render(
      <DiagramsPanel
        documents={documents}
        activeDocumentId="doc-1"
        isAtDocumentLimit={false}
        onSelect={onSelect}
        onDuplicate={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Order System")).toBeInTheDocument();
    expect(screen.getByText("Untitled Cell")).toBeInTheDocument();

    await user.click(screen.getByText("Untitled Cell"));
    expect(onSelect).toHaveBeenCalledWith("doc-2");
  });

  it("opens the row menu and exposes duplicate, export, and delete", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const documents = [buildDocument()];

    render(
      <DiagramsPanel
        documents={documents}
        activeDocumentId="doc-1"
        isAtDocumentLimit={false}
        onSelect={vi.fn()}
        onDuplicate={onDuplicate}
        onExport={onExport}
        onDelete={onDelete}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledWith(documents[0]);

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Export .cell" }));
    expect(onExport).toHaveBeenCalledWith(documents[0]);

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(documents[0]);
  });

  it("disables duplicate at the document limit and closes via the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const documents = [buildDocument()];

    render(
      <DiagramsPanel
        documents={documents}
        activeDocumentId="doc-1"
        isAtDocumentLimit
        onSelect={vi.fn()}
        onDuplicate={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Close diagrams panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/DiagramsPanel.test.tsx`
Expected: FAIL with "Cannot find module './DiagramsPanel'"

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/DiagramsPanel.tsx
import { Copy, Download, Eye, MoreVertical, Trash2, X } from "lucide-react";
import { useState } from "react";
import { DiagramDocument } from "../storage/documentRepository";

interface DiagramsPanelProps {
  documents: DiagramDocument[];
  activeDocumentId: string;
  isAtDocumentLimit: boolean;
  onSelect: (id: string) => void;
  onDuplicate: (document: DiagramDocument) => void;
  onExport: (document: DiagramDocument) => void;
  onDelete: (document: DiagramDocument) => void;
  onClose: () => void;
}

export function DiagramsPanel({
  documents,
  activeDocumentId,
  isAtDocumentLimit,
  onSelect,
  onDuplicate,
  onExport,
  onDelete,
  onClose
}: DiagramsPanelProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="diagrams-panel">
      <div className="diagrams-panel__header">
        <span>Diagrams</span>
        <button type="button" className="icon-button" aria-label="Close diagrams panel" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <nav className="diagrams-panel__list" aria-label="Saved diagrams">
        {documents.map((document) => (
          <div
            key={document.id}
            className={
              document.id === activeDocumentId
                ? "diagrams-panel__item diagrams-panel__item--active"
                : "diagrams-panel__item"
            }
          >
            <button type="button" className="diagrams-panel__select" onClick={() => onSelect(document.id)}>
              <strong>{document.name}</strong>
              <small>{new Date(document.updatedAt).toLocaleString()}</small>
            </button>
            <button
              type="button"
              className="diagrams-panel__menu-button"
              aria-label={`More actions for ${document.name}`}
              aria-haspopup="menu"
              aria-expanded={openMenuId === document.id}
              onClick={() => setOpenMenuId((current) => (current === document.id ? null : document.id))}
            >
              <MoreVertical size={16} />
            </button>
            {openMenuId === document.id ? (
              <div className="diagrams-panel__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(document.id);
                    setOpenMenuId(null);
                  }}
                >
                  <Eye size={15} />
                  <span>View</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={isAtDocumentLimit}
                  onClick={() => {
                    onDuplicate(document);
                    setOpenMenuId(null);
                  }}
                >
                  <Copy size={15} />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onExport(document);
                    setOpenMenuId(null);
                  }}
                >
                  <Download size={15} />
                  <span>Export .cell</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="diagrams-panel__menu-danger"
                  onClick={() => {
                    onDelete(document);
                    setOpenMenuId(null);
                  }}
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/DiagramsPanel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/DiagramsPanel.tsx src/app/DiagramsPanel.test.tsx
git commit -m "feat(app): add right-side DiagramsPanel with row actions"
```

---

### Task 8: ShareButton (disabled, with tooltip)

**Files:**
- Create: `src/app/ShareButton.tsx`
- Create: `src/app/ShareButton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/ShareButton.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareButton } from "./ShareButton";

describe("ShareButton", () => {
  it("renders a disabled button described by a coming-soon tooltip", () => {
    render(<ShareButton />);

    const button = screen.getByRole("button", { name: "Share" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Sharing is coming soon");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/ShareButton.test.tsx`
Expected: FAIL with "Cannot find module './ShareButton'"

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/ShareButton.tsx
export function ShareButton() {
  return (
    <div className="share-button">
      <button type="button" className="share-button__trigger" disabled aria-describedby="share-button-tooltip">
        Share
      </button>
      <span id="share-button-tooltip" role="tooltip" className="share-button__tooltip">
        Sharing is coming soon
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/ShareButton.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/app/ShareButton.tsx src/app/ShareButton.test.tsx
git commit -m "feat(app): add disabled ShareButton with coming-soon tooltip"
```

---

### Task 9: InfoPanel (open-source / GitHub / storage note)

**Files:**
- Create: `src/app/InfoPanel.tsx`
- Create: `src/app/InfoPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/InfoPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoPanel } from "./InfoPanel";

describe("InfoPanel", () => {
  it("toggles a popover with the GitHub link, star ask, and storage note", async () => {
    const user = userEvent.setup();
    render(<InfoPanel />);

    expect(screen.queryByRole("dialog", { name: "About Cell Architect" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open info" }));

    const dialog = screen.getByRole("dialog", { name: "About Cell Architect" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/kanushka/cell-architect"
    );
    expect(screen.getByRole("link", { name: /Star the repo/ })).toHaveAttribute(
      "href",
      "https://github.com/kanushka/cell-architect"
    );
    expect(
      screen.getByText("Diagrams are stored in this browser only. You can keep up to 10 at a time.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close info" }));
    expect(screen.queryByRole("dialog", { name: "About Cell Architect" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/InfoPanel.test.tsx`
Expected: FAIL with "Cannot find module './InfoPanel'"

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/InfoPanel.tsx
import { Github, Info, Star, X } from "lucide-react";
import { useState } from "react";

const REPO_URL = "https://github.com/kanushka/cell-architect";

export function InfoPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="info-panel">
      <button
        type="button"
        className="icon-button"
        aria-label={open ? "Close info" : "Open info"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={16} /> : <Info size={16} />}
      </button>
      {open ? (
        <div className="info-panel__popover" role="dialog" aria-label="About Cell Architect">
          <p className="info-panel__lede">Cell Architect is open source.</p>
          <a className="info-panel__link" href={REPO_URL} target="_blank" rel="noreferrer">
            <Github size={15} />
            <span>View on GitHub</span>
          </a>
          <a className="info-panel__link" href={REPO_URL} target="_blank" rel="noreferrer">
            <Star size={15} />
            <span>Star the repo</span>
          </a>
          <p className="info-panel__note">
            Diagrams are stored in this browser only. You can keep up to 10 at a time.
          </p>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/InfoPanel.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/app/InfoPanel.tsx src/app/InfoPanel.test.tsx
git commit -m "feat(app): add InfoPanel with repo link and storage note"
```

---

### Task 10: Rewrite App.tsx to compose the canvas-first shell

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

This is the integration task: it removes the old sidebar/split-pane markup and wires the new overlay components together, computing insets from panel state.

- [ ] **Step 1: Replace `src/app/App.test.tsx` with tests for the new structure**

```tsx
// src/app/App.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../storage/documentRepository";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the default sample full-bleed with the editor open", () => {
    const { container } = render(<App />);

    expect(screen.getAllByText("OrderProject").length).toBeGreaterThan(0);
    expect(screen.getByText("CustomerApp")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");
    expect(container.querySelector('[data-cell-shape="octagon"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-node-shape="circle"]').length).toBeGreaterThanOrEqual(5);
  });

  it("shows parser diagnostics in the editor panel while preserving the canvas", async () => {
    const user = userEvent.setup();
    render(<App />);

    const editor = screen.getByLabelText("Cell DSL source");
    await user.clear(editor);
    await user.type(editor, "title Broken\ncomponent API service\nAPI -- Missing");

    expect(
      screen.getByText("Unknown statement. Expected title, version, component, or dependency arrow.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Fix the DSL errors to render the diagram.")).not.toBeInTheDocument();
  });

  it("collapses and expands the editor panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Collapse editor" }));
    expect(screen.queryByLabelText("Cell DSL source")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand editor" }));
    expect(screen.getByLabelText("Cell DSL source")).toBeInTheDocument();
  });

  it("opens the hamburger menu and creates a new diagram", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "New diagram" }));

    expect(screen.getByLabelText("Diagram name")).toHaveValue("Untitled Cell");
  });

  it("opens the DSL guide from the hamburger menu", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "DSL Guide" }));

    expect(screen.getByRole("dialog", { name: "Cell DSL Guide" })).toBeInTheDocument();
  });

  it("opens the diagrams panel, switches documents, and closes it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    expect(screen.getByRole("navigation", { name: "Saved diagrams" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "New diagram" }));
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Untitled Cell");

    await user.click(screen.getByText("Order System"));
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");

    await user.click(screen.getByRole("button", { name: "Close diagrams panel" }));
    expect(screen.queryByRole("navigation", { name: "Saved diagrams" })).not.toBeInTheDocument();
  });

  it("duplicates, exports, and deletes a diagram from the diagrams panel", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    expect(screen.getByText("Order System Copy")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith('Delete "Order System"? This cannot be undone.');
    expect(screen.queryByText("Order System", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("prevents creating or duplicating more than ten diagrams", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (let index = 1; index < 10; index += 1) {
      await user.click(screen.getByRole("button", { name: "Open main menu" }));
      await user.click(screen.getByRole("menuitem", { name: "New diagram" }));
    }

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    expect(screen.getByRole("menuitem", { name: "New diagram" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Import .cell" })).toBeDisabled();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    await user.click(screen.getAllByRole("button", { name: /More actions for/ })[0]);
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
  });

  it("shows a disabled Share button with a coming-soon tooltip", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("shows the info popover with the repo link", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open info" }));
    expect(screen.getByRole("dialog", { name: "About Cell Architect" })).toBeInTheDocument();
  });

  it("focuses linked connections when clicking a component and clears with Escape", async () => {
    render(<App />);
    const orderServiceLabel = screen.getByText("OrderService");
    const orderServiceCircle = orderServiceLabel.closest(".component-node");
    const orderServiceNode = orderServiceLabel.closest(".react-flow__node");

    expect(orderServiceCircle).toBeInTheDocument();
    await waitFor(() => expect(orderServiceCircle).toHaveAttribute("data-diagram-node-id", "OrderService"));

    fireEvent.click(orderServiceCircle!);
    await waitFor(() => expect(orderServiceNode).toHaveClass("connection-highlight-node"));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(orderServiceNode).not.toHaveClass("connection-highlight-node"));
  });

  it("does not show React Flow branding labels in the diagram chrome", () => {
    render(<App />);

    expect(screen.queryByText("React Flow canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "React Flow attribution" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL — current `App.tsx` still renders the old sidebar/toolbar structure (no "Open main menu", "Diagrams", "Collapse editor", or "Open info" buttons yet).

- [ ] **Step 3: Rewrite `src/app/App.tsx`**

```tsx
// src/app/App.tsx
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { compileCellSource } from "../compiler/compileCellSource";
import { DiagramCanvas } from "../renderer/DiagramCanvas";
import {
  createDocument,
  deleteDocument,
  DiagramDocument,
  duplicateDocument,
  loadRepository,
  MAX_DOCUMENTS,
  replaceRepository,
  saveDocument
} from "../storage/documentRepository";
import { AppMenu } from "./AppMenu";
import { computeCanvasInsets, EDITOR_DEFAULT_WIDTH } from "./layoutConstants";
import { DiagramsPanel } from "./DiagramsPanel";
import { DslGuide } from "./DslGuide";
import { EditorPanel } from "./EditorPanel";
import { InfoPanel } from "./InfoPanel";
import { ShareButton } from "./ShareButton";
import "./styles.css";

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const [repository, setRepository] = useState(() => loadRepository());
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorWidth, setEditorWidth] = useState(EDITOR_DEFAULT_WIDTH);
  const [diagramsOpen, setDiagramsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeDocument =
    repository.documents.find((document) => document.id === repository.activeDocumentId) ?? repository.documents[0];
  const compiled = useMemo(() => compileCellSource(activeDocument.source), [activeDocument.source]);
  const lastValidModel = useRef(compiled.model);
  if (compiled.model) {
    lastValidModel.current = compiled.model;
  }
  const visibleModel = compiled.model ?? lastValidModel.current;
  const isAtDocumentLimit = repository.documents.length >= MAX_DOCUMENTS;
  const insets = computeCanvasInsets({ editorOpen, editorWidth, diagramsOpen });

  function refreshRepository() {
    setRepository(loadRepository());
  }

  function setActiveDocument(id: string) {
    setRepository(replaceRepository({ ...repository, activeDocumentId: id }));
  }

  function updateActiveSource(source: string) {
    const updated = saveDocument({ ...activeDocument, source });
    setRepository({ ...loadRepository(), activeDocumentId: updated.id });
  }

  function updateActiveName(name: string) {
    const updated = saveDocument({ ...activeDocument, name });
    setRepository({ ...loadRepository(), activeDocumentId: updated.id });
  }

  function handleNewDocument() {
    if (isAtDocumentLimit) {
      return;
    }

    createDocument("Untitled Cell", "title UntitledCell\n\ncomponent API service\n");
    refreshRepository();
  }

  function handleImportClick() {
    if (!isAtDocumentLimit) {
      fileInputRef.current?.click();
    }
  }

  function handleDuplicate(document: DiagramDocument) {
    if (isAtDocumentLimit) {
      return;
    }

    duplicateDocument(document.id);
    refreshRepository();
  }

  function handleDelete(document: DiagramDocument) {
    if (!window.confirm(`Delete "${document.name}"? This cannot be undone.`)) {
      return;
    }

    deleteDocument(document.id);
    refreshRepository();
  }

  function handleExport(document: DiagramDocument) {
    downloadText(`${document.name || "cell-diagram"}.cell`, document.source);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (isAtDocumentLimit) {
      event.target.value = "";
      return;
    }

    const source = await file.text();
    createDocument(file.name.replace(/\.[^.]+$/, "") || "Imported Cell", source);
    event.target.value = "";
    refreshRepository();
  }

  return (
    <main className="app-shell">
      <DiagramCanvas model={visibleModel} insets={insets} />

      <div className="overlay overlay--top-left">
        <AppMenu
          onNewDocument={handleNewDocument}
          onImportClick={handleImportClick}
          onOpenGuide={() => setGuideOpen(true)}
          disableCreateActions={isAtDocumentLimit}
        />
        <EditorPanel
          documentName={activeDocument.name}
          onDocumentNameChange={updateActiveName}
          source={activeDocument.source}
          onSourceChange={updateActiveSource}
          diagnostics={compiled.diagnostics}
          collapsed={!editorOpen}
          onToggleCollapsed={() => setEditorOpen((current) => !current)}
          width={editorWidth}
          onWidthChange={setEditorWidth}
        />
      </div>

      <div className="overlay overlay--top-right">
        <ShareButton />
        <button
          type="button"
          className="diagrams-toggle"
          aria-label="Diagrams"
          aria-pressed={diagramsOpen}
          onClick={() => setDiagramsOpen((current) => !current)}
        >
          Diagrams
        </button>
      </div>

      {diagramsOpen ? (
        <DiagramsPanel
          documents={repository.documents}
          activeDocumentId={activeDocument.id}
          isAtDocumentLimit={isAtDocumentLimit}
          onSelect={setActiveDocument}
          onDuplicate={handleDuplicate}
          onExport={handleExport}
          onDelete={handleDelete}
          onClose={() => setDiagramsOpen(false)}
        />
      ) : null}

      <div className="overlay overlay--bottom-right">
        <InfoPanel />
      </div>

      <input ref={fileInputRef} type="file" accept=".cell,.txt" hidden onChange={handleImport} />

      {guideOpen ? <DslGuide onClose={() => setGuideOpen(false)} /> : null}
    </main>
  );
}
```

Note: the `Diagrams` button uses `aria-label="Diagrams"` on an element whose own text content is already "Diagrams" — React Testing Library's accessible name computation prefers text content over `aria-label` only when `aria-label` is absent; here `aria-label` is redundant but harmless. To keep the accessible name exactly `"Diagrams"` (matching the test's `getByRole("button", { name: "Diagrams" })`), remove the `aria-label` attribute entirely and rely on the button's text content:

```tsx
        <button
          type="button"
          className="diagrams-toggle"
          aria-pressed={diagramsOpen}
          onClick={() => setDiagramsOpen((current) => !current)}
        >
          Diagrams
        </button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/App.test.tsx`
Expected: PASS (13 tests)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: All tests PASS, including `DiagramCanvas.test.tsx`, `EditorPanel.test.tsx`, `DiagramsPanel.test.tsx`, `AppMenu.test.tsx`, `ShareButton.test.tsx`, `InfoPanel.test.tsx`, `layoutConstants.test.ts`, and the untouched `SourceEditor.test.ts`, `DslGuide`-related tests, parser/domain/compiler tests. `styles.test.ts` will FAIL at this point — that's expected and fixed in Task 11.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat(app): rewrite App as a canvas-first shell with floating overlays"
```

---

### Task 11: Rewrite styles.css for overlay positioning

**Files:**
- Modify: `src/app/styles.css`
- Modify: `src/app/styles.test.ts`

- [ ] **Step 1: Replace `src/app/styles.test.ts` with assertions for the new layout**

```ts
// src/app/styles.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/app/styles.css"), "utf8");

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.#[\]]/g, (match) => `\\${match}`);
  const pattern = new RegExp(`${escaped} \\{[\\s\\S]*?\\}`);
  return styles.match(pattern)?.[0] ?? "";
}

describe("diagram interaction styles", () => {
  it("does not resize nodes while highlighting connections", () => {
    const highlightRule = styles.match(/\.connection-highlight-node \.component-node,[\s\S]*?\}/)?.[0] ?? "";
    expect(highlightRule).not.toContain("transform:");
  });
});

describe("canvas-first shell", () => {
  it("makes the app shell a full-bleed, fixed-position stage", () => {
    const rule = ruleFor(".app-shell");
    expect(rule).toContain("position: fixed;");
    expect(rule).toContain("inset: 0;");
    expect(rule).toContain("overflow: hidden;");
  });

  it("positions the top-left, top-right, and bottom-right overlays as absolute layers", () => {
    expect(ruleFor(".overlay--top-left")).toContain("position: absolute;");
    expect(ruleFor(".overlay--top-right")).toContain("position: absolute;");
    expect(ruleFor(".overlay--bottom-right")).toContain("position: absolute;");
  });

  it("floats the diagrams panel on the right edge, spanning the viewport height", () => {
    const rule = ruleFor(".diagrams-panel");
    expect(rule).toContain("position: absolute;");
    expect(rule).toContain("right:");
  });
});

describe("source editor interaction styles", () => {
  it("makes text selections more prominent than the active cursor line", () => {
    const activeLineRule = styles.match(/\.source-editor__codemirror \.cm-activeLine,[\s\S]*?\}/)?.[0] ?? "";
    const selectionRule =
      styles.match(/\.source-editor__codemirror \.cm-selectionBackground,[\s\S]*?\}/)?.[0] ?? "";

    expect(activeLineRule).toContain("rgba(37, 99, 235, 0.06)");
    expect(selectionRule).toContain("#93c5fd");
    expect(selectionRule).toContain("!important");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/styles.test.ts`
Expected: FAIL — `.app-shell` is still `display: grid` (not `position: fixed`), and `.overlay--*`/`.diagrams-panel` selectors don't exist yet.

- [ ] **Step 3: Rewrite `src/app/styles.css`**

Replace everything from `.app-shell` through the end of `.diagnostics-panel` (i.e. delete the old `.app-shell`, `.app-shell--diagram-fullscreen`, `.document-rail*`, `.rail-header`, `.brand-block`, `.document-actions`, `.storage-notice`, `.document-list*`, `.document-menu*`, `.workbench`, `.document-title`, `.icon-button`, `.sidebar-reopen-button`, `.danger-button`, `.split-editor*`, `.editor-pane`, `.canvas-pane`, `.pane-header*`, `.canvas-actions`, `.source-editor*` block stays, `.diagnostics-panel` block) with the block below. Keep `.guide-backdrop` / `.guide-dialog` / `.guide-*` rules, `.source-editor*` rules, `.canvas-pane .react-flow` (rename to `.app-shell .react-flow`), and everything from `.cell-boundary` onward **unchanged** (the node/edge/gate styling is untouched by this refactor).

```css
:root {
  font-family: "Aptos", "Segoe UI", system-ui, sans-serif;
  color: #172033;
  background: #eef2f6;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --ink: #111827;
  --muted: #64748b;
  --panel: #f8fafc;
  --panel-strong: #ffffff;
  --line: #d6dee8;
  --north: #0284c7;
  --east: #ea580c;
  --south: #059669;
  --west: #7c3aed;
  --shadow: 0 20px 50px rgba(15, 23, 42, 0.14);
  --panel-edge-offset: 14px;
  --control-gap: 8px;
  --info-button-size: 34px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.app-shell {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #eef2f6;
}

.app-shell .react-flow {
  background: #f8fafc;
}

.icon-button {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: #334155;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.icon-button:hover {
  border-color: #94a3b8;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.overlay {
  position: absolute;
  z-index: 20;
  display: flex;
  gap: var(--control-gap);
}

.overlay--top-left {
  top: var(--panel-edge-offset);
  left: var(--panel-edge-offset);
  flex-direction: column;
  align-items: flex-start;
}

.overlay--top-right {
  top: var(--panel-edge-offset);
  right: var(--panel-edge-offset);
  align-items: flex-start;
}

.overlay--bottom-right {
  bottom: var(--panel-edge-offset);
  right: var(--panel-edge-offset);
}

.app-menu {
  position: relative;
}

.app-menu__dropdown {
  position: absolute;
  top: 42px;
  left: 0;
  z-index: 25;
  display: grid;
  min-width: 168px;
  padding: 6px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
}

.app-menu__dropdown button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 9px;
  color: #263447;
  background: transparent;
  border-radius: 6px;
  text-align: left;
}

.app-menu__dropdown button:hover {
  background: #f1f5f9;
}

.editor-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 320px;
  height: 420px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 12px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.editor-panel--collapsed {
  grid-template-rows: auto;
  height: auto;
}

.editor-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
}

.editor-panel__name {
  min-width: 0;
  flex: 1;
  padding: 7px 10px;
  color: var(--ink);
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
}

.editor-panel__diagnostics {
  display: grid;
  gap: 8px;
  max-height: 150px;
  padding: 12px 14px;
  overflow: auto;
  background: #f8fafc;
  border-top: 1px solid var(--line);
}

.editor-panel__diagnostics p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
}

.editor-panel__diagnostics strong {
  display: block;
  color: #be123c;
}

.editor-panel__resize-handle {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  border-right: 2px solid #cbd5e1;
  border-bottom: 2px solid #cbd5e1;
}

.diagrams-toggle {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  color: #1e293b;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
  font-size: 13px;
  font-weight: 750;
}

.diagrams-toggle[aria-pressed="true"] {
  color: #ffffff;
  background: #1e293b;
}

.diagrams-panel {
  position: absolute;
  top: var(--panel-edge-offset);
  right: var(--panel-edge-offset);
  bottom: var(--panel-edge-offset);
  z-index: 20;
  width: 260px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 12px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.diagrams-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
  font-weight: 800;
}

.diagrams-panel__list {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
}

.diagrams-panel__item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
}

.diagrams-panel__item--active {
  background: #eef2ff;
  border-color: #bfd0e3;
}

.diagrams-panel__select {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 10px 8px 10px 12px;
  text-align: left;
  color: inherit;
  background: transparent;
}

.diagrams-panel__select strong {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diagrams-panel__select small {
  color: var(--muted);
  font-size: 11px;
}

.diagrams-panel__menu-button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  margin-right: 6px;
  color: #475569;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
}

.diagrams-panel__menu-button:hover,
.diagrams-panel__menu-button[aria-expanded="true"] {
  color: #0f172a;
  background: #f1f5f9;
  border-color: #d6dee8;
}

.diagrams-panel__menu {
  position: absolute;
  top: 42px;
  right: 8px;
  z-index: 25;
  display: grid;
  min-width: 154px;
  padding: 6px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
}

.diagrams-panel__menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 9px;
  color: #263447;
  background: transparent;
  border-radius: 6px;
  text-align: left;
}

.diagrams-panel__menu button:hover {
  background: #f1f5f9;
}

.diagrams-panel__menu-danger {
  color: #991b1b !important;
}

.share-button {
  position: relative;
  display: inline-flex;
}

.share-button__trigger {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  color: #b6c0cf;
  background: #f1f5f9;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 750;
}

.share-button__tooltip {
  position: absolute;
  top: 44px;
  right: 0;
  z-index: 25;
  padding: 5px 8px;
  color: #ffffff;
  background: #1e293b;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.share-button:hover .share-button__tooltip,
.share-button:focus-within .share-button__tooltip {
  opacity: 1;
}

.info-panel {
  position: relative;
}

.info-panel__popover {
  position: absolute;
  bottom: calc(var(--info-button-size) + var(--control-gap));
  right: 0;
  z-index: 25;
  display: grid;
  gap: 10px;
  width: 240px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
}

.info-panel__lede {
  margin: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.info-panel__link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1e293b;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}

.info-panel__link:hover {
  text-decoration: underline;
}

.info-panel__note {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}

.guide-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(8px);
}

.guide-dialog {
  width: min(920px, calc(100vw - 48px));
  max-height: min(760px, calc(100vh - 48px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  color: #172033;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.34);
}

.guide-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}

.guide-header p {
  margin: 0 0 5px;
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.guide-header h2 {
  margin: 0;
  color: var(--ink);
  font-size: 22px;
  line-height: 1.1;
  letter-spacing: 0;
}

.guide-content {
  min-height: 0;
  display: grid;
  gap: 12px;
  padding: 14px;
  overflow-y: auto;
}

.guide-section {
  display: grid;
  gap: 10px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #dbe4ee;
  border-radius: 8px;
}

.guide-section h3,
.guide-section p {
  margin: 0;
}

.guide-section h3 {
  color: #0f172a;
  font-size: 15px;
}

.guide-section p {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.guide-section__copy {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.guide-example {
  display: grid;
  gap: 6px;
}

.guide-example__copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.guide-example__label {
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.guide-section__copy button,
.guide-example__copy button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  color: #1e293b;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.guide-section__copy button:hover,
.guide-example__copy button:hover {
  border-color: #94a3b8;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.guide-section pre {
  min-width: 0;
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  color: #dbeafe;
  background: #0f172a;
  border-radius: 8px;
}

.guide-section code {
  font-family: "SFMono-Regular", "Cascadia Code", Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre;
}

.source-editor {
  position: relative;
  min-height: 0;
  background: #ffffff;
}

.source-editor__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.source-editor__codemirror,
.source-editor__codemirror .cm-editor {
  height: 100%;
}

.source-editor__codemirror .cm-editor {
  background: #ffffff;
  color: #1f2937;
  font-size: 13px;
}

.source-editor__codemirror .cm-gutters {
  color: #64748b;
  background: #f8fafc;
  border-right-color: #d6dee8;
}

.source-editor__codemirror .cm-activeLine,
.source-editor__codemirror .cm-activeLineGutter {
  background: rgba(37, 99, 235, 0.06);
}

.source-editor__codemirror .cm-selectionBackground,
.source-editor__codemirror .cm-focused .cm-selectionBackground {
  background: #93c5fd !important;
}

.source-editor__test-input {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.zoom-controls {
  position: absolute;
  right: calc(var(--panel-edge-offset) + var(--info-button-size) + var(--control-gap));
  bottom: var(--panel-edge-offset);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
}

.zoom-controls__button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  color: #334155;
  background: transparent;
  border-radius: 6px;
}

.zoom-controls__button:hover {
  background: #f1f5f9;
}

.zoom-controls__level {
  min-width: 34px;
  text-align: center;
  color: #475569;
  font-size: 11px;
  font-weight: 750;
}
```

Then keep everything from `.cell-boundary` through the end of the file (the octagon/component/external/gateway/edge/focus-hint/empty-canvas rules) **exactly as it was**, but delete the trailing `@media (max-width: 980px)` block's rules that reference now-removed selectors (`.document-rail`, `.pane-header--document`, `.document-title input`, `.split-editor`, `.editor-pane`, `.canvas-pane`) — replace that whole media query block with:

```css
@media (max-width: 640px) {
  .guide-backdrop {
    padding: 12px;
  }

  .guide-dialog {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }

  .guide-header,
  .guide-section__copy,
  .guide-example__copy {
    align-items: stretch;
  }

  .guide-section__copy,
  .guide-example__copy {
    flex-direction: column;
  }

  .guide-section__copy button,
  .guide-example__copy button {
    justify-content: center;
    width: 100%;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/styles.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc -b`
Expected: No errors.

Run: `npx eslint .`
Expected: No errors (fix any unused-import/unused-var issues surfaced by the App.tsx rewrite, e.g. removed `Copy`/`Download`/`Eye` icons from App.tsx since those moved into `DiagramsPanel`).

- [ ] **Step 7: Commit**

```bash
git add src/app/styles.css src/app/styles.test.ts
git commit -m "style(app): replace split-pane layout with canvas-first overlay positioning"
```

---

### Task 12: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and load the app**

Use the preview tooling to start the `dev` script and open the app in the browser preview.

- [ ] **Step 2: Verify the resting layout**

Confirm: full-bleed canvas with dotted background, hamburger top-left, editor panel below it showing the sample source, Share (disabled, hover shows "Sharing is coming soon") and Diagrams buttons top-right, zoom cluster + info button bottom-right, no leftover boxed panels.

- [ ] **Step 3: Verify recentering**

Click **Diagrams** to open the right panel and confirm the diagram visually re-centers into the remaining space rather than being covered. Close it and confirm it re-centers back. Drag the editor panel's resize handle wider and confirm the diagram shifts to stay centered in the shrinking free space.

- [ ] **Step 4: Verify collapse, hamburger menu, and info popover**

Collapse the editor via its header chevron and confirm the diagram re-centers to use the freed space; expand it again. Open the hamburger menu and confirm New/Import/Guide work. Open the info popover and confirm the GitHub link points to `https://github.com/kanushka/cell-architect`.

- [ ] **Step 5: Verify focus-click behavior is undisturbed**

Click a component node and confirm connection highlighting works and does **not** trigger a visible re-fit/pan (only dimming/highlighting), consistent with the `model`-only dependency in `FitViewController`.

- [ ] **Step 6: Report results**

Summarize what was checked and any visual issues found, with a screenshot of the resting state and the Diagrams-panel-open state.

---

## Plan Self-Review Notes

- **Spec coverage:** hamburger menu (Task 4), resizable/collapsible editor (Tasks 5–6), disabled Share with tooltip (Task 8), Diagrams panel with switch/duplicate/export/delete (Task 7), bottom-right zoom/fit + info (Tasks 3, 9), recenter-on-toggle via `fitView` insets (Task 2), editor+Diagrams open together (Task 10 — no mutual-exclusion logic added), fullscreen-collapses-editor (Task 10 — no separate fullscreen mode exists; the collapse chevron is the only "fullscreen" affordance, matching the spec's Behavior Decision #3), Guide stays a centered modal (untouched `DslGuide.tsx`, wired via `AppMenu`).
- **Out of scope confirmed untouched:** `src/parser`, `src/domain`, `src/compiler`, `src/storage/documentRepository.ts`, `DslGuide.tsx`, `SourceEditor.tsx` internals, `flowLayout.ts`, `highlightModel.ts`.
- **Type/name consistency check:** `insets: DiagramCanvasInsets` (Task 2) flows unchanged through `ZoomControls` (Task 3) and `App.tsx` (Task 10) via `computeCanvasInsets` (Task 1). `EditorPanel`'s `width`/`onWidthChange` (Task 6) match `editorWidth`/`setEditorWidth` in `App.tsx` (Task 10). `DiagramsPanel`'s callback names (`onSelect`, `onDuplicate`, `onExport`, `onDelete`, `onClose`) match the handlers wired in `App.tsx`.
