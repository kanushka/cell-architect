import type {
  Wso2CellModel,
  Wso2Component,
  Wso2ConvertOptions
} from "./wso2Model";

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

// A platform component reference is `org:project:component` with an optional
// `:resource` suffix — i.e. 3 or 4 colon-separated segments. `[1]` is the
// project and `[2]` is the component. URIs (`scheme://host`) have only 2
// segments and are excluded, so they fall through to the south/external branch.
const COMPONENT_REF = /^[^:\s]+:[^:\s]+:[^:\s]+(:[^:\s]+)?$/;
const SIMPLE_ID = /^[A-Za-z0-9_-]+$/;

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function lastSegment(id: string): string {
  const afterScheme = id.includes("://") ? id.slice(id.indexOf("://") + 3) : id;
  const parts = afterScheme.split(/[/:]+/).filter(Boolean);
  return slug(parts[parts.length - 1] ?? afterScheme);
}

/** Decide the DSL id and whether an `as "label"` alias is needed. */
function baseAlias(label: string | undefined, rawId: string): { id: string; withAlias: boolean; label?: string } {
  if (label && label.trim()) {
    const words = label.trim().split(/\s+/);
    if (words.length > 1) {
      const initials = words.map((w) => w[0]?.toLowerCase() ?? "").join("");
      return { id: initials || slug(label), withAlias: true, label: label.trim() };
    }
    const single = words[0];
    return SIMPLE_ID.test(single)
      ? { id: single, withAlias: false }
      : { id: slug(single), withAlias: false };
  }
  return { id: lastSegment(rawId), withAlias: false };
}

type Direction = "east" | "south";

interface ExternalDecl {
  id: string;             // resolved unique DSL id
  direction: Direction;
  label?: string;         // only when an alias is needed
  type?: string;
}

export function wso2ToDsl(model: Wso2CellModel, options: Wso2ConvertOptions = {}): string {
  const components = model.components ?? [];
  const project = model.id;
  const componentIds = new Set(components.map((c) => c.id));

  const north: string[] = [];
  const west: string[] = [];
  for (const component of components) {
    if (isExposed(component, "internet")) north.push(component.id);
    if (isExposed(component, "intranet")) west.push(component.id);
  }

  // First pass: resolve each external connection id to a stable DSL id, dedup, merge label/type.
  const externalsByRawId = new Map<string, ExternalDecl>();
  const usedIds = new Set<string>(componentIds);

  function ensureUnique(candidate: string): string {
    let id = candidate || "ext";
    let n = 2;
    while (usedIds.has(id)) id = `${candidate}${n++}`;
    usedIds.add(id);
    return id;
  }

  interface Edge { source: string; target: string; }
  const edges: Edge[] = [];
  const seenEdges = new Set<string>();
  function addEdge(source: string, target: string) {
    const key = `${source}->${target}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      edges.push({ source, target });
    }
  }

  function registerExternal(raw: string, direction: Direction, label: string | undefined, type: string | undefined): string {
    const existing = externalsByRawId.get(raw);
    if (existing) {
      if (!existing.label && label) {
        const rebuilt = baseAlias(label, raw);
        if (rebuilt.withAlias) { existing.label = rebuilt.label; }
      }
      if (!existing.type && type) existing.type = type;
      return existing.id;
    }
    const base = baseAlias(label, raw);
    const decl: ExternalDecl = {
      id: ensureUnique(base.id),
      direction,
      label: base.withAlias ? base.label : undefined,
      type
    };
    externalsByRawId.set(raw, decl);
    return decl.id;
  }

  for (const component of components) {
    for (const connection of component.connections ?? []) {
      if (connection.observationOnly === true) continue;

      if (COMPONENT_REF.test(connection.id)) {
        const parts = connection.id.split(":");
        const connProject = parts[1];
        const targetComponent = parts[2];
        if (connProject === project && componentIds.has(targetComponent)) {
          addEdge(component.id, targetComponent); // internal, declared target
        } else {
          // Same project but not a declared component, or a different project entirely: external.
          const id = registerExternal(connection.id, "east", connection.label, "api");
          addEdge(component.id, id);
        }
      } else {
        const type = connection.type === "datastore" ? "database" : connection.type;
        const id = registerExternal(connection.id, "south", connection.label, type);
        addEdge(component.id, id);
      }
    }
  }

  // Emit in stable order: components, east decls, south decls, exposures, edges.
  const lines: string[] = [];
  if (options.title && model.name) lines.push(`title ${model.name}`, "");

  for (const component of components) {
    const type = mapComponentType(component.type);
    lines.push(`component ${component.id}${type ? ` ${type}` : ""}`);
  }

  const decls = Array.from(externalsByRawId.values());
  const emitDecl = (d: ExternalDecl) => {
    const alias = d.label ? ` as "${d.label}"` : "";
    const type = d.type ? ` ${d.type}` : "";
    return `${d.direction} ${d.id}${alias}${type}`;
  };
  const eastDecls = decls.filter((d) => d.direction === "east");
  const southDecls = decls.filter((d) => d.direction === "south");
  if (eastDecls.length) { lines.push(""); eastDecls.forEach((d) => lines.push(emitDecl(d))); }
  if (southDecls.length) { lines.push(""); southDecls.forEach((d) => lines.push(emitDecl(d))); }

  if (north.length || west.length) {
    lines.push("");
    north.forEach((id) => lines.push(`north -> ${id}`));
    west.forEach((id) => lines.push(`west -> ${id}`));
  }

  if (edges.length) {
    lines.push("");
    edges.forEach((e) => lines.push(`${e.source} -> ${e.target}`));
  }

  return lines.join("\n") + "\n";
}
