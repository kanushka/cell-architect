# Cell Architect Requirements

## Product Idea

Cell Architect is a web app for creating cell architecture diagrams from a simple text notation. It should feel similar to tools like Mermaid Live for notation-driven rendering and Excalidraw for an approachable diagram workspace, while staying focused on WSO2-style cell architecture concepts.

The app should let a user describe a cell, its internal components, boundary gateways, external dependencies, and public exposures using a compact DSL. The generated diagram should preserve the cell architecture mental model: components live inside the cell, external systems live outside the cell, and north/east/south/west gateways show how traffic crosses boundaries.

## Goals

- Provide a fast notation-to-diagram workflow for cell architecture.
- Keep the DSL readable enough to write without learning a complex language.
- Render diagrams with a clear cell boundary, gateway circles, component circles, and directional links.
- Preserve all diagrams in the user's browser local storage.
- Support multiple saved diagrams with import and export.
- Keep the first screen as the usable editor, not a landing page.

## Non-Goals

- No backend service is required for the first version.
- No real-time multi-user collaboration is required for the first version.
- No cloud account, authentication, or remote persistence is required.
- No full Mermaid compatibility is required.
- No freeform drawing mode is required.

## Users

Primary users are architects and engineers who need to sketch or document cell-based application architecture quickly. They should be able to paste a DSL snippet, adjust it, and immediately see a diagram suitable for discussion or documentation.

## Core Workflow

1. User opens the app.
2. App loads saved diagrams from browser local storage, or creates a default sample.
3. User edits the Cell DSL in the text editor.
4. App parses and validates the DSL continuously.
5. App renders the latest valid diagram.
6. If the DSL has errors, diagnostics are shown while preserving the last valid diagram.
7. User can create, duplicate, delete, import, and export diagrams.
8. User can switch to fullscreen diagram mode for review.

## DSL Requirements

The DSL must support the notation documented in [DSL guide](dsl-guide.md).

Required statements:

- `title <name>` sets the cell title.
- `version <value>` sets an optional cell version.
- Metadata is optional. If title and version are omitted, no cell label is rendered.
- `component <id> [type]` declares an internal component with an optional type label.
- `component <id> as <display-name> [type]` declares an internal component with a diagram label and optional type label.
- Internal component declarations are optional when no type, display label, or alias is needed.
- Undeclared internal components are inferred when they appear on the internal side of a dependency.
- `<direction> <id> [as <display-name>] [type]` declares an external system on a boundary.
- `<component> -> <component>` declares an internal dependency.
- `<direction> <external> -> <component>` declares an inbound boundary dependency.
- `<component> -> <direction> <external>` declares an outbound boundary dependency.
- `<direction> -> <component>` declares a north/west gateway exposure when the external consumer is unknown.
- `<component> -> <direction>` declares an east/south gateway exposure when the external consumer is unknown.
- `<external> -> <component>` is allowed when the external was predeclared.
- `<component> -> <external>` is allowed when the external was predeclared.

Supported directions:

- `north`
- `east`
- `south`
- `west`

Labels:

- Dependencies may include an optional label after `:`.
- Labels should render near the relevant edge.

Comments:

- Blank lines are ignored.
- Lines starting with `#` or `//` are ignored.

Validation:

- Component names must be unique.
- External ids must be unique.
- North and west boundary connections must flow into the cell.
- East and south boundary connections must flow out of the cell.
- Internal dependency endpoints may be declared components or inferred components.
- Inbound targets may be declared components or inferred components.
- Outbound sources may be declared components or inferred components.
- Gateway exposure components may be declared components or inferred components.
- External systems do not need component declarations.
- Declared ids are the preferred stable references. Display names may be used only when unambiguous.

## Diagram Rendering Requirements

Cell:

- The cell boundary must be an octagon.
- The cell body must be transparent.
- The cell boundary must use a visible outline.
- The cell title and version should be shown near the northwest side of the cell.
- If no title or version is provided, no cell label should render.

Components:

- Internal components must render as circles inside the cell.
- External systems must render as circles outside the cell.
- Component type should be shown inside internal component circles.
- If a component type is omitted, no type text should render for that component.
- Declared display names should be shown instead of ids.
- External type labels should be shown when provided.

Gateways:

- Gateway circles should appear on a boundary only when that boundary has at least one connection.
- Inbound, outbound, and gateway exposure edges must route through the relevant gateway circle.
- If a component is exposed with `<direction> -> <component>` or `<component> -> <direction>`, no external component should be created.

Connections:

- Internal dependencies connect internal components.
- Inbound dependencies connect external system to gateway, then gateway to internal component.
- Outbound dependencies connect internal component to gateway, then gateway to external system.
- Gateway exposures connect gateway to internal component for north/west and internal component to gateway for east/south.
- North/south/east/west labels should sit near gateways, outside the cell, without colliding with links.
- Links should use boundary-aware handles where possible:
  - North connections attach to the top side of internal components.
  - South connections leave from the bottom side of internal components.
  - East connections leave from the right side.
  - West connections attach to or leave from the left side.

Focus behavior:

- Hover should not change focus state.
- Clicking a component should enter focus view for its connected links and nodes.
- Clicking the canvas or pressing `Esc` should clear focus view.
- The canvas should show a short hint for focus behavior.

## App UI Requirements

Layout:

- The app should use a split editor layout by default.
- Left side: document/sidebar controls and source editor.
- Right side: diagram canvas.
- The source editor should use a light theme.
- The diagram canvas should not show React Flow branding labels.

Document management:

- User can create a new diagram.
- User can import `.cell` or text files.
- User can export a diagram as `.cell`.
- User can duplicate diagrams.
- User can delete diagrams after confirmation.
- The app should keep a practical maximum number of browser-stored diagrams.

Fullscreen:

- User can enter fullscreen diagram mode.
- Fullscreen mode hides the sidebar and text editor.
- Fullscreen mode keeps diagram controls available.
- User can exit fullscreen mode and return to the split editor.

Persistence:

- Diagrams are stored in browser local storage.
- The app does not require a backend to save diagrams.
- Users should be warned that browser-local diagrams can be lost if browser data is cleared.

## Technical Requirements

Frontend:

- React + TypeScript.
- Vite development and build pipeline.
- React Flow for diagram canvas behavior.
- Dagre for internal component layout.
- CodeMirror for source editing.

Quality:

- Parser, compiler, layout, storage, and app behavior should have tests.
- `npm test` should pass before release.
- `npm run lint` should pass before release.
- `npm run build` should pass before release.

## Current Implementation Plan

Completed:

- React/Vite app scaffold.
- Split editor with light source editor.
- Local document repository.
- Default sample diagram.
- Import, export, create, duplicate, and delete actions.
- Octagon cell boundary.
- Circle components and external systems.
- Boundary gateway circles.
- Inbound, outbound, internal, and gateway exposure DSL forms.
- Click-to-focus connection view.
- Fullscreen diagram mode.
- README and DSL guide.
- Export as SVG or PNG.
- Multi-cell diagram support, with cross-cell links and shared externals.

Next useful improvements:

- Add copy/share of DSL text.
- Improve mobile layout for dense diagrams.
- Add optional sample templates.
- Add pan/zoom reset or fit controls with clearer icons.
- Add a richer validation panel with clickable line diagnostics.

## Open Design Questions

- Resolved: multi-cell diagrams use explicit `cell <id> [as "<label>"] { ... }` blocks; a document with no blocks remains a single implicit cell, fully backward compatible.
- Resolved: external systems used on a boundary by two or more cells are automatically treated as one shared, reusable entity.
- Should gateway exposure edges allow labels, for example `north -> API : public REST`?
- Resolved: the app supports exporting diagrams as SVG and PNG.
- Should local storage later be replaced or supplemented by file-backed project storage?
