# NPM Library + WSO2 Converter — Design

Date: 2026-07-10
Status: Approved (pending spec review)
Branch base: `feature/multi-cell-dsl` (converter emits multi-cell DSL, which requires this branch's grammar)

## Goal

Turn Cell Architect into a publishable npm library, `@kanushka/cell-diagram-react`, that other
React projects can consume, while keeping the existing Firebase-hosted workbench as the library's
demo/playground. Add a converter that turns the WSO2
[cell-diagram](https://github.com/wso2/cell-diagram) input model (JSON) into Cell Architect DSL,
so consumers can render WSO2 models through the library.

Consumer flow:

```tsx
import { CellDiagram, wso2ToDsl } from "@kanushka/cell-diagram-react";
import "@kanushka/cell-diagram-react/style.css";

<CellDiagram source={wso2ToDsl(wso2Json)} />
```

## Scope decisions (locked)

- **Public surface:** `CellDiagram` React component + `wso2ToDsl` converter (plus the
  types/`compileProject` they depend on). Not shipping a broad DSL toolkit surface beyond that.
- **Repo shape:** **npm-workspaces monorepo** — `packages/cell-diagram-react` (the published
  library) and `apps/playground` (the existing workbench, consuming the library as a workspace
  dependency). Firebase hosting preserved, repointed at the app's build output.
- **Sequencing:** library packaging first, converter second.
- **Converter fidelity:** semantically equivalent valid DSL (renders the same diagram), **not** a
  byte-for-byte match of any hand-written DSL. Generated alias ids may differ from a human's.
- **Observations:** `observations[]` metrics and any `observationOnly: true` connection are
  **dropped entirely** — no declaration, no edge. The converter has zero observation logic.

## Project structure (monorepo)

```
cell-architect/
├─ package.json               root; private; "workspaces": ["packages/*", "apps/*"]
├─ package-lock.json          single lockfile for the whole workspace
├─ tsconfig.base.json         shared compiler options; each package extends it
├─ .github/workflows/         ci.yml, release.yml
├─ firebase.json, .firebaserc repointed at apps/playground/dist
├─ docs/                      specs, plans, dsl-guide (stay at root)
│
├─ packages/
│  └─ cell-diagram-react/     THE LIBRARY → published as @kanushka/cell-diagram-react
│     ├─ package.json         name, exports, peerDeps, build/test scripts, publishConfig
│     ├─ tsconfig.json        extends ../../tsconfig.base.json
│     ├─ vite.config.ts       build.lib (entry src/index.ts) + dts + vitest
│     ├─ src/
│     │  ├─ index.ts          public entry (see Public entry)
│     │  ├─ domain/           model + diagnostic types
│     │  ├─ parser/           Cell DSL parser
│     │  ├─ compiler/         parse → ProjectModel
│     │  ├─ renderer/         DiagramCanvas + CellDiagram wrapper + diagram CSS
│     │  ├─ converter/        (new) wso2ToDsl + WSO2 types
│     │  └─ ui/               ControlIcons (used by renderer)
│     └─ dist/                build output: index.js, index.d.ts, style.css
│
└─ apps/
   └─ playground/             THE DEMO → the Firebase-hosted workbench
      ├─ package.json         depends on @kanushka/cell-diagram-react: "*"
      ├─ tsconfig.json        extends ../../tsconfig.base.json
      ├─ vite.config.ts       app build/dev; dev alias → library src for HMR
      ├─ index.html
      └─ src/
         ├─ main.tsx          app entry
         ├─ app/              editor shell, panels, app-shell CSS
         ├─ storage/          localStorage repo + sample
         └─ share/            share-via-link
```

The current `src/*` folders move into these two homes: `domain, parser, compiler, renderer,
converter, ui` → the library; `app, storage, share, main.tsx, index.html` → the playground.
Every cross-folder import updates accordingly, and app-only imports of library modules become
package imports (`@kanushka/cell-diagram-react`).

## Workstream 1 — Library packaging

### Public entry

`packages/cell-diagram-react/src/index.ts` exporting:

- `CellDiagram` — the React component (see Workstream 2).
- `wso2ToDsl` — the converter (see Workstream 3), plus its input types.
- `compileProject`, `parseProject`, and the model/diagnostic types from `domain/cellModel.ts`
  that appear in the component props / converter output (TS consumers need them).

### Build

- Library Vite config with `build.lib` (ESM output; entry `src/index.ts`) + `vite-plugin-dts` for
  `.d.ts`.
- **Externalize** `react`, `react-dom`, `react/jsx-runtime` (moved to `peerDependencies`).
- Keep runtime deps (`@xyflow/react`, `@dagrejs/dagre`, `clsx`, `lucide-react`, `nanoid`) as the
  library's `dependencies` so consumers don't manage them. `lz-string`/`html-to-image` are
  share/export concerns and stay with the playground unless the shipped component needs them.
- Ship CSS as `dist/style.css` (diagram/renderer CSS extracted into the library + required
  `@xyflow/react` styles) that consumers import explicitly. Mark `sideEffects: ["*.css"]`.

### Library package.json

- Name `@kanushka/cell-diagram-react`, `type: module`, `publishConfig.access: public`, not private.
- `main`/`module`/`types`/`exports` (root + `./style.css`) and `files: ["dist"]`.
- `react`/`react-dom` in `peerDependencies`.
- Scripts: `build` (lib), `test`, `lint`.

### Root + playground wiring

- **Root `package.json`:** `private: true`, `workspaces: ["packages/*", "apps/*"]`, and pass-through
  scripts (`build:lib`, `build:app`, `test`, `lint`) that delegate to the right workspace.
- **Package manager:** npm workspaces with a single root `package-lock.json`. The
  `packageManager: pnpm` field is dropped (it disagreed with the committed npm lockfile). Note: npm
  workspaces do **not** support the `workspace:` dependency protocol — the playground depends on
  `"@kanushka/cell-diagram-react": "*"` and npm symlinks it.
- **Dev DX:** the playground's Vite config aliases `@kanushka/cell-diagram-react` to the library's
  `src/index.ts` in dev so HMR works against source without a prior lib build. The production app
  build and CI resolve the real package (built `dist`).
- **Firebase:** `firebase.json` `public` repointed to `apps/playground/dist`; deploy still run from
  repo root.

## Workstream 2 — `CellDiagram` component

A thin, self-contained wrapper around the existing `src/renderer/DiagramCanvas.tsx`.

```ts
interface CellDiagramProps {
  source?: string;                 // DSL text; compiled internally
  model?: ProjectModel;            // alternative: pass a precompiled model
  className?: string;
  style?: React.CSSProperties;
  fitView?: boolean;               // default true
  interactive?: boolean;           // pan/zoom/click-focus, default true
  onDiagnostics?: (d: Diagnostic[]) => void;  // parse/compile diagnostics
}
```

Behavior:

- If `source` is given, run `compileProject(source)`; surface diagnostics via `onDiagnostics`;
  render the resulting `ProjectModel`. If `model` is given, render it directly.
- Render inside a `ReactFlowProvider` so the component is drop-in with no provider setup by the
  consumer.
- Must not depend on app-level state (storage, editor, share). If `DiagramCanvas` currently pulls
  any app context, extract/parameterize the minimum needed so the component is standalone.

## Workstream 3 — WSO2 converter

Self-contained module `packages/cell-diagram-react/src/converter/`:

- `wso2Model.ts` — TypeScript types for the WSO2 input (`Wso2CellModel`, `Wso2Component`,
  `Wso2Service`, `Wso2Gateway`, `Wso2Connection`).
- `wso2ToDsl.ts` — `wso2ToDsl(model: Wso2CellModel, options?: Wso2ConvertOptions): string`.
- Pure functions, no React / no packaging dependencies.

### Input shape (WSO2 cell-diagram)

- Top level: `{ id, name, components[], modelVersion }`. Project id = top-level `id`.
- `components[]`: `{ id, label?, version, type, services{}, connections[] }`.
- `services{}`: keyed by full id; each `{ id, label, type, deploymentMetadata.gateways }`.
  - `gateways.internet.isExposed: boolean`, `gateways.intranet.isExposed: boolean`.
- `connections[]`: `{ id, label?, type?, onPlatform, observationOnly?, observations[] }`.
- Component/service ids are `<org>:<project>:<component>:<resource>`.

### Mapping rules

1. **Components.** Each `components[]` entry → `component <id> <type>`. Type map:
   `service → api` (fallthrough: pass the WSO2 type through unless a mapping is defined;
   `datastore → database`).
2. **Gateway exposures.** For a component, if **any** of its services has
   `gateways.internet.isExposed === true` → emit `north -> <component>`. If any has
   `gateways.intranet.isExposed === true` → emit `west -> <component>`.
3. **Connections → dependencies.** Drop any connection with `observationOnly === true`. For the
   rest, classify by the connection `id`:
   - **4-part `org:project:comp:res`** (a platform component ref): let `p = id.split(":")[1]`.
     - `p === project` → **internal** edge to component `id.split(":")[2]`:
       `<sourceComponent> -> <targetComponent>`.
     - `p !== project` → **east** external. Declare `east <alias> [as "<label>"] <type>` and emit
       `<sourceComponent> -> <alias>`.
   - **URI form** (`scheme://host`, e.g. `mysql://mysql`, `googleapps://firebase`) or
     `type === "datastore"` → **south** external. Declare `south <alias> [as "<label>"] <type>`
     and emit `<sourceComponent> -> <alias>`. (`onPlatform` is ignored here — id shape decides.)
4. **External dedup.** Externals are keyed by canonical connection id. The same id used by
   multiple components collapses to one declaration (label = first non-empty; type = first
   non-empty) with one edge per using component.
5. **Alias generation (deterministic).**
   - Multi-word label → generate a short id from the label (e.g. initials / sanitized), ensure
     uniqueness across the document with a numeric suffix, and emit `as "<label>"`.
   - Single-word label → use the label directly as the id.
   - No label → derive an id from the raw connection id (last meaningful segment, sanitized), e.g.
     `mysql://mysql → mysql`, `googleapps://firebase → firebase`.
   - Determinism over prettiness: generated aliases may differ from any hand-written DSL.
6. **Metrics.** `observations[]` and all latency/error/request fields are ignored.

### Emit order (stable)

`component` lines (input order) → `east` declarations → `south` declarations → blank →
`north` exposures → `west` exposures → blank → edges (internal first, then external), each group
in a deterministic order. Stable output makes snapshot testing meaningful.

### Options

`Wso2ConvertOptions` (initial): `{ title?: boolean }` — whether to emit a top-level `title` from
the model `name`. Default off (the reference example omits it). Kept minimal; extend later.

## Workstream 4 — Tests

- **Golden/semantic test:** feed the reference WSO2 JSON to `wso2ToDsl`, then
  `compileProject(output)` and assert **zero error diagnostics** and that the resulting
  `ProjectModel` matches the expected structure — components, externals grouped by boundary
  (`north`/`west` exposures; `east`/`south` externals), and the exact edge set. This validates
  semantic equivalence, not text.
- **Text snapshot:** also snapshot the emitted string for regression visibility.
- **Focused unit tests**, one behavior each:
  - internet/intranet exposure → north/west (including "any service exposes it").
  - same-project 4-part id → internal edge.
  - different-project 4-part id → east external + edge.
  - URI id / datastore → south external.
  - `observationOnly` connection → produces nothing.
  - same external id across components → single declaration, multiple edges, label/type merge.
  - unlabeled URI id → id derived from last segment.
  - alias uniqueness → collision gets a suffix.

## Workstream 5 — CI / release

- `.github/workflows/ci.yml` — on push + PR: `npm ci` (root, installs all workspaces),
  `npm run lint`, `tsc` typecheck, `npm test`, `npm run build:lib`. Node 20.
- `.github/workflows/release.yml` — on `v*` tag push: `npm ci`, build the library workspace, then
  `npm publish -w @kanushka/cell-diagram-react --access public` using the `NPM_TOKEN` repo secret.
  The published version is whatever is in the library `package.json` at the tagged commit.
  (Changesets deferred — simple tag-based publish for v1.)
- Both use npm workspaces against the single root `package-lock.json`.

## Out of scope

- Changesets / automated version bumping.
- CJS build (ESM only for v1).
- Converting the demo app itself to consume the *published* package (it uses local source).
- Any `observations`/metrics visualization.

## Risks / open notes

- `DiagramCanvas` may currently couple to app state; extraction effort is the main library-side
  unknown. Implementation plan should verify its dependencies early.
- `@xyflow/react` CSS must be included in the shipped `style.css` or the diagram renders unstyled
  for consumers.
- npm scope `@kanushka` must exist / be claimed before the first publish.
- **Monorepo migration is the largest single step:** moving `src/*` into two workspaces rewrites
  import paths across nearly every file and test, and repoints Firebase, tsconfig, and vitest. The
  plan should do the move as one mechanical commit (git mv + import rewrite) with the full test
  suite green before any packaging/converter work begins.
