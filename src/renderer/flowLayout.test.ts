import { describe, expect, it } from "vitest";
import { CellDiagramModel } from "../domain/cellModel";
import { toReactFlow } from "./flowLayout";

describe("toReactFlow", () => {
  it("routes boundary edges through gateway circles for active bounds", () => {
    const model: CellDiagramModel = {
      title: "Orders",
      version: "v1",
      components: [{ id: "OrderAPI", type: "api", line: 3 }],
      externals: [
        { id: "CustomerApp", direction: "north" },
        { id: "Stripe", direction: "south" }
      ],
      edges: [
        {
          id: "north-CustomerApp-OrderAPI-4",
          source: "CustomerApp",
          target: "OrderAPI",
          direction: "north",
          kind: "inbound",
          line: 4
        },
        {
          id: "south-OrderAPI-Stripe-5",
          source: "OrderAPI",
          target: "Stripe",
          direction: "south",
          kind: "outbound",
          line: 5
        }
      ]
    };

    const flow = toReactFlow(model);

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gateway-north",
          type: "gateway",
          data: expect.objectContaining({ direction: "north" })
        }),
        expect.objectContaining({
          id: "gateway-south",
          type: "gateway",
          data: expect.objectContaining({ direction: "south" })
        })
      ])
    );
    expect(flow.nodes.find((node) => node.id === "gateway-east")).toBeUndefined();
    expect(flow.nodes.find((node) => node.id === "gateway-west")).toBeUndefined();
    expect(flow.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "north-CustomerApp-OrderAPI-4-external-gateway",
          data: expect.objectContaining({
            connectionId: "north-CustomerApp-OrderAPI-4",
            connectedNodeIds: ["external-CustomerApp", "gateway-north", "OrderAPI"]
          }),
          source: "external-CustomerApp",
          sourceHandle: "external-bottom-source",
          target: "gateway-north",
          targetHandle: "gateway-top-target"
        }),
        expect.objectContaining({
          id: "north-CustomerApp-OrderAPI-4-gateway-component",
          data: expect.objectContaining({
            connectionId: "north-CustomerApp-OrderAPI-4",
            connectedNodeIds: ["external-CustomerApp", "gateway-north", "OrderAPI"]
          }),
          source: "gateway-north",
          sourceHandle: "gateway-bottom-source",
          target: "OrderAPI",
          targetHandle: "component-top-target"
        }),
        expect.objectContaining({
          id: "south-OrderAPI-Stripe-5-component-gateway",
          source: "OrderAPI",
          sourceHandle: "component-bottom-source",
          target: "gateway-south",
          targetHandle: "gateway-top-target"
        }),
        expect.objectContaining({
          id: "south-OrderAPI-Stripe-5-gateway-external",
          source: "gateway-south",
          sourceHandle: "gateway-bottom-source",
          target: "external-Stripe",
          targetHandle: "external-top-target"
        })
      ])
    );
  });

  it("keeps north and south external components far enough apart for edge labels", () => {
    const model: CellDiagramModel = {
      title: "Orders",
      version: "v1",
      components: [{ id: "OrderAPI", type: "api", line: 3 }],
      externals: [
        { id: "CustomerApp", direction: "north" },
        { id: "PartnerPortal", direction: "north" },
        { id: "Stripe", direction: "south" },
        { id: "SendGrid", direction: "south" }
      ],
      edges: [
        {
          id: "north-CustomerApp-OrderAPI-4",
          source: "CustomerApp",
          target: "OrderAPI",
          direction: "north",
          kind: "inbound",
          label: "HTTPS",
          line: 4
        },
        {
          id: "north-PartnerPortal-OrderAPI-5",
          source: "PartnerPortal",
          target: "OrderAPI",
          direction: "north",
          kind: "inbound",
          label: "REST",
          line: 5
        },
        {
          id: "south-OrderAPI-Stripe-6",
          source: "OrderAPI",
          target: "Stripe",
          direction: "south",
          kind: "outbound",
          label: "payment",
          line: 6
        },
        {
          id: "south-OrderAPI-SendGrid-7",
          source: "OrderAPI",
          target: "SendGrid",
          direction: "south",
          kind: "outbound",
          label: "email",
          line: 7
        }
      ]
    };

    const flow = toReactFlow(model);
    const cell = flow.nodes.find((node) => node.id === "cell-boundary");
    const customerApp = flow.nodes.find((node) => node.id === "external-CustomerApp");
    const partnerPortal = flow.nodes.find((node) => node.id === "external-PartnerPortal");
    const stripe = flow.nodes.find((node) => node.id === "external-Stripe");
    const sendGrid = flow.nodes.find((node) => node.id === "external-SendGrid");

    expect(cell).toBeDefined();
    expect(customerApp).toBeDefined();
    expect(partnerPortal).toBeDefined();
    expect(stripe).toBeDefined();
    expect(sendGrid).toBeDefined();

    const cellBottom = cell!.position.y + Number(cell!.data.height);

    expect(Math.abs(customerApp!.position.x - partnerPortal!.position.x)).toBeGreaterThanOrEqual(230);
    expect(Math.abs(stripe!.position.x - sendGrid!.position.x)).toBeGreaterThanOrEqual(230);
    expect(cell!.position.y - customerApp!.position.y).toBeGreaterThanOrEqual(200);
    expect(stripe!.position.y - cellBottom).toBeGreaterThanOrEqual(100);
    expect(sendGrid!.position.y - cellBottom).toBeGreaterThanOrEqual(100);
  });

  it("routes gateway exposure edges without creating external nodes", () => {
    const model: CellDiagramModel = {
      title: "UntitledCell",
      components: [{ id: "API", type: "service", line: 3 }],
      externals: [],
      edges: [
        {
          id: "north-API-north-5",
          source: "API",
          target: "north",
          direction: "north",
          kind: "exposure",
          line: 5
        }
      ]
    };

    const flow = toReactFlow(model);

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gateway-north",
          type: "gateway",
          data: expect.objectContaining({ direction: "north" })
        })
      ])
    );
    expect(flow.nodes.some((node) => node.id.startsWith("external-"))).toBe(false);
    expect(flow.edges).toEqual([
      expect.objectContaining({
        id: "north-API-north-5-component-gateway",
        data: expect.objectContaining({
          connectionId: "north-API-north-5",
        connectedNodeIds: ["API", "gateway-north"]
        }),
        source: "API",
        sourceHandle: "component-top-source",
        target: "gateway-north",
        targetHandle: "gateway-top-target"
      })
    ]);
  });
});
