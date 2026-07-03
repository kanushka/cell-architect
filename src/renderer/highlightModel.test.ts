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
    const connectionIds = connectionIdsForNode(flow.edges, "OrderService");
    const highlightedNodeIds = highlightedNodeIdsForConnections(flow.edges, new Set(connectionIds));

    expect(connectionIds).toEqual(
      expect.arrayContaining([
        "internal-api-OrderService-23",
        "internal-OrderService-odb-24",
        "internal-OrderService-EventPublisher-25",
        "east-OrderService-InventoryAPI-27",
        "east-OrderService-CustomerCell-28",
        "south-OrderService-Stripe-29",
        "south-OrderService-SendGrid-30"
      ])
    );
    expect(Array.from(highlightedNodeIds)).toEqual(
      expect.arrayContaining([
        "OrderService",
        "odb",
        "EventPublisher",
        "gateway-east",
        "external-InventoryAPI",
        "gateway-south",
        "external-Stripe"
      ])
    );
  });
});
