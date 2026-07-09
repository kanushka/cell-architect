import { describe, expect, it } from "vitest";
import { ProjectModel } from "../domain/cellModel";
import { toReactFlow } from "./flowLayout";

describe("toReactFlow", () => {
  it("routes boundary edges through gateway circles for active bounds", () => {
    const project: ProjectModel = {
      title: "Orders",
      cells: [
        {
          id: "main",
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
        }
      ],
      crossEdges: [],
      sharedExternals: []
    };

    const flow = toReactFlow(project);

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
    const project: ProjectModel = {
      title: "Orders",
      cells: [
        {
          id: "main",
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
        }
      ],
      crossEdges: [],
      sharedExternals: []
    };

    const flow = toReactFlow(project);
    const cell = flow.nodes.find((node) => node.id === "cell-main");
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
    const project: ProjectModel = {
      title: "UntitledCell",
      cells: [
        {
          id: "main",
          components: [{ id: "API", type: "service", line: 3 }],
          externals: [],
          edges: [
            {
              id: "north-north-API-5",
              source: "north",
              target: "API",
              direction: "north",
              kind: "exposure",
              line: 5
            },
            {
              id: "east-API-east-6",
              source: "API",
              target: "east",
              direction: "east",
              kind: "exposure",
              line: 6
            }
          ]
        }
      ],
      crossEdges: [],
      sharedExternals: []
    };

    const flow = toReactFlow(project);

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gateway-north",
          type: "gateway",
          data: expect.objectContaining({ direction: "north" })
        }),
        expect.objectContaining({
          id: "gateway-east",
          type: "gateway",
          data: expect.objectContaining({ direction: "east" })
        })
      ])
    );
    expect(flow.nodes.some((node) => node.id.startsWith("external-"))).toBe(false);
    expect(flow.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "north-north-API-5-gateway-component",
          data: expect.objectContaining({
            connectionId: "north-north-API-5",
            connectedNodeIds: ["gateway-north", "API"]
          }),
          source: "gateway-north",
          sourceHandle: "gateway-bottom-source",
          target: "API",
          targetHandle: "component-top-target"
        }),
        expect.objectContaining({
          id: "east-API-east-6-component-gateway",
          data: expect.objectContaining({
            connectionId: "east-API-east-6",
            connectedNodeIds: ["API", "gateway-east"]
          }),
          source: "API",
          sourceHandle: "component-right-source",
          target: "gateway-east",
          targetHandle: "gateway-left-target"
        })
      ])
    );
  });

  it("draws internal dependencies as arrows with a small arrow head", () => {
    const project: ProjectModel = {
      cells: [
        {
          id: "main",
          components: [
            { id: "WebApp", type: "web-app", line: 1 },
            { id: "OrderAPI", type: "api", line: 2 }
          ],
          externals: [],
          edges: [
            {
              id: "internal-WebApp-OrderAPI-3",
              source: "WebApp",
              target: "OrderAPI",
              direction: "internal",
              kind: "internal",
              line: 3
            }
          ]
        }
      ],
      crossEdges: [],
      sharedExternals: []
    };

    const flow = toReactFlow(project);
    const internalEdge = flow.edges.find((edge) => edge.id === "internal-WebApp-OrderAPI-3");

    expect(internalEdge?.markerEnd).toEqual(
      expect.objectContaining({
        type: "arrowclosed",
        width: 14,
        height: 14
      })
    );
  });

  it("uses display labels and external types from declarations", () => {
    const project: ProjectModel = {
      cells: [
        {
          id: "main",
          components: [{ id: "api", label: "OrderAPI", type: "api", line: 1 }],
          externals: [{ id: "inv", label: "InventoryAPI", type: "api", direction: "east", line: 2 }],
          edges: [
            {
              id: "east-api-inv-3",
              source: "api",
              target: "inv",
              direction: "east",
              kind: "outbound",
              line: 3
            }
          ]
        }
      ],
      crossEdges: [],
      sharedExternals: []
    };

    const flow = toReactFlow(project);

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api",
          data: expect.objectContaining({
            label: "OrderAPI",
            componentType: "api"
          })
        }),
        expect.objectContaining({
          id: "external-inv",
          data: expect.objectContaining({
            label: "InventoryAPI",
            externalType: "api"
          })
        })
      ])
    );
  });

  it("keeps single-cell node ids un-namespaced", () => {
    const project: ProjectModel = {
      cells: [{ id: "main", components: [{ id: "api" }], externals: [], edges: [] }],
      crossEdges: [],
      sharedExternals: []
    };
    const flow = toReactFlow(project);
    expect(flow.nodes.some((n) => n.id === "api")).toBe(true);
    expect(flow.nodes.some((n) => n.id === "cell-main")).toBe(true);
  });

  it("namespaces component ids and lays out multiple cells without overlapping", () => {
    const project: ProjectModel = {
      cells: [
        { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
        { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
      ],
      crossEdges: [],
      sharedExternals: []
    };
    const flow = toReactFlow(project);
    expect(flow.nodes.some((n) => n.id === "orders::api")).toBe(true);
    expect(flow.nodes.some((n) => n.id === "products::api")).toBe(true);
    const ordersCell = flow.nodes.find((n) => n.id === "cell-orders")!;
    const productsCell = flow.nodes.find((n) => n.id === "cell-products")!;
    // With no cross-cell edges, dagre (rankdir LR) places both cells in the same rank
    // and separates them along the perpendicular axis, so position differs on y here.
    expect(ordersCell.position).not.toEqual(productsCell.position);
  });

  it("positions a shared external once between the cells that use it", () => {
    const project: ProjectModel = {
      cells: [
        { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
        { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
      ],
      crossEdges: [],
      sharedExternals: [{ id: "s3", direction: "east" }]
    };
    const flow = toReactFlow(project);
    const sharedNodes = flow.nodes.filter((n) => n.id === "external-s3");
    expect(sharedNodes).toHaveLength(1);
  });

  it("emits a connected cross edge as component -> gateway -> gateway -> component using step edges", () => {
    const project: ProjectModel = {
      cells: [
        { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
        { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
      ],
      crossEdges: [
        {
          id: "x1",
          sourceCell: "orders",
          sourceComp: "api",
          targetCell: "products",
          targetComp: "api",
          exit: "east",
          entry: "west",
          mode: "connected",
          line: 1
        }
      ],
      sharedExternals: []
    };
    const flow = toReactFlow(project);
    const crossEdges = flow.edges.filter((e) => e.id.startsWith("x1"));
    expect(crossEdges).toHaveLength(3);
    expect(crossEdges.every((e) => e.type === "step")).toBe(true);
    expect(crossEdges.some((e) => e.source === "gateway-orders-east" && e.target === "gateway-products-west")).toBe(
      true
    );
    expect(crossEdges.some((e) => e.source === "orders::api" && e.target === "gateway-orders-east")).toBe(true);
    expect(crossEdges.some((e) => e.source === "gateway-products-west" && e.target === "products::api")).toBe(true);
  });

  it("does not render an edge for a decoupled cross edge yet", () => {
    const project: ProjectModel = {
      cells: [
        { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
        { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
      ],
      crossEdges: [
        {
          id: "d1",
          sourceCell: "orders",
          sourceComp: "api",
          targetCell: "products",
          targetComp: "api",
          exit: "south",
          entry: "north",
          mode: "decoupled",
          line: 1
        }
      ],
      sharedExternals: []
    };
    const flow = toReactFlow(project);
    expect(flow.edges.some((e) => e.id.startsWith("d1"))).toBe(false);
  });

  it("emits gateways for cross-edge exit/entry directions even without other boundary usage", () => {
    const project: ProjectModel = {
      cells: [
        { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
        { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
      ],
      crossEdges: [
        {
          id: "x1",
          sourceCell: "orders",
          sourceComp: "api",
          targetCell: "products",
          targetComp: "api",
          exit: "east",
          entry: "west",
          mode: "connected",
          line: 1
        }
      ],
      sharedExternals: []
    };
    const flow = toReactFlow(project);
    expect(flow.nodes.some((n) => n.id === "gateway-orders-east")).toBe(true);
    expect(flow.nodes.some((n) => n.id === "gateway-products-west")).toBe(true);
  });

  it("handles a mixed-axis connected cross edge (east exit into north entry)", () => {
    const project: ProjectModel = {
      cells: [
        { id: "orders", components: [{ id: "api" }], externals: [], edges: [] },
        { id: "products", components: [{ id: "api" }], externals: [], edges: [] }
      ],
      crossEdges: [
        {
          id: "x2",
          sourceCell: "orders",
          sourceComp: "api",
          targetCell: "products",
          targetComp: "api",
          exit: "east",
          entry: "north",
          mode: "connected",
          line: 1
        }
      ],
      sharedExternals: []
    };
    const flow = toReactFlow(project);
    const middleSegment = flow.edges.find((e) => e.id === "x2-gateway-gateway");
    expect(middleSegment?.source).toBe("gateway-orders-east");
    expect(middleSegment?.target).toBe("gateway-products-north");
    const lastSegment = flow.edges.find((e) => e.id === "x2-gateway-component");
    expect(lastSegment?.targetHandle).toBe("component-top-target");
  });
});
