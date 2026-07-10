import { compileProject } from "../compiler/compileProject";
import sample from "./__fixtures__/wso2-sample.json";
import type { Wso2CellModel, Wso2Component } from "./wso2Model";
import { wso2ToDsl } from "./wso2ToDsl";

const REFERENCE_MODEL = sample as unknown as Wso2CellModel;

function svc(id: string, internet: boolean, intranet: boolean) {
  return {
    [id]: {
      id,
      type: "http",
      deploymentMetadata: {
        gateways: {
          internet: { isExposed: internet },
          intranet: { isExposed: intranet }
        }
      }
    }
  };
}

describe("wso2ToDsl — components and exposures", () => {
  it("emits a component per entry and north/west exposures from gateways", () => {
    const model: Wso2CellModel = {
      id: "A",
      name: "A",
      components: [
        { id: "Users", type: "service", services: svc("A:A:Users:get", true, true), connections: [] },
        { id: "Products", type: "service", services: svc("A:A:Products:get", false, false), connections: [] },
        { id: "Invoices", type: "service", services: svc("A:A:Invoices:get", false, true), connections: [] }
      ]
    };
    const dsl = wso2ToDsl(model);
    expect(dsl).toContain("component Users api");
    expect(dsl).toContain("component Products api");
    expect(dsl).toContain("component Invoices api");
    expect(dsl).toContain("north -> Users");
    expect(dsl).toContain("west -> Users");
    expect(dsl).toContain("west -> Invoices");
    expect(dsl).not.toContain("north -> Products");
    // Must be valid DSL:
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });
});

function comp(id: string, connections: Wso2Component["connections"]): Wso2Component {
  return { id, type: "service", services: {}, connections };
}

describe("wso2ToDsl — connections", () => {
  it("same-project 4-part id becomes an internal edge to the component", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Users", [{ id: "ABC:A:Products:basepath", onPlatform: true }]), comp("Products", [])]
    });
    expect(dsl).toContain("Users -> Products");
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("different-project 4-part id becomes an east external and edge", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Invoices", [{ id: "ABC:B:Invoices:post", label: "Org Invoices", type: "http", onPlatform: true }])]
    });
    expect(dsl).toContain('east oi as "Org Invoices" api');
    expect(dsl).toContain("Invoices -> oi");
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("URI/datastore connection becomes a south external", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Users", [{ id: "googleapps://firebase", label: "Firebase", type: "datastore", onPlatform: false }])]
    });
    expect(dsl).toContain("south Firebase database");
    expect(dsl).toContain("Users -> Firebase");
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("drops observationOnly connections entirely", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Products", [{ id: "ABC:B:Users:get", label: "Org Users", onPlatform: true, observationOnly: true }])]
    });
    expect(dsl).not.toContain("Org Users");
    expect(dsl).not.toContain("-> ou");
  });

  it("dedupes a shared external id across components into one declaration with merged label", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [
        comp("Products", [{ id: "mysql://mysql", onPlatform: true, type: "datastore" }]),
        comp("Invoices", [{ id: "mysql://mysql", label: "MySQL DB", onPlatform: false, type: "datastore" }])
      ]
    });
    const southDeclCount = dsl.split("\n").filter((l) => l.startsWith("south ") && l.includes("MySQL DB")).length;
    expect(southDeclCount).toBe(1);
    expect(dsl).toMatch(/Products -> \w+/);
    expect(dsl).toMatch(/Invoices -> \w+/);
    expect(compileProject(dsl).diagnostics).toEqual([]);
  });

  it("derives an id from an unlabeled URI connection", () => {
    const dsl = wso2ToDsl({
      id: "A", name: "A",
      components: [comp("Products", [{ id: "mysql://mysql", onPlatform: true, type: "datastore" }])]
    });
    expect(dsl).toContain("south mysql database");
    expect(dsl).toContain("Products -> mysql");
  });
});

describe("wso2ToDsl — reference model", () => {
  it("produces valid DSL that compiles without diagnostics", () => {
    const dsl = wso2ToDsl(REFERENCE_MODEL);
    const result = compileProject(dsl);
    expect(result.diagnostics).toEqual([]);
    expect(result.model).not.toBeNull();
    // Transactions is isolated (its only connection was observationOnly):
    expect(dsl).toContain("component Transactions api");
    expect(dsl).not.toMatch(/Transactions ->/);
    // Snapshot the text for regression:
    expect(dsl).toMatchSnapshot();
  });
});
