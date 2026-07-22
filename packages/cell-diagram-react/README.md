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

## Limitations

The WSO2 converter assumes component and service identifiers from the WSO2 cell-diagram model are valid Cell DSL identifiers. An identifier that exactly equals a DSL reserved keyword (`title`, `version`, `component`, `as`, `north`, `south`, `east`, `west`) will produce DSL output that fails to compile. Such inputs are out of scope for the converter.
