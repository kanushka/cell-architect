# Contributing to Cell Architect

Thanks for taking an interest. Bug reports, DSL suggestions, and pull requests are all
welcome.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). To report a
security vulnerability, use the private process in [SECURITY.md](SECURITY.md) instead of an
issue or pull request.

## Before you start

For anything larger than a bug fix or a docs change, please open an issue first so we can
agree on the approach. Cell Architect deliberately keeps a small surface area — a focused
DSL, no backend, no accounts — and it is easier to discuss scope before code exists than
after.

## Repository layout

This is an npm workspaces monorepo:

```text
packages/cell-diagram-react   The publishable library (@kanushka/cell-diagram-react)
apps/playground               The workbench app hosted at cell-architect.web.app
docs                          DSL guide, requirements, and design specs
```

The playground consumes the library. During `npm run dev` the app resolves
`@kanushka/cell-diagram-react` straight to `packages/cell-diagram-react/src` via a Vite
alias, so library edits hot-reload without a rebuild.

## Development setup

Requires **Node.js 20 or newer** (CI runs Node 20).

```bash
npm install        # installs every workspace from the repo root
npm run dev        # playground dev server at http://127.0.0.1:5173/
```

Other useful commands, all run from the repo root:

```bash
npm test           # vitest across all workspaces
npm run lint       # eslint
npm run build:lib  # build the library only
npm run build      # build the library, then the playground app
```

To typecheck the way CI does — note the library must be built first, because the
playground resolves its types from `dist`:

```bash
npm run build:lib
npm run typecheck -w @kanushka/cell-diagram-react
npm run typecheck -w @cell-architect/playground
```

## What CI checks

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request:
`npm ci`, `npm run lint`, `npm run build:lib`, both typechecks, then `npm test`. Please make
sure all of it passes locally before opening a pull request.

## Making a change

1. Branch off `main`.
2. Write a test. The project is test-driven and the suite is fast — new behavior should come
   with coverage, and bug fixes should come with a test that fails before your fix.
3. Keep the change focused. Unrelated refactors make review harder; send them separately.
4. Match the surrounding style. ESLint and TypeScript `strict` are enforced; there is no
   separate formatter, so follow the conventions of the file you are editing.
5. Update the docs when behavior changes — most importantly
   [`docs/dsl-guide.md`](docs/dsl-guide.md) for anything touching the notation.
6. Add an entry under `Unreleased` in [CHANGELOG.md](CHANGELOG.md) for anything a user or a
   library consumer would notice. Internal refactors and test-only changes do not need one.

### Changing the DSL

The DSL is the project's public contract, and existing `.cell` files and share links must
keep working. New notation should be additive, and a change that would break previously
valid sources needs a strong justification in the issue thread first. Parser changes belong
in `packages/cell-diagram-react/src/parser`, with validation in `src/compiler`.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) — the existing history
uses `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, and `test:`, with an optional scope:

```text
feat(parser): allow quoted labels on cross-cell edges
fix(renderer): keep gateway circles on the boundary when dragging
docs: document the share link size limit
```

## Pull requests

Describe what changed and why, link the issue it addresses, and include a before/after
screenshot for anything that alters the diagram or the UI. Keep the pull request in draft
until CI is green.

## Releasing

Maintainers only. The library publishes to npm from a tag-triggered workflow:

1. Move the `Unreleased` entries in [CHANGELOG.md](CHANGELOG.md) under the new version
   heading, and update the comparison links at the bottom of the file.
2. Bump `version` in `packages/cell-diagram-react/package.json`.
3. Commit both, then tag the commit `vX.Y.Z`, matching the new version exactly, and push
   the tag.

[`release.yml`](.github/workflows/release.yml) verifies the tag matches the package version,
then publishes with npm provenance.
