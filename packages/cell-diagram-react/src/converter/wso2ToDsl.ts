import type { Wso2CellModel, Wso2Component, Wso2ConvertOptions } from "./wso2Model";

function mapComponentType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  if (type === "service") return "api";
  return type;
}

function isExposed(component: Wso2Component, gateway: "internet" | "intranet"): boolean {
  const services = component.services ?? {};
  return Object.values(services).some(
    (service) => service.deploymentMetadata?.gateways?.[gateway]?.isExposed === true
  );
}

export function wso2ToDsl(model: Wso2CellModel, options: Wso2ConvertOptions = {}): string {
  const components = model.components ?? [];
  const lines: string[] = [];

  if (options.title && model.name) {
    lines.push(`title ${model.name}`, "");
  }

  for (const component of components) {
    const type = mapComponentType(component.type);
    lines.push(`component ${component.id}${type ? ` ${type}` : ""}`);
  }

  const north: string[] = [];
  const west: string[] = [];
  for (const component of components) {
    if (isExposed(component, "internet")) north.push(component.id);
    if (isExposed(component, "intranet")) west.push(component.id);
  }

  if (north.length || west.length) {
    lines.push("");
    for (const id of north) lines.push(`north -> ${id}`);
    for (const id of west) lines.push(`west -> ${id}`);
  }

  return lines.join("\n") + "\n";
}
