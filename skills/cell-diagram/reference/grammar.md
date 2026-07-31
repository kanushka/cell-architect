# Cell DSL — full grammar

Line-based. One statement per line. Blank lines ignored.

A comment is a **whole line** beginning with `#` or `//`. **Trailing comments are not supported and
fail silently** — `Courses -> Tasks # note` does not error, it creates a component whose id is
`Tasks # note` and points the edge at that instead of `Tasks`. Always put a comment on its own line.

**Statements are order-independent.** An id may be used before it is declared. Declare-then-use is
the readable convention, not a requirement.

**Ids** may contain letters, digits, `-` and `_`, and may start with a digit. Avoid `.` — it is the
cross-cell qualifier. **Types** are free-form strings rendered verbatim as a caption under the node;
there is no enum, no icon mapping, and no validation, so spelling is entirely up to you (`webapp`
and `web-app` are two different captions).

Duplicate edges (`a -> b` twice) and self edges (`a -> a`) are accepted and render as written.
Multiple edges into or out of one node are fine — a datastore may have many writers.

## Metadata

```cell
title OrderProject
version v1
```

Both optional.

- **Single-cell document** (no `cell { }` blocks): `title` and `version` render on the cell
  boundary. Omit both and the boundary has no title label.
- **Multi-cell document:** a top-level `title` sets the **project** title. `version` is per cell and
  must go **inside** a block — at the top level it is the error
  `This document uses cell blocks. Components and local dependencies must be inside a named cell.`

## Components

```cell
component <id> [as <label>] [type]
```

```cell
component usersAPI
component WebApp web-app
component odb as OrderDB database
component ep as "Event Publisher" event
```

Declaring is optional. An id that appears on the internal side of an arrow and was never declared
is inferred as a plain internal component. Declare only when you want a type or a label.

## Externals on a boundary

```cell
<direction> <id> [as <label>] [type]
```

```cell
north CustomerApp
west ap as AdminPortal webapp
east inventories api
south adb as "Azure Postgre" database
```

Directions: `north` `east` `south` `west`. **`north` and `west` are inbound. `east` and `south` are
outbound.**

## Dependencies

```cell
# internal; any arrow takes an optional ": label"
A -> B
A -> B : label

# predeclared external
CustomerApp -> WebApp

# inline: declares the external and the edge together
north CustomerApp -> WebApp
WebApp -> south Stripe
```

`->` is the only arrow. `--`, `-->`, `<-` are syntax errors.

## Gateway exposures

When the counterpart has no identity, link the component to the boundary gateway itself. No
external node is created.

```cell
north -> API
west  -> API
API -> east
API -> south : archive        # exposures take a ": label" like any other arrow
```

`API -> north`, `API -> west`, `east -> API`, `south -> API` are all rejected — they point against
the boundary's direction.

The target of an exposure is **always resolved as an internal component**. Pointing one at an id you
already declared as an external (`north CustomerApp` then `north -> CustomerApp`) does not error — it
silently creates a second, internal node sharing that id.

An external that both calls in and is called out to needs **two ids**: `north partnerIn` and
`east partnerOut`. The same id on two sides is `External "p" is already defined.`

## Labels and types

`as` sets the display label; the id before `as` is what arrows use.

```cell
component odb as "Order Datastore"
south adb as "Azure Postgre" database
```

Quote a multi-word label. **Unquoted, the last word is taken as the type** — `as Azure Postgre
database` parses as label `Azure Postgre`, type `database`. Quoting is the unambiguous form, and is
required for a multi-word label with no type after it.

Reserved words — cannot be ids, but *may* be labels: `north` `east` `south` `west` `component`
`cell` `as` `title` `version`.

## Multi-cell projects

```cell
cell <id> [as "<label>"] {
  ...
}
```

```cell
title Storefront

cell orders as "Order Cell" {
  version v2
  component api
  component odb database
  component customerApp as "Customer App" webapp

  north -> customerApp
  customerApp -> api
  api -> odb
}

cell products {
  component api
}
```

Everything valid in a single-cell document is valid inside a block. A document with **no** blocks is
one implicit cell.

Each cell holds the client apps that belong to it — a UI goes inside the cell it serves, with its own
ingress exposure, never on the boundary between two cells.

Once the document uses `cell { }` blocks, components and local dependencies **must** be inside a
block. Outside a block only `title`, comments, and cross-cell edges are allowed — otherwise:
`This document uses cell blocks. Components and local dependencies must be inside a named cell.`

Component ids are scoped per cell — two cells may both have `component api`.

## Cross-cell links

Qualify the target as `<cell>.<component>`. Inside a block the source may be a bare local id; at the
top level both ends must be qualified.

```cell
cell orders {
  component api
  # connected; default exit=east entry=west
  api -> products.api
  # connected; exit east, enter north
  api -> east-north products.api
  # decoupled
  api -> south-north products.api
  api -> south-west products.api
}

cell products {
  component api
}

orders.api -> south-north products.api : recalculate tier
orders.api -> products.api : get stock
```

Both forms are equivalent — write the link inside the source cell's block when the source is local,
at the top level when it reads better as a project-level relationship. A direction token and a
`: label` may be combined, in either position: `<source> -> <exit>-<entry> <cell>.<comp> : label`.

Direction token is `<exit>` or `<exit>-<entry>`. `exit` ∈ {`east`, `south`}, `entry` ∈ {`west`,
`north`}. Defaults: exit `east`, entry `west`.

| Exit | Mode | Rendering |
| --- | --- | --- |
| `east` | connected | one joined line from source component, out the exit gateway, into the target component |
| `south` | decoupled | no joining line; each cell shows its own marker labelled with the other end's qualified name |

Use **decoupled** when the dependency is cyclic, or when a straight line would cross under another
cell. A bare `south` with no entry is an error: *A south cross-cell link needs an explicit entry,
e.g. `south-north`.*

For a cycle, decouple **one** direction, not both: keep the primary flow connected so the diagram
still reads left-to-right, and decouple the back-edge. `south-north` and `south-west` differ only in
which gateway the marker attaches to on the target cell — pick whichever keeps the two cells' other
links uncluttered.

## Shared externals

An external **id** declared on a boundary by two or more cells collapses into a single node rendered
between them.

**There is no project-level external declaration.** You do not declare a shared external once
outside the blocks — `south s3 as "AWS S3" storage` at the top level is the error *This document
uses cell blocks. Components and local dependencies must be inside a named cell.* Sharing is
inferred from the id, so declare it **inside each cell that uses it**, with the same id.

```cell
cell orders {
  component api
  api -> east identity
}

cell products {
  component api
  east identity as "Identity Service" api
  api -> identity
}
```

Direction, label and type are per use-site, so a shared external *may* sit on a different side of
each cell — but only do that when the placement rule genuinely differs between the two cells.
Putting one third-party SaaS on `east` in one cell and `south` in another just makes the diagram
lie about who owns it.

Matching is by **id**, so use the identical id in every cell that shares the system. `s3` in one cell
and `awsS3` in another renders as two separate nodes.

## Worked example: two cells with a cyclic dependency

Decouple the back-edge, keep the forward flow connected, and share the external that both cells use.

```cell
title Commerce

cell checkout as "Checkout Cell" {
  version v4
  component api as "Checkout API" api
  component cdb as "Checkout Store" database

  north -> api
  api -> cdb
  api -> south Stripe : capture payment

  api -> loyalty.points : burn points
}

cell loyalty as "Loyalty Cell" {
  component points as "Points Service" service
  component ldb as "Points Ledger" database

  points -> ldb
  points -> south-north checkout.api : read order total
}
```

`api -> loyalty.points` takes the default `east`/`west` and renders as one joined line.
`points -> south-north checkout.api` is the back-edge: no joining line, a marker on each cell
instead, which is what keeps the cycle readable. A `: label` works on both.

## Diagnostics you may hit

| Message | Cause |
| --- | --- |
| `Unknown statement. Expected title, version, component, or dependency arrow.` | Not a recognised line — usually a bad arrow |
| `Component "X" is already defined.` | Duplicate `component X` in one cell |
| `"north" is a reserved keyword and cannot be used as a component id.` | Reserved word as an id |
| `North boundary connections must flow into the cell.` | Inbound side used outbound (also West/East/South variants) |
| `Component statements must use: component <id> [as <label>] [type].` | Malformed component declaration |
| `External statements must use: <direction> <id> [as <label>] [type].` | Malformed external declaration |
| `Unknown cell "X".` | Cross-cell link naming a cell with no block |
| `Invalid cross-cell direction. Exit must be east or south; entry must be west or north.` | Bad direction token |
| `This diagram has N nodes, more than the 1000 node limit.` | Split into separate diagrams |

## Layout comments

Cell Architect may append a `# @layout=` comment holding manual node positions. It is
application-owned: leave it alone, and don't hand-write one.
