export type BoundaryDirection = "north" | "east" | "south" | "west";
export type EdgeDirection = BoundaryDirection | "internal";
export type EdgeKind = "internal" | "inbound" | "outbound" | "exposure";

export interface Diagnostic {
  severity: "error";
  message: string;
  line: number;
  column: number;
}

export interface ParsedComponent {
  id: string;
  label?: string;
  type?: string;
  line?: number;
}

export interface ParsedExternal {
  id: string;
  direction: BoundaryDirection;
  label?: string;
  type?: string;
  line?: number;
}

export interface ParsedEdge {
  id: string;
  source: string;
  target: string;
  direction: EdgeDirection;
  kind: EdgeKind;
  label?: string;
  line: number;
}

export interface ParsedCellDocument {
  title?: string;
  version?: string;
  components: ParsedComponent[];
  externals: ParsedExternal[];
  edges: ParsedEdge[];
}

export type ExternalNode = ParsedExternal;

export interface CellDiagramModel {
  title?: string;
  version?: string;
  components: ParsedComponent[];
  externals: ExternalNode[];
  edges: ParsedEdge[];
}

export interface ParseResult {
  document: ParsedCellDocument;
  diagnostics: Diagnostic[];
}

export interface CompileResult {
  model: CellDiagramModel | null;
  diagnostics: Diagnostic[];
}

export type CrossExit = "east" | "south";
export type CrossEntry = "west" | "north";
export type CrossMode = "connected" | "decoupled";

export interface CrossEdge {
  id: string;
  sourceCell: string;
  sourceComp: string;
  targetCell: string;
  targetComp: string;
  exit: CrossExit;
  entry: CrossEntry;
  mode: CrossMode;
  label?: string;
  line: number;
}

export interface CellModel {
  id: string;
  label?: string;
  version?: string;
  components: ParsedComponent[];
  externals: ExternalNode[];
  edges: ParsedEdge[];
}

export interface ProjectModel {
  title?: string;
  cells: CellModel[];
  crossEdges: CrossEdge[];
  sharedExternals: ExternalNode[];
}

export interface ProjectCompileResult {
  model: ProjectModel | null;
  diagnostics: Diagnostic[];
}
