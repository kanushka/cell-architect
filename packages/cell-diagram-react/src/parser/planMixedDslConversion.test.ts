import { describe, expect, it } from "vitest";
import { planMixedDslConversion } from "./planMixedDslConversion";

describe("planMixedDslConversion", () => {
  it("moves loose cell statements and their leading trivia into cell main", () => {
    const source = [
      "# Existing single-cell content",
      "component Users API",
      "",
      "Courses -> Users",
      "",
      "cell orders {",
      "  component api",
      "}"
    ].join("\n");

    expect(planMixedDslConversion(source)).toEqual({
      cellId: "main",
      movedLineCount: 2,
      source: [
        "cell main {",
        "  # Existing single-cell content",
        "  component Users API",
        "",
        "  Courses -> Users",
        "}",
        "",
        "cell orders {",
        "  component api",
        "}"
      ].join("\n")
    });
  });

  it("keeps project title, qualified cross-cell links, and existing blocks unchanged", () => {
    const existingBlocks = [
      "cell orders as \"Order Cell\" {",
      "    component api",
      "}",
      "cell products {",
      "\tcomponent api",
      "}"
    ].join("\n");
    const source = [
      "title Commerce",
      "component loose",
      "orders.api -> products.api",
      existingBlocks
    ].join("\n");
    const conversion = planMixedDslConversion(source);

    expect(conversion?.source).toContain("title Commerce\norders.api -> products.api\ncell main {");
    expect(conversion?.source.endsWith(existingBlocks)).toBe(true);
  });

  it("moves a cross-cell edge with an unqualified local source", () => {
    const source = "component api\napi -> east-north products.api\ncell products {\n  component api\n}";
    const conversion = planMixedDslConversion(source);

    expect(conversion?.movedLineCount).toBe(2);
    expect(conversion?.source).toContain("  api -> east-north products.api");
  });

  it("uses the next available generated cell identifier", () => {
    const source = [
      "component loose",
      "cell main {",
      "  component a",
      "}",
      "cell main-2 {",
      "  component b",
      "}"
    ].join("\n");

    expect(planMixedDslConversion(source)?.cellId).toBe("main-3");
  });

  it("leaves malformed top-level lines and their trivia untouched", () => {
    const source = [
      "component loose",
      "// Explain the malformed line",
      "not valid DSL",
      "",
      "cell existing {",
      "  component api",
      "}"
    ].join("\n");
    const conversion = planMixedDslConversion(source);

    expect(conversion?.source).toContain("// Explain the malformed line\nnot valid DSL");
    expect(conversion?.source).toContain("not valid DSL\ncell main {");
  });

  it("preserves CRLF and final-newline behavior", () => {
    const withFinalNewline = "component loose\r\ncell existing {\r\n  component api\r\n}\r\n";
    const withoutFinalNewline = "component loose\r\ncell existing {\r\n  component api\r\n}";

    const withFinalResult = planMixedDslConversion(withFinalNewline)?.source;
    const withoutFinalResult = planMixedDslConversion(withoutFinalNewline)?.source;

    expect(withFinalResult?.endsWith("\r\n")).toBe(true);
    expect(withFinalResult?.replaceAll("\r\n", "")).not.toContain("\n");
    expect(withoutFinalResult?.endsWith("\r\n")).toBe(false);
  });

  it("returns null when there is no safe mixed-mode conversion", () => {
    expect(planMixedDslConversion("component api")).toBeNull();
    expect(planMixedDslConversion("cell existing {\n  component api\n}")).toBeNull();
    expect(planMixedDslConversion("not valid DSL\ncell existing {\n  component api\n}")).toBeNull();
    expect(planMixedDslConversion("component loose\ncell existing {\n  component api")).toBeNull();
  });
});
