# NPM Library + WSO2 Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Cell Architect into an npm-workspaces monorepo that publishes `@kanushka/cell-diagram-react` (a React `<CellDiagram>` component + `wso2ToDsl` converter) while keeping the existing workbench as a playground app, with CI and a tag-based npm release pipeline.

**Architecture:** Two workspaces — `packages/cell-diagram-react` (the published library: DSL parser/compiler, React Flow renderer, `CellDiagram` wrapper, WSO2 converter) and `apps/playground` (the Firebase-hosted editor, consuming the library). The library defines its public surface through `src/index.ts`; a Vite library build emits `dist/{index.js,index.d.ts,style.css}`. The converter is a pure function turning WSO2 cell-diagram JSON into Cell DSL text that the library then renders.

**Tech Stack:** TypeScript, React 18, Vite (app + library modes), `vite-plugin-dts`, Vitest, `@xyflow/react`, `@dagrejs/dagre`, npm workspaces, GitHub Actions.

## Global Constraints

- Node 20 in CI. Package manager: **npm workspaces**, single root `package-lock.json`. Do NOT reintroduce a `packageManager: pnpm` field.
- npm workspaces do **not** support the `workspace:` protocol — the playground depends on `"@kanushka/cell-diagram-react": "*"`.
- Published package name: `@kanushka/cell-diagram-react`, `publishConfig.access: public`, ESM-only.
- Library `dependencies`: `@dagrejs/dagre`, `@xyflow/react`, `html-to-image`. Library `peerDependencies`: `react`, `react-dom`. `clsx` is unused — do not carry it anywhere.
- Converter is **pure** (no React, no DOM). It drops all `observations[]` and any connection with `observationOnly === true` (no declaration, no edge).
- Converter fidelity: semantically-equivalent valid DSL, not byte-match. Alias ids are generated deterministically.
- TDD throughout: failing test → run (see it fail) → minimal implementation → run (see it pass) → commit. Keep the full suite green after every task.
- Run a single library test file with: `npm test -w @kanushka/cell-diagram-react -- <relative-path>`. Run the whole library suite with: `npm test -w @kanushka/cell-diagram-react`. Same pattern with `-w @cell-architect/playground` for the app.

---

## File Structure

```
cell-architect/
├─ package.json                         root: private, workspaces, delegating scripts, shared devDeps
├─ package-lock.json                    single workspace lockfile
├─ tsconfig.base.json                   shared compilerOptions
├─ eslint.config.js                     root flat config (unchanged, ignores updated)
├─ firebase.json / .firebaserc          public → apps/playground/dist
├─ .github/workflows/ci.yml             lint + typecheck + test + build:lib
├─ .github/workflows/release.yml        publish on v* tag
├─ docs/…                               specs, plans, dsl-guide (stay at root)
│
├─ packages/cell-diagram-react/
│  ├─ package.json                      library manifest (name, exports, deps, peerDeps)
│  ├─ tsconfig.json                     extends ../../tsconfig.base.json
│  ├─ vite.config.ts                    build.lib + dts + vitest
│  ├─ src/
│  │  ├─ index.ts                       PUBLIC ENTRY
│  │  ├─ test/setup.ts                  vitest setup (moved)
│  │  ├─ domain/cellModel.ts
│  │  ├─ parser/…
│  │  ├─ compiler/…
│  │  ├─ renderer/… (+ CellDiagram.tsx, diagram.css)
│  │  ├─ converter/  wso2Model.ts, wso2ToDsl.ts, wso2ToDsl.test.ts
│  │  └─ ui/ControlIcons.tsx            Zoom/Fit icons only
│  └─ dist/                             build output
│
└─ apps/playground/
   ├─ package.json                      app manifest, depends on the library
   ├─ tsconfig.json                     extends ../../tsconfig.base.json
   ├─ vite.config.ts                    app build/dev, dev alias → library src
   ├─ index.html
   └─ src/
      ├─ main.tsx
      ├─ test/setup.ts                  vitest setup (copy)
      ├─ app/… (+ EditorIcons.tsx        Code icons moved out of ControlIcons)
      ├─ storage/…
      └─ share/…
```

---

## Task 1: Monorepo skeleton and shared config

Creates the workspace roots and configs. No source moves yet — this task ends with `npm install` linking two empty-ish workspaces and the root lint still passing.

**Files:**
- Create: `packages/cell-diagram-react/package.json`, `packages/cell-diagram-react/tsconfig.json`
- Create: `apps/playground/package.json`, `apps/playground/tsconfig.json`
- Create: `tsconfig.base.json`
- Modify: `package.json` (root — becomes the workspace root)
- Delete: `tsconfig.app.json`, `tsconfig.node.json` (superseded), `vite.config.ts` (moves into workspaces)

**Interfaces:**
- Produces: workspace names `@kanushka/cell-diagram-react` and `@cell-architect/playground`; root scripts `dev`, `build`, `build:lib`, `build:app`, `test`, `lint`.

- [ ] **Step 1: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 2: Write the root `package.json`**

Replace the current root manifest with the workspace root (moves all build/test tooling to root devDeps; runtime deps move into the two workspaces in Tasks 2–3):

```json
{
  "name": "cell-architect-monorepo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "npm run dev -w @cell-architect/playground",
    "build": "npm run build:lib && npm run build:app",
    "build:lib": "npm run build -w @kanushka/cell-diagram-react",
    "build:app": "npm run build -w @cell-architect/playground",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^6.0.3",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "jsdom": "^25.0.1",
    "typescript": "~5.6.3",
    "typescript-eslint": "^8.18.2",
    "vite": "^8.1.3",
    "vite-plugin-dts": "^4.5.4",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 3: Write `packages/cell-diagram-react/package.json`**

```json
{
  "name": "@kanushka/cell-diagram-react",
  "version": "0.1.0",
  "description": "React component and DSL for rendering cell architecture diagrams, with a WSO2 cell-diagram converter.",
  "license": "MIT",
  "type": "module",
  "sideEffects": ["*.css"],
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./style.css": "./dist/style.css"
  },
  "files": ["dist"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "@dagrejs/dagre": "^1.1.5",
    "@xyflow/react": "^12.8.4",
    "html-to-image": "^1.11.13"
  },
  "peerDependencies": {
    "react": "^18.3.1 || ^19.0.0",
    "react-dom": "^18.3.1 || ^19.0.0"
  }
}
```

- [ ] **Step 4: Write `packages/cell-diagram-react/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Write `apps/playground/package.json`**

```json
{
  "name": "@cell-architect/playground",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "@kanushka/cell-diagram-react": "*",
    "@codemirror/language": "^6.0.0",
    "@lezer/highlight": "^1.0.0",
    "@uiw/react-codemirror": "^4.23.13",
    "lucide-react": "^0.468.0",
    "lz-string": "^1.5.0",
    "nanoid": "^5.0.9",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

> Note: verify the exact installed versions of `@codemirror/language` and `@lezer/highlight` with `npm ls @codemirror/language @lezer/highlight` after install and pin to whatever resolves; the `^6`/`^1` floors above are safe defaults.

- [ ] **Step 6: Write `apps/playground/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom", "node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Delete superseded root files**

```bash
git rm tsconfig.app.json tsconfig.node.json vite.config.ts
```

- [ ] **Step 8: Update `eslint.config.js` ignores**

Replace the `ignores` line so build outputs in both workspaces are ignored:

```js
  { ignores: ["**/dist/**", ".claude/worktrees", ".playwright-mcp", ".superpowers", ".worktrees"] },
```

- [ ] **Step 9: Install and verify workspaces link**

Run: `npm install`
Expected: completes without error; `ls node_modules/@kanushka/cell-diagram-react` shows a symlink into `packages/cell-diagram-react`.

Run: `npm run lint`
Expected: passes (no source moved yet, root `src/` still lints).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold npm-workspaces monorepo skeleton"
```

---

## Task 2: Move library source into `packages/cell-diagram-react`

Moves the DSL/renderer/converter-home folders, splits `ControlIcons`, adds the library Vite config and public entry, and gets the **library** test suite green. The app is temporarily broken (fixed in Task 3) — that's expected; only run the library suite here.

**Files:**
- Move: `src/{domain,parser,compiler,renderer,ui}` → `packages/cell-diagram-react/src/{domain,parser,compiler,renderer,ui}`
- Move: `src/test/setup.ts` → `packages/cell-diagram-react/src/test/setup.ts`
- Modify: `packages/cell-diagram-react/src/ui/ControlIcons.tsx` (remove Code icons)
- Create: `packages/cell-diagram-react/src/index.ts`
- Create: `packages/cell-diagram-react/vite.config.ts`

**Interfaces:**
- Produces (from `src/index.ts`): `compileProject`, `parseProject`, `DiagramCanvas`, and the types `ProjectModel`, `Diagnostic`, `CellModel`, `CrossEdge`, `ExternalNode`, `ParsedComponent`, `ParsedEdge` re-exported from `./domain/cellModel`.

- [ ] **Step 1: Move the library folders (preserve history)**

```bash
mkdir -p packages/cell-diagram-react/src
git mv src/domain packages/cell-diagram-react/src/domain
git mv src/parser packages/cell-diagram-react/src/parser
git mv src/compiler packages/cell-diagram-react/src/compiler
git mv src/renderer packages/cell-diagram-react/src/renderer
git mv src/ui packages/cell-diagram-react/src/ui
git mv src/test packages/cell-diagram-react/src/test
```

Internal imports inside these folders are relative (`../domain/...`) and remain valid after the move.

- [ ] **Step 2: Trim `ControlIcons.tsx` to renderer-only icons**

In `packages/cell-diagram-react/src/ui/ControlIcons.tsx`, delete the `CodeHideIcon` and `CodeShowIcon` exports (lines defining them). Keep `ZoomInIcon`, `ZoomOutIcon`, `FitScreenIcon` and the shared `ControlIconProps`/wrapper. The two removed icons are recreated in the app in Task 3.

- [ ] **Step 3: Write the public entry `packages/cell-diagram-react/src/index.ts`**

```ts
export { compileProject } from "./compiler/compileProject";
export { compileCellSource } from "./compiler/compileCellSource";
export { parseProject } from "./parser/parseProject";
export { DiagramCanvas } from "./renderer/DiagramCanvas";

export type {
  ProjectModel,
  ProjectCompileResult,
  CellModel,
  CrossEdge,
  ExternalNode,
  ParsedComponent,
  ParsedExternal,
  ParsedEdge,
  Diagnostic,
  BoundaryDirection
} from "./domain/cellModel";
```

- [ ] **Step 4: Write the library Vite config `packages/cell-diagram-react/vite.config.ts`**

```ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: "./tsconfig.json", include: ["src"] })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js"
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"]
    },
    cssCodeSplit: false
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
```

- [ ] **Step 5: Run the library test suite**

Run: `npm test -w @kanushka/cell-diagram-react`
Expected: all moved parser/compiler/renderer tests PASS (import paths unchanged; only their location moved).

- [ ] **Step 6: Typecheck the library**

Run: `npm run typecheck -w @kanushka/cell-diagram-react`
Expected: no errors. (If `DiagramCanvas` references removed Code icons, it should not — only EditorPanel used them.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move DSL, renderer, and shared types into cell-diagram-react package"
```

---

## Task 3: Move the app into `apps/playground` and consume the library

Moves the editor/storage/share code, repoints its imports of library modules to the package, recreates the Code icons locally, adds the app Vite config with a dev alias to library source, repoints Firebase, and gets the **app** suite green.

**Files:**
- Move: `src/{app,storage,share}` → `apps/playground/src/{app,storage,share}`
- Move: `src/main.tsx` → `apps/playground/src/main.tsx`; `index.html` → `apps/playground/index.html`
- Create: `apps/playground/src/test/setup.ts` (copy of the library setup)
- Create: `apps/playground/src/app/EditorIcons.tsx` (Code icons)
- Create: `apps/playground/vite.config.ts`
- Modify: `apps/playground/src/app/App.tsx`, `apps/playground/src/app/EditorPanel.tsx`, `apps/playground/src/app/EditorPanel.test.tsx` (import rewrites)
- Modify: `firebase.json`

**Interfaces:**
- Consumes: `compileProject`, `DiagramCanvas`, `Diagnostic` from `@kanushka/cell-diagram-react` (Task 2).

- [ ] **Step 1: Move app folders and entry**

```bash
mkdir -p apps/playground/src
git mv src/app apps/playground/src/app
git mv src/storage apps/playground/src/storage
git mv src/share apps/playground/src/share
git mv src/main.tsx apps/playground/src/main.tsx
git mv index.html apps/playground/index.html
```

After this, `src/` at the repo root should be empty — remove it if git left it: `rmdir src 2>/dev/null || true`.

- [ ] **Step 2: Copy the test setup for the app**

Create `apps/playground/src/test/setup.ts` with the identical contents of `packages/cell-diagram-react/src/test/setup.ts` (the ResizeObserver + Range mocks). The app's CodeMirror tests need them.

- [ ] **Step 3: Recreate the Code icons locally**

Create `apps/playground/src/app/EditorIcons.tsx` with the `CodeHideIcon` and `CodeShowIcon` component bodies that were removed from `ControlIcons.tsx` in Task 2 (same JSX, same `ControlIconProps` shape: `{ size?: number }`).

- [ ] **Step 4: Rewrite library imports in the app**

- `apps/playground/src/app/App.tsx`: replace
  `import { compileProject } from "../compiler/compileProject";` and
  `import { DiagramCanvas } from "../renderer/DiagramCanvas";`
  with a single `import { compileProject, DiagramCanvas } from "@kanushka/cell-diagram-react";`
- `apps/playground/src/app/EditorPanel.tsx`: replace
  `import { Diagnostic } from "../domain/cellModel";` with `import { Diagnostic } from "@kanushka/cell-diagram-react";`
  and replace `import { CodeHideIcon, CodeShowIcon } from "../ui/ControlIcons";` with `import { CodeHideIcon, CodeShowIcon } from "./EditorIcons";`
- `apps/playground/src/app/EditorPanel.test.tsx`: replace `import { Diagnostic } from "../domain/cellModel";` with `import { Diagnostic } from "@kanushka/cell-diagram-react";`

Then confirm nothing else still points at moved lib paths:

Run: `grep -rn "\.\./\(domain\|parser\|compiler\|renderer\|ui\)/" apps/playground/src || echo CLEAN`
Expected: `CLEAN`.

- [ ] **Step 5: Write the app Vite config `apps/playground/vite.config.ts`**

The dev alias points the package name at the library source so `npm run dev` gives HMR without a prior lib build; production `build` resolves the real package.

```ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve:
    command === "serve"
      ? {
          alias: {
            "@kanushka/cell-diagram-react": resolve(
              __dirname,
              "../../packages/cell-diagram-react/src/index.ts"
            )
          }
        }
      : undefined,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    alias: {
      "@kanushka/cell-diagram-react": resolve(
        __dirname,
        "../../packages/cell-diagram-react/src/index.ts"
      )
    }
  }
}));
```

> The `test.alias` makes Vitest run app tests against library source (no build needed in CI test step).

- [ ] **Step 6: Repoint Firebase hosting**

In `firebase.json`, set `"public": "apps/playground/dist"` and change `"predeploy"` to `["npm run build:app"]`.

- [ ] **Step 7: Build the library once so the app can resolve the package for a production build check**

Run: `npm run build:lib`
Expected: emits `packages/cell-diagram-react/dist/index.js` and `index.d.ts`.

- [ ] **Step 8: Run the app test suite and typecheck**

Run: `npm test -w @cell-architect/playground`
Expected: all app tests PASS.

Run: `npm run typecheck -w @cell-architect/playground`
Expected: no errors.

- [ ] **Step 9: Run the whole workspace suite + lint**

Run: `npm test` then `npm run lint`
Expected: both PASS across both workspaces.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: move workbench into playground app consuming the library"
```

---

## Task 4: Extract diagram CSS into the library

Splits `styles.css` so the library ships only diagram/renderer styles as `dist/style.css`, while the app keeps its shell chrome.

**Files:**
- Create: `packages/cell-diagram-react/src/renderer/diagram.css`
- Modify: `packages/cell-diagram-react/src/renderer/DiagramCanvas.tsx` (import diagram.css)
- Modify: `apps/playground/src/app/styles.css` (remove diagram rules) and `apps/playground/src/app/App.tsx` (import library style.css)

**Interfaces:**
- Produces: `@kanushka/cell-diagram-react/style.css` (built from `diagram.css` + `@xyflow/react` styles via the `cssCodeSplit:false` lib build).

- [ ] **Step 1: Move diagram rules into `diagram.css`**

Create `packages/cell-diagram-react/src/renderer/diagram.css` and move into it every rule whose selector targets the diagram surface. Ownership rule — a selector belongs to the library if it matches any of these prefixes/classes:

```
.react-flow, .cell-boundary, .cell-boundary__*, .cell-gate-label, .component-node,
.external-node, .gateway-node, .zoom-controls, .zoom-controls__*, .export-controls,
.export-controls__*, .edge-label, .focus-hint, .empty-canvas, .connection-highlight-node,
.connection-dimmed-node, .connection-highlight-edge, .connection-dimmed-edge
```

Everything else (`.app-shell`, `.editor-panel*`, `.diagrams-panel*`, `.share-button*`, `.help-panel*`, `.guide-*`, `.overlay*`, `.mobile-tab-bar`, `.tooltip-*`, `.pill-button`, `.icon-button`, layout CSS variables used only by the shell) stays in the app's `styles.css`. Move any CSS custom properties (`--…`) that the diagram rules reference into `diagram.css` as well (e.g. `--zoom-controls-height` if a diagram rule uses it); duplicate a variable into both files if both sides need it.

- [ ] **Step 2: Import `diagram.css` from the renderer**

At the top of `packages/cell-diagram-react/src/renderer/DiagramCanvas.tsx`, below the existing `import "@xyflow/react/dist/style.css";`, add:

```ts
import "./diagram.css";
```

This makes the diagram styles part of the library bundle so the built `dist/style.css` (with `cssCodeSplit:false`) contains both React Flow's CSS and the diagram rules.

- [ ] **Step 3: Import the library CSS in the app**

In `apps/playground/src/app/App.tsx`, the existing `import "./styles.css";` now only carries shell styles. Add above it:

```ts
import "@kanushka/cell-diagram-react/style.css";
```

For dev-mode resolution of this CSS subpath through the alias, add the CSS entry to the app Vite `resolve.alias` (serve branch) and `test.alias` created in Task 3:

```ts
"@kanushka/cell-diagram-react/style.css": resolve(
  __dirname, "../../packages/cell-diagram-react/dist/style.css"
),
```

> The CSS subpath resolves to the built file; run `npm run build:lib` before `npm run dev` the first time. (Component code still hot-reloads via the src alias.)

- [ ] **Step 4: Rebuild the library and verify the CSS bundle**

Run: `npm run build:lib`
Expected: `packages/cell-diagram-react/dist/style.css` exists and contains both a `.react-flow` rule (from React Flow) and a `.cell-boundary` rule (from `diagram.css`):

Run: `grep -c "cell-boundary" packages/cell-diagram-react/dist/style.css`
Expected: a count ≥ 1.

- [ ] **Step 5: Verify the app still renders styled**

Run: `npm test` and `npm run lint`
Expected: PASS. (Diagram render tests assert structure, not pixels; a passing suite plus the CSS grep is the gate here.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: ship diagram styles from the library as style.css"
```

---

## Task 5: `CellDiagram` public component

Adds the thin, source-driven wrapper that is the library's headline export.

**Files:**
- Create: `packages/cell-diagram-react/src/renderer/CellDiagram.tsx`
- Create: `packages/cell-diagram-react/src/renderer/CellDiagram.test.tsx`
- Modify: `packages/cell-diagram-react/src/index.ts` (export `CellDiagram`, `CellDiagramProps`)

**Interfaces:**
- Consumes: `compileProject` (Task 2), `DiagramCanvas` + `DiagramCanvasProps` (existing), `ProjectModel`, `Diagnostic`.
- Produces: `CellDiagram` component and `CellDiagramProps` type.

- [ ] **Step 1: Write the failing test `CellDiagram.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { CellDiagram } from "./CellDiagram";

describe("CellDiagram", () => {
  it("renders a component node from DSL source", () => {
    render(<CellDiagram source={"component api service\nnorth -> api"} />);
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("reports diagnostics for invalid source and renders the empty state", () => {
    const onDiagnostics = vi.fn();
    render(<CellDiagram source={"api -> north"} onDiagnostics={onDiagnostics} />);
    expect(onDiagnostics).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ severity: "error" })])
    );
    expect(screen.getByText(/Fix the DSL errors/i)).toBeInTheDocument();
  });

  it("renders a directly-provided model without a source", () => {
    render(<CellDiagram model={{ cells: [{ id: "c", components: [{ id: "api" }], externals: [], edges: [] }], crossEdges: [], sharedExternals: [] }} />);
    expect(screen.getByText("api")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -w @kanushka/cell-diagram-react -- src/renderer/CellDiagram.test.tsx`
Expected: FAIL — `Cannot find module './CellDiagram'`.

- [ ] **Step 3: Implement `CellDiagram.tsx`**

```tsx
import { useEffect, useMemo, type CSSProperties } from "react";
import { compileProject } from "../compiler/compileProject";
import type { Diagnostic, ProjectModel } from "../domain/cellModel";
import { DiagramCanvas } from "./DiagramCanvas";

export interface CellDiagramProps {
  /** Cell DSL source text; compiled internally. */
  source?: string;
  /** Pre-compiled model; used when `source` is not provided. */
  model?: ProjectModel;
  className?: string;
  style?: CSSProperties;
  /** Called with parse/compile diagnostics whenever `source` changes. */
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
}

export function CellDiagram({ source, model, className, style, onDiagnostics }: CellDiagramProps) {
  const compiled = useMemo(
    () => (source !== undefined ? compileProject(source) : null),
    [source]
  );

  useEffect(() => {
    if (compiled) {
      onDiagnostics?.(compiled.diagnostics);
    }
  }, [compiled, onDiagnostics]);

  const resolvedModel = source !== undefined ? compiled?.model ?? null : model ?? null;

  return (
    <div className={className} style={{ width: "100%", height: "100%", ...style }}>
      <DiagramCanvas model={resolvedModel} />
    </div>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm test -w @kanushka/cell-diagram-react -- src/renderer/CellDiagram.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Export from the public entry**

In `packages/cell-diagram-react/src/index.ts` add:

```ts
export { CellDiagram } from "./renderer/CellDiagram";
export type { CellDiagramProps } from "./renderer/CellDiagram";
```

- [ ] **Step 6: Full library suite + typecheck**

Run: `npm test -w @kanushka/cell-diagram-react` then `npm run typecheck -w @kanushka/cell-diagram-react`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add CellDiagram public component"
```

---

## Task 6: Verify the published package shape

Confirms the built package exposes the right files and entry points before wiring release automation.

**Files:**
- None created; this task is a build + inspection gate.

- [ ] **Step 1: Clean build the library**

Run: `rm -rf packages/cell-diagram-react/dist && npm run build:lib`
Expected: `dist/` contains `index.js`, `index.d.ts`, `style.css`.

- [ ] **Step 2: Inspect the packed tarball contents**

Run: `npm pack --dry-run -w @kanushka/cell-diagram-react`
Expected: the file list includes `dist/index.js`, `dist/index.d.ts`, `dist/style.css`, and `package.json` — and does **not** include `src/` or test files.

- [ ] **Step 3: Verify the type entry resolves the public API**

Run: `grep -E "CellDiagram|wso2ToDsl|compileProject" packages/cell-diagram-react/dist/index.d.ts | head`
Expected: `CellDiagram` and `compileProject` appear. (`wso2ToDsl` is added in Task 8; re-run after that task.)

- [ ] **Step 4: Verify React is externalized (not bundled)**

Run: `grep -c "createContext\|react-dom" packages/cell-diagram-react/dist/index.js || true`
Expected: React internals are not inlined — the bundle imports from `"react"`/`"react-dom"`. Confirm with:
Run: `grep -E "from\"react\"|from ?\"react-dom\"|require\(\"react" packages/cell-diagram-react/dist/index.js | head`
Expected: at least one external `react` import present.

- [ ] **Step 5: Commit (no-op safeguard)**

If the build produced tracked changes (it should not — `dist/` is gitignored), do nothing. Otherwise:

```bash
git status --short
```
Expected: clean. No commit needed for this gate.

---

## Task 7: WSO2 input types and converter scaffolding (TDD start)

Introduces the converter module with its input types and the first behavior — component + exposure emission — under test.

**Files:**
- Create: `packages/cell-diagram-react/src/converter/wso2Model.ts`
- Create: `packages/cell-diagram-react/src/converter/wso2ToDsl.ts`
- Create: `packages/cell-diagram-react/src/converter/wso2ToDsl.test.ts`

**Interfaces:**
- Produces: `Wso2CellModel`, `Wso2Component`, `Wso2Service`, `Wso2Gateway`, `Wso2Connection`, `Wso2ConvertOptions` (types) and `wso2ToDsl(model: Wso2CellModel, options?: Wso2ConvertOptions): string`.

- [ ] **Step 1: Write the WSO2 input types `wso2Model.ts`**

```ts
export interface Wso2Gateway {
  isExposed?: boolean;
  tooltip?: string;
  observations?: unknown[];
}

export interface Wso2Service {
  id: string;
  label?: string;
  type?: string;
  dependencyIds?: string[];
  deploymentMetadata?: {
    gateways?: { internet?: Wso2Gateway; intranet?: Wso2Gateway };
  };
}

export interface Wso2Connection {
  id: string;
  label?: string;
  type?: string;
  onPlatform?: boolean;
  observationOnly?: boolean;
  observations?: unknown[];
}

export interface Wso2Component {
  id: string;
  label?: string;
  version?: string;
  type?: string;
  services?: Record<string, Wso2Service>;
  connections?: Wso2Connection[];
}

export interface Wso2CellModel {
  id: string;
  name?: string;
  components?: Wso2Component[];
  modelVersion?: string;
}

export interface Wso2ConvertOptions {
  /** Emit a top-level `title <name>` line from the model name. Default false. */
  title?: boolean;
}
```

- [ ] **Step 2: Write the failing test (components + exposures) in `wso2ToDsl.test.ts`**

```ts
import { compileProject } from "../compiler/compileProject";
import type { Wso2CellModel } from "./wso2Model";
import { wso2ToDsl } from "./wso2ToDsl";

function svc(id: string, internet: boolean, intranet: boolean) {
  return {
    [id]: {
      id,
      type: "http",
      deploymentMetadata: {
        gateways: {
          internet: { isExposed: internet },
          intranet: { isExposed: intranet }
        }
      }
    }
  };
}

describe("wso2ToDsl — components and exposures", () => {
  it("emits a component per entry and north/west exposures from gateways", () => {
    const model: Wso2CellModel = {
      id: "A",
      name: "A",
      components: [
        { id: "Users", type: "service", services: svc("A:A:Users:get", true, true), connections: [] },
        { id: "Products", type: "service", services: svc("A:A:Products:get", false, false), connections: [] },
        { id: "Invoices", type: "service", services: svc("A:A:Invoices:get", false, true), connections: [] }
      ]
    };
    const dsl = wso2ToDsl(model);
    expect(dsl).toContain("component Users api");
    expect(dsl).toContain("component Products api");
    expect(dsl).toContain("component Invoices api");
    expect(dsl).toContain("north -> Users");
    expect(dsl).toContain("west -> Users");
    expect(dsl).toContain("west -> Invoices");
    expect(dsl).not.toContain("north -> Products");
    // Must be valid DSL:
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm test -w @kanushka/cell-diagram-react -- src/converter/wso2ToDsl.test.ts`
Expected: FAIL — `Cannot find module './wso2ToDsl'`.

- [ ] **Step 4: Implement the minimal converter `wso2ToDsl.ts`**

```ts
import type { Wso2CellModel, Wso2Component, Wso2ConvertOptions } from "./wso2Model";

function mapComponentType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  if (type === "service") return "api";
  return type;
}

function isExposed(component: Wso2Component, gateway: "internet" | "intranet"): boolean {
  const services = component.services ?? {};
  return Object.values(services).some(
    (service) => service.deploymentMetadata?.gateways?.[gateway]?.isExposed === true
  );
}

export function wso2ToDsl(model: Wso2CellModel, options: Wso2ConvertOptions = {}): string {
  const components = model.components ?? [];
  const lines: string[] = [];

  if (options.title && model.name) {
    lines.push(`title ${model.name}`, "");
  }

  for (const component of components) {
    const type = mapComponentType(component.type);
    lines.push(`component ${component.id}${type ? ` ${type}` : ""}`);
  }

  const north: string[] = [];
  const west: string[] = [];
  for (const component of components) {
    if (isExposed(component, "internet")) north.push(component.id);
    if (isExposed(component, "intranet")) west.push(component.id);
  }

  if (north.length || west.length) {
    lines.push("");
    for (const id of north) lines.push(`north -> ${id}`);
    for (const id of west) lines.push(`west -> ${id}`);
  }

  return lines.join("\n") + "\n";
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm test -w @kanushka/cell-diagram-react -- src/converter/wso2ToDsl.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: convert WSO2 components and gateway exposures to DSL"
```

---

## Task 8: Connection classification, externals, aliases, and public export

Completes the converter: internal vs east vs south classification, external dedup, deterministic alias generation, and the emitted edge/declaration sections. Exports `wso2ToDsl` from the package entry.

**Files:**
- Modify: `packages/cell-diagram-react/src/converter/wso2ToDsl.ts`
- Modify: `packages/cell-diagram-react/src/converter/wso2ToDsl.test.ts` (add cases)
- Modify: `packages/cell-diagram-react/src/index.ts` (export converter)

**Interfaces:**
- Consumes: everything from Task 7.
- Produces: the full `wso2ToDsl` behavior and the `wso2ToDsl` + WSO2 types re-exported from `src/index.ts`.

- [ ] **Step 1: Add failing tests for connection rules**

Append to `wso2ToDsl.test.ts`:

```ts
import type { Wso2Component } from "./wso2Model";

function comp(id: string, connections: Wso2Component["connections"]): Wso2Component {
  return { id, type: "service", services: {}, connections };
}

describe("wso2ToDsl — connections", () => {
  it("same-project 4-part id becomes an internal edge to the component", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Users", [{ id: "ABC:A:Products:basepath", onPlatform: true }]), comp("Products", [])]
    });
    expect(dsl).toContain("Users -> Products");
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("different-project 4-part id becomes an east external and edge", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Invoices", [{ id: "ABC:B:Invoices:post", label: "Org Invoices", type: "http", onPlatform: true }])]
    });
    expect(dsl).toContain('east oi as "Org Invoices" api');
    expect(dsl).toContain("Invoices -> oi");
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("URI/datastore connection becomes a south external", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Users", [{ id: "googleapps://firebase", label: "Firebase", type: "datastore", onPlatform: false }])]
    });
    expect(dsl).toContain("south Firebase database");
    expect(dsl).toContain("Users -> Firebase");
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("drops observationOnly connections entirely", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Products", [{ id: "ABC:B:Users:get", label: "Org Users", onPlatform: true, observationOnly: true }])]
    });
    expect(dsl).not.toContain("Org Users");
    expect(dsl).not.toContain("-> ou");
  });

  it("dedupes a shared external id across components into one declaration with merged label", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [
        comp("Products", [{ id: "mysql://mysql", onPlatform: true, type: "datastore" }]),
        comp("Invoices", [{ id: "mysql://mysql", label: "MySQL DB", onPlatform: false, type: "datastore" }])
      ]
    });
    const southDeclCount = dsl.split("\n").filter((l) => l.startsWith("south ") && l.includes("MySQL DB")).length;
    expect(southDeclCount).toBe(1);
    expect(dsl).toMatch(/Products -> \w+/);
    expect(dsl).toMatch(/Invoices -> \w+/);
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("derives an id from an unlabeled URI connection", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Products", [{ id: "mysql://mysql", onPlatform: true, type: "datastore" }])]
    });
    expect(dsl).toContain("south mysql database");
    expect(dsl).toContain("Products -> mysql");
  });
});

describe("wso2ToDsl — reference model", () => {
  it("produces valid DSL that compiles without diagnostics", () => {
    // Paste the reference JSON from the design spec as REFERENCE_MODEL:
    const dsl = wso2ToDsl(REFERENCE_MODEL);
    const result = compileProject(dsl);
    expect(result.diagnostics).toEqual([]);
    expect(result.model).not.toBeNull();
    // Transactions is isolated (its only connection was observationOnly):
    expect(dsl).toContain("component Transactions api");
    expect(dsl).not.toMatch(/Transactions ->/);
    // Snapshot the text for regression:
    expect(dsl).toMatchSnapshot();
  });
});
```

Store the reference model as a JSON fixture and import it. Create
`packages/cell-diagram-react/src/converter/__fixtures__/wso2-sample.json` containing the exact WSO2
JSON object the user provided (the `{ "id": "A", … "modelVersion": "0.4.0" }` document, verbatim),
and add this import at the top of the test file (`resolveJsonModule` is enabled in the base
tsconfig):

```ts
import sample from "./__fixtures__/wso2-sample.json";
const REFERENCE_MODEL = sample as unknown as Wso2CellModel;
```

- [ ] **Step 2: Run and watch the new cases fail**

Run: `npm test -w @kanushka/cell-diagram-react -- src/converter/wso2ToDsl.test.ts`
Expected: FAIL — connection edges/externals not yet emitted.

- [ ] **Step 3: Extend `wso2ToDsl.ts` with classification, dedup, and aliases**

Replace the file with the full implementation:

```ts
import type {
  Wso2CellModel,
  Wso2Component,
  Wso2Connection,
  Wso2ConvertOptions
} from "./wso2Model";

function mapComponentType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  if (type === "service") return "api";
  return type;
}

function isExposed(component: Wso2Component, gateway: "internet" | "intranet"): boolean {
  const services = component.services ?? {};
  return Object.values(services).some(
    (service) => service.deploymentMetadata?.gateways?.[gateway]?.isExposed === true
  );
}

const COMPONENT_REF = /^[^:\s]+:[^:\s]+:[^:\s]+:[^:\s]+$/;
const SIMPLE_ID = /^[A-Za-z0-9_-]+$/;

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function lastSegment(id: string): string {
  const afterScheme = id.includes("://") ? id.slice(id.indexOf("://") + 3) : id;
  const parts = afterScheme.split(/[/:]+/).filter(Boolean);
  return slug(parts[parts.length - 1] ?? afterScheme);
}

/** Decide the DSL id and whether an `as "label"` alias is needed. */
function baseAlias(label: string | undefined, rawId: string): { id: string; withAlias: boolean; label?: string } {
  if (label && label.trim()) {
    const words = label.trim().split(/\s+/);
    if (words.length > 1) {
      const initials = words.map((w) => w[0]?.toLowerCase() ?? "").join("");
      return { id: initials || slug(label), withAlias: true, label: label.trim() };
    }
    const single = words[0];
    return SIMPLE_ID.test(single)
      ? { id: single, withAlias: false }
      : { id: slug(single), withAlias: false };
  }
  return { id: lastSegment(rawId), withAlias: false };
}

type Direction = "east" | "south";

interface ExternalDecl {
  id: string;             // resolved unique DSL id
  direction: Direction;
  label?: string;         // only when an alias is needed
  type?: string;
}

export function wso2ToDsl(model: Wso2CellModel, options: Wso2ConvertOptions = {}): string {
  const components = model.components ?? [];
  const project = model.id;
  const componentIds = new Set(components.map((c) => c.id));

  const north: string[] = [];
  const west: string[] = [];
  for (const component of components) {
    if (isExposed(component, "internet")) north.push(component.id);
    if (isExposed(component, "intranet")) west.push(component.id);
  }

  // First pass: resolve each external connection id to a stable DSL id, dedup, merge label/type.
  const externalsByRawId = new Map<string, ExternalDecl>();
  const usedIds = new Set<string>(componentIds);

  function ensureUnique(candidate: string): string {
    let id = candidate || "ext";
    let n = 2;
    while (usedIds.has(id)) id = `${candidate}${n++}`;
    usedIds.add(id);
    return id;
  }

  interface Edge { source: string; target: string; }
  const edges: Edge[] = [];
  const seenEdges = new Set<string>();
  function addEdge(source: string, target: string) {
    const key = `${source} ${target}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      edges.push({ source, target });
    }
  }

  function registerExternal(raw: string, direction: Direction, label: string | undefined, type: string | undefined): string {
    const existing = externalsByRawId.get(raw);
    if (existing) {
      if (!existing.label && label) {
        const rebuilt = baseAlias(label, raw);
        if (rebuilt.withAlias) { existing.label = rebuilt.label; }
      }
      if (!existing.type && type) existing.type = type;
      return existing.id;
    }
    const base = baseAlias(label, raw);
    const decl: ExternalDecl = {
      id: ensureUnique(base.id),
      direction,
      label: base.withAlias ? base.label : undefined,
      type
    };
    externalsByRawId.set(raw, decl);
    return decl.id;
  }

  for (const component of components) {
    for (const connection of component.connections ?? []) {
      if (connection.observationOnly === true) continue;

      if (COMPONENT_REF.test(connection.id)) {
        const parts = connection.id.split(":");
        const connProject = parts[1];
        const targetComponent = parts[2];
        if (connProject === project) {
          addEdge(component.id, targetComponent); // internal
        } else {
          const id = registerExternal(connection.id, "east", connection.label, "api");
          addEdge(component.id, id);
        }
      } else {
        const type = connection.type === "datastore" ? "database" : connection.type;
        const id = registerExternal(connection.id, "south", connection.label, type);
        addEdge(component.id, id);
      }
    }
  }

  // Emit in stable order: components, east decls, south decls, exposures, edges.
  const lines: string[] = [];
  if (options.title && model.name) lines.push(`title ${model.name}`, "");

  for (const component of components) {
    const type = mapComponentType(component.type);
    lines.push(`component ${component.id}${type ? ` ${type}` : ""}`);
  }

  const decls = Array.from(externalsByRawId.values());
  const emitDecl = (d: ExternalDecl) => {
    const alias = d.label ? ` as "${d.label}"` : "";
    const type = d.type ? ` ${d.type}` : "";
    return `${d.direction} ${d.id}${alias}${type}`;
  };
  const eastDecls = decls.filter((d) => d.direction === "east");
  const southDecls = decls.filter((d) => d.direction === "south");
  if (eastDecls.length) { lines.push(""); eastDecls.forEach((d) => lines.push(emitDecl(d))); }
  if (southDecls.length) { lines.push(""); southDecls.forEach((d) => lines.push(emitDecl(d))); }

  if (north.length || west.length) {
    lines.push("");
    north.forEach((id) => lines.push(`north -> ${id}`));
    west.forEach((id) => lines.push(`west -> ${id}`));
  }

  if (edges.length) {
    lines.push("");
    edges.forEach((e) => lines.push(`${e.source} -> ${e.target}`));
  }

  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run and watch all converter tests pass**

Run: `npm test -w @kanushka/cell-diagram-react -- src/converter/wso2ToDsl.test.ts`
Expected: PASS, including the reference-model compile-clean assertion and a written snapshot. Review the printed snapshot: it should list all four components, `east` (Org Invoices), two `south` externals (Firebase + MySQL), `north/west` exposures, and edges — with no `Transactions ->` line and nothing from the `observationOnly` connections.

- [ ] **Step 5: Export the converter from the package entry**

In `packages/cell-diagram-react/src/index.ts` add:

```ts
export { wso2ToDsl } from "./converter/wso2ToDsl";
export type {
  Wso2CellModel,
  Wso2Component,
  Wso2Service,
  Wso2Gateway,
  Wso2Connection,
  Wso2ConvertOptions
} from "./converter/wso2Model";
```

- [ ] **Step 6: Full suite, typecheck, lint, build**

Run: `npm test` , `npm run typecheck -w @kanushka/cell-diagram-react` , `npm run lint` , `npm run build:lib`
Expected: all PASS; `dist/index.d.ts` now contains `wso2ToDsl` (re-run Task 6 Step 3 grep to confirm).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: convert WSO2 connections to internal, east, and south dependencies"
```

---

## Task 9: CI workflow

Adds continuous integration across the workspace.

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck -w @kanushka/cell-diagram-react
      - run: npm run typecheck -w @cell-architect/playground
      - run: npm test
      - run: npm run build:lib
```

- [ ] **Step 2: Validate the workflow locally as far as possible**

Run: `npm ci && npm run lint && npm run typecheck -w @kanushka/cell-diagram-react && npm run typecheck -w @cell-architect/playground && npm test && npm run build:lib`
Expected: the exact CI command chain passes end-to-end.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add workspace lint, typecheck, test, and library build"
```

---

## Task 10: Release workflow and publish docs

Adds tag-triggered npm publishing for the library and documents the release + consumer usage.

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `packages/cell-diagram-react/README.md`
- Modify: root `README.md` (document monorepo layout + release steps)

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          registry-url: "https://registry.npmjs.org"
      - run: npm ci
      - run: npm test
      - run: npm run build:lib
      - run: npm publish -w @kanushka/cell-diagram-react --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Write the library README `packages/cell-diagram-react/README.md`**

```markdown
# @kanushka/cell-diagram-react

React component + DSL for cell architecture diagrams, with a WSO2 cell-diagram converter.

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
```

- [ ] **Step 3: Update the root README**

Replace the "Getting Started" and "Project Structure" sections to describe the monorepo: `npm install` at root, `npm run dev` (playground), `npm run build:lib` (library), `npm test`, and the release flow: bump `packages/cell-diagram-react/package.json` version, tag `vX.Y.Z`, push the tag → `release.yml` publishes. Note the `NPM_TOKEN` repository secret requirement and that the `@kanushka` scope must exist.

- [ ] **Step 4: Sanity-check the release workflow inputs**

Confirm the version to publish is read from the library manifest:
Run: `node -p "require('./packages/cell-diagram-react/package.json').version"`
Expected: `0.1.0`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml packages/cell-diagram-react/README.md README.md
git commit -m "ci: add tag-based npm release and publish docs"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** monorepo structure (Tasks 1–3), library packaging + CSS + component (Tasks 2,4,5,6), converter with all rules (Tasks 7–8), CI + release (Tasks 9–10). Every spec section maps to a task.
- **Verify early:** `DiagramCanvas` was confirmed self-contained (takes `ProjectModel | null`, owns its `ReactFlowProvider`). If Task 5's render test surfaces a hidden app-state coupling, stop and reduce the wrapper before proceeding.
- **Alias reminder:** the reference model yields `md` (from "MySQL DB") and `oi` (from "Org Invoices"), not the hand-written `mdb`/`oi`. That is expected under the semantic-equivalence decision — the compile-clean assertion, not text equality, is the gate.
- **Type consistency:** `wso2ToDsl(model, options?)`, `CellDiagramProps.source`/`.model`/`.onDiagnostics`, and the `@kanushka/cell-diagram-react` import specifier are used identically everywhere they appear.
