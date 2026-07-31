import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../../packages/cell-diagram-react/src/compiler/compileProject";
import type { ExternalNode, ProjectModel } from "../../packages/cell-diagram-react/src/domain/cellModel";

/**
 * Scores skill eval runs.
 *
 * Each case is a prose architecture brief (`cases/<id>/prompt.md`) plus
 * name-insensitive expectations (`cases/<id>/expect.json`). A run is a `.cell`
 * document an agent produced for that brief, stored under `runs/<arm>/<id>.cell`.
 *
 * Two tiers:
 *   1. Hard  — the document compiles with zero diagnostics.
 *   2. Rubric — the compiled model places things where a cell architect would.
 *
 * Checks match on regex against ids AND labels rather than exact ids, because
 * the agent picks the names. What is being scored is placement, not naming.
 */

const CASES_DIR = join(__dirname, "cases");
const RUNS_DIR = join(__dirname, "runs");

type Check =
  | { kind: "cellCount"; n: number; desc: string }
  | { kind: "componentMatching"; pattern: string; desc: string }
  | { kind: "externalOn"; direction: string; pattern: string; desc: string }
  | { kind: "inboundOn"; direction: string; desc: string }
  | { kind: "noExternalMatching"; pattern: string; desc: string }
  | { kind: "externalCount"; max: number; desc: string }
  | { kind: "edgeKind"; edgeKind: string; min: number; desc: string }
  | { kind: "crossEdgeCount"; min: number; desc: string }
  | { kind: "crossEdgeMode"; mode: string; min: number; desc: string }
  | { kind: "sharedExternal"; pattern: string; minCells: number; desc: string }
  | { kind: "projectTitle"; pattern: string; desc: string }
  | { kind: "cellLabel"; pattern: string; desc: string }
  | { kind: "cellVersion"; pattern: string; desc: string };

interface CaseSpec {
  title: string;
  checks: Check[];
}

const rx = (pattern: string) => new RegExp(pattern, "i");

/** An external's identity for matching purposes: its id and its display label. */
const names = (node: { id: string; label?: string }) => `${node.id} ${node.label ?? ""}`;

function allExternals(model: ProjectModel): ExternalNode[] {
  return [...model.sharedExternals, ...model.cells.flatMap((cell) => cell.externals)];
}

function runCheck(check: Check, model: ProjectModel): boolean {
  switch (check.kind) {
    case "cellCount":
      return model.cells.length === check.n;
    case "componentMatching":
      return model.cells.some((cell) => cell.components.some((c) => rx(check.pattern).test(names(c))));
    case "externalOn":
      return allExternals(model).some(
        (e) => e.direction === check.direction && rx(check.pattern).test(names(e))
      );
    case "inboundOn":
      // Traffic crosses this boundary either via a declared external or via a
      // bare gateway exposure. Which one is right depends on whether the
      // counterpart has an identity, so the rubric accepts both.
      return (
        allExternals(model).some((e) => e.direction === check.direction) ||
        model.cells
          .flatMap((c) => c.edges)
          .some((e) => e.kind === "exposure" && e.direction === check.direction)
      );
    case "noExternalMatching":
      return !allExternals(model).some((e) => rx(check.pattern).test(names(e)));
    case "externalCount":
      return allExternals(model).length <= check.max;
    case "edgeKind":
      return model.cells.flatMap((c) => c.edges).filter((e) => e.kind === check.edgeKind).length >= check.min;
    case "crossEdgeCount":
      return model.crossEdges.length >= check.min;
    case "crossEdgeMode":
      return model.crossEdges.filter((e) => e.mode === check.mode).length >= check.min;
    case "sharedExternal":
      // compileProject only promotes an external to `sharedExternals` when two
      // or more cells declare the same id, so presence here IS the ">= 2 cells" proof.
      return model.sharedExternals.some((e) => rx(check.pattern).test(names(e)));
    case "projectTitle":
      return rx(check.pattern).test(model.title ?? "");
    case "cellLabel":
      return model.cells.some((cell) => rx(check.pattern).test(cell.label ?? ""));
    case "cellVersion":
      return model.cells.some((cell) => rx(check.pattern).test(cell.version ?? ""));
  }
}

const caseIds = readdirSync(CASES_DIR).sort();
// `_`-prefixed arms are recorded as evidence but deliberately not scored — the
// no-reference control does not produce .cell syntax at all, so scoring it
// would mean a permanently red test rather than a useful signal.
const arms = existsSync(RUNS_DIR)
  ? readdirSync(RUNS_DIR)
      .filter((arm) => !arm.startsWith("_"))
      .filter((arm) => readdirSync(join(RUNS_DIR, arm)).some((f) => f.endsWith(".cell")))
  : [];

describe.each(arms)("arm: %s", (arm) => {
  describe.each(caseIds)("%s", (caseId) => {
    const runPath = join(RUNS_DIR, arm, `${caseId}.cell`);
    const spec: CaseSpec = JSON.parse(readFileSync(join(CASES_DIR, caseId, "expect.json"), "utf8"));

    if (!existsSync(runPath)) {
      it.skip(`no run recorded for ${arm}`, () => {});
      return;
    }

    const source = readFileSync(runPath, "utf8");
    const result = compileProject(source);

    it("compiles with zero diagnostics", () => {
      expect(result.diagnostics).toEqual([]);
    });

    spec.checks.forEach((check) => {
      it(check.desc, () => {
        expect(result.model, "document did not compile, so the model is null").not.toBeNull();
        expect(runCheck(check, result.model!)).toBe(true);
      });
    });
  });
});
