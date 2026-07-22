# Temporary Manual Component Layout — Design

Date: 2026-07-22

## Overview

Cell Architect currently reruns Dagre whenever the DSL produces a new model. That
makes small source edits rearrange every component and can cause links to cross
even when the previous arrangement was understandable.

This change lets users drag components into clearer positions without making
positioning part of the visible architectural DSL. A manual arrangement is
intentionally temporary: editing the DSL or selecting **Auto arrange** discards
the entire arrangement and runs Dagre again. Users can preserve an arrangement
by exporting or sharing it; the serialized `.cell` content carries the layout in
one opaque comment line.

## Goals

- Let users drag internal and external components to reduce crossings.
- Keep cell boundaries and gateways fixed and non-draggable.
- Prevent a drag from changing whether a component is inside or outside a cell.
- Constrain cell-local external components to their DSL-declared boundary side.
- Reset manual positioning predictably after any DSL edit.
- Provide an explicit **Auto arrange** action that returns to Dagre layout.
- Preserve a manual arrangement in exported/imported `.cell` files and share
  links without showing generated positions in the DSL editor.
- Keep exported files backward compatible with parsers that ignore comments.

## Non-goals

- Persisting manual layout in the browser's document repository.
- Preserving manual positions across DSL edits.
- Letting users drag cells or gateways.
- Letting a drag change DSL structure, boundary direction, or component scope.
- Incrementally repairing or optimizing a manual layout after a model change.
- Full obstacle-avoiding edge routing.
- An interface for editing coordinates directly.

## Behavior Decisions

### Layout lifetime

A custom layout lives only in the current application session and active
diagram. It is not written into `DiagramDocument` or local storage. Refreshing
the page, switching diagrams, or reopening a locally saved diagram returns to
Dagre unless the user first exported the diagram and imports that file again.

The following events clear the complete custom layout and rerun Dagre:

- any change to the visible DSL source;
- selecting **Auto arrange**;
- switching to another saved diagram;
- creating, duplicating, or deleting into a different active diagram;
- importing a diagram, after which a valid layout carried by that imported file
  becomes the new session layout;
- starting a fresh application session.

There is no attempt to preserve some dragged nodes while replacing others after
a source change. This keeps the reset behavior simple and predictable.

### Draggable objects and constraints

- An internal component can move only inside its owning cell. Its complete node
  rectangle must remain inside the cell's usable interior padding.
- A cell-local external component can move only along the side declared by the
  DSL. For example, an east external may move vertically along the east rail but
  cannot move north, south, west, or into the cell.
- A decoupled cross-cell stub follows the same rule as a cell-local external and
  remains on the side implied by the cross-edge.
- A shared external can move in the canvas area outside all cell interiors. If a
  drag would place it inside a cell, it is projected to the nearest valid point
  outside that cell.
- Cell boundaries and gateways are never draggable.
- Edges are never edited directly. React Flow updates their paths as connected
  nodes move.

Constraints apply continuously during dragging where React Flow permits it and
are enforced again at drag end. Invalid drag results are clamped or projected to
the closest valid position rather than rejected with an error.

### Warning and reset feedback

The first successful drag activates custom-layout mode. While it is active, the
canvas/editor shows a persistent, compact warning:

> Manual arrangement is temporary. Editing the DSL or choosing Auto arrange
> will reset it. Export the `.cell` file to preserve it.

The warning is informational, not a confirmation dialog. The first DSL edit
immediately clears the layout and shows short feedback such as **Manual layout
reset after DSL change**. Further typing does not repeat the message because no
custom layout remains.

### Auto arrange

An **Auto arrange** button is available with the diagram controls. When a custom
layout exists, selecting it clears all manual positions and renders the current
model directly from `toReactFlow`, which invokes Dagre. When no custom layout
exists, the action is disabled.

## Architecture

The design introduces a seam between semantic compilation and presentation
state. The compiler continues to return only `ProjectModel`; it does not know
about coordinates. A layout-state module owns all temporary positions and drag
constraints behind a small interface.

Conceptually:

```ts
interface CustomLayout {
  version: 1;
  sourceFingerprint: string;
  nodes: Record<string, CustomNodePosition>;
}

type CustomNodePosition =
  | { kind: "component"; cellId: string; x: number; y: number }
  | { kind: "external"; cellId: string; side: BoundaryDirection; offset: number }
  | { kind: "shared-external"; x: number; y: number };
```

Node keys use the renderer's stable ids, including namespaced component ids in a
multi-cell project. Internal component coordinates are relative to their cell.
Cell-local external positions use a normalized `0..1` offset along their fixed
side so they remain valid for the cell dimensions. Shared-external coordinates
are absolute canvas coordinates.

The layout module's interface is responsible for:

1. capturing constrained positions from a completed drag;
2. applying a custom layout to the Dagre-produced React Flow nodes;
3. clearing the complete layout;
4. encoding and decoding portable layout metadata;
5. rejecting metadata that does not match the accompanying source fingerprint.

This keeps drag rules, coordinate conversions, serialization, and validation
local to one module. `DiagramCanvas` consumes the resolved nodes and reports drag
events; `App` owns whether custom-layout mode is active.

## Data Flow

### Normal editing

1. `App` compiles the visible DSL into `ProjectModel` as today.
2. `toReactFlow(model)` produces the Dagre layout.
3. If a matching `CustomLayout` exists, the layout module overlays its saved
   component/external positions onto those generated nodes.
4. `DiagramCanvas` renders the resulting controlled React Flow nodes.
5. A successful node drag updates the in-memory custom layout and activates the
   warning.

When `SourceEditor.onChange` fires while a custom layout exists, `App` clears the
layout before saving and compiling the new source. The resulting render therefore
comes entirely from Dagre.

### Export and share

The visible DSL remains unchanged. Export/share serialization appends exactly
one reserved line:

```cell
# @layout=<payload>
```

`payload` is URL-safe, compressed JSON created with the existing `lz-string`
dependency. It contains the versioned `CustomLayout`, including a fingerprint of
the source without the metadata line. The line is omitted when no custom layout
exists.

The prefix is intentionally short because the line is application-owned and is
not shown in the editor. It is still a valid DSL comment, so older Cell Architect
versions ignore it and render using Dagre.

Serialization must replace an existing reserved line rather than append a second
one. Ordinary source lines that do not begin with the exact `# @layout=` prefix
are untouched.

### Import and share opening

1. Split the exact reserved metadata line from the source before displaying or
   saving the DSL.
2. Decode and validate the payload.
3. Compile the clean semantic source normally.
4. Apply the imported custom layout only when its version is supported and its
   source fingerprint matches the clean source.
5. Keep the restored layout in session state; do not save it into the repository.

Share links serialize the same portable content before applying the existing
outer share-link compression. This makes `.cell` import/export and share links
use one layout codec.

## Error Handling

- A missing metadata line means normal Dagre layout.
- An empty, malformed, unsupported, or undecodable payload is ignored. The DSL
  still opens and renders with Dagre.
- A source-fingerprint mismatch discards the custom layout. This covers files
  whose DSL was edited outside Cell Architect without removing the metadata.
- Layout failures are presentation warnings, not compiler diagnostics, because
  they do not make the architectural model invalid.
- Unknown node ids are ignored defensively. If no valid positions remain, custom
  layout mode is not activated.
- Non-finite numbers and offsets outside `0..1` are rejected during decoding.

## UI Changes

- Enable dragging for component, external, shared-external, and decoupled-stub
  React Flow nodes.
- Keep cell-boundary and gateway nodes explicitly non-draggable.
- Add **Auto arrange** alongside the existing zoom/export controls.
- Show the temporary-layout warning only while custom layout is active.
- Show brief reset feedback after a DSL edit clears a custom layout.
- Do not display, fold, or edit the `# @layout=` line in `SourceEditor`; imported
  metadata is stripped before source reaches the editor.

## Testing

### Layout-state module

- Applying component positions uses cell-local coordinates.
- Internal nodes clamp inside their owning cell.
- Each local external remains on its declared rail and clamps its normalized
  offset.
- Shared externals cannot overlap cell interiors.
- Gateways and cells cannot acquire custom positions.
- Encoding and decoding round-trip a valid layout.
- Malformed payloads, unsupported versions, invalid numbers, unknown node ids,
  and fingerprint mismatches fall back safely.

### Renderer

- Components and supported external nodes are draggable.
- Cell boundaries and gateways remain fixed.
- Dragging changes connected edge paths through React Flow node updates.
- Auto arrange returns nodes to `toReactFlow`/Dagre positions.

### Application

- The first drag activates the warning.
- A DSL edit clears all custom positions once and shows reset feedback.
- Switching documents clears session layout.
- Refresh/local repository load does not restore manual layout.
- Export adds one `# @layout=` line only when a custom layout exists.
- Import strips the metadata from the visible DSL and restores valid positions.
- Exporting an imported custom layout does not duplicate metadata.
- Share-link round trips preserve a valid custom layout.
- Existing `.cell` files, share links, and repository schema remain compatible.

## Implementation Scope

Expected changes are limited to:

- a new renderer/application layout-state and portable-codec module with tests;
- controlled draggable-node handling in `DiagramCanvas`;
- session layout ownership, reset feedback, import/export/share wiring in `App`;
- the Auto arrange control and temporary-layout warning styles/tests;
- documentation for manual movement, reset behavior, and portable export.

The semantic parser, compiler, and `ProjectModel` remain unchanged.
