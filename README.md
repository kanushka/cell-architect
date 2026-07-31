<img src="apps/playground/public/logo.svg" alt="Cell Architect logo" width="48" height="48" />

# Cell Architect

[![CI](https://github.com/kanushka/cell-architect/actions/workflows/ci.yml/badge.svg)](https://github.com/kanushka/cell-architect/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@kanushka/cell-diagram-react.svg)](https://www.npmjs.com/package/@kanushka/cell-diagram-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Draw cell architecture diagrams from a small text DSL — in the browser, from your coding agent, or
inside your own React app.

## What is cell-based architecture?

A **cell** is a collection of components grouped together from design through to deployment: an
independently deployable, manageable and observable unit that owns one piece of business
functionality, and is owned by one team. What makes it a cell rather than a folder is the
**boundary** — everything entering or leaving passes through a gateway, so the cell's dependencies
are explicit rather than incidental.

That is what this notation draws. Components live inside the cell; anything the cell doesn't own
sits on one of its four boundary sides, and which side says what it is:

| Side | Meaning |
| --- | --- |
| `north` | Inbound from the public internet |
| `west` | Inbound from the intranet / corporate network |
| `east` | Outbound to another team's service on your own platform |
| `south` | Outbound to a third-party SaaS or vendor |

The model comes from WSO2's
[cell-based reference architecture](https://github.com/wso2/reference-architecture/blob/master/reference-architecture-cell-based.md),
which is worth reading if you want the full rationale on cell granularity, ownership and versioning.

## Playground

**[Try it live at cell-architect.web.app](https://cell-architect.web.app/)** — no account, no
install, nothing leaves your browser.

![Cell Architect workbench: the Cell DSL source on the left, the generated cell diagram on the right](docs/assets/screenshot.png)

It works like a split editor: write notation on the left, inspect the generated diagram on the
right, and keep diagrams saved in the browser's local storage.

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

**Features**

- Text DSL for cell diagrams, single-cell or multi-cell projects
- Split editor and diagram canvas, plus a fullscreen diagram mode
- Light and dark diagram themes, with every color exposed as a CSS custom property for rebranding
- Local browser storage for diagrams
- Import and export `.cell` files
- Share a diagram as a self-contained link (the DSL is compressed into the URL, not uploaded)
- Internal, inbound, outbound, and gateway exposure dependencies
- Gateway circles on active cell boundaries
- Click a component to focus its connected links
- Temporary drag-to-arrange with Auto arrange reset
- Portable manual positions in exported `.cell` files and share links
- Convert a WSO2 cell-diagram model into Cell DSL

## Agent skill

Describe your system to a coding agent in plain English and get a `.cell` document back.

### Install

```bash
npx skills add kanushka/cell-architect --skill cell-diagram
```

Works with Claude Code, Codex, opencode and anything else
[`npx skills`](https://github.com/vercel-labs/skills) supports. Add `-a <agent>` to target one
agent, `-g` to install globally instead of per-project, or `--list` to see what this repo ships.

The skill is **self-contained** — it carries the grammar, so it works in a project that has nothing
else from Cell Architect installed.

### Use

Just describe the system. No DSL vocabulary needed:

> We have a React app customers use, an Orders API behind it, and an Order Service that owns a
> Postgres database and charges cards through Stripe. Draw this as a cell diagram.

```cell
component webApp as "Customer Web" webapp
component ordersApi as "Orders API" api
component orderService as "Order Service" service
component odb as "Order Store" database

north -> webApp

webApp -> ordersApi
ordersApi -> orderService
orderService -> odb
orderService -> south Stripe : charge card
```

Paste the result into the [playground](https://cell-architect.web.app), or save it as a `.cell` file
and open it there. The skill also handles editing an existing document, so "add a Redis cache the
Order Service reads from" works on a file you already have.

What it adds beyond the syntax is **placement** — the judgment the notation encodes:

- Services, UIs and the cell's own datastore go **inside** the cell; it is the project boundary
- The four boundary sides mean what the table above says, and the compiler enforces their direction
- A counterpart the brief names only by category ("an object store", "any client") gets a gateway
  exposure, not an invented node
- Cyclic cell dependencies use a decoupled cross-cell link so the diagram stays readable

## React library

The renderer is published as
[`@kanushka/cell-diagram-react`](https://www.npmjs.com/package/@kanushka/cell-diagram-react), so you
can drop a cell diagram into your own app:

```bash
npm install @kanushka/cell-diagram-react
```

```tsx
import { CellDiagram } from "@kanushka/cell-diagram-react";
import "@kanushka/cell-diagram-react/style.css";

<CellDiagram source={source} />;
```

Full install, usage, theming and token reference:
[`packages/cell-diagram-react/README.md`](packages/cell-diagram-react/README.md).

## Storage and privacy

Cell Architect has no backend. There is no account, no telemetry, and no diagram data ever leaves your machine:

- Diagrams live in the current browser's local storage, up to 10 at a time.
- Share links carry the compressed DSL in the URL fragment (`#s=…`), which browsers never send to a server.
- Export important diagrams as `.cell` files before clearing browser data or switching machines.

Opening a share link always asks before saving anything, and shows you the diagram source
first — following a link is not consent to have a diagram added to your library. Diagrams
are capped at 1000 nodes so that an oversized source cannot lock up the browser.

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

skills/cell-diagram           Agent skill, installable with `npx skills add`
evals/cell-diagram            Briefs, recorded agent runs, and the scorer for that skill

docs                          DSL guide, requirements, and design history
  dsl-guide.md                Full notation reference
  requirements.md             What the project is and is not trying to be
  superpowers/                Design specs and implementation plans, kept as a record
.github/workflows             CI and release workflows
```

Every feature was designed before it was built, and those write-ups are kept in
[`docs/superpowers`](docs/superpowers/README.md). They explain why things are the way they
are, which is worth reading before proposing a change. They are historical records, though —
where a document and the code disagree, the code is correct.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, the
checks CI runs, how changes are reviewed, and the release process. By taking part you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

Changing the agent skill? [`evals/cell-diagram`](evals/cell-diagram/README.md) scores it against
prose architecture briefs — read it before editing `skills/cell-diagram`.

Release history is in [CHANGELOG.md](CHANGELOG.md).

## Security

To report a vulnerability, please follow the private process in [SECURITY.md](SECURITY.md) rather than opening a public issue.

## License

[MIT](LICENSE) &copy; Kanushka Gayan
