import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { classifyDiagramMotion } from "./diagramMotion";

function node(id: string, type = "component", motionKey?: string): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { motionKey } };
}

function edge(id: string, source: string, target: string, label?: string): Edge {
  return { id, source, target, type: "smoothstep", label };
}

describe("classifyDiagramMotion", () => {
  it("does not animate every element on the first render", () => {
    const result = classifyDiagramMotion(null, [node("cell-main", "cellBoundary"), node("api")], [], "doc-1");

    expect(result.enteringNodeIds).toEqual(new Set());
    expect(result.movingNodeIds).toEqual(new Set());
    expect(result.enteringEdgeIds).toEqual(new Set());
  });

  it("classifies new circles and connections while keeping surviving nodes movable", () => {
    const initial = classifyDiagramMotion(null, [node("cell-main", "cellBoundary"), node("api")], [], "doc-1");
    const next = classifyDiagramMotion(
      initial.snapshot,
      [node("cell-main", "cellBoundary"), node("api"), node("worker")],
      [edge("internal-api-worker-4", "api", "worker")],
      "doc-1"
    );

    expect(next.enteringNodeIds).toEqual(new Set(["worker"]));
    expect(next.movingNodeIds).toEqual(new Set(["cell-main", "api"]));
    expect(next.enteringEdgeIds).toEqual(new Set(["internal-api-worker-4"]));
  });

  it("uses connection semantics instead of line-number-based edge ids", () => {
    const initial = classifyDiagramMotion(
      null,
      [node("api"), node("db")],
      [edge("internal-api-db-3", "api", "db")],
      "doc-1"
    );
    const next = classifyDiagramMotion(
      initial.snapshot,
      [node("api"), node("db"), node("worker")],
      [edge("internal-api-db-4", "api", "db")],
      "doc-1"
    );

    expect(next.enteringEdgeIds).toEqual(new Set());
  });

  it("does not treat label-only changes as new graph elements", () => {
    const initial = classifyDiagramMotion(
      null,
      [node("api"), node("db")],
      [edge("internal-api-db-3", "api", "db", "calls")],
      "doc-1"
    );
    const next = classifyDiagramMotion(
      initial.snapshot,
      [node("api"), node("db")],
      [edge("internal-api-db-3", "api", "db", "requests")],
      "doc-1"
    );

    expect(next.enteringNodeIds).toEqual(new Set());
    expect(next.enteringEdgeIds).toEqual(new Set());
  });

  it("does not replay a circle entrance while an identifier is being renamed", () => {
    const initial = classifyDiagramMotion(
      null,
      [node("cell-main", "cellBoundary"), node("W", "component", "main:component:2")],
      [],
      "doc-1"
    );
    const nextKeystroke = classifyDiagramMotion(
      initial.snapshot,
      [node("cell-main", "cellBoundary"), node("Wo", "component", "main:component:2")],
      [],
      "doc-1"
    );

    expect(nextKeystroke.enteringNodeIds).toEqual(new Set());
  });

  it("still animates a new component inserted on a line previously occupied by an existing component", () => {
    const initial = classifyDiagramMotion(
      null,
      [node("API", "component", "main:component:2")],
      [],
      "doc-1"
    );
    const inserted = classifyDiagramMotion(
      initial.snapshot,
      [node("Worker", "component", "main:component:2"), node("API", "component", "main:component:3")],
      [],
      "doc-1"
    );

    expect(inserted.enteringNodeIds).toEqual(new Set(["Worker"]));
  });

  it("does not replay connections when a connected identifier is renamed", () => {
    const initial = classifyDiagramMotion(
      null,
      [node("Worker", "component", "main:component:1"), node("DB", "component", "main:component:2")],
      [edge("internal-Worker-DB-3", "Worker", "DB")],
      "doc-1"
    );
    const renamed = classifyDiagramMotion(
      initial.snapshot,
      [node("JobRunner", "component", "main:component:1"), node("DB", "component", "main:component:2")],
      [edge("internal-JobRunner-DB-3", "JobRunner", "DB")],
      "doc-1"
    );

    expect(renamed.enteringNodeIds).toEqual(new Set());
    expect(renamed.enteringEdgeIds).toEqual(new Set());
  });

  it("resets motion history when the document context changes", () => {
    const initial = classifyDiagramMotion(null, [node("api")], [], "doc-1");
    const next = classifyDiagramMotion(initial.snapshot, [node("api"), node("worker")], [], "doc-2");

    expect(next.enteringNodeIds).toEqual(new Set());
    expect(next.movingNodeIds).toEqual(new Set());
  });
});
