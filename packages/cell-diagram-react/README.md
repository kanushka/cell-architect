# @kanushka/cell-diagram-react

React component + DSL for cell architecture diagrams, with a WSO2 cell-diagram converter.

Try the DSL in the browser at **[cell-architect.web.app](https://cell-architect.web.app/)**, or browse the
[source on GitHub](https://github.com/kanushka/cell-architect).

## Install

```bash
npm install @kanushka/cell-diagram-react
```

`react` and `react-dom` are peer dependencies.

## Usage

```tsx
import { CellDiagram, wso2ToDsl } from "@kanushka/cell-diagram-react";
import "@kanushka/cell-diagram-react/style.css";

// From Cell DSL text:
<CellDiagram source={`component api service\nnorth -> api`} />

// From a WSO2 cell-diagram model:
<CellDiagram source={wso2ToDsl(wso2Json)} />
```

`CellDiagram` fills its container — give the parent a height.

## Theming

The diagram ships with **light** (default) and **dark** themes. Set the `theme` prop
on `CellDiagram` or `DiagramCanvas`:

```tsx
import { CellDiagram, type DiagramTheme } from "@kanushka/cell-diagram-react";

<CellDiagram source={dsl} theme="dark" />
```

`theme` accepts `"light" | "dark"` (the `DiagramTheme` type) and defaults to `"light"`.
The theme is applied to the diagram root element via a `data-cd-theme` attribute, so any
screenshot or capture of the diagram reflects whatever theme is currently displayed.

### Custom colors

Every color the diagram renders is a `--cd-*` CSS custom property on the
`.cell-diagram-root` element. Override any of them from your own stylesheet to rebrand
the diagram — no prop needed. Because the built-in values are defined at zero
specificity, a plain class selector wins:

```css
/* Brand every diagram on the page */
.cell-diagram-root {
  --cd-node-border: #7c3aed;
  --cd-edge: #7c3aed;
}

/* Or scope overrides to one theme */
.cell-diagram-root[data-cd-theme="dark"] {
  --cd-canvas-bg: #000000;
}
```

#### Token reference

**Text**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--cd-title-text` | `#0f172a` | `#e2e8f0` | Cell title text |
| `--cd-node-text` | `#172033` | `#e2e8f0` | Component / external node labels |
| `--cd-body-text` | `#334155` | `#cbd5e1` | Edge labels, notifications, control icons |
| `--cd-muted-text` | `#64748b` | `#94a3b8` | Subtitles, empty-state text |
| `--cd-subtle-text` | `#475569` | `#cbd5e1` | Zoom-level readout |
| `--cd-disabled-text` | `#94a3b8` | `#64748b` | Disabled controls |
| `--cd-boundary-color` | `#263447` | `#cbd5e1` | Cell boundary outline |

**Surfaces**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--cd-surface` | `#ffffff` | `#1e293b` | Node and control backgrounds |
| `--cd-surface-hover` | `#f1f5f9` | `#334155` | Hovered control background |
| `--cd-canvas-bg` | `#f8fafc` | `#0f172a` | Canvas / empty-state background |
| `--cd-chip-bg` | `rgba(255,255,255,.88)` | `rgba(30,41,59,.88)` | Gate & edge label chips |
| `--cd-chip-bg-strong` | `rgba(255,255,255,.92)` | `rgba(30,41,59,.92)` | Notification pill |
| `--cd-title-bg` | `rgba(255,255,255,.86)` | `rgba(30,41,59,.86)` | Cell title plate |

**Lines & borders**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--cd-line` | `#d6dee8` | `#334155` | Default borders / dividers |
| `--cd-line-strong` | `#cbd5e1` | `#475569` | Export button border |
| `--cd-node-border` | `#334155` | `#64748b` | Component & gateway borders |
| `--cd-external-border` | `#64748b` | `#94a3b8` | External node border |
| `--cd-dots` | `#cbd5e1` | `#334155` | Background dot grid |

**Boundary zones & edges**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--cd-north` | `#0284c7` | `#38bdf8` | North gate / edge accent |
| `--cd-east` | `#ea580c` | `#fb923c` | East gate / edge accent |
| `--cd-south` | `#059669` | `#34d399` | South gate / edge accent |
| `--cd-west` | `#7c3aed` | `#a78bfa` | West gate / edge accent |
| `--cd-cross` | `#7c3aed` | `#a78bfa` | Cross-cell edge stroke |
| `--cd-edge` | `#475569` | `#94a3b8` | Default edge stroke |

**Shadows & notifications**

The diagram also exposes composite tokens for elevation and inline notifications:
`--cd-shadow-controls`, `--cd-shadow-node`, `--cd-shadow-external`,
`--cd-shadow-gateway`, `--cd-shadow-chip`, `--cd-shadow-info`, `--cd-highlight-ring`,
`--cd-highlight-edge-shadow`, `--cd-hint-active-text`, `--cd-hint-active-border`,
`--cd-hint-active-shadow`, `--cd-warn-text`, `--cd-warn-bg`, `--cd-warn-border`,
`--cd-warn-shadow`, `--cd-info-text`, `--cd-info-bg`. Their light/dark defaults are in
[`diagram.css`](https://github.com/kanushka/cell-architect/blob/main/packages/cell-diagram-react/src/renderer/diagram.css).

## Node limit

`compileProject` refuses a source over `MAX_DIAGRAM_NODES` (1000) nodes, returning a `null`
model and one error diagnostic rather than attempting a layout that would lock up the
browser. Layout cost grows faster than linearly in the node count, and consumers frequently
render sources they did not author — a share link, an uploaded file — so the ceiling is
enforced in the compiler rather than left to each caller.

```tsx
import { compileProject, MAX_DIAGRAM_NODES } from "@kanushka/cell-diagram-react";

const { model, diagnostics } = compileProject(untrustedSource);
if (!model) {
  // diagnostics[0].message explains why, including the node limit case
}
```

## Limitations

The WSO2 converter assumes component and service identifiers from the WSO2 cell-diagram model are valid Cell DSL identifiers. An identifier that exactly equals a DSL reserved keyword (`title`, `version`, `component`, `as`, `north`, `south`, `east`, `west`) will produce DSL output that fails to compile. Such inputs are out of scope for the converter.
