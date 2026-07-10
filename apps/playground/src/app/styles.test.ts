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

  it("sizes component and boundary dependency subtype labels consistently", () => {
    const componentRule = ruleFor(".component-node small");
    const externalRule = ruleFor(".external-node small");

    expect(componentRule).toContain("font-size: 10px;");
    expect(componentRule).not.toContain("text-transform:");
    expect(externalRule).toContain("font-size: 10px;");
    expect(externalRule).not.toContain("text-transform:");
  });
});

describe("canvas-first shell", () => {
  it("makes the app shell a full-bleed, fixed-position stage", () => {
    const rule = ruleFor(".app-shell");
    expect(rule).toContain("position: fixed;");
    expect(rule).toContain("inset: 0;");
    expect(rule).toContain("overflow: hidden;");
  });

  it("positions the top-left and top-right overlays as absolute layers", () => {
    expect(ruleFor(".overlay--top-left")).toContain("position: absolute;");
    expect(ruleFor(".overlay--top-right")).toContain("position: absolute;");
  });

  it("floats the diagrams panel on the right edge, leaving room for the zoom controls below it", () => {
    const rule = ruleFor(".diagrams-panel");
    expect(rule).toContain("position: absolute;");
    expect(rule).toContain("right:");
    expect(rule).toContain("--zoom-controls-height");
  });

  it("keeps the expanded editor toggle close to the diagram name input height", () => {
    const rule = ruleFor(".editor-panel__toggle-button");
    expect(rule).toContain("width: 34px;");
    expect(rule).toContain("height: 34px;");
  });

  it("keeps the editor panel CSS fallback size aligned with the default constants", () => {
    const rule = ruleFor(".editor-panel");
    expect(rule).toContain("width: 416px;");
    expect(rule).toContain("height: 720px;");
  });

  it("delays the New and Import tooltips on hover", () => {
    const rule =
      styles.match(/\.tooltip-control:hover \.app-tooltip--panel,[\s\S]*?\.tooltip-control:focus-within \.app-tooltip--panel \{[\s\S]*?\}/)?.[0] ?? "";

    expect(rule).toContain("transition-delay: 350ms;");
  });
});

describe("mobile workbench layout", () => {
  it("hides the mobile tab bar outside the mobile breakpoint", () => {
    const rule = ruleFor(".mobile-tab-bar");
    expect(rule).toContain("display: none;");
  });

  it("defines mobile tab, editor, and diagram rules under the phone breakpoint", () => {
    const mobileRule = styles.match(/@media \(max-width: 640px\) \{[\s\S]*?\.guide-backdrop/)?.[0] ?? "";

    expect(mobileRule).toContain(".mobile-tab-bar");
    expect(mobileRule).toContain('.app-shell[data-mobile-tab="code"] .react-flow');
    expect(mobileRule).toContain('.app-shell[data-mobile-tab="code"] .overlay--top-right');
    expect(mobileRule).toContain('.app-shell[data-mobile-tab="diagram"] .overlay--top-left');
    expect(mobileRule).toContain(".editor-panel");
    expect(mobileRule).toContain(".diagrams-panel");
  });

  it("keeps the hidden code-tab canvas measurable for React Flow fitting", () => {
    const tabbedCodeCanvasRule =
      styles.match(/\.app-shell\[data-layout-mode="mobile"\]\[data-mobile-tab="code"\] \.react-flow \{[\s\S]*?\}/)?.[0] ??
      "";
    const phoneCodeCanvasRule =
      styles.match(/\.app-shell\[data-mobile-tab="code"\] \.react-flow \{[\s\S]*?\}/)?.[0] ?? "";

    expect(tabbedCodeCanvasRule).toContain("visibility: hidden;");
    expect(tabbedCodeCanvasRule).toContain("pointer-events: none;");
    expect(tabbedCodeCanvasRule).not.toContain("display: none;");
    expect(phoneCodeCanvasRule).not.toContain("display: none;");
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

  it("allows long mobile editor lines to scroll horizontally instead of clipping", () => {
    const scrollerRule = styles.match(/\.source-editor__codemirror \.cm-scroller \{[\s\S]*?\}/)?.[0] ?? "";
    const contentRule = styles.match(/\.source-editor__codemirror \.cm-content \{[\s\S]*?\}/)?.[0] ?? "";
    const lineRule = styles.match(/\.source-editor__codemirror \.cm-line \{[\s\S]*?\}/)?.[0] ?? "";

    expect(scrollerRule).toContain("overflow-x: auto;");
    expect(contentRule).toContain("width: max-content;");
    expect(lineRule).toContain("white-space: pre;");
  });
});
