import { describe, expect, it } from "vitest";
import { compileProject } from "../compiler/compileProject";
import { defaultSampleSource } from "../storage/defaultSample";
import { toReactFlow } from "./flowLayout";
import { connectionIdsForNode, highlightedNodeIdsForConnections } from "./highlightModel";

describe("highlightModel", () => {
  it("finds every connection linked to a hovered component", () => {
    const compiled = compileProject(defaultSampleSource);

    expect(compiled.model).not.toBeNull();

    const flow = toReactFlow(compiled.model!);
    const connectionIds = connectionIdsForNode(flow.edges, "orders");
    const highlightedNodeIds = highlightedNodeIdsForConnections(flow.edges, new Set(connectionIds));

    expect(connectionIds).toEqual(
      expect.arrayContaining([
        "north-pp-orders-13",
        "west-ap-orders-14",
        "internal-WebApp-orders-15",
        "internal-orders-odb-16",
        "internal-orders-ep-17",
        "east-orders-inventories-18",
        "east-orders-customers-19",
        "south-orders-Stripe-20",
        "south-orders-SendGrid-21"
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
