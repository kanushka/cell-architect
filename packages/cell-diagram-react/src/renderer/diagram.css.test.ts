import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(join(process.cwd(), "src/renderer/diagram.css"), "utf8");

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.#[\]]/g, (match) => `\\${match}`);
  const pattern = new RegExp(`${escaped} \\{[\\s\\S]*?\\}`);
  return styles.match(pattern)?.[0] ?? "";
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

  it("turns diagram construction motion off for reduced-motion users", () => {
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(reducedMotionRule).toContain(".diagram-node--position-animated");
    expect(reducedMotionRule).toContain("transition: none;");
    expect(reducedMotionRule).toContain(".diagram-edge--entering .react-flow__edge-path");
    expect(reducedMotionRule).toContain("animation: none;");
  });
});
