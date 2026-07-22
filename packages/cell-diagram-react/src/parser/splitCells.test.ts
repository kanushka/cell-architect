import { describe, expect, it } from "vitest";
import { splitCells } from "./splitCells";

describe("splitCells", () => {
  it("returns a single implicit block when there are no cell braces", () => {
    const result = splitCells(`component API service\nnorth -> API`);
    expect(result.diagnostics).toEqual([]);
    expect(result.implicit).toBe(true);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].id).toBe("main");
    expect(result.cells[0].lines.map((l) => l.text)).toEqual(["component API service", "north -> API"]);
    expect(result.cells[0].lines.map((l) => l.line)).toEqual([1, 2]);
    expect(result.topLevel).toEqual([]);
  });

  it("splits explicit cell blocks and keeps original line numbers", () => {
    const source = [
      "title Project",
      "cell orders as \"Order Cell\" {",
      "  component api",
      "}",
      "cell products {",
      "  component api",
      "}"
    ].join("\n");
    const result = splitCells(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.implicit).toBe(false);
    expect(result.topLevel.map((l) => l.text)).toEqual(["title Project"]);
    expect(result.cells).toHaveLength(2);
    expect(result.cells[0]).toMatchObject({ id: "orders", label: "Order Cell", headerLine: 2 });
    expect(result.cells[0].lines).toEqual([{ text: "component api", line: 3 }]);
    expect(result.cells[1]).toMatchObject({ id: "products", label: undefined, headerLine: 5 });
    expect(result.cells[1].lines).toEqual([{ text: "component api", line: 6 }]);
  });

  it("reports an unbalanced-brace diagnostic", () => {
    const result = splitCells(`cell a {\n  component x`);
    expect(result.diagnostics).toEqual([
      { severity: "error", message: "Unbalanced braces: a cell block was not closed.", line: 1, column: 1 }
    ]);
  });

  it("reports a nested cell header", () => {
    const result = splitCells(`cell a {\n  cell b {\n  }\n}`);
    expect(result.diagnostics[0]).toMatchObject({ message: "Nested cells are not supported.", line: 2 });
  });

  it("reports a malformed cell header", () => {
    const result = splitCells(`cell orders as bad name {\n}`);
    expect(result.diagnostics[0]).toEqual({
      severity: "error",
      message: 'Malformed cell header. Use: cell <id> [as "label"] {',
      line: 1,
      column: 1
    });
  });

  it("reports an unexpected closing brace", () => {
    const result = splitCells(`}\n`);
    expect(result.diagnostics).toEqual([
      { severity: "error", message: "Unexpected closing brace.", line: 1, column: 1 }
    ]);
  });

  it("treats an empty quoted label as undefined", () => {
    const result = splitCells(`cell x as "" {\n}`);
    expect(result.diagnostics).toEqual([]);
    expect(result.cells[0]).toMatchObject({ id: "x", label: undefined });
  });
});
