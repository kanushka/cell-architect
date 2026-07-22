import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  applyCustomLayout,
  captureCustomPosition,
  createCustomLayout,
  parsePortableSource,
  PORTABLE_LAYOUT_PREFIX,
  serializePortableSource
} from "./customLayout";

const source = "cell orders {\n  component api\n  east s3\n  api -> s3\n}";

function baseNodes(): Node[] {
  return [
    {
      id: "cell-orders",
      type: "cellBoundary",
      position: { x: 100, y: 200 },
      data: { layoutKind: "cell", cellId: "orders", width: 640, height: 640 }
    },
    {
      id: "orders::api",
      type: "component",
      position: { x: 300, y: 400 },
      data: { layoutKind: "component", cellId: "orders" }
    },
    {
      id: "external-orders-s3",
      type: "external",
      position: { x: 890, y: 460 },
      data: { layoutKind: "external", cellId: "orders", direction: "east" }
    },
    {
      id: "external-shared",
      type: "external",
      position: { x: 900, y: 300 },
      data: { layoutKind: "shared-external" }
    },
    {
      id: "gateway-orders-east",
      type: "gateway",
      position: { x: 723, y: 503 },
      data: { layoutKind: "gateway", cellId: "orders", direction: "east" }
    }
  ];
}

describe("custom layout", () => {
  it("captures and reapplies internal positions relative to their cell", () => {
    const nodes = baseNodes();
    const dragged = { ...nodes[1], position: { x: 430, y: 510 } };
    const layout = captureCustomPosition(null, source, dragged, nodes);

    expect(layout?.nodes["orders::api"]).toEqual({
      kind: "component",
      cellId: "orders",
      x: 330,
      y: 310
    });
    expect(applyCustomLayout(nodes, layout).find((node) => node.id === "orders::api")?.position).toEqual({
      x: 430,
      y: 510
    });
  });

  it("clamps internal components inside their cell padding", () => {
    const nodes = baseNodes();
    const dragged = { ...nodes[1], position: { x: -500, y: 2000 } };
    const layout = captureCustomPosition(null, source, dragged, nodes);

    expect(applyCustomLayout(nodes, layout).find((node) => node.id === "orders::api")?.position).toEqual({
      x: 172,
      y: 656
    });
  });

  it("stores a local external as an offset along its declared side", () => {
    const nodes = baseNodes();
    const dragged = { ...nodes[2], position: { x: 400, y: 307 } };
    const layout = captureCustomPosition(null, source, dragged, nodes);

    expect(layout?.nodes["external-orders-s3"]).toEqual({
      kind: "external",
      cellId: "orders",
      side: "east",
      offset: 0.2
    });
    expect(applyCustomLayout(nodes, layout).find((node) => node.id === "external-orders-s3")?.position).toEqual({
      x: 890,
      y: 306.8
    });
  });

  it("projects shared externals outside cell interiors", () => {
    const nodes = baseNodes();
    const dragged = { ...nodes[3], position: { x: 300, y: 350 } };
    const layout = captureCustomPosition(null, source, dragged, nodes);
    const position = applyCustomLayout(nodes, layout).find((node) => node.id === "external-shared")?.position;

    expect(position).toEqual({ x: 300, y: 94 });
  });

  it("does not capture gateways or cell boundaries", () => {
    const nodes = baseNodes();
    expect(captureCustomPosition(null, source, nodes[0], nodes)).toBeNull();
    expect(captureCustomPosition(null, source, nodes[4], nodes)).toBeNull();
  });

  it("round-trips an opaque portable layout line", () => {
    const layout = captureCustomPosition(null, source, { ...baseNodes()[1], position: { x: 430, y: 510 } }, baseNodes());
    const portable = serializePortableSource(source, layout);

    expect(portable.split("\n").at(-1)).toMatch(/^# @layout=\S+$/);
    expect(parsePortableSource(portable)).toEqual({ source, layout, layoutError: false });
  });

  it("omits metadata for an empty layout", () => {
    expect(serializePortableSource(source, createCustomLayout(source))).toBe(source);
  });

  it("ignores malformed, duplicate, and stale metadata", () => {
    const malformed = `${source}\n${PORTABLE_LAYOUT_PREFIX}garbage`;
    expect(parsePortableSource(malformed)).toMatchObject({ source, layout: null, layoutError: true });

    const layout = captureCustomPosition(null, source, { ...baseNodes()[1], position: { x: 430, y: 510 } }, baseNodes());
    const portable = serializePortableSource(source, layout);
    expect(parsePortableSource(`${portable}\n${portable.split("\n").at(-1)}`)).toMatchObject({
      source,
      layout: null,
      layoutError: true
    });
    expect(parsePortableSource(portable.replace("component api", "component changed"))).toMatchObject({
      layout: null,
      layoutError: true
    });
  });
});
