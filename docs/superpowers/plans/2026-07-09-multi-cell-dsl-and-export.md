# Multi-Cell DSL and Diagram Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Cell Architect to render multiple cells (a "project") from `cell <id> { … }` blocks with cross-cell links and shared externals, and add SVG/PNG export.

**Architecture:** Keep the existing single-cell parse/compile/layout pipeline and wrap it. A brace-aware pre-pass splits source into cells; each cell is parsed/compiled with today's per-line logic; a new project layer resolves cross-cell edges and shared externals into a `ProjectModel`. Rendering gains a two-level layout: existing per-cell layout, then a cell-level dagre pass that offsets each cell. Export uses `html-to-image` on the React Flow viewport.

**Tech Stack:** React + TypeScript, Vite, Vitest, `@xyflow/react`, `@dagrejs/dagre`, `html-to-image` (new).

**Key conventions used throughout this plan:**
- Run all tests with `npm test`. Run a single file with `npx vitest run <path>`.
- The implicit single cell (a document with no `cell {}` blocks) has cell id `"main"`.
- **Node-id namespacing is only applied when `project.cells.length > 1`.** Helper: `namespacedId(cellId, id, multi) => (multi ? `${cellId}::${id}` : id)`. This keeps single-cell diagrams byte-for-byte identical to today, so existing `flowLayout`/`DiagramCanvas` tests keep passing unchanged.
- Commit after every task with the shown message.

---

## Phase 1 — Export (SVG / PNG)

Independent of multi-cell; ships value on today's diagrams first.

### Task 1: Add the html-to-image dependency

**Files:**
- Modify: `package.json` (dependencies)

- [ ] **Step 1: Install**

Run: `npm install html-to-image@1.11.13`
Expected: `package.json` gains `"html-to-image": "1.11.13"` under `dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require('html-to-image')"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html-to-image for diagram export"
```

### Task 2: Export viewport math helper

A pure function computes the zoom+offset that fits the whole diagram into a target image size, independent of current pan/zoom.

**Files:**
- Create: `src/renderer/exportImage.ts`
- Test: `src/renderer/exportImage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { computeExportTransform } from "./exportImage";

describe("computeExportTransform", () => {
  it("scales a wide diagram to fit width and centers it with padding", () => {
    const bounds = { x: 0, y: 0, width: 800, height: 400 };
    const t = computeExportTransform(bounds, { width: 1000, height: 1000, padding: 0.1 });

    // 10% padding => usable 800x800; wide side (800w) scales by 800/800 = 1
    expect(t.zoom).toBeCloseTo(1, 5);
    // centered horizontally: (1000 - 800*1)/2 = 100
    expect(t.x).toBeCloseTo(100, 5);
    // centered vertically: (1000 - 400*1)/2 = 300
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/exportImage.test.ts`
Expected: FAIL — `computeExportTransform is not a function`.

- [ ] **Step 3: Implement the helper**

```ts
export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExportTarget {
  width: number;
  height: number;
  padding: number; // fraction of the target reserved as margin, e.g. 0.1
}

export interface ExportTransform {
  x: number;
  y: number;
  zoom: number;
}

export function computeExportTransform(bounds: ExportBounds, target: ExportTarget): ExportTransform {
  const usableWidth = target.width * (1 - target.padding);
  const usableHeight = target.height * (1 - target.padding);
  const zoom = Math.min(usableWidth / bounds.width, usableHeight / bounds.height, 1);
  const x = target.width / 2 - (bounds.x + bounds.width / 2) * zoom;
  const y = target.height / 2 - (bounds.y + bounds.height / 2) * zoom;
  return { x, y, zoom };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/exportImage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/exportImage.ts src/renderer/exportImage.test.ts
git commit -m "feat: add export viewport transform helper"
```

### Task 3: Export functions (SVG + PNG) using html-to-image

**Files:**
- Modify: `src/renderer/exportImage.ts`

- [ ] **Step 1: Add the download + capture functions**

Append to `src/renderer/exportImage.ts`:

```ts
import { toPng, toSvg } from "html-to-image";
import { getNodesBounds, type Node } from "@xyflow/react";

const EXPORT_WIDTH = 2000;
const EXPORT_HEIGHT = 1400;
const EXPORT_PADDING = 0.08;

function triggerDownload(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

interface CaptureArgs {
  nodes: Node[];
  viewport: HTMLElement;
  filename: string;
}

function captureOptions(nodes: Node[]) {
  const bounds = getNodesBounds(nodes);
  const transform = computeExportTransform(bounds, {
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
    padding: EXPORT_PADDING
  });
  return {
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
    style: {
      width: `${EXPORT_WIDTH}px`,
      height: `${EXPORT_HEIGHT}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`
    }
  };
}

export async function exportPng({ nodes, viewport, filename }: CaptureArgs) {
  const options = captureOptions(nodes);
  const dataUrl = await toPng(viewport, {
    ...options,
    pixelRatio: 2,
    backgroundColor: "#ffffff"
  });
  triggerDownload(dataUrl, `${filename}.png`);
}

export async function exportSvg({ nodes, viewport, filename }: CaptureArgs) {
  const options = captureOptions(nodes);
  const dataUrl = await toSvg(viewport, {
    ...options,
    backgroundColor: "#ffffff"
  });
  triggerDownload(dataUrl, `${filename}.svg`);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/exportImage.ts
git commit -m "feat: add SVG and PNG diagram capture functions"
```

### Task 4: Export controls in the canvas

Add Export SVG / Export PNG buttons that read nodes and the viewport element from React Flow.

**Files:**
- Modify: `src/renderer/DiagramCanvas.tsx` (add an `ExportControls` component; render it next to `ZoomControls`)
- Modify: `src/renderer/DiagramCanvas.test.tsx` (assert buttons render)

- [ ] **Step 1: Write the failing test**

Add to `src/renderer/DiagramCanvas.test.tsx` (inside the existing top-level `describe`; keep existing imports, add `screen` if missing):

```ts
it("renders SVG and PNG export controls", () => {
  render(<DiagramCanvas model={sampleModel} />);
  expect(screen.getByRole("button", { name: /export png/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /export svg/i })).toBeInTheDocument();
});
```

If the test file lacks a `sampleModel`, reuse the model it already builds for other tests (inspect the file and reuse the existing fixture variable name).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/DiagramCanvas.test.tsx`
Expected: FAIL — buttons not found.

- [ ] **Step 3: Add the ExportControls component**

In `src/renderer/DiagramCanvas.tsx`, add imports at top:

```ts
import { exportPng, exportSvg } from "./exportImage";
```

Add this component near `ZoomControls`:

```tsx
function ExportControls({ filename }: { filename: string }) {
  const { getNodes } = useReactFlow();

  function viewportElement(): HTMLElement | null {
    return document.querySelector(".react-flow__viewport");
  }

  async function handleExport(kind: "png" | "svg") {
    const viewport = viewportElement();
    if (!viewport) {
      return;
    }
    const nodes = getNodes();
    const args = { nodes, viewport, filename };
    if (kind === "png") {
      await exportPng(args);
    } else {
      await exportSvg(args);
    }
  }

  return (
    <div className="export-controls">
      <button type="button" className="export-controls__button" aria-label="Export PNG" onClick={() => handleExport("png")}>
        PNG
      </button>
      <button type="button" className="export-controls__button" aria-label="Export SVG" onClick={() => handleExport("svg")}>
        SVG
      </button>
    </div>
  );
}
```

Render it inside the `<ReactFlow>` element, right after `<ZoomControls insets={insets} />`:

```tsx
<ExportControls filename={model.title?.trim() || "cell-diagram"} />
```

- [ ] **Step 4: Add minimal styling**

Append to `src/app/styles.css`:

```css
.export-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
  display: flex;
  gap: 6px;
}

.export-controls__button {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
}

.export-controls__button:hover {
  background: #f1f5f9;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/renderer/DiagramCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 6: Manually verify capture works**

Run: `npm run dev`, open the app, click PNG then SVG. Expected: two files download and open correctly. (`html-to-image` is not exercised in jsdom, so this manual check is the real verification.)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/DiagramCanvas.tsx src/renderer/DiagramCanvas.test.tsx src/app/styles.css
git commit -m "feat: add SVG/PNG export buttons to the diagram canvas"
```

> **Note (`model.title`):** `model` is still `CellDiagramModel` at this point. Phase 2 renames the canvas prop to a `ProjectModel`; Task 12 updates this `filename` expression to `model.title` (project title). No change needed here yet.

---

## Phase 2 — DSL, Model, Parse, Compile

Produces a `ProjectModel` and all validations. Fully testable without rendering. The single-cell path stays behavior-identical.

### Task 5: Project/cell/cross-edge domain types

**Files:**
- Modify: `src/domain/cellModel.ts`

- [ ] **Step 1: Add the new types**

Append to `src/domain/cellModel.ts` (keep everything already there):

```ts
export type CrossExit = "east" | "south";
export type CrossEntry = "west" | "north";
export type CrossMode = "connected" | "decoupled";

export interface CrossEdge {
  id: string;
  sourceCell: string;
  sourceComp: string;
  targetCell: string;
  targetComp: string;
  exit: CrossExit;
  entry: CrossEntry;
  mode: CrossMode;
  label?: string;
  line: number;
}

export interface CellModel {
  id: string;
  label?: string;
  version?: string;
  components: ParsedComponent[];
  externals: ExternalNode[];
  edges: ParsedEdge[];
}

export interface ProjectModel {
  title?: string;
  cells: CellModel[];
  crossEdges: CrossEdge[];
  sharedExternals: ExternalNode[];
}

export interface ProjectCompileResult {
  model: ProjectModel | null;
  diagnostics: Diagnostic[];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors (only additive types).

- [ ] **Step 3: Commit**

```bash
git add src/domain/cellModel.ts
git commit -m "feat: add ProjectModel, CellModel, and CrossEdge domain types"
```

### Task 6: Brace-aware source splitter

Splits a document into cell blocks and top-level lines, tracking original line numbers.

**Files:**
- Create: `src/parser/splitCells.ts`
- Test: `src/parser/splitCells.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { splitCells } from "./splitCells";

describe("splitCells", () => {
  it("returns a single implicit block when there are no cell braces", () => {
    const result = splitCells(`component API service\nnorth -> API`);
    expect(result.diagnostics).toEqual([]);
    expect(result.implicit).toBe(true);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].id).toBe("main");
    expect(result.cells[0].lines.map((l) => l.text)).toEqual(["component API service", "north -> API"]);
    expect(result.cells[0].lines.map((l) => l.line)).toEqual([1, 2]);
    expect(result.topLevel).toEqual([]);
  });

  it("splits explicit cell blocks and keeps original line numbers", () => {
    const source = [
      "title Project",          // line 1  (top level)
      "cell orders as \"Order Cell\" {", // line 2
      "  component api",         // line 3
      "}",                       // line 4
      "cell products {",         // line 5
      "  component api",         // line 6
      "}"                        // line 7
    ].join("\n");
    const result = splitCells(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.implicit).toBe(false);
    expect(result.topLevel.map((l) => l.text)).toEqual(["title Project"]);
    expect(result.cells).toHaveLength(2);
    expect(result.cells[0]).toMatchObject({ id: "orders", label: "Order Cell", headerLine: 2 });
    expect(result.cells[0].lines).toEqual([{ text: "component api", line: 3 }]);
    expect(result.cells[1]).toMatchObject({ id: "products", label: undefined, headerLine: 5 });
    expect(result.cells[1].lines).toEqual([{ text: "component api", line: 6 }]);
  });

  it("reports an unbalanced-brace diagnostic", () => {
    const result = splitCells(`cell a {\n  component x`);
    expect(result.diagnostics).toEqual([
      { severity: "error", message: "Unbalanced braces: a cell block was not closed.", line: 1, column: 1 }
    ]);
  });

  it("reports a nested cell header", () => {
    const result = splitCells(`cell a {\n  cell b {\n  }\n}`);
    expect(result.diagnostics[0]).toMatchObject({
      message: "Nested cells are not supported.",
      line: 2
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/parser/splitCells.test.ts`
Expected: FAIL — `splitCells is not a function`.

- [ ] **Step 3: Implement the splitter**

```ts
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
  const hasBlocks = rawLines.some((line) => /^\s*cell\s+\S+.*\{\s*$/.test(line) || /^\s*cell\s+\S+.*\{/.test(line.trim()));

  if (!hasBlocks) {
    const lines = rawLines
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter((entry) => entry.text.length > 0);
    return {
      implicit: true,
      cells: [{ id: "main", headerLine: 0, lines }],
      topLevel: [],
      diagnostics: []
    };
  }

  const cells: CellBlock[] = [];
  const topLevel: SourceLine[] = [];
  const diagnostics: Diagnostic[] = [];
  let current: CellBlock | null = null;

  rawLines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return;
    }

    const header = headerPattern.exec(trimmed);
    if (header) {
      if (current) {
        diagnostics.push({ severity: "error", message: "Nested cells are not supported.", line, column: 1 });
        return;
      }
      current = { id: header[1], label: header[2] ?? header[3], headerLine: line, lines: [] };
      return;
    }

    if (trimmed === "}") {
      if (!current) {
        diagnostics.push({ severity: "error", message: "Unexpected closing brace.", line, column: 1 });
        return;
      }
      cells.push(current);
      current = null;
      return;
    }

    if (current) {
      current.lines.push({ text: trimmed, line });
    } else {
      topLevel.push({ text: trimmed, line });
    }
  });

  if (current) {
    diagnostics.push({
      severity: "error",
      message: "Unbalanced braces: a cell block was not closed.",
      line: current.headerLine,
      column: 1
    });
  }

  return { implicit: false, cells, topLevel, diagnostics };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/parser/splitCells.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/parser/splitCells.ts src/parser/splitCells.test.ts
git commit -m "feat: add brace-aware cell block splitter"
```

### Task 7: Direction-token parser for cross-cell edges

**Files:**
- Create: `src/parser/crossEdge.ts`
- Test: `src/parser/crossEdge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseDirToken, parseCrossEdge } from "./crossEdge";

describe("parseDirToken", () => {
  it("defaults to east/west when no token is given", () => {
    expect(parseDirToken(undefined)).toEqual({ exit: "east", entry: "west" });
  });
  it("expands a bare east to east/west", () => {
    expect(parseDirToken("east")).toEqual({ exit: "east", entry: "west" });
  });
  it("parses east-north", () => {
    expect(parseDirToken("east-north")).toEqual({ exit: "east", entry: "north" });
  });
  it("parses south-north and south-west", () => {
    expect(parseDirToken("south-north")).toEqual({ exit: "south", entry: "north" });
    expect(parseDirToken("south-west")).toEqual({ exit: "south", entry: "west" });
  });
  it("rejects a bare south (no explicit entry)", () => {
    expect(parseDirToken("south")).toEqual({ error: "bare-south" });
  });
  it("rejects an inbound exit or outbound entry", () => {
    expect(parseDirToken("west")).toEqual({ error: "bad-token" });
    expect(parseDirToken("east-south")).toEqual({ error: "bad-token" });
  });
});

describe("parseCrossEdge", () => {
  it("parses an inline cross edge with a bare local source", () => {
    expect(parseCrossEdge("api -> east-north products.api : get stock", 12)).toEqual({
      sourceCell: null,
      sourceComp: "api",
      targetCell: "products",
      targetComp: "api",
      exit: "east",
      entry: "north",
      label: "get stock",
      line: 12
    });
  });
  it("parses a project-level cross edge with both ends qualified", () => {
    expect(parseCrossEdge("orders.api -> products.stock", 3)).toEqual({
      sourceCell: "orders",
      sourceComp: "api",
      targetCell: "products",
      targetComp: "stock",
      exit: "east",
      entry: "west",
      label: undefined,
      line: 3
    });
  });
  it("returns null when the target is not qualified (not a cross edge)", () => {
    expect(parseCrossEdge("api -> east InventoryAPI", 1)).toBeNull();
  });
  it("returns a bare-south error result", () => {
    expect(parseCrossEdge("api -> south products.api", 5)).toEqual({ error: "bare-south", line: 5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/parser/crossEdge.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement**

```ts
import { CrossEntry, CrossExit } from "../domain/cellModel";

export type DirTokenResult =
  | { exit: CrossExit; entry: CrossEntry }
  | { error: "bare-south" | "bad-token" };

const outbound = new Set<CrossExit>(["east", "south"]);
const inbound = new Set<CrossEntry>(["west", "north"]);

export function parseDirToken(token: string | undefined): DirTokenResult {
  if (!token) {
    return { exit: "east", entry: "west" };
  }
  const parts = token.split("-");
  const exit = parts[0] as CrossExit;
  if (!outbound.has(exit)) {
    return { error: "bad-token" };
  }
  if (parts.length === 1) {
    if (exit === "south") {
      return { error: "bare-south" };
    }
    return { exit, entry: "west" };
  }
  if (parts.length !== 2) {
    return { error: "bad-token" };
  }
  const entry = parts[1] as CrossEntry;
  if (!inbound.has(entry)) {
    return { error: "bad-token" };
  }
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

function splitLabel(statement: string) {
  const index = statement.indexOf(":");
  if (index === -1) {
    return { body: statement.trim(), label: undefined as string | undefined };
  }
  const label = statement.slice(index + 1).trim();
  return { body: statement.slice(0, index).trim(), label: label.length > 0 ? label : undefined };
}

function qualified(token: string): { cell: string; comp: string } | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) {
    return null;
  }
  return { cell: token.slice(0, dot), comp: token.slice(dot + 1) };
}

export function parseCrossEdge(statement: string, line: number): CrossEdgeParse {
  const { body, label } = splitLabel(statement);
  const arrow = body.split(/\s*->\s*/);
  if (arrow.length !== 2 || !arrow[0] || !arrow[1]) {
    return null;
  }

  const rightTokens = arrow[1].trim().split(/\s+/);
  let dirToken: string | undefined;
  let targetToken: string;
  if (rightTokens.length === 2) {
    dirToken = rightTokens[0];
    targetToken = rightTokens[1];
  } else if (rightTokens.length === 1) {
    targetToken = rightTokens[0];
  } else {
    return null;
  }

  const target = qualified(targetToken);
  if (!target) {
    return null; // not a cross-cell edge; leave to existing per-line logic
  }

  const leftToken = arrow[0].trim();
  const source = qualified(leftToken);

  const dir = parseDirToken(dirToken);
  if ("error" in dir) {
    return { error: dir.error, line };
  }

  return {
    sourceCell: source ? source.cell : null,
    sourceComp: source ? source.comp : leftToken,
    targetCell: target.cell,
    targetComp: target.comp,
    exit: dir.exit,
    entry: dir.entry,
    label,
    line
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/parser/crossEdge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser/crossEdge.ts src/parser/crossEdge.test.ts
git commit -m "feat: add cross-cell edge and direction-token parsing"
```

### Task 8: Project parser — assemble cells + cross edges

Wraps `splitCells`, the existing `parseCellDsl` (per cell body), and `parseCrossEdge`.

**Files:**
- Create: `src/parser/parseProject.ts`
- Test: `src/parser/parseProject.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseProject } from "./parseProject";

describe("parseProject", () => {
  it("parses a single implicit cell (backward compatible)", () => {
    const result = parseProject(`component API service\nnorth -> API`);
    expect(result.diagnostics).toEqual([]);
    expect(result.project.title).toBeUndefined();
    expect(result.project.cells).toHaveLength(1);
    expect(result.project.cells[0].id).toBe("main");
    expect(result.project.cells[0].document.components.map((c) => c.id)).toEqual(["API"]);
    expect(result.project.crossEdges).toEqual([]);
  });

  it("parses two cells, a project title, and an inline cross edge", () => {
    const source = [
      "title Commerce",
      "cell orders {",
      "  component api",
      "  api -> east products.api : get stock",
      "}",
      "cell products {",
      "  component api",
      "}"
    ].join("\n");
    const result = parseProject(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.project.title).toBe("Commerce");
    expect(result.project.cells.map((c) => c.id)).toEqual(["orders", "products"]);
    expect(result.project.crossEdges).toEqual([
      {
        id: "cross-orders-api-products-api-4",
        sourceCell: "orders",
        sourceComp: "api",
        targetCell: "products",
        targetComp: "api",
        exit: "east",
        entry: "west",
        mode: "connected",
        label: "get stock",
        line: 4
      }
    ]);
  });

  it("flags a bare-south cross edge", () => {
    const source = "cell a {\n  x -> south b.y\n}\ncell b {\n  component y\n}";
    const result = parseProject(source);
    expect(result.diagnostics.some((d) => /south/i.test(d.message))).toBe(true);
  });

  it("flags top-level component statements mixed with cell blocks", () => {
    const source = "component loose\ncell a {\n  component x\n}";
    const result = parseProject(source);
    expect(result.diagnostics.some((d) => /top level|outside a cell/i.test(d.message))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/parser/parseProject.test.ts`
Expected: FAIL — `parseProject is not a function`.

- [ ] **Step 3: Implement**

```ts
import { CrossExit, CrossEntry, Diagnostic, ParsedCellDocument } from "../domain/cellModel";
import { parseCellDsl } from "./parseCellDsl";
import { CellBlock, SourceLine, splitCells } from "./splitCells";
import { parseCrossEdge } from "./crossEdge";

export interface ParsedCell {
  id: string;
  label?: string;
  document: ParsedCellDocument;
}

export interface ParsedCrossEdgeResolved {
  id: string;
  sourceCell: string | null;
  sourceComp: string;
  targetCell: string;
  targetComp: string;
  exit: CrossExit;
  entry: CrossEntry;
  mode: "connected" | "decoupled";
  label?: string;
  line: number;
}

export interface ParsedProject {
  title?: string;
  cells: ParsedCell[];
  crossEdges: ParsedCrossEdgeResolved[];
}

export interface ParseProjectResult {
  project: ParsedProject;
  diagnostics: Diagnostic[];
}

function crossEdgeId(sourceComp: string, targetCell: string, targetComp: string, line: number) {
  return `cross-${sourceComp}-${targetCell}-${targetComp}-${line}`;
}

// Reconstruct a per-cell source string from its block lines, preserving nothing
// but the statement text (line numbers are tracked separately for diagnostics).
function cellBodySource(lines: SourceLine[]): string {
  return lines.map((entry) => entry.text).join("\n");
}

export function parseProject(source: string): ParseProjectResult {
  const split = splitCells(source);
  const diagnostics: Diagnostic[] = [...split.diagnostics];
  const crossEdges: ParsedCrossEdgeResolved[] = [];

  // Pull cross edges out of each cell body so parseCellDsl never sees them.
  const cells: ParsedCell[] = split.cells.map((block: CellBlock) => {
    const keptLines: SourceLine[] = [];
    block.lines.forEach((entry) => {
      const cross = parseCrossEdge(entry.text, entry.line);
      if (cross === null) {
        keptLines.push(entry);
        return;
      }
      if ("error" in cross) {
        diagnostics.push({
          severity: "error",
          message:
            cross.error === "bare-south"
              ? "A south cross-cell link needs an explicit entry, e.g. `south-north`. Use `east` for a connected link."
              : "Invalid cross-cell direction. Exit must be east or south; entry must be west or north.",
          line: cross.line,
          column: 1
        });
        return;
      }
      crossEdges.push({
        id: crossEdgeId(cross.sourceComp, cross.targetCell, cross.targetComp, cross.line),
        ...cross,
        mode: cross.exit === "east" ? "connected" : "decoupled"
      });
    });

    const parsed = parseCellDsl(cellBodySource(keptLines));
    diagnostics.push(...parsed.diagnostics);
    return { id: block.id, label: block.label, document: parsed.document };
  });

  let title: string | undefined = split.implicit ? cells[0]?.document.title : undefined;

  // Top-level statements: title, project-level cross edges, else error.
  split.topLevel.forEach((entry) => {
    if (entry.text.startsWith("title ")) {
      title = entry.text.slice("title ".length).trim() || undefined;
      return;
    }
    if (entry.text.startsWith("#") || entry.text.startsWith("//")) {
      return;
    }
    const cross = parseCrossEdge(entry.text, entry.line);
    if (cross && !("error" in cross)) {
      crossEdges.push({
        id: crossEdgeId(cross.sourceComp, cross.targetCell, cross.targetComp, cross.line),
        ...cross,
        mode: cross.exit === "east" ? "connected" : "decoupled"
      });
      return;
    }
    if (cross && "error" in cross) {
      diagnostics.push({
        severity: "error",
        message:
          cross.error === "bare-south"
            ? "A south cross-cell link needs an explicit entry, e.g. `south-north`."
            : "Invalid cross-cell direction.",
        line: cross.line,
        column: 1
      });
      return;
    }
    diagnostics.push({
      severity: "error",
      message: "Only `title`, comments, and cross-cell edges are allowed outside a cell block.",
      line: entry.line,
      column: 1
    });
  });

  return { project: { title, cells, crossEdges }, diagnostics };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/parser/parseProject.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser/parseProject.ts src/parser/parseProject.test.ts
git commit -m "feat: add project parser assembling cells and cross edges"
```

### Task 9: Refactor compiler into per-cell + project layers

Extract today's `compileCellSource` body into `compileCell(document)` returning `{ cell fields, diagnostics }`, then add `compileProject` that builds a `ProjectModel`, groups shared externals, and resolves cross edges. Keep `compileCellSource` as the public entry returning `{ model: ProjectModel | null, diagnostics }`.

**Files:**
- Modify: `src/compiler/compileCellSource.ts`
- Test: `src/compiler/compileProject.test.ts` (new)
- Modify: `src/parser/cellDsl.test.ts` (update single-cell compile assertions to read `model.cells[0]`)

- [ ] **Step 1: Write the failing test (project compile)**

Create `src/compiler/compileProject.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compileCellSource } from "./compileCellSource";

describe("compileProject", () => {
  it("wraps a single-cell document in a one-cell ProjectModel", () => {
    const result = compileCellSource(`component API service\nnorth -> API`);
    expect(result.diagnostics).toEqual([]);
    expect(result.model?.cells).toHaveLength(1);
    expect(result.model?.cells[0].id).toBe("main");
    expect(result.model?.cells[0].components.map((c) => c.id)).toEqual(["API"]);
    expect(result.model?.crossEdges).toEqual([]);
    expect(result.model?.sharedExternals).toEqual([]);
  });

  it("marks an external used by two cells as shared", () => {
    const source = [
      "cell orders {",
      "  component api",
      "  api -> east s3",
      "}",
      "cell inventory {",
      "  component api",
      "  api -> south s3",
      "}"
    ].join("\n");
    const result = compileCellSource(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.model?.sharedExternals.map((e) => e.id)).toEqual(["s3"]);
    // s3 must NOT also appear as a cell-local external
    expect(result.model?.cells.flatMap((c) => c.externals.map((e) => e.id))).not.toContain("s3");
  });

  it("keeps a single-use external cell-local", () => {
    const source = ["cell orders {", "  component api", "  api -> east s3", "}", "cell inventory {", "  component api", "}"].join("\n");
    const result = compileCellSource(source);
    expect(result.model?.sharedExternals).toEqual([]);
    expect(result.model?.cells[0].externals.map((e) => e.id)).toEqual(["s3"]);
  });

  it("resolves a connected cross edge and reports unknown target cell", () => {
    const ok = compileCellSource("cell a {\n  x -> b.y\n}\ncell b {\n  component y\n}");
    expect(ok.diagnostics).toEqual([]);
    expect(ok.model?.crossEdges[0]).toMatchObject({ sourceCell: "a", targetCell: "b", mode: "connected" });

    const bad = compileCellSource("cell a {\n  x -> zzz.y\n}");
    expect(bad.model).toBeNull();
    expect(bad.diagnostics.some((d) => /unknown cell/i.test(d.message))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/compiler/compileProject.test.ts`
Expected: FAIL — `result.model?.cells` is undefined (compiler still returns the old shape).

- [ ] **Step 3: Refactor `compileCellSource.ts`**

Replace the exported `compileCellSource` with a per-cell compile plus a project compile. Keep all existing helper functions (`normalizeEdge`, `validateEdgeDirection`, `inferredComponents`, `createLookup`, etc.) unchanged; only the public function and imports change.

Change the import to pull in the parser + project types:

```ts
import {
  CellModel,
  CrossEdge,
  ExternalNode,
  ProjectCompileResult,
  ProjectModel,
  Diagnostic,
  ParsedCellDocument
} from "../domain/cellModel";
import { parseProject, ParsedCrossEdgeResolved } from "../parser/parseProject";
```

Add a `compileCellDocument` that is today's body but parameterized on a `ParsedCellDocument` instead of re-parsing source:

```ts
interface CompiledCell {
  components: CellModel["components"];
  externals: ExternalNode[];
  edges: CellModel["edges"];
  diagnostics: Diagnostic[];
}

function compileCellDocument(document: ParsedCellDocument): CompiledCell {
  const componentLookup = createLookup(document.components);
  const declaredExternalMap = new Map<string, ExternalNode>(document.externals.map((e) => [e.id, e]));
  const externalLookup = createLookup(document.externals);
  const normalizedEdges = document.edges.map((edge) =>
    normalizeEdge(edge, componentLookup, externalLookup, declaredExternalMap)
  );
  const components = inferredComponents(document.components, normalizedEdges);
  const diagnostics = normalizedEdges.flatMap(validateEdgeDirection);

  const externalMap = new Map<string, ExternalNode>(declaredExternalMap);
  normalizedEdges.forEach((edge) => {
    if (edge.kind === "inbound" && edge.direction !== "internal") {
      externalMap.set(edge.source, externalMap.get(edge.source) ?? { id: edge.source, direction: edge.direction, line: edge.line });
    }
    if (edge.kind === "outbound" && edge.direction !== "internal") {
      externalMap.set(edge.target, externalMap.get(edge.target) ?? { id: edge.target, direction: edge.direction, line: edge.line });
    }
  });

  return { components, externals: Array.from(externalMap.values()), edges: normalizedEdges, diagnostics };
}
```

Add cross-edge resolution and shared-external grouping, and the new public entry:

```ts
function resolveCrossEdges(
  parsed: ParsedCrossEdgeResolved[],
  cellsById: Map<string, CellModel>,
  implicitSingle: boolean
): { edges: CrossEdge[]; diagnostics: Diagnostic[] } {
  const edges: CrossEdge[] = [];
  const diagnostics: Diagnostic[] = [];

  parsed.forEach((edge) => {
    if (implicitSingle) {
      diagnostics.push({ severity: "error", message: "Cross-cell edges require named cell blocks.", line: edge.line, column: 1 });
      return;
    }
    const sourceCell = edge.sourceCell ?? findCellForInline(cellsById, edge);
    if (!sourceCell || !cellsById.has(sourceCell)) {
      diagnostics.push({ severity: "error", message: `Unknown cell "${edge.sourceCell ?? ""}".`, line: edge.line, column: 1 });
      return;
    }
    if (!cellsById.has(edge.targetCell)) {
      diagnostics.push({ severity: "error", message: `Unknown cell "${edge.targetCell}".`, line: edge.line, column: 1 });
      return;
    }
    edges.push({
      id: edge.id,
      sourceCell,
      sourceComp: edge.sourceComp,
      targetCell: edge.targetCell,
      targetComp: edge.targetComp,
      exit: edge.exit,
      entry: edge.entry,
      mode: edge.mode,
      label: edge.label,
      line: edge.line
    });
  });

  return { edges, diagnostics };
}
```

> **Note on inline source cell:** `parseProject` records `sourceCell: null` for an inline edge (source is a bare local component). The owning cell is known at parse time — update Task 8's cell mapping to stamp `sourceCell` with `block.id` when it is `null` before pushing to `crossEdges`. Do that now: in `parseProject.ts`, inside the per-cell `block.lines.forEach`, set `sourceCell: cross.sourceCell ?? block.id` in the pushed object. With that change, `findCellForInline` is unnecessary — delete the `?? findCellForInline(...)` fallback and just use `edge.sourceCell`.

Revised `resolveCrossEdges` source-cell line (after the parseProject fix):

```ts
    const sourceCell = edge.sourceCell;
    if (!sourceCell || !cellsById.has(sourceCell)) {
```

Shared-external grouping + public entry:

```ts
export function compileProject(source: string): ProjectCompileResult {
  const { project, diagnostics: parseDiagnostics } = parseProject(source);
  const diagnostics: Diagnostic[] = [...parseDiagnostics];

  const cells: CellModel[] = project.cells.map((cell) => {
    const compiled = compileCellDocument(cell.document);
    diagnostics.push(...compiled.diagnostics);
    return {
      id: cell.id,
      label: cell.label,
      version: cell.document.version,
      components: compiled.components,
      externals: compiled.externals,
      edges: compiled.edges
    };
  });

  // Group externals by id across all cells; >=2 uses => shared.
  const usage = new Map<string, { cells: Set<string>; node: ExternalNode }>();
  cells.forEach((cell) => {
    cell.externals.forEach((ext) => {
      const entry = usage.get(ext.id) ?? { cells: new Set<string>(), node: ext };
      entry.cells.add(cell.id);
      if (!entry.node.label && ext.label) entry.node = { ...entry.node, label: ext.label };
      if (!entry.node.type && ext.type) entry.node = { ...entry.node, type: ext.type };
      usage.set(ext.id, entry);
    });
  });

  const sharedIds = new Set(Array.from(usage.entries()).filter(([, v]) => v.cells.size >= 2).map(([id]) => id));
  const sharedExternals: ExternalNode[] = Array.from(sharedIds).map((id) => usage.get(id)!.node);
  const scopedCells = cells.map((cell) => ({
    ...cell,
    externals: cell.externals.filter((ext) => !sharedIds.has(ext.id))
  }));

  const cellsById = new Map(scopedCells.map((cell) => [cell.id, cell]));
  const { edges: crossEdges, diagnostics: crossDiagnostics } = resolveCrossEdges(
    project.crossEdges,
    cellsById,
    project.cells.length === 1 && project.cells[0].id === "main"
  );
  diagnostics.push(...crossDiagnostics);

  if (diagnostics.length > 0) {
    return { model: null, diagnostics };
  }

  const model: ProjectModel = {
    title: project.title,
    cells: scopedCells,
    crossEdges,
    sharedExternals
  };
  return { model, diagnostics: [] };
}

export function compileCellSource(source: string): ProjectCompileResult {
  return compileProject(source);
}
```

Delete the old `CompileResult`/`CellDiagramModel`-returning body of `compileCellSource` (now replaced). Remove any now-unused imports.

- [ ] **Step 4: Update the existing single-cell compile assertions**

In `src/parser/cellDsl.test.ts`, every `result.model?.components` / `.externals` / `.edges` / `.title` under the `compileCellSource` describe must become `result.model?.cells[0].components` etc. (title stays `result.model?.title`). Update each assertion accordingly. Example:

```ts
// before: expect(result.model?.components.map((c) => c.id)).toEqual([...])
expect(result.model?.cells[0].components.map((c) => c.id)).toEqual([...]);
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: `compileProject.test.ts` passes; updated `cellDsl.test.ts` passes. `flowLayout`/`DiagramCanvas`/`App` tests will now FAIL to typecheck because they consume the old model shape — that is expected and fixed in Phase 3 / Task 12. If you want a green suite at this checkpoint, proceed straight into Phase 3 before running `npm test` again.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/compileCellSource.ts src/compiler/compileProject.test.ts src/parser/parseProject.ts src/parser/cellDsl.test.ts
git commit -m "feat: compile source into a ProjectModel with shared externals and cross edges"
```

---

## Phase 3 — Rendering and Layout

Two-level layout, per-cell gateways, namespaced ids, connected/decoupled cross-edge rendering. This phase makes the app build and render again.

### Task 10: Per-cell layout function

Extract today's single-cell placement into a function that lays out ONE cell and returns cell-local node positions plus the cell footprint, without committing to a global origin.

**Files:**
- Modify: `src/renderer/flowLayout.ts`
- Test: `src/renderer/flowLayout.test.ts`

- [ ] **Step 1: Read the current test file**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Note the existing assertions so you preserve single-cell output exactly.

- [ ] **Step 2: Write the failing test (per-cell layout shape)**

Add to `src/renderer/flowLayout.test.ts`:

```ts
import { layoutCell } from "./flowLayout";
import type { CellModel } from "../domain/cellModel";

it("layoutCell returns component positions and a square footprint", () => {
  const cell: CellModel = {
    id: "orders",
    components: [{ id: "api" }, { id: "odb" }],
    externals: [],
    edges: [{ id: "e", source: "api", target: "odb", direction: "internal", kind: "internal", line: 1 }]
  };
  const layout = layoutCell(cell);
  expect(layout.width).toBeGreaterThan(0);
  expect(layout.height).toBe(layout.width); // square cell
  expect(layout.nodes.map((n) => n.component.id).sort()).toEqual(["api", "odb"]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Expected: FAIL — `layoutCell is not exported`.

- [ ] **Step 4: Refactor `flowLayout.ts`**

Rename the existing internal `componentLayout(model)` to `layoutCell(cell: CellModel)` and export it. Its body is unchanged except the parameter type is `CellModel` (which has the same `components`/`edges` fields). Update its single call site inside `toReactFlow` (rewritten in Task 11).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Expected: the new test passes. (Existing `toReactFlow` tests may fail to compile until Task 11 — acceptable mid-phase.)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/flowLayout.ts src/renderer/flowLayout.test.ts
git commit -m "refactor: extract exported layoutCell from componentLayout"
```

### Task 11: Two-level layout + namespacing in `toReactFlow`

Rewrite `toReactFlow` to accept a `ProjectModel`, lay out each cell locally, place cells (and shared externals) with a cell-level dagre pass, offset everything, and namespace ids when `cells.length > 1`.

**Files:**
- Modify: `src/renderer/flowLayout.ts`
- Test: `src/renderer/flowLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { toReactFlow } from "./flowLayout";
import type { ProjectModel } from "../domain/cellModel";

function singleCell(): ProjectModel {
  return {
    cells: [{ id: "main", components: [{ id: "api" }], externals: [], edges: [] }],
    crossEdges: [],
    sharedExternals: []
  };
}

it("keeps single-cell node ids un-namespaced", () => {
  const flow = toReactFlow(singleCell());
  expect(flow.nodes.some((n) => n.id === "api")).toBe(true);
  expect(flow.nodes.some((n) => n.id === "cell-main")).toBe(true);
});

it("namespaces component ids across multiple cells", () => {
  const project: ProjectModel = {
    cells: [
      { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
      { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
    ],
    crossEdges: [],
    sharedExternals: []
  };
  const flow = toReactFlow(project);
  expect(flow.nodes.some((n) => n.id === "orders::api")).toBe(true);
  expect(flow.nodes.some((n) => n.id === "products::api")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Expected: FAIL — `toReactFlow` returns wrong ids / type error.

- [ ] **Step 3: Rewrite `toReactFlow`**

Replace the exported `toReactFlow(model: CellDiagramModel)` with a `ProjectModel` version. Key structure:

```ts
import { CellModel, ProjectModel } from "../domain/cellModel";

const namespaced = (cellId: string, id: string, multi: boolean) => (multi ? `${cellId}::${id}` : id);
const cellNodeId = (cellId: string) => `cell-${cellId}`;
const gatewayNodeId = (cellId: string, dir: string, multi: boolean) =>
  multi ? `gateway-${cellId}-${dir}` : `gateway-${dir}`;

export function toReactFlow(project: ProjectModel) {
  const multi = project.cells.length > 1;
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];

  // 1. Lay out each cell locally.
  const layouts = new Map<string, ReturnType<typeof layoutCell>>();
  project.cells.forEach((cell) => layouts.set(cell.id, layoutCell(cell)));

  // 2. Cell-level dagre pass: cells + shared externals are nodes,
  //    connected cross edges are the edges.
  const cellGraph = new dagre.graphlib.Graph();
  cellGraph.setDefaultEdgeLabel(() => ({}));
  cellGraph.setGraph({ rankdir: "LR", ranksep: 260, nodesep: 200, marginx: 60, marginy: 60 });
  project.cells.forEach((cell) => {
    const layout = layouts.get(cell.id)!;
    cellGraph.setNode(cellNodeId(cell.id), { width: layout.width, height: layout.height });
  });
  project.sharedExternals.forEach((ext) => {
    cellGraph.setNode(`external-${ext.id}`, { width: externalSize, height: externalSize });
  });
  project.crossEdges
    .filter((edge) => edge.mode === "connected")
    .forEach((edge) => cellGraph.setEdge(cellNodeId(edge.sourceCell), cellNodeId(edge.targetCell)));
  dagre.layout(cellGraph);

  // 3. Emit each cell's boundary + internal nodes at its dagre origin.
  project.cells.forEach((cell) => {
    const layout = layouts.get(cell.id)!;
    const g = cellGraph.node(cellNodeId(cell.id));
    const originX = g.x - layout.width / 2;
    const originY = g.y - layout.height / 2;

    nodes.push({
      id: cellNodeId(cell.id),
      type: "cellBoundary",
      position: { x: originX, y: originY },
      data: { title: cell.label ?? (multi ? cell.id : project.title), version: cell.version, width: layout.width, height: layout.height },
      draggable: false,
      selectable: false
    });

    layout.nodes.forEach(({ component, x, y }) => {
      nodes.push({
        id: namespaced(cell.id, component.id, multi),
        type: "component",
        position: { x: originX + x, y: originY + y },
        data: { nodeId: namespaced(cell.id, component.id, multi), label: component.label ?? component.id, componentType: component.type },
        draggable: false
      });
    });

    // Per-cell gateways + cell-local externals: reuse existing
    // gatewayPosition / externalPosition, offset by (originX, originY),
    // and id them with gatewayNodeId(cell.id, dir, multi) /
    // `external-${multi ? cell.id + "-" : ""}${ext.id}`.
    // (Port the existing gateway/external emission from the old toReactFlow,
    //  wrapping ids through the namespacing helpers and offsetting positions.)
  });

  // 4. Shared external nodes at their dagre positions.
  project.sharedExternals.forEach((ext) => {
    const g = cellGraph.node(`external-${ext.id}`);
    nodes.push({
      id: `external-${ext.id}`,
      type: "external",
      position: { x: g.x - externalSize / 2, y: g.y - externalSize / 2 },
      data: { nodeId: `external-${ext.id}`, label: ext.label ?? ext.id, externalType: ext.type, direction: ext.direction ?? "east" },
      draggable: false
    });
  });

  // 5. Intra-cell edges (Task existing logic, namespaced) + cross edges (Task 12/13).
  //    ... emit here ...

  const boundsW = Math.max(...nodes.map((n) => n.position.x)) + 400;
  const boundsH = Math.max(...nodes.map((n) => n.position.y)) + 400;
  return { nodes, edges, cellSize: { width: boundsW, height: boundsH } };
}
```

Port the existing per-cell gateway emission, cell-local external emission, and intra-cell edge emission from the pre-refactor `toReactFlow` into steps 3 and 5, wrapping every node/handle id through `namespaced(...)` / `gatewayNodeId(...)`. For the single-cell case (`multi === false`) the ids are identical to today, preserving existing behavior.

- [ ] **Step 4: Migrate the existing `toReactFlow` test fixtures**

The pre-existing `flowLayout.test.ts` tests call `toReactFlow(model)` with the old single-cell shape (`{ title, components, externals, edges }`). Wrap each such fixture in a one-cell `ProjectModel`:

```ts
// before: const flow = toReactFlow({ title, components, externals, edges });
const flow = toReactFlow({
  title,
  cells: [{ id: "main", label: title, components, externals, edges }],
  crossEdges: [],
  sharedExternals: []
});
```

Because `multi === false` for one cell, every emitted node/edge id is byte-for-byte identical to before, so the existing assertions (`"api"`, `"cell-boundary"` → now `"cell-main"`, gateway ids, etc.) only need updating where they referenced the old boundary id. Update `"cell-boundary"` expectations to `"cell-main"`; leave all other id assertions unchanged.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Expected: the two new tests pass and the migrated single-cell assertions pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/flowLayout.ts src/renderer/flowLayout.test.ts
git commit -m "feat: two-level cell layout with id namespacing"
```

### Task 12: Connected cross-edge rendering + wire ProjectModel through the app

**Files:**
- Modify: `src/renderer/flowLayout.ts` (emit connected cross edges in step 5)
- Modify: `src/renderer/DiagramCanvas.tsx` (prop type `CellDiagramModel` → `ProjectModel`; export filename uses `model.title`)
- Modify: `src/app/App.tsx` (`compiled.model` is now `ProjectModel`; share/name title uses `model.title`)
- Test: `src/renderer/flowLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("emits a connected cross edge as component->gateway->gateway->component", () => {
  const project: ProjectModel = {
    cells: [
      { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
      { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
    ],
    crossEdges: [
      { id: "x1", sourceCell: "orders", sourceComp: "api", targetCell: "products", targetComp: "api", exit: "east", entry: "west", mode: "connected", line: 1 }
    ],
    sharedExternals: []
  };
  const flow = toReactFlow(project);
  const stepEdges = flow.edges.filter((e) => e.id.startsWith("x1"));
  expect(stepEdges.length).toBeGreaterThanOrEqual(2);
  // an inter-cell segment connects the two cells' gateways
  expect(stepEdges.some((e) => e.source === "gateway-orders-east" && e.target === "gateway-products-west")).toBe(true);
  expect(stepEdges.every((e) => e.type === "step")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Expected: FAIL — no `x1` edges emitted.

- [ ] **Step 3: Emit connected cross edges**

In step 5 of `toReactFlow`, for each `project.crossEdges` with `mode === "connected"`, emit three `type: "step"` edges (all sharing one `connectionData` id so focus highlighting groups them):

```ts
project.crossEdges.forEach((edge) => {
  const srcComp = namespaced(edge.sourceCell, edge.sourceComp, multi);
  const tgtComp = namespaced(edge.targetCell, edge.targetComp, multi);
  const srcGate = gatewayNodeId(edge.sourceCell, edge.exit, multi);
  const tgtGate = gatewayNodeId(edge.targetCell, edge.entry, multi);

  if (edge.mode === "connected") {
    const conn = connectionData(edge.id, [srcComp, srcGate, tgtGate, tgtComp]);
    edges.push(
      { id: `${edge.id}-a`, data: conn, source: srcComp, sourceHandle: componentHandle(edge.exit, "source"), target: srcGate, targetHandle: gatewayTargetHandle(edge.exit), type: "step", animated: true, className: "edge-cross" },
      { id: `${edge.id}-b`, data: conn, source: srcGate, sourceHandle: gatewaySourceHandle(edge.exit), target: tgtGate, targetHandle: gatewayTargetHandle(edge.entry), label: edge.label, type: "step", animated: true, className: "edge-cross" },
      { id: `${edge.id}-c`, data: conn, source: tgtGate, sourceHandle: gatewaySourceHandle(edge.entry), target: tgtComp, targetHandle: componentHandle(edge.entry, "target"), type: "step", animated: true, className: "edge-cross" }
    );
  }
  // decoupled handled in Task 13
});
```

Also ensure the source/target cells' `exit`/`entry` gateways are emitted even when they have no in-cell boundary usage: in step 3, collect the set of gateway directions each cell needs from `project.crossEdges` (exit dir for source cell, entry dir for target cell) and union it with the existing per-cell gateway directions.

- [ ] **Step 4: Register the `step` edge type + cross styling**

In `src/renderer/DiagramCanvas.tsx`, add `step` to `edgeTypes` (reuse `LabeledEdge`, which already handles labels; `getBezierPath` is fine visually, but for true L-shape import and use `getSmoothStepPath`). Add a variant:

```tsx
import { getSmoothStepPath } from "@xyflow/react";

function StepEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ ...props, borderRadius: 0 });
  return (
    <>
      <path className="react-flow__edge-path" d={edgePath} markerEnd={props.markerEnd} />
      {props.label ? (
        <EdgeLabelRenderer>
          <div className="edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}>{props.label}</div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const edgeTypes = {
  smoothstep: memo(LabeledEdge),
  step: memo(StepEdge)
};
```

Append to `src/app/styles.css`:

```css
.react-flow__edge.edge-cross .react-flow__edge-path {
  stroke: #7c3aed;
  stroke-width: 2;
  stroke-dasharray: 6 4;
}
```

- [ ] **Step 5: Change the canvas + app model type**

In `DiagramCanvas.tsx`: change `import { CellDiagramModel }` to `import { ProjectModel }`, and every `CellDiagramModel` to `ProjectModel`. Update `ExportControls filename={model.title?.trim() || "cell-diagram"}` (already `model.title`; now valid on `ProjectModel`).

In `App.tsx`: `compiled.model` is a `ProjectModel`. Update the share-link title extraction at line ~92 `compileCellSource(source).model?.title` — still valid (`ProjectModel.title`). No structural changes needed; `visibleModel` flows straight into `<DiagramCanvas model={visibleModel} />`.

- [ ] **Step 6: Migrate canvas/app test fixtures to `ProjectModel`**

`src/renderer/DiagramCanvas.test.tsx` and `src/app/App.test.tsx` build models of the old shape and pass them to `DiagramCanvas`. Wrap each such fixture in a one-cell `ProjectModel` (same wrapper as Task 11 Step 4). The `sampleModel` used by the Task 4 export-buttons test must be wrapped too. `App.test.tsx` drives the app through the editor/compile path, so its assertions are mostly DSL-string based — only update any place that constructs a model object directly or asserts on the old model shape.

- [ ] **Step 7: Run the full suite + typecheck**

Run: `npx tsc -b && npm test`
Expected: PASS across parser, compiler, layout, canvas, app. Fix any remaining references to the old model shape flagged by `tsc`.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/flowLayout.ts src/renderer/DiagramCanvas.tsx src/app/App.tsx src/app/styles.css src/renderer/flowLayout.test.ts src/renderer/DiagramCanvas.test.tsx src/app/App.test.tsx
git commit -m "feat: render connected cross-cell links and thread ProjectModel through the app"
```

### Task 13: Decoupled cross-edge rendering (boundary stubs)

**Files:**
- Modify: `src/renderer/flowLayout.ts`
- Test: `src/renderer/flowLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("emits two independent stubs for a decoupled cross edge (no inter-cell segment)", () => {
  const project: ProjectModel = {
    cells: [
      { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
      { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
    ],
    crossEdges: [
      { id: "d1", sourceCell: "orders", sourceComp: "api", targetCell: "products", targetComp: "api", exit: "south", entry: "north", mode: "decoupled", line: 1 }
    ],
    sharedExternals: []
  };
  const flow = toReactFlow(project);
  expect(flow.nodes.some((n) => n.id === "xstub-d1-out")).toBe(true);
  expect(flow.nodes.some((n) => n.id === "xstub-d1-in")).toBe(true);
  // no edge directly joins the two cells' gateways
  expect(flow.edges.some((e) => e.source === "gateway-orders-south" && e.target === "gateway-products-north")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Expected: FAIL — no stub nodes.

- [ ] **Step 3: Emit stubs**

In the `project.crossEdges.forEach` loop, add the decoupled branch. Place `xstub-<id>-out` just outside the source cell's exit side and `xstub-<id>-in` just outside the target cell's entry side (reuse `externalPosition` offset relative to each cell origin; you have `originX/originY` per cell — capture them in a `Map<cellId, {originX, originY, width, height}>` during step 3 so this loop can read them):

```ts
if (edge.mode === "decoupled") {
  const src = cellBoxes.get(edge.sourceCell)!;
  const tgt = cellBoxes.get(edge.targetCell)!;
  const outPos = externalPosition(edge.exit, 0, 1, src.width, src.height);
  const inPos = externalPosition(edge.entry, 0, 1, tgt.width, tgt.height);

  nodes.push({
    id: `xstub-${edge.id}-out`, type: "external",
    position: { x: src.originX + outPos.x, y: src.originY + outPos.y },
    data: { nodeId: `xstub-${edge.id}-out`, label: `${edge.targetCell}.${edge.targetComp}`, direction: edge.exit }, draggable: false
  });
  nodes.push({
    id: `xstub-${edge.id}-in`, type: "external",
    position: { x: tgt.originX + inPos.x, y: tgt.originY + inPos.y },
    data: { nodeId: `xstub-${edge.id}-in`, label: `${edge.sourceCell}.${edge.sourceComp}`, direction: edge.entry }, draggable: false
  });

  const outConn = connectionData(`${edge.id}-out`, [srcComp, srcGate, `xstub-${edge.id}-out`]);
  edges.push(
    { id: `${edge.id}-out-a`, data: outConn, source: srcComp, sourceHandle: componentHandle(edge.exit, "source"), target: srcGate, targetHandle: gatewayTargetHandle(edge.exit), type: "step", animated: true, className: "edge-cross" },
    { id: `${edge.id}-out-b`, data: outConn, source: srcGate, sourceHandle: gatewaySourceHandle(edge.exit), target: `xstub-${edge.id}-out`, targetHandle: externalTargetHandle(edge.exit), label: edge.label, type: "step", animated: true, className: "edge-cross" }
  );
  const inConn = connectionData(`${edge.id}-in`, [`xstub-${edge.id}-in`, tgtGate, tgtComp]);
  edges.push(
    { id: `${edge.id}-in-a`, data: inConn, source: `xstub-${edge.id}-in`, sourceHandle: externalSourceHandle(edge.entry), target: tgtGate, targetHandle: gatewayTargetHandle(edge.entry), type: "step", animated: true, className: "edge-cross" },
    { id: `${edge.id}-in-b`, data: inConn, source: tgtGate, sourceHandle: gatewaySourceHandle(edge.entry), target: tgtComp, targetHandle: componentHandle(edge.entry, "target"), type: "step", animated: true, className: "edge-cross" }
  );
}
```

Add `const cellBoxes = new Map<string, { originX: number; originY: number; width: number; height: number }>();` before step 3 and populate it inside the step-3 cell loop. Also add the decoupled cells' exit/entry directions to each cell's gateway set (same union step as Task 12).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/renderer/flowLayout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/flowLayout.ts src/renderer/flowLayout.test.ts
git commit -m "feat: render decoupled cross-cell links as boundary stubs"
```

### Task 14: Highlight model + focus across cells

Confirm click-to-focus still works with namespaced ids (it is id-agnostic, but add a guard test).

**Files:**
- Test: `src/renderer/highlightModel.test.ts`

- [ ] **Step 1: Add a namespaced-id test**

```ts
it("groups highlighted nodes for a namespaced cross-cell connection", () => {
  const edges = [
    { id: "x1-a", data: { connectionId: "x1", connectedNodeIds: ["orders::api", "gateway-orders-east", "gateway-products-west", "products::api"] } }
  ];
  const ids = highlightedNodeIdsForConnections(edges, new Set(["x1"]));
  expect(ids).toContain("orders::api");
  expect(ids).toContain("products::api");
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/renderer/highlightModel.test.ts`
Expected: PASS (no code change needed; `highlightModel` is id-agnostic). If it fails, that reveals a real regression to fix.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/highlightModel.test.ts
git commit -m "test: verify focus highlighting works with namespaced cross-cell ids"
```

### Task 15: Manual multi-cell verification

- [ ] **Step 1: Run the app**

Run: `npm run dev`. Paste this into the editor:

```cell
title Commerce

cell orders as "Order Cell" {
  component api
  component odb database
  north customerApp
  customerApp -> api
  api -> odb
  api -> east products.api : get stock
  api -> east s3
}

cell products {
  component api
  component pdb database
  api -> pdb
  api -> south-north orders.api : callback
  api -> east s3
}
```

- [ ] **Step 2: Confirm visually**

Expected: two octagon cells laid out left-to-right; a connected purple dashed link `orders.api → products.api`; a decoupled pair of stubs for the `south-north` callback; one **shared** `s3` node used by both cells; click-to-focus dims unrelated nodes; PNG/SVG export produces the whole two-cell diagram.

- [ ] **Step 3: Confirm backward compatibility**

Switch to the default sample document. Expected: renders exactly as before (single cell, bare ids).

---

## Phase 4 — Documentation

### Task 16: Update the DSL sample, guides, and syntax highlighting

**Files:**
- Modify: `src/storage/defaultSample.ts` (optional: keep single-cell default, OR add a second sample document — see note)
- Modify: `docs/dsl-guide.md` (add "Multi-cell projects", "Cross-cell links", "Shared externals" sections)
- Modify: `docs/requirements.md` (move the four resolved open questions into DSL/rendering requirements; mark multi-cell + export as completed)
- Modify: `src/app/DslGuide.tsx` (add the same multi-cell sections shown in-app)
- Modify: `src/app/cellDslLanguage.ts` (highlight the `cell` keyword and `{ }`)
- Test: `src/app/cellDslLanguage.test.ts`, `src/app/DslGuide.test.tsx`

- [ ] **Step 1: Add a highlighting test**

In `src/app/cellDslLanguage.test.ts`, add a case asserting the `cell` keyword and braces are tokenized as keyword/punctuation (mirror the file's existing assertion style — read it first and copy the pattern).

- [ ] **Step 2: Run it to fail, implement the grammar change, run to pass**

Run: `npx vitest run src/app/cellDslLanguage.test.ts` (FAIL → implement → PASS). Add `cell` to the keyword set and `{`/`}` to punctuation in `cellDslLanguage.ts`.

- [ ] **Step 3: Update guides**

Write the new DSL guide sections using the exact grammar from the spec (cell blocks, `<exit>[-<entry>]` token table, connected vs decoupled, shared externals, the `.`/`:` symbol summary). Update `DslGuide.tsx` to match. Keep `DslGuide.test.tsx` passing (update any content assertions).

- [ ] **Step 4: Run the full suite, lint, build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add docs/dsl-guide.md docs/requirements.md src/app/DslGuide.tsx src/app/DslGuide.test.tsx src/app/cellDslLanguage.ts src/app/cellDslLanguage.test.ts src/storage/defaultSample.ts
git commit -m "docs: document multi-cell DSL, cross-cell links, and shared externals"
```

> **Note (default sample):** keep the existing single-cell default sample as the first-run document so new users see the simple case. The multi-cell example lives in the guide. If you want a ready-made multi-cell document, add it as a second seeded document in `defaultSample.ts`/the repository seed rather than replacing the default.

---

## Final Verification

- [ ] `npm test` — all green.
- [ ] `npm run lint` — clean.
- [ ] `npm run build` — succeeds.
- [ ] Manual: multi-cell sample renders connected + decoupled links and a shared external; single-cell default unchanged; PNG and SVG export the full diagram.

Then use **superpowers:finishing-a-development-branch** to complete the work.
