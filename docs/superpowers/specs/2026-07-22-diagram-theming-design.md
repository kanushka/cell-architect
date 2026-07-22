# Diagram Theming (Light / Dark) — Design

**Date:** 2026-07-22
**Scope:** `@kanushka/cell-diagram-react` library only. The playground app stays light in this pass.
**Ships as:** v0.3.0 (additive, backward compatible).

## Goal

Let library consumers render the cell diagram in light or dark mode, and let advanced
consumers customize individual colors with plain CSS. Light mode must remain
pixel-identical to today's rendering.

## Decisions

- **Scope:** Library only. Playground continues to render the default (light) theme.
- **API:** `theme?: "light" | "dark"` prop + CSS custom properties for per-token overrides.
- **Export:** Exported images match the currently displayed theme (WYSIWYG). No export changes.
- **Mechanism:** CSS token layer + data attribute (approach A below).

## Approach

All colors in `diagram.css` move to prefixed CSS custom properties (`--cd-*`) defined
on the diagram root element. A `[data-cd-theme="dark"]` selector block overrides them
with the dark palette. The `theme` prop stamps the data attribute; switching themes is
instant and has zero runtime cost.

This also fixes a latent bug: `diagram.css` currently references `var(--muted)`,
`var(--line)`, and `var(--north/--south/--east/--west)` that only exist because the
*playground* defines them. Standalone consumers get broken colors today. The library
becomes self-contained by defining defaults for every token it uses.

### Rejected alternatives

- **Theme object prop (JS-driven):** bigger API surface; CSS overrides already cover the
  advanced case.
- **Separate dark stylesheet:** no dynamic switching without stylesheet juggling; poor
  fit for a future playground toggle.

## Design

### 1. Token layer (`diagram.css`)

- A `:where(.cell-diagram-root)` block defines all `--cd-*` tokens. Light values are
  today's exact colors, so light mode does not change visually.
- A `.cell-diagram-root[data-cd-theme="dark"]` block redefines every token with a
  slate-based dark palette: backgrounds in the `#0f172a`–`#1e293b` range, text `#e2e8f0`,
  lines `#334155`, adjusted boundary-zone colors (`--cd-north/south/east/west`), and
  flipped translucent overlays.
- Every hardcoded color literal in rules is replaced with `var(--cd-*)`. Roughly 40
  literals across ~514 lines.
- Token naming: `--cd-` prefix to avoid collisions with host-app variables.

### 2. Public API

- `CellDiagramProps` and `DiagramCanvasProps` gain `theme?: "light" | "dark"`
  (default `"light"`).
- The diagram root element renders `data-cd-theme={theme}`.
- New exported type: `export type DiagramTheme = "light" | "dark"`.

### 3. Image export

- No code changes: `exportImage.ts` serializes the live DOM, so resolved dark token
  values are captured automatically. Add one test confirming dark-theme markup carries
  through to the serialized output.

### 4. Testing

- Extend `diagram.css.test.ts`:
  - No raw hex/rgba color literals outside the two token blocks.
  - The dark block defines every token the light block defines (no missing overrides).
- Component tests (`CellDiagram.test.tsx` / `DiagramCanvas.test.tsx`):
  - `data-cd-theme` renders per the prop.
  - Defaults to `light` when the prop is omitted (backward compatibility).

### 5. Documentation

- New **Theming** section in `packages/cell-diagram-react/README.md`:
  - How to use the `theme` prop (light/dark) with a code example.
  - How to customize colors with custom CSS by overriding `--cd-*` tokens, with a
    copy-paste example (e.g. re-branding the cell border color).
  - A reference table listing every `--cd-*` token, its role, and its light/dark
    default values. Token names are public API from v0.3.0 onward.

### 6. Playground

- Untouched. It keeps passing no `theme` prop → light. Its `--muted`/`--line` variables
  no longer leak into the library since the library defines its own defaults.

## Out of scope

- Playground app dark mode and theme toggle UI (future pass; it will forward its theme
  state into the `theme` prop).
- Auto-detection via `prefers-color-scheme` (consumers can wire this themselves through
  the prop).
- Additional named themes beyond light/dark (custom CSS overrides cover branding needs).
