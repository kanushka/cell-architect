---
name: cell-diagram
description: Use when asked to draw, write, or edit a cell architecture diagram or a `.cell` file, when working with Cell Architect or @kanushka/cell-diagram-react, or when a system needs to be shown as a cell with what it exposes and what it depends on.
---

# Cell Diagram DSL

Cell Architect renders a `.cell` document: one or more **cells** (deployable units owned by one
team), the **components** inside them, and the dependencies that **cross the cell boundary**.

A cell has four boundary sides. Which side a dependency sits on is not cosmetic — it states who
owns the thing, which network it lives on, and which way traffic flows. Get placement right first,
then write the syntax.

## Placement: decide this before writing any line

| The thing you are placing | Goes |
| --- | --- |
| Services, APIs, workers, functions | `component` **inside** the cell |
| **Client apps and UIs** — web, mobile, admin consoles, portals | `component` **inside** the cell |
| The cell's **own** datastore, cache or queue | `component` **inside** the cell |
| A system the brief says is **third-party or another org's** and calls in over the **public internet** | `north <id>` |
| A third-party or other-org system that calls in over the **intranet / corporate network only** | `west <id>` |
| A named service this cell calls, run by **another team on your own platform** | `east <id>` |
| A **third-party SaaS or vendor** this cell calls | `south <id>` |
| A counterpart the brief names only by **category** ("an object store", "any client") | gateway exposure — `north -> api`, `api -> east` |
| A component in **another cell of the same project** | cross-cell link — `orders.api -> products.api` |

**A client app is part of the system, not a consumer of it.** When someone describes their system,
its UIs come with it — the web app, the mobile app, the admin console, the customer portal. They go
**inside** the cell as components. The cell is the project boundary, and the UI is in the project.

Move a UI onto a boundary **only when the brief explicitly makes it someone else's**: a third-party
app, a partner's portal, another org's system. "Our customer portal", "an Ops Console the finance
team uses", "a React app customers use" are all inside. Silence is not evidence of third-party.

So the most common shape in the whole notation is a UI inside the cell, reached by anonymous users:

```cell
component webApp as "Customer Web" webapp
component api

north -> webApp                # anonymous ingress, no external node
webApp -> api
```

`north -> webApp` says "people arrive from the internet". `north CustomerApp` would say "a system we
don't own calls us" — a different and usually wrong claim.

**In a multi-cell project, each client app belongs inside the cell it serves.** Don't float a UI on
the boundary between two cells; put it in its own cell with an ingress exposure there.

**The cell's own database is a component, not a south external.** Putting it on a boundary asserts
that somebody else owns it. Owned data lives inside the cell — that is what makes the cell
independently deployable.

**The proper-noun test — run it before writing any `<direction> <id>` line.** Ask: *does the brief
give this thing a name I could look up?*

- **Proper noun** — `Stripe`, `Auth0`, `AWS S3`, `Customer Profile API`, `Partner Portal`. It has an
  identity. Declare the external: `south Stripe payment`.
- **Category noun** — "an object store", "a queue", "some CDN", "any client", "callers", "another
  team's service, not decided yet". It has no identity. Write the **gateway exposure**:
  `indexer -> east`, `north -> api`. No external node.

Turning a category into a name — `east objectStore as "Object Store"`, `north Client` — invents a
system the brief does not have. It looks more complete and is less true. This applies to **outbound
exactly as much as inbound**: an undecided downstream is `api -> east`, not `east someStore`.

**Don't invent edges either.** Draw the dependencies the brief states. If it names two components
and never connects them, leave them unconnected and say so — a plausible-looking arrow is a claim
about the system that nobody made. The same goes for which component calls a given external: if the
brief attributes a dependency to the cell rather than to one component, pick the most likely
component and flag that you did.

**East vs south is the org boundary, not distance.** Another team's API inside your company is
`east`. Stripe, Auth0, SendGrid are `south`. This holds for gateway exposures too: an undecided
system that will be run by another team is still `api -> east`.

## Red flags — stop and re-place

If you catch yourself writing any of these, the placement is wrong:

- **"I'll call it `objectStore` / `Client` / `PublicUsers` for now."** You just turned a category
  noun into a proper noun. Gateway exposure instead — `indexer -> east`, `north -> api`.
- **"The outbound side needs somewhere to point."** No — `api -> east` is a complete statement on
  its own. An arrow into the gateway is the answer, not a half-answer.
- **"This one's a UI so it goes on the boundary."** UIs are components. Only the brief calling it
  third-party moves it out.
- **"The portal is inside but the console can go on `west`."** Two client apps in one document,
  placed by two different rules. Pick one reading of the brief and apply it to both.
- **"The database is theirs, roughly."** If this cell reads and writes it, it is inside.

## Direction is enforced

North and west are **inbound**; east and south are **outbound**. The compiler rejects the reverse:

```cell
north -> api      # ok — flows in
api -> east       # ok — flows out
api -> north      # ERROR: North boundary connections must flow into the cell.
east -> api       # ERROR: East boundary connections must flow out of the cell.
```

An external that both calls you and is called by you needs **two declarations with different ids**
(`north partnerIn`, `east partnerOut`). Declaring the same id on two sides is
`External "p" is already defined.`

## Syntax

```cell
title ShippingCell                    # optional; renders on the cell boundary
version v1                            # optional

component api                         # component <id> [as <label>] [type]
component labels as "Label Printer" worker
component sdb as "Shipment Store" database
east rates as "Rate Engine" api       # <direction> <id> [as <label>] [type]
south DHL courier

api -> sdb                            # dependency, optional ": label"
api -> labels : print label
api -> rates : quote
api -> south UPS : book pickup        # inline — declares the external and the edge together
north -> api                          # gateway exposure, no external node
api -> east : archive                 # exposures take labels too
```

- **Ids** are single words used in arrows; letters, digits, `-` and `_` are all fine. Avoid `.` — it
  is the cross-cell separator. **Labels** are what render; quote a multi-word label. Without quotes
  the **last** word is read as the type: `as Azure Postgre database` → label `Azure Postgre`, type
  `database`.
- **`type` is free-form text**, rendered verbatim as a small caption under the node. There is no
  enum and no icon mapping — `webapp` and `web-app` are simply two different captions, so pick one
  spelling and stay consistent. Name the **role, not the technology**: `component odb as "Order
  Postgres" database`, not `type mysql`. These read well and are what the project's own diagrams
  use: `api` `service` `worker` `webapp` `database` `cache` `queue` `event` `storage` `gateway`
  `function`. Types are optional — omit them all rather than typing half the nodes.
- Declaring first is only needed when you want a type or a label. A bare id on the internal side of
  an arrow is inferred as an internal component; `north Foo -> api` creates the external inline.
- **A gateway exposure's target is always an internal component.** `north -> CustomerApp` where
  `CustomerApp` is a declared external silently creates a *second*, internal node with the same id.
- **Statements are order-independent** — you may use an id before declaring it. Declare-then-use
  still reads better.
- Reserved, cannot be ids: `north` `east` `south` `west` `component` `cell` `as` `title` `version`.
- Comments start with `#` or `//`. Blank lines are ignored.

Multi-cell projects, cross-cell links, shared externals and the full grammar are in
[reference/grammar.md](reference/grammar.md). Read it whenever the diagram has more than one cell.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| The cell's own DB declared as `south ordersDb database` | Make it a `component` inside the cell |
| A client app or portal declared as `north webApp` | UIs are part of the system — `component webApp`, then `north -> webApp` |
| A UI floated on the boundary between two cells | Put it inside the cell it serves, with its own ingress exposure |
| Inventing `north PublicUsers` for anonymous callers | `north -> api` gateway exposure |
| `component north` / `east as api` | Reserved keyword used as an id — rename it |
| `api -> north CustomerApp` | North is inbound: `north CustomerApp -> api` |
| Same external id declared on two sides | Two ids: `north partnerIn`, `east partnerOut` |
| `api -- db` or `api --> db` | The only arrow is `->` |
| Two cells archiving to S3 with ids `s3` and `awsS3` | Use the **same id** in both cells so it renders as one shared node |
| Declaring a shared external once at the top level, outside the blocks | There is no project-level declaration — declare it **inside each cell**, same id |
| Cross-cell link written as a plain `->` between cells | Qualify the target: `orders.api -> products.api` |
| `api -> south products.api` for a cyclic dependency | Bare `south` is an error — needs an entry: `south-north` |
| `version` at the top level of a multi-cell document | `version` is per cell — put it inside the block |

## Verifying

If `@kanushka/cell-diagram-react` is installed, `compileProject(source)` returns
`{ model, diagnostics }`; a correct document has `diagnostics: []`, and each diagnostic carries a
line, a column and a message naming the fix.

There is no standalone CLI. Without the package, say the document is unverified rather than implying
it compiles, and walk this list — the diagnostics table catches syntax, but every placement mistake
above compiles cleanly:

- [ ] Every datastore the cell owns is a `component`, not a boundary external.
- [ ] Every client app and UI is a `component`, unless the brief called it third-party.
- [ ] Nothing on a boundary is a name the brief didn't give you.
- [ ] Every `east` external is another team's; every `south` external is outside the company.
- [ ] No arrow points out of `north`/`west` or into `east`/`south`.
- [ ] No external id is declared on two sides.
- [ ] Every id in an arrow is one you meant — a typo silently becomes a new inferred component.
- [ ] Types (if used) are on every node, spelled consistently, and name roles not technologies.

## Full example

```cell
title MediaCell
version v3

component uploadApi as "Upload API" api
component transcoder worker
component catalog service
component mdb as "Media Store" database
component cms as "Editorial CMS" webapp

east identity as "Identity Service" api
south Cloudflare cdn
south Mux transcoding

west -> cms                    # editors, on the corporate network
north -> catalog               # anonymous viewers, over the internet

cms -> uploadApi : publish

uploadApi -> mdb
uploadApi -> transcoder : queue job
transcoder -> mdb
catalog -> mdb

uploadApi -> identity : verify editor
transcoder -> Mux : encode
catalog -> Cloudflare : purge cache
```
