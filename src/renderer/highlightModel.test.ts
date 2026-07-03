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
        "internal-OrderAPI-OrderService-15",
        "internal-OrderService-OrderDB-16",
        "internal-OrderService-EventPublisher-17",
        "east-OrderService-InventoryCell-19",
        "east-OrderService-CustomerCell-20",
        "south-OrderService-Stripe-21",
        "south-OrderService-SendGrid-22"
      ])
    );
    expect(Array.from(highlightedNodeIds)).toEqual(
      expect.arrayContaining([
        "OrderService",
        "OrderDB",
        "EventPublisher",
        "gateway-east",
        "external-InventoryCell",
        "gateway-south",
        "external-Stripe"
      ])
    );
  });
});
