import { compileProject } from "../compiler/compileProject";
import type { Wso2CellModel } from "./wso2Model";
import { wso2ToDsl } from "./wso2ToDsl";

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
