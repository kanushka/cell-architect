# Cell Architect DSL Guide

The Cell Architect DSL describes a cell, the components inside it, and dependencies that cross the cell boundary.

## Metadata

Set the cell title:

```cell
title OrderProject
```

Set an optional version:

```cell
version v1
```

Metadata is optional. If `title` and `version` are omitted, the cell boundary is rendered without a title label.

## Components

Declare a component inside the cell, with or without a type:

```cell
component usersAPI
component WebApp web-app
component OrderService service
```

The format is:

```cell
component <id> [type]
```

Use the id in dependencies. If the type is omitted, the diagram renders only the component name.

Component declarations are optional when you only need a plain internal component. If a component id appears on the internal side of a dependency, Cell Architect infers that component:

```cell
north -> usersAPI
WebApp -> OrderAPI
```

Declare components when you want a type label or a stable alias (see [Aliases](#aliases)).

## Boundary Declarations

Declare external systems on a boundary, with or without a type:

```cell
north CustomerApp
east InventoryAPI api
south CustomerDB database
```

The format is:

```cell
<direction> <id> [type]
```

External declarations are optional. They are useful when you want a type label or an alias (see [Aliases](#aliases)) for an external system.

Supported boundary directions:

```text
north
east
south
west
```

`north` and `west` are inbound boundaries. `east` and `south` are outbound boundaries.

## Internal Dependencies

Declare the components, then create a dependency between them:

```cell
component api
component OrderService

api -> OrderService
```

You don't have to declare a component first. If a component id appears on the internal side of a dependency and was never declared, Cell Architect infers it as a plain internal component:

```cell
api -> OrderService
```

Declaring a component first is only needed when you want more than the plain id — a type, or an alias (display name, see [Aliases](#aliases)).

## Boundary Dependencies

North and west boundaries are inbound; links on these boundaries must flow into the cell. East and south boundaries are outbound; links on these boundaries must flow out of the cell.

Declare the external system, then create a dependency to or from it:

```cell
north CustomerApp
east InventoryAPI

CustomerApp -> WebApp
OrderService -> InventoryAPI
```

You don't have to declare the external system first. You can create the dependency inline and Cell Architect creates the external for you:

```cell
north CustomerApp -> OrderAPI
OrderService -> east InventoryAPI
```

The inline format is:

```cell
<direction> <external-system> -> <component>
<component> -> <direction> <external-system>
```

The external system is rendered outside the cell. The link enters or exits through the gateway on that boundary.

Declaring the external system first is only needed when you want more than the plain id — a type, or an alias (display name, see [Aliases](#aliases)).

## Gateway Exposures

Expose an internal component through a boundary when the external consumer is unknown:

```cell
north -> API
API -> east
```

This creates a link between the component and the boundary gateway only. It does not create an external component.
If `API` was not declared, it is inferred as an internal component.

Gateway exposure direction must follow the boundary rule:

```cell
# inbound
north -> API
west -> API

# outbound
API -> east
API -> south
```

These are rejected because they point the wrong way:

```cell
API -> north
API -> west
east -> API
south -> API
```

## Multi-Cell Projects

Group a cell's contents inside `cell <id> [as "<label>"] { ... }`. Everything valid in a single-cell document is valid inside a block: metadata, components, boundary declarations, dependencies, gateway exposures, aliases, and comments.

```cell
cell orders as "Order Cell" {
  version v2
  component api
  component odb database
  north customerApp

  customerApp -> api
  api -> odb
}

cell products {
  component api
}
```

The format is:

```cell
cell <id> [as "<label>"] {
  ...
}
```

A document with **no** `cell { ... }` blocks is treated as a single implicit cell, and renders exactly as it always has — this keeps every existing single-cell diagram fully backward compatible.

`title`, when written at the top level outside any `cell` block, sets the overall project title rather than a single cell's title.

## Cross-Cell Links

Connect a component in one cell to a component in another using a dot to qualify the target. Inside a `cell` block, the source may be a bare local component id; at the project level (outside any block), both ends must be qualified as `<cell>.<component>`.

```cell
# inline, inside a block, bare local source
api -> products.api                 # connected, default exit=east entry=west
api -> east-north products.api      # connected, exit east / enter north
api -> south-north products.api     # decoupled — exit south, enter north
api -> south-west products.api      # decoupled — exit south, enter west

# project-level, outside any block, both ends qualified
orders.api -> products.api : get stock
```

The direction token is `<exit>` or `<exit>-<entry>`, where `exit` is `east` or `south` and `entry` is `west` or `north`. Defaults are `exit=east`, `entry=west`.

| Exit direction | Mode | Rendering |
| --- | --- | --- |
| `east` | Connected | One joined line from the source component, out the source cell's east (or specified) gateway, across to the target cell's entry gateway, into the target component. |
| `south` | Decoupled | No joining line. Each cell shows its own independent boundary marker instead: the source cell shows a line from the component out its south gateway to a small marker labeled with the target's qualified name; the target cell shows a line from a marker labeled with the source's qualified name in through its entry gateway to the target component. This is the escape hatch for cyclic cell dependencies or layouts where a straight line would cross under another cell. |

A bare `south` with no entry direction (e.g. `api -> south products.api`) is a validation **error** — decoupled mode requires an explicit entry direction.

`:` still adds a label to a cross-cell link, the same as any other dependency arrow.

## Shared Externals

An external system id used on a boundary by **two or more** cells automatically becomes one shared node, rendered once and placed between the cells that use it. An external id used by only one cell renders next to that cell, as before.

```cell
cell orders {
  component api
  api -> east s3
}

cell products {
  component api
  api -> south s3 as "AWS S3" storage
}
```

Direction and alias/type are given per use-site — a shared external can sit on a different boundary side of each cell, and each cell can give it its own label or type.

## Aliases

The `as` keyword sets a display label (alias) on a component or external declaration. The id before `as` is used in dependencies; the label after `as` is what renders on the diagram.

```cell
component api as OrderAPI
south db as Datastore
```

The format is:

```cell
component <id> as <display-name> [type]
<direction> <id> as <display-name> [type]
```

By default a label is a single word. Wrap it in double quotes to use more than one word:

```cell
component odb as "Order Datastore"
south adb as "Azure Postgre" database
```

Quotes are only needed for multi-word labels. Without quotes, if you write more than one word after `as`, Cell Architect treats the last word as the type and everything before it as the label — so `as Azure Postgre database` still parses as label `Azure Postgre` with type `database`. Quoting is the explicit way to write a multi-word label, including when there is no type after it (`as "Order Datastore"` would otherwise be ambiguous, since without quotes the last word is always assumed to be the type).

## Labels in Dependencies

Add an optional label to any dependency arrow with `:`. This applies to internal dependencies, boundary dependencies, and inline boundary syntax:

```cell
OrderService -> EventPublisher : order.created
CustomerApp -> WebApp : HTTPS
OrderService -> InventoryAPI : reserve stock
north CustomerApp -> OrderAPI : REST
OrderService -> east InventoryAPI : reserve stock
```

The label renders on the link in the diagram.

## Comments

Blank lines are ignored. Lines starting with `#` or `//` are treated as comments:

```cell
# Customer-facing entry point
north CustomerApp -> WebApp : HTTPS

// Internal service call
WebApp -> OrderAPI
```

## Complete Example

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

## Multi-Cell Example

A small two-cell project combining a version, a label, a cross-cell link, and a shared external:

```cell
title Storefront

cell orders as "Order Cell" {
  version v2
  component api
  component odb database
  north customerApp

  customerApp -> api
  api -> odb
  api -> east s3
}

cell products {
  component api
  api -> south s3 as "AWS S3" storage
}

orders.api -> products.api : get stock
```

Here `orders` and `products` are each fully self-contained cells, `s3` is declared on the boundary of both and renders as a single shared node between them, and the project-level `orders.api -> products.api` line connects the two cells with a labeled, connected cross-cell link.
