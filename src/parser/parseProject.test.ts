import { describe, expect, it } from "vitest";
import { parseProject } from "./parseProject";

describe("parseProject", () => {
  it("parses a single implicit cell (backward compatible)", () => {
    const result = parseProject(`component API service\nnorth -> API`);
    expect(result.diagnostics).toEqual([]);
    expect(result.project.title).toBeUndefined();
    expect(result.project.cells).toHaveLength(1);
    expect(result.project.cells[0].id).toBe("main");
    expect(result.project.cells[0].document.components.map((c) => c.id)).toEqual(["API"]);
    expect(result.project.crossEdges).toEqual([]);
  });

  it("parses two cells, a project title, and an inline cross edge", () => {
    const source = [
      "title Commerce",
      "cell orders {",
      "  component api",
      "  api -> east products.api : get stock",
      "}",
      "cell products {",
      "  component api",
      "}"
    ].join("\n");
    const result = parseProject(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.project.title).toBe("Commerce");
    expect(result.project.cells.map((c) => c.id)).toEqual(["orders", "products"]);
    expect(result.project.crossEdges).toEqual([
      {
        id: "cross-orders-api-products-api-4",
        sourceCell: "orders",
        sourceComp: "api",
        targetCell: "products",
        targetComp: "api",
        exit: "east",
        entry: "west",
        mode: "connected",
        label: "get stock",
        line: 4
      }
    ]);
  });

  it("stamps the owning cell on an inline cross edge with unqualified source", () => {
    const source = "cell a {\n  x -> b.y\n}\ncell b {\n  component y\n}";
    const result = parseProject(source);
    expect(result.project.crossEdges[0]).toMatchObject({ sourceCell: "a", sourceComp: "x", targetCell: "b", targetComp: "y", mode: "connected" });
  });

  it("parses a project-level cross edge outside blocks", () => {
    const source = "cell a {\n  component x\n}\ncell b {\n  component y\n}\na.x -> south-north b.y";
    const result = parseProject(source);
    expect(result.project.crossEdges[0]).toMatchObject({ sourceCell: "a", sourceComp: "x", targetCell: "b", targetComp: "y", exit: "south", entry: "north", mode: "decoupled" });
  });

  it("flags a bare-south cross edge", () => {
    const source = "cell a {\n  x -> south b.y\n}\ncell b {\n  component y\n}";
    const result = parseProject(source);
    expect(result.diagnostics.some((d) => /south/i.test(d.message))).toBe(true);
  });

  it("flags top-level component statements mixed with cell blocks", () => {
    const source = "component loose\ncell a {\n  component x\n}";
    const result = parseProject(source);
    expect(result.diagnostics.some((d) => /outside a cell/i.test(d.message))).toBe(true);
  });

  it("rejects an unqualified source on a top-level cross edge", () => {
    const source = "cell a {\n  component x\n}\nx -> b.y";
    const result = parseProject(source);
    expect(result.diagnostics.some((d) => /qualified source/i.test(d.message))).toBe(true);
    expect(result.project.crossEdges).toEqual([]);
  });

  it("flags a top-level bare-south cross edge", () => {
    const source = "cell a {\n  component x\n}\ncell b {\n  component y\n}\na.x -> south b.y";
    const result = parseProject(source);
    expect(result.diagnostics.some((d) => /south/i.test(d.message))).toBe(true);
    expect(result.project.crossEdges).toEqual([]);
  });

  it("flags a bad-token in-block cross edge", () => {
    const source = "cell a {\n  x -> west b.y\n}\ncell b {\n  component y\n}";
    const result = parseProject(source);
    expect(result.diagnostics.some((d) => /exit must be east or south/i.test(d.message))).toBe(true);
  });

  it("ignores a top-level comment line", () => {
    const source = "# a comment\ncell a {\n  component x\n}";
    const result = parseProject(source);
    expect(result.diagnostics).toEqual([]);
  });

  it("treats an empty title as undefined", () => {
    const source = "title \ncell a {\n  component x\n}";
    const result = parseProject(source);
    expect(result.project.title).toBeUndefined();
  });
});
