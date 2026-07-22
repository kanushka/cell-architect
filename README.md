<img src="public/logo.svg" alt="Cell Architect logo" width="48" height="48" />

# Cell Architect

Cell Architect is a browser-based workbench for drawing cell architecture diagrams from a small text DSL. It works like a split editor: write notation on the left, inspect the generated diagram on the right, and keep diagrams saved in the browser's local storage.

## Features

- Text DSL for cell diagrams
- Split editor and diagram canvas
- Fullscreen diagram mode
- Local browser storage for diagrams
- Import and export `.cell` files
- Internal, inbound, outbound, and gateway exposure dependencies
- Gateway circles on active cell boundaries
- Click a component to focus its connected links
- Temporary drag-to-arrange with Auto arrange reset
- Portable manual positions in exported `.cell` files and share links

## Getting Started

This is a monorepo: the `@kanushka/cell-diagram-react` library lives in `packages/`, and the playground app that showcases it lives in `apps/`.

Install dependencies (installs all workspaces from the repo root):

```bash
npm install
```

Start the local playground dev server:

```bash
npm run dev
```

The app runs on:

```text
http://127.0.0.1:5173/
```

Build the library (`packages/cell-diagram-react`):

```bash
npm run build:lib
```

Build everything (library, then the playground app):

```bash
npm run build
```

Run tests across all workspaces:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

### Releasing the library

The library is published to npm as [`@kanushka/cell-diagram-react`](https://www.npmjs.com/package/@kanushka/cell-diagram-react) via a tag-triggered GitHub Actions workflow (`.github/workflows/release.yml`):

1. Bump the version in `packages/cell-diagram-react/package.json`.
2. Commit the version bump.
3. Tag the commit `vX.Y.Z` (matching the new version) and push the tag:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. The `Release` workflow runs `npm ci`, `npm test`, `npm run build:lib`, then `npm publish -w @kanushka/cell-diagram-react --access public`.

This requires an `NPM_TOKEN` repository secret with publish rights, and the `@kanushka` npm scope must already exist (or the token's account must be authorized to create it).

## DSL Example

```cell
component WebApp web-app
component orders as Orders api
component odb as OrderDB database
component ep as "Event Publisher" event

north ca as "Customer App" webapp
north pp as "Partner Portal" webapp
west ap as "Admin Portal" webapp
east inventories api
east customers api
south Stripe payment
south SendGrid email

ca -> WebApp : HTTPS
pp -> orders : REST
ap -> orders : backoffice

WebApp -> orders
orders -> odb
orders -> ep : order.created

orders -> inventories : reserve stock
orders -> customers : customer profile
orders -> Stripe : payment
orders -> SendGrid : email

north -> orders
```

For full notation details, see the [DSL guide](docs/dsl-guide.md).

## Storage

Diagrams are stored in the current browser only using local storage. Export important diagrams as `.cell` files before clearing browser data or switching machines.

## Project Structure

```text
packages/cell-diagram-react   Publishable library (@kanushka/cell-diagram-react)
  src/parser                  Cell DSL parser
  src/compiler                Parser-to-diagram model validation
  src/renderer                React Flow layout and diagram rendering
  src/converter               WSO2 cell-diagram converter
  src/domain                  Shared cell diagram model types
  src/ui                      CellDiagram component

apps/playground               Browser workbench app that showcases the library
  src/app                     React app shell, editor, and styles
  src/storage                 Local document repository and default sample
  src/share                   Diagram import/export and sharing

docs                          DSL guide and specs
.github/workflows             CI and release workflows
```

See `packages/cell-diagram-react/README.md` for library install and usage instructions.
