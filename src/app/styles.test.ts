import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/app/styles.css"), "utf8");

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.#[\]]/g, (match) => `\\${match}`);
  const pattern = new RegExp(`${escaped} \\{[\\s\\S]*?\\}`);
  return styles.match(pattern)?.[0] ?? "";
}

describe("diagram interaction styles", () => {
  it("does not resize nodes while highlighting connections", () => {
    const highlightRule = styles.match(/\.connection-highlight-node \.component-node,[\s\S]*?\}/)?.[0] ?? "";
    expect(highlightRule).not.toContain("transform:");
  });
});

describe("canvas-first shell", () => {
  it("makes the app shell a full-bleed, fixed-position stage", () => {
    const rule = ruleFor(".app-shell");
    expect(rule).toContain("position: fixed;");
    expect(rule).toContain("inset: 0;");
    expect(rule).toContain("overflow: hidden;");
  });

  it("positions the top-left, top-right, and bottom-right overlays as absolute layers", () => {
    expect(ruleFor(".overlay--top-left")).toContain("position: absolute;");
    expect(ruleFor(".overlay--top-right")).toContain("position: absolute;");
    expect(ruleFor(".overlay--bottom-right")).toContain("position: absolute;");
  });

  it("floats the diagrams panel on the right edge, spanning the viewport height", () => {
    const rule = ruleFor(".diagrams-panel");
    expect(rule).toContain("position: absolute;");
    expect(rule).toContain("right:");
  });
});

describe("source editor interaction styles", () => {
  it("makes text selections more prominent than the active cursor line", () => {
    const activeLineRule = styles.match(/\.source-editor__codemirror \.cm-activeLine,[\s\S]*?\}/)?.[0] ?? "";
    const selectionRule =
      styles.match(/\.source-editor__codemirror \.cm-selectionBackground,[\s\S]*?\}/)?.[0] ?? "";

    expect(activeLineRule).toContain("rgba(37, 99, 235, 0.06)");
    expect(selectionRule).toContain("#93c5fd");
    expect(selectionRule).toContain("!important");
  });
});
