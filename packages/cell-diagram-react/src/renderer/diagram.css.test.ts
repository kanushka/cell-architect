import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/renderer/diagram.css"), "utf8");

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.#[\]]/g, (match) => `\\${match}`);
  const pattern = new RegExp(`${escaped} \\{[\\s\\S]*?\\}`);
  return styles.match(pattern)?.[0] ?? "";
}

const lightTokenBlock = styles.match(/:where\(\.cell-diagram-root\) \{[\s\S]*?\n\}/)?.[0] ?? "";
const darkTokenBlock =
  styles.match(/\.cell-diagram-root\[data-cd-theme="dark"\] \{[\s\S]*?\n\}/)?.[0] ?? "";

function themeTokensIn(block: string) {
  return new Set([...block.matchAll(/(--cd-[a-z-]+):/g)].map((match) => match[1]));
}

describe("diagram interaction styles", () => {
  it("does not resize nodes while highlighting connections", () => {
    const highlightRule = styles.match(/\.connection-highlight-node \.component-node,[\s\S]*?\}/)?.[0] ?? "";
    expect(highlightRule).not.toBe("");
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

  it("defines a coherent live-edit motion sequence", () => {
    expect(ruleFor(".diagram-node--position-animated")).toContain("transition: transform");
    expect(styles).toContain("@keyframes diagram-node-arrive");
    expect(styles).toContain("@keyframes diagram-edge-arrive");
    expect(styles).toContain("--diagram-edge-enter-delay: 80ms;");
  });

  it("visually distinguishes temporary layout state and disabled auto arrange", () => {
    expect(ruleFor(".canvas-notification")).toContain("position: absolute;");
    expect(ruleFor(".canvas-notification")).toContain("pointer-events: none;");
    expect(ruleFor('.canvas-notification[data-tone="warning"]')).toContain("var(--cd-warn-border)");
    expect(ruleFor('.canvas-notification[data-mode="message"]')).toContain("canvas-notification-pop");
    expect(ruleFor(".zoom-controls__auto:disabled")).toContain("cursor: not-allowed;");
  });

  it("keeps every rendered color behind a theme token", () => {
    expect(lightTokenBlock).not.toBe("");
    expect(darkTokenBlock).not.toBe("");

    const rules = styles.replace(lightTokenBlock, "").replace(darkTokenBlock, "");

    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rules).not.toMatch(/\brgba?\(/);
  });

  it("overrides every light token in the dark theme", () => {
    const lightTokens = themeTokensIn(lightTokenBlock);
    const darkTokens = themeTokensIn(darkTokenBlock);

    expect(lightTokens.size).toBeGreaterThan(0);
    const missing = [...lightTokens].filter((token) => !darkTokens.has(token));
    expect(missing).toEqual([]);
  });

  it("turns diagram construction motion off for reduced-motion users", () => {
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(reducedMotionRule).toContain(".diagram-node--position-animated");
    expect(reducedMotionRule).toContain("transition: none;");
    expect(reducedMotionRule).toContain(".diagram-edge--entering .react-flow__edge-path");
    expect(reducedMotionRule).toContain("animation: none;");
  });
});
