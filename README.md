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
src/app          React app shell, editor, styles, and app tests
src/parser       Cell DSL parser
src/compiler     Parser-to-diagram model validation
src/renderer     React Flow layout and diagram rendering
src/storage      Local document repository and default sample
src/domain       Shared cell diagram model types
```
