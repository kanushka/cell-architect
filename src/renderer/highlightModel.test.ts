import { describe, expect, it } from "vitest";
import { compileCellSource } from "../compiler/compileCellSource";
import { defaultSampleSource } from "../storage/defaultSample";
import { toReactFlow } from "./flowLayout";
import { connectionIdsForNode, highlightedNodeIdsForConnections } from "./highlightModel";

describe("highlightModel", () => {
  it("finds every connection linked to a hovered component", () => {
    const compiled = compileCellSource(defaultSampleSource);

    expect(compiled.model).not.toBeNull();

    const flow = toReactFlow(compiled.model!);
    const connectionIds = connectionIdsForNode(flow.edges, "orders");
    const highlightedNodeIds = highlightedNodeIdsForConnections(flow.edges, new Set(connectionIds));

    expect(connectionIds).toEqual(
      expect.arrayContaining([
        "north-pp-orders-15",
        "west-ap-orders-16",
        "internal-WebApp-orders-18",
        "internal-orders-odb-19",
        "internal-orders-ep-20",
        "east-orders-inventories-22",
        "east-orders-customers-23",
        "south-orders-Stripe-24",
        "south-orders-SendGrid-25"
      ])
    );
    expect(Array.from(highlightedNodeIds)).toEqual(
      expect.arrayContaining([
        "orders",
        "odb",
        "ep",
        "gateway-east",
        "external-inventories",
        "gateway-south",
        "external-Stripe"
      ])
    );
  });
});
