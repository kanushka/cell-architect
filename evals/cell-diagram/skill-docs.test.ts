import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../../packages/cell-diagram-react/src/compiler/compileProject";

/**
 * Guards the skill's own examples.
 *
 * A skill teaches by example, so a broken snippet is worse than a missing one —
 * agents copy the shape before they read the prose. Two things are checked, and
 * the second exists because the first cannot catch it.
 */

const SKILL_DIR = join(__dirname, "..", "..", "skills", "cell-diagram");
const DOCS = [join(SKILL_DIR, "SKILL.md"), join(SKILL_DIR, "reference", "grammar.md")];

/** Fenced ```cell blocks, with their 1-indexed starting line. */
function cellBlocks(file: string): { src: string; line: number }[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/```cell\n([\s\S]*?)```/g)].map((m) => ({
    src: m[1],
    line: text.slice(0, m.index).split("\n").length
  }));
}

/**
 * Signature statements (`component <id> [as <label>] [type]`) and deliberate
 * error demonstrations are documentation, not documents, and are not expected
 * to compile.
 */
const isProse = (src: string) => /ERROR|^<|\[as |\[type\]/m.test(src) || !src.trim().includes("\n");

describe("skill examples", () => {
  it.each(DOCS)("%s: every whole-document block compiles", (file) => {
    cellBlocks(file).forEach(({ src, line }) => {
      if (isProse(src)) return;
      expect(compileProject(src).diagnostics, `${file}:${line}\n${src}`).toEqual([]);
    });
  });

  /**
   * Trailing comments do NOT produce a diagnostic — `a -> b # note` silently
   * becomes an edge to a component literally named `b # note`. The compile
   * check above therefore passes on corrupted examples, which is exactly how
   * these got into the skill in the first place. This is the only check that
   * catches them.
   */
  it.each(DOCS)("%s: no block uses a trailing comment", (file) => {
    const offenders: string[] = [];
    cellBlocks(file).forEach(({ src, line }) => {
      src.split("\n").forEach((raw, i) => {
        const statement = raw.trim();
        if (!statement || statement.startsWith("#") || statement.startsWith("//")) return;
        // Everything after " : " is a free-text label and may legitimately
        // contain # or //, so only inspect the statement before it, ignoring
        // quoted labels.
        const beforeLabel = statement.split(" : ")[0].replace(/"[^"]*"/g, "");
        if (/\S\s+(#|\/\/)/.test(beforeLabel)) {
          offenders.push(`${file}:${line + i}  ${statement}`);
        }
      });
    });
    expect(offenders, `Put these comments on their own line:\n${offenders.join("\n")}`).toEqual([]);
  });
});
