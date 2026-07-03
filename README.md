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

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

The app runs on:

```text
http://127.0.0.1:5173/
```

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

## DSL Example

```cell
title OrderCell
version v1

component WebApp web-app
component OrderAPI api
component OrderService service
component OrderDB database
component EventPublisher event

north CustomerApp -> WebApp : HTTPS
west AdminPortal -> OrderAPI : backoffice

WebApp -> OrderAPI
OrderAPI -> OrderService
OrderService -> OrderDB
OrderService -> EventPublisher : order.created

OrderService -> east InventoryCell : reserve stock
OrderService -> south Stripe : payment
```

## DSL Reference

Set the cell title:

```cell
title OrderCell
```

Set an optional version:

```cell
version v1
```

Declare a component inside the cell:

```cell
component OrderAPI api
```

Create an internal dependency:

```cell
OrderAPI -> OrderService
```

Create an inbound dependency from an external system through a boundary:

```cell
north CustomerApp -> OrderAPI : REST
```

Create an outbound dependency to an external system through a boundary:

```cell
OrderService -> east InventoryCell : reserve stock
```

Expose an internal component through a boundary when the consumer is unknown:

```cell
API -> north
```

Supported boundary directions:

```text
north
east
south
west
```

Labels are optional and use `:` after the dependency:

```cell
OrderService -> EventPublisher : order.created
```

## Storage

Diagrams are stored in the current browser only using local storage. Export important diagrams as `.cell` files before clearing browser data or switching machines.

## Project Structure

```text
src/app          React app shell, editor, styles, and app tests
src/parser       Cell DSL parser
src/compiler     Parser-to-diagram model validation
src/renderer     React Flow layout and diagram rendering
src/storage      Local document repository and default sample
src/domain       Shared cell diagram model types
```

