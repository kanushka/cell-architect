# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbers track the published library,
[`@kanushka/cell-diagram-react`](https://www.npmjs.com/package/@kanushka/cell-diagram-react).
Changes to the playground app at <https://cell-architect.web.app/> ship continuously and are
listed under the release they went out with, marked **(app)**.

## [Unreleased]

### Added

- `MAX_DIAGRAM_NODES` is exported, and `compileProject` now refuses a source over 1000 nodes
  with an error diagnostic instead of attempting a layout that would lock up the browser.
- **(app)** Opening a share link shows the diagram source and asks before saving it. Links
  previously wrote into the library on load.
- **(app)** Size limits on untrusted input: 100k characters of decompressed share source and
  a 1 MB ceiling on imported `.cell` files.
- Security policy, contribution guide, code of conduct, issue forms, and a pull request
  template.

### Changed

- **(app)** The hosted site sends a Content-Security-Policy along with
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and
  `Cross-Origin-Opener-Policy`.
- **(app)** Content-hashed assets are cached for a year as immutable, and HTML is served
  `no-cache`, so a deploy reaches visitors immediately rather than up to an hour later.

### Fixed

- `constrainSharedExternal` exits once a settle pass stops moving a node instead of always
  running its full `O(cells²)` loop. It runs per node during layout, so the cost compounded.
- Corrected the package README: the `diagram.css` link pointed into `src/`, which is not
  published, and the theming section described an image export that is not part of the
  public API.

## [0.3.0] - 2026-07-22

### Added

- Light and dark diagram themes via a `theme` prop on `CellDiagram` and `DiagramCanvas`,
  with the `DiagramTheme` type exported.
- A `--cd-*` CSS custom property layer covering every color the diagram renders, so consumers
  can rebrand it from their own stylesheet without a prop. Defaults are declared at zero
  specificity, so a plain class selector overrides them.

## [0.2.0] - 2026-07-22

### Added

- One-click conversion for mixed DSL sources, via `planMixedDslConversion` and the
  `MIXED_CELL_MODE_DIAGNOSTIC_CODE` diagnostic.
- Temporary drag-to-arrange for components and external nodes, with an Auto arrange reset.
- Portable manual positions: `serializePortableSource` and `parsePortableSource` round-trip
  layout metadata through exported `.cell` files and share links.
- Animated transitions as the diagram updates from live DSL edits.
- **(app)** Unified canvas notifications, and responsive navigation in the DSL guide.

## [0.1.1] - 2026-07-11

### Fixed

- Externalize React and every declared runtime dependency so consumer bundlers resolve them
  as ESM. Bundling them inlined transitive CommonJS requires and produced
  `Dynamic require of "react" is not supported` in Vite apps.

## [0.1.0] - 2026-07-11

Initial release, extracted from the Cell Architect app into a publishable library.

### Added

- Cell DSL parser, compiler, and diagram model: components, boundary gateways, external
  systems, and internal, inbound, outbound, and gateway-exposure dependencies.
- Multi-cell sources with `cell { … }` blocks, cross-cell links in connected and decoupled
  modes, and externals shared across cells.
- `CellDiagram` and `DiagramCanvas` React components, rendering through React Flow with a
  dagre-based two-level layout and floating edges.
- `wso2ToDsl`, converting a WSO2 cell-diagram model into Cell DSL.
- Diagram styles shipped as `@kanushka/cell-diagram-react/style.css`.

### Notes

- PNG and SVG export exists in the source but is disabled and not part of the public API.

[Unreleased]: https://github.com/kanushka/cell-architect/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/kanushka/cell-architect/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/kanushka/cell-architect/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/kanushka/cell-architect/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kanushka/cell-architect/releases/tag/v0.1.0
