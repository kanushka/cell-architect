import {
  BoundaryDirection,
  Diagnostic,
  EdgeDirection,
  ParsedCellDocument,
  ParsedComponent,
  ParsedEdge,
  ParseResult
} from "../domain/cellModel";

const boundaryDirections = new Set<BoundaryDirection>(["north", "east", "south", "west"]);

function splitLabel(statement: string) {
  const index = statement.indexOf(":");
  if (index === -1) {
    return { body: statement.trim(), label: undefined };
  }

  const label = statement.slice(index + 1).trim();
  return {
    body: statement.slice(0, index).trim(),
    label: label.length > 0 ? label : undefined
  };
}

function edgeId(direction: EdgeDirection, source: string, target: string, line: number) {
  return `${direction}-${source}-${target}-${line}`;
}

function parseArrow(statement: string, line: number): ParsedEdge | null {
  const { body, label } = splitLabel(statement);
  const parts = body.split(/\s*->\s*/);

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const leftTokens = parts[0].trim().split(/\s+/);
  const rightTokens = parts[1].trim().split(/\s+/);

  if (rightTokens.length === 1 && boundaryDirections.has(rightTokens[0] as BoundaryDirection)) {
    const direction = rightTokens[0] as BoundaryDirection;
    const source = leftTokens.join(" ");
    return {
      id: edgeId(direction, source, direction, line),
      source,
      target: direction,
      direction,
      kind: "exposure",
      label,
      line
    };
  }

  if (leftTokens.length === 2 && boundaryDirections.has(leftTokens[0] as BoundaryDirection)) {
    const direction = leftTokens[0] as BoundaryDirection;
    const source = leftTokens[1];
    const target = rightTokens.join(" ");
    return {
      id: edgeId(direction, source, target, line),
      source,
      target,
      direction,
      kind: "inbound",
      label,
      line
    };
  }

  if (rightTokens.length >= 2 && boundaryDirections.has(rightTokens[0] as BoundaryDirection)) {
    const direction = rightTokens[0] as BoundaryDirection;
    const source = leftTokens.join(" ");
    const target = rightTokens.slice(1).join(" ");
    return {
      id: edgeId(direction, source, target, line),
      source,
      target,
      direction,
      kind: "outbound",
      label,
      line
    };
  }

  const source = leftTokens.join(" ");
  const target = rightTokens.join(" ");
  return {
    id: edgeId("internal", source, target, line),
    source,
    target,
    direction: "internal",
    kind: "internal",
    label,
    line
  };
}

function unknownStatement(line: number): Diagnostic {
  return {
    severity: "error",
    message: "Unknown statement. Expected title, version, component, or dependency arrow.",
    line,
    column: 1
  };
}

export function parseCellDsl(source: string): ParseResult {
  const components: ParsedComponent[] = [];
  const edges: ParsedEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const componentNames = new Set<string>();
  let title = "Untitled Cell";
  let version: string | undefined;

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const statement = rawLine.trim();

    if (!statement || statement.startsWith("#") || statement.startsWith("//")) {
      return;
    }

    if (statement.startsWith("title ")) {
      title = statement.slice("title ".length).trim() || title;
      return;
    }

    if (statement.startsWith("version ")) {
      version = statement.slice("version ".length).trim() || undefined;
      return;
    }

    if (statement.startsWith("component ")) {
      const tokens = statement.split(/\s+/);
      const id = tokens[1];
      const type = tokens[2];

      if (!id || !type || tokens.length !== 3) {
        diagnostics.push({
          severity: "error",
          message: "Component statements must use: component <name> <type>.",
          line,
          column: 1
        });
        return;
      }

      if (componentNames.has(id)) {
        diagnostics.push({
          severity: "error",
          message: `Component "${id}" is already defined.`,
          line,
          column: rawLine.indexOf(id) + 1
        });
        return;
      }

      componentNames.add(id);
      components.push({ id, type, line });
      return;
    }

    if (statement.includes("->")) {
      const edge = parseArrow(statement, line);
      if (edge) {
        edges.push(edge);
        return;
      }
    }

    diagnostics.push(unknownStatement(line));
  });

  const document: ParsedCellDocument = {
    title,
    version,
    components,
    edges
  };

  return { document, diagnostics };
}
