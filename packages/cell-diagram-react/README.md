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
