import { describe, expect, it } from "vitest";
import { compileProject } from "../compiler/compileProject";
import { defaultSampleSource } from "../test/defaultSample";
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

  it("groups highlighted nodes for a namespaced cross-cell connection", () => {
    const edges = [
      {
        id: "x1-component-gateway",
        data: {
          connectionId: "x1",
          connectedNodeIds: ["orders::api", "gateway-orders-east", "gateway-products-west", "products::api"]
        }
      }
    ];
    const highlighted = highlightedNodeIdsForConnections(edges, new Set(["x1"]));
    expect(highlighted.has("orders::api")).toBe(true);
    expect(highlighted.has("products::api")).toBe(true);
  });
});
