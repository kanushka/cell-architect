import { describe, expect, it } from "vitest";
import { compileProject } from "./compileProject";

describe("compileProject", () => {
  it("wraps a single-cell document in a one-cell ProjectModel", () => {
    const result = compileProject(`component API service\nnorth -> API`);
    expect(result.diagnostics).toEqual([]);
    expect(result.model?.cells).toHaveLength(1);
    expect(result.model?.cells[0].id).toBe("main");
    expect(result.model?.cells[0].components.map((c) => c.id)).toEqual(["API"]);
    expect(result.model?.crossEdges).toEqual([]);
    expect(result.model?.sharedExternals).toEqual([]);
  });

  it("marks an external used by two cells as shared", () => {
    const source = [
      "cell orders {", "  component api", "  api -> east s3", "}",
      "cell inventory {", "  component api", "  api -> south s3", "}"
    ].join("\n");
    const result = compileProject(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.model?.sharedExternals.map((e) => e.id)).toEqual(["s3"]);
    expect(result.model?.cells.flatMap((c) => c.externals.map((e) => e.id))).not.toContain("s3");
  });

  it("keeps a single-use external cell-local", () => {
    const source = ["cell orders {", "  component api", "  api -> east s3", "}", "cell inventory {", "  component api", "}"].join("\n");
    const result = compileProject(source);
    expect(result.model?.sharedExternals).toEqual([]);
    expect(result.model?.cells[0].externals.map((e) => e.id)).toEqual(["s3"]);
  });

  it("resolves a connected cross edge and reports unknown target cell", () => {
    const ok = compileProject("cell a {\n  x -> b.y\n}\ncell b {\n  component y\n}");
    expect(ok.diagnostics).toEqual([]);
    expect(ok.model?.crossEdges[0]).toMatchObject({ sourceCell: "a", targetCell: "b", mode: "connected" });

    const bad = compileProject("cell a {\n  x -> zzz.y\n}");
    expect(bad.model).toBeNull();
    expect(bad.diagnostics.some((d) => /unknown cell/i.test(d.message))).toBe(true);
  });

  it("keeps cell version and label", () => {
    const result = compileProject("cell orders as \"Order Cell\" {\n  version v2\n  component api\n}");
    expect(result.model?.cells[0]).toMatchObject({ id: "orders", label: "Order Cell", version: "v2" });
  });
});
