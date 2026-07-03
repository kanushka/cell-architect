import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/app/styles.css"), "utf8");

describe("diagram interaction styles", () => {
  it("does not resize nodes while highlighting connections", () => {
    const highlightRule = styles.match(/\.connection-highlight-node \.component-node,[\s\S]*?\}/)?.[0] ?? "";

    expect(highlightRule).not.toContain("transform:");
  });

  it("keeps the diagram rail list scrollable when many diagrams are saved", () => {
    const railRule = styles.match(/\.document-rail \{[\s\S]*?\}/)?.[0] ?? "";
    const listRule = styles.match(/\.document-list \{[\s\S]*?\}/)?.[0] ?? "";

    expect(railRule).toContain("display: grid;");
    expect(railRule).toContain("grid-template-rows:");
    expect(railRule).toContain("height: 100vh;");
    expect(listRule).toContain("min-height: 0;");
    expect(listRule).toContain("overflow-y: auto;");
  });
});
