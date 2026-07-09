# Multi-Cell DSL and Diagram Export — Design

Date: 2026-07-09

## Overview

Cell Architect today renders a single cell from a compact text DSL. This design
extends the DSL and renderer to describe **multiple cells in one diagram**
(a "project"), with connections that cross cell boundaries, and adds
**SVG and PNG export** of the rendered diagram.

Two capabilities ship here:

1. **Multi-cell DSL + rendering** — group a cell's contents in `cell <id> { … }`
   blocks, connect components across cells, share external systems between cells,
   and lay the cells out automatically.
2. **Export** — download the current diagram as SVG or PNG. Export is largely
   independent of multi-cell and also works for single-cell diagrams.

### Goals

- Keep every existing single-cell diagram working unchanged (full backward
  compatibility).
- Let a user describe several cells and the traffic between them with a compact,
  readable extension of the current notation.
- Support shared external systems (e.g. `AWS S3`) referenced by more than one
  cell.
- Support cyclic dependencies between cells without links disappearing under a
  cell body.
- Add SVG and PNG export of the full diagram.

### Non-Goals

- No backend, accounts, or remote persistence (unchanged from the product's
  existing non-goals).
- No manual drag-to-position of cells in this iteration (layout is automatic;
  manual override is a possible later addition).
- No pixel-perfect obstacle-avoiding edge routing. Orthogonal (L-shaped) routing
  plus automatic cell spacing is the target; occasional link/cell proximity is
  acceptable.

## DSL Grammar

### Cell blocks

A cell wraps its contents in braces:

```cell
cell orders as "Order Cell" {
  version v2
  component api
  component odb database
  north customerApp

  customerApp -> api
  api -> odb
}
```

- Header: `cell <id> [as "<label>"] {` … `}`.
- Everything valid in a single-cell document today is valid **inside** a block:
  `version`, `component`, boundary declarations, internal edges, boundary edges,
  gateway exposures, aliases, labels, comments.
- `title` at the top level (outside any block) sets the **project** title.
  `version` inside a block sets that cell's version. A cell's display label comes
  from `as "<label>"`, falling back to the cell id.

### Backward compatibility

- A document with **no** `cell {}` blocks is treated as a single implicit cell,
  exactly as today. All existing diagrams render unchanged.
- Mixing bare top-level `component`/edge statements with `cell {}` blocks is an
  error. Once any block is opened, the document is in multi-cell mode and all
  components/internal edges must live inside a block. The only statements allowed
  at the top level in multi-cell mode are: `title`, comments, and project-level
  cross-cell edges (below).

### Cross-cell links

A cross-cell link connects a component in one cell to a component in another. The
target (and, for project-level edges, the source) is **qualified** with a dot:
`<cell>.<component>`.

Grammar (inside a block, source is a local component):

```
<localComponent> -> [<dirToken>] <targetCell>.<targetComponent> [: <label>]
```

Grammar (project level, outside all blocks, both ends qualified):

```
<srcCell>.<srcComponent> -> [<dirToken>] <targetCell>.<targetComponent> [: <label>]
```

`<dirToken>` is `<exit>` or `<exit>-<entry>`:

- `exit` ∈ { `east`, `south` } — which gateway of the **source** cell the link
  leaves. Default `east`.
- `entry` ∈ { `west`, `north` } — which gateway of the **target** cell the link
  enters. Default `west`.

The dot in an endpoint is what distinguishes a cross-cell reference
(`east products.api`) from a local boundary external (`east InventoryAPI`).

### Connected vs decoupled links (overloaded direction)

The exit direction selects the link mode:

| DSL                                | Exit  | Entry | Mode      | Rendering |
|------------------------------------|-------|-------|-----------|-----------|
| `api -> products.api`              | east  | west  | connected | one joined line, source east gateway → target west gateway |
| `api -> east products.api`         | east  | west  | connected | same as above |
| `api -> east-north products.api`   | east  | north | connected | joined line, enters target north gateway |
| `api -> south-west products.api`   | south | west  | decoupled | two stubs, no joining line |
| `api -> south-north products.api`  | south | north | decoupled | two stubs, no joining line |
| `api -> south products.api`        | south | —     | —         | **error** (anti-pattern: bare `south` has no explicit entry) |

- **Connected mode (`exit = east`).** A single L-shaped line is drawn from the
  source component, out the source cell's east gateway, across the canvas, into
  the target cell's entry gateway (`west` default or `north`), to the target
  component.
- **Decoupled mode (`exit = south`).** No line joins the two cells. Instead each
  cell shows its own boundary stub:
  - The source cell draws a line from the source component out its south gateway
    to a small external marker labeled with the target (`products.api`).
  - The target cell draws a line from a small external marker labeled with the
    source (`orders.api`) in through its entry gateway (`north` or `west`) to the
    target component.
  - Decoupled mode requires an explicit entry direction; bare `south` is an
    error. This is the escape hatch for cyclic dependencies and awkward
    placements where a crossing line would overlap a cell body.

### Shared externals (auto-shared by id)

- External systems are matched by id **across all cells**. An external id used on
  a boundary in two or more cells renders as a **single shared node**, placed by
  layout between the cells that use it. An id used in only one cell renders next
  to that cell, as today.
- The boundary direction lives on each **link**, not on the external, because a
  shared external can sit on a different side of each cell
  (`orders: orders -> east s3`, `inventory: inv -> south s3`).
- Alias and type may be attached at any use site
  (`inv -> south s3 as "AWS S3" storage`). If different use sites give
  conflicting aliases/types for the same id, the compiler emits a diagnostic.

### Symbol summary (user-facing)

- `.` — cell/component qualifier: `products.api` = component `api` in cell
  `products`.
- `:` — edge label: `api -> products.api : get stock`.
- `{ }` — cell block grouping.
- (`::` is an internal node-id separator in the renderer only; never written or
  shown to the user.)

## Domain Model

New project-level model wraps per-cell models:

```ts
interface ProjectModel {
  title?: string;
  cells: CellModel[];
  crossEdges: CrossEdge[];
  sharedExternals: ExternalNode[]; // externals used by >= 2 cells
}

interface CellModel {
  id: string;
  label?: string;
  version?: string;
  components: ParsedComponent[];
  externals: ExternalNode[]; // cell-local externals (used by only this cell)
  edges: ParsedEdge[];       // intra-cell edges (existing kinds)
}

type CrossExit = "east" | "south";
type CrossEntry = "west" | "north";

interface CrossEdge {
  id: string;
  sourceCell: string;
  sourceComp: string;
  targetCell: string;
  targetComp: string;
  exit: CrossExit;
  entry: CrossEntry;
  mode: "connected" | "decoupled";
  label?: string;
  line: number;
}
```

- The existing `CellDiagramModel` shape is effectively `CellModel` plus identity.
  Single-cell documents produce a `ProjectModel` with one cell, no `crossEdges`,
  and `sharedExternals` empty — preserving current behavior end to end.
- Internal (in-cell) edges keep the existing `ParsedEdge`/`EdgeKind` model.

## Parsing

`parseCellDsl` gains a **brace-aware pre-pass** before the existing per-line
logic:

1. Scan lines and slice the source into `cell <id> [as "<label>"] { … }` blocks
   and top-level lines. Track brace nesting; report unbalanced braces as
   diagnostics with line numbers. (Nesting cells is not supported; a `cell`
   header inside a block is an error.)
2. If **no** blocks are found, run the existing single-cell parse over the whole
   source (implicit cell) — unchanged code path.
3. For each block, run the existing per-line parser over the block body to build
   that cell's components/externals/edges. The per-line parser is reused as-is;
   its results are collected under the cell's id.
4. Top-level lines are parsed as: `title`, comment/blank (ignored), or a
   project-level cross-cell edge. Anything else at the top level in multi-cell
   mode is a diagnostic.

Cross-cell edge recognition (both inside blocks and at project level):

- An edge endpoint containing a `.` is a qualified `<cell>.<component>` reference.
- The optional token immediately after `->` is parsed as a `<dirToken>`
  (`east`, `south`, `east-west`, `east-north`, `south-west`, `south-north`).
- Inside a block, the left endpoint may be a bare local component; the right
  endpoint must be qualified for the edge to be cross-cell. If neither endpoint
  is qualified, it is an ordinary intra-cell/boundary edge (existing logic).

## Compilation and Validation

`compileCellSource` produces a `ProjectModel`:

- Per cell: reuse existing normalization/inference (lookups, inferred components,
  boundary normalization, direction validation) over that cell's statements.
- **Shared externals:** gather all external usages across cells, group by id.
  Ids used by ≥2 cells become `sharedExternals`; others remain in the owning
  cell's `externals`. Merge alias/type across use sites; conflicting values emit
  a diagnostic.
- **Cross-edge resolution:** resolve `sourceCell`/`sourceComp` and
  `targetCell`/`targetComp`; infer missing components on either side (consistent
  with today's inference for internal endpoints). Derive `mode` from `exit`
  (`east` → connected, `south` → decoupled).

New diagnostics:

- `exit` not in {east, south}; `entry` not in {west, north}.
- Bare `south` (decoupled without explicit entry).
- Qualified reference to an unknown cell, or unknown component in a known cell
  that also cannot be inferred.
- Bare top-level `component`/internal-edge statements mixed with `cell {}` blocks.
- Unbalanced braces; nested `cell` header.
- Conflicting alias/type for a shared external id.

As today, any diagnostics suppress model output (`model: null`) so the canvas
keeps the last valid diagram.

## Rendering and Layout

Layout becomes **two-level**, reusing the existing single-cell layout for each
cell's interior.

### Intra-cell (reuse)

For each cell, run the existing `componentLayout` (dagre `LR`) to place internal
components and compute the octagon size, plus the existing external/gateway
positioning — but scoped per cell. Gateways and externals are positioned relative
to that cell's local origin.

### Inter-cell

1. Build a dagre graph whose **nodes are cells** (size = each cell's octagon
   footprint including its local externals' bounding box) plus one node per
   shared external. Edges are the **connected** cross-edges (decoupled edges do
   not couple positions). Run dagre (`rankdir: LR`) to get a cell origin per cell
   and a position per shared external.
2. Translate every cell's intra-cell layout by that cell's origin, producing
   absolute positions for all nodes on one flat React Flow canvas.

### Node id namespacing

- Component nodes: `<cellId>::<compId>`.
- Cell boundary nodes: `cell-<cellId>`.
- Gateways: `gateway-<cellId>-<dir>`.
- Cell-local externals: `external-<cellId>-<extId>`; shared externals:
  `external-<extId>`.
- Decoupled stub markers: `xstub-<edgeId>-out` (source side),
  `xstub-<edgeId>-in` (target side).

This namespacing threads through `flowLayout`, `highlightModel`, edge ids, and
the focus/highlight logic. Single-cell diagrams still get exactly one cell id, so
their behavior is unchanged.

### Edge rendering

- **Intra-cell edges:** unchanged (existing `smoothstep` handling through
  per-cell gateways).
- **Connected cross-edges:** `sourceComp → gateway-<srcCell>-<exit> →
  gateway-<tgtCell>-<entry> → targetComp`, using an **orthogonal L-shaped** edge
  type (React Flow `step`) for the inter-cell segment so links do not slide under
  a cell body.
- **Decoupled cross-edges:** two independent chains, no segment between the
  cells: `sourceComp → gateway-<srcCell>-<exit> → xstub-out` and
  `xstub-in → gateway-<tgtCell>-<entry> → targetComp`. The stub markers reuse the
  external node visual, labeled with the opposite endpoint's qualified id.

### Routing limitations

Full obstacle avoidance is out of scope. Overlap is minimized by (a) dagre cell
spacing, (b) exiting east / entering west toward the facing neighbor for
connected links, and (c) the decoupled escape hatch for cyclic or awkward
dependencies.

## Export (SVG / PNG)

React Flow renders nodes as HTML, so export uses the standard React Flow recipe
with `html-to-image`:

1. Compute the diagram's full bounds from all nodes (`getNodesBounds`) and derive
   a transform that fits the entire diagram (`getViewportForBounds`), independent
   of the user's current pan/zoom.
2. Capture the `.react-flow__viewport` element:
   - **PNG:** `toPng` at 2× pixel ratio on a white background.
   - **SVG:** `toSvg` (nodes embedded as `foreignObject`; this is an SVG file, not
     hand-authored vector shapes — acceptable for documentation use).
3. Trigger a download with a filename derived from the project/cell title.

UI: add **Export SVG** and **Export PNG** actions near the existing zoom/diagram
controls. Export works for single-cell and multi-cell diagrams alike.

New dependency: `html-to-image`.

## Testing

- **Parser:** block slicing, `as "<label>"` headers, brace balance/nesting
  errors, project title, cross-edge recognition (`.` qualifier), `<dirToken>`
  parsing, top-level-mixing error, backward-compat single-cell path.
- **Compiler:** shared-external grouping (1 cell vs ≥2 cells), alias/type merge
  and conflict, connected vs decoupled mode derivation, cross-edge component
  inference, all new diagnostics, single-cell `ProjectModel` shape.
- **Layout (`flowLayout`):** id namespacing, per-cell gateways, two-level offset
  correctness, connected chain node/edge structure, decoupled stub structure,
  single-cell unchanged output.
- **Highlight model:** focus/highlight with namespaced ids across cells.
- **Export:** the bounds/transform helper (pure function) is unit-tested;
  DOM capture is covered by a thin integration check.

## Phasing

The work is cohesive but can land in independently shippable phases:

1. **Export (SVG/PNG).** Independent of multi-cell; delivers value on existing
   single-cell diagrams first. Lowest risk.
2. **DSL + model + parse + compile.** Grammar, `ProjectModel`, brace-aware
   parsing, shared externals, validation. Fully testable without rendering.
3. **Rendering + layout.** Two-level dagre, per-cell gateways/namespacing,
   connected and decoupled cross-edge rendering, L-shaped routing.
4. **Docs.** Update `docs/dsl-guide.md`, `docs/requirements.md`, the in-app DSL
   guide, and the default sample to showcase a small multi-cell project.

## Deferred / Open

- Manual cell positioning / drag-to-arrange.
- Obstacle-avoiding edge routing.
- True vector SVG (nodes as SVG shapes rather than `foreignObject`).
- Nested cells / sub-cells.
- Transparent-background PNG option.
