import { describe, expect, it } from "vitest";
import { compileCellSource } from "../compiler/compileCellSource";
import { defaultSampleSource } from "../storage/defaultSample";
import { parseCellDsl } from "./parseCellDsl";

const orderSystemSource = `title OrderCell
version v1

component WebApp web-app
component OrderAPI api
component OrderService service
component OrderDB database
component EventPublisher event

north CustomerApp -> WebApp : HTTPS
west AdminPortal -> OrderAPI : backoffice

WebApp -> OrderAPI
OrderAPI -> OrderService
OrderService -> OrderDB
OrderService -> EventPublisher : order.created

OrderService -> east InventoryCell : reserve stock
OrderService -> south Stripe : payment`;

describe("parseCellDsl", () => {
  it("parses metadata, components, internal dependencies, and boundary dependencies", () => {
    const result = parseCellDsl(orderSystemSource);

    expect(result.diagnostics).toEqual([]);
    expect(result.document.title).toBe("OrderCell");
    expect(result.document.version).toBe("v1");
    expect(result.document.components).toHaveLength(5);
    expect(result.document.edges).toEqual([
      {
        id: "north-CustomerApp-WebApp-10",
        source: "CustomerApp",
        target: "WebApp",
        direction: "north",
        kind: "inbound",
        label: "HTTPS",
        line: 10
      },
      {
        id: "west-AdminPortal-OrderAPI-11",
        source: "AdminPortal",
        target: "OrderAPI",
        direction: "west",
        kind: "inbound",
        label: "backoffice",
        line: 11
      },
      {
        id: "internal-WebApp-OrderAPI-13",
        source: "WebApp",
        target: "OrderAPI",
        direction: "internal",
        kind: "internal",
        label: undefined,
        line: 13
      },
      {
        id: "internal-OrderAPI-OrderService-14",
        source: "OrderAPI",
        target: "OrderService",
        direction: "internal",
        kind: "internal",
        label: undefined,
        line: 14
      },
      {
        id: "internal-OrderService-OrderDB-15",
        source: "OrderService",
        target: "OrderDB",
        direction: "internal",
        kind: "internal",
        label: undefined,
        line: 15
      },
      {
        id: "internal-OrderService-EventPublisher-16",
        source: "OrderService",
        target: "EventPublisher",
        direction: "internal",
        kind: "internal",
        label: "order.created",
        line: 16
      },
      {
        id: "east-OrderService-InventoryCell-18",
        source: "OrderService",
        target: "InventoryCell",
        direction: "east",
        kind: "outbound",
        label: "reserve stock",
        line: 18
      },
      {
        id: "south-OrderService-Stripe-19",
        source: "OrderService",
        target: "Stripe",
        direction: "south",
        kind: "outbound",
        label: "payment",
        line: 19
      }
    ]);
  });

  it("reports line and column diagnostics for duplicate components and unknown syntax", () => {
    const result = parseCellDsl(`title Broken
component API service
component API service
API -- DB`);

    expect(result.diagnostics).toEqual([
      {
        severity: "error",
        message: "Component \"API\" is already defined.",
        line: 3,
        column: 11
      },
      {
        severity: "error",
        message: "Unknown statement. Expected title, version, component, or dependency arrow.",
        line: 4,
        column: 1
      }
    ]);
  });

  it("parses component to boundary direction as a gateway exposure", () => {
    const result = parseCellDsl(`title UntitledCell

component API service

API -> north`);

    expect(result.diagnostics).toEqual([]);
    expect(result.document.edges).toEqual([
      {
        id: "north-API-north-5",
        source: "API",
        target: "north",
        direction: "north",
        kind: "exposure",
        label: undefined,
        line: 5
      }
    ]);
  });
});

describe("compileCellSource", () => {
  it("compiles the bundled default sample", () => {
    const result = compileCellSource(defaultSampleSource);

    expect(result.diagnostics).toEqual([]);
    expect(result.model?.title).toBe("OrderCell");
  });

  it("creates a normalized model and external nodes for the order system sample", () => {
    const result = compileCellSource(orderSystemSource);

    expect(result.diagnostics).toEqual([]);
    expect(result.model).toMatchObject({
      title: "OrderCell",
      version: "v1"
    });
    expect(result.model?.components.map((component) => component.id)).toEqual([
      "WebApp",
      "OrderAPI",
      "OrderService",
      "OrderDB",
      "EventPublisher"
    ]);
    expect(result.model?.externals.map((external) => `${external.direction}:${external.id}`)).toEqual([
      "north:CustomerApp",
      "west:AdminPortal",
      "east:InventoryCell",
      "south:Stripe"
    ]);
  });

  it("rejects dependencies that point at undefined internal components", () => {
    const result = compileCellSource(`title Broken
component API service
API -> MissingService
north Customer -> MissingGateway
MissingWorker -> south Stripe`);

    expect(result.model).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        severity: "error",
        message: "Internal dependency target \"MissingService\" is not a defined component.",
        line: 3,
        column: 8
      },
      {
        severity: "error",
        message: "Inbound dependency target \"MissingGateway\" is not a defined component.",
        line: 4,
        column: 19
      },
      {
        severity: "error",
        message: "Outbound dependency source \"MissingWorker\" is not a defined component.",
        line: 5,
        column: 1
      }
    ]);
  });

  it("compiles gateway exposures without creating external nodes", () => {
    const result = compileCellSource(`title UntitledCell

component API service

API -> north`);

    expect(result.diagnostics).toEqual([]);
    expect(result.model?.externals).toEqual([]);
    expect(result.model?.edges).toEqual([
      expect.objectContaining({
        source: "API",
        target: "north",
        direction: "north",
        kind: "exposure"
      })
    ]);
  });
});
