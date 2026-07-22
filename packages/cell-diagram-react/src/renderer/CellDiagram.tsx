import { useEffect, useMemo, type CSSProperties } from "react";
import { compileProject } from "../compiler/compileProject";
import type { Diagnostic, ProjectModel } from "../domain/cellModel";
import { DiagramCanvas, type DiagramTheme } from "./DiagramCanvas";

export interface CellDiagramProps {
  /** Cell DSL source text; compiled internally. */
  source?: string;
  /** Pre-compiled model; used when `source` is not provided. */
  model?: ProjectModel;
  className?: string;
  style?: CSSProperties;
  /** Called with parse/compile diagnostics whenever `source` changes. */
  onDiagnostics?: (diagnostics: Diagnostic[]) => void;
  /** Light or dark color theme. Defaults to `"light"`. */
  theme?: DiagramTheme;
}

export function CellDiagram({ source, model, className, style, onDiagnostics, theme = "light" }: CellDiagramProps) {
  const compiled = useMemo(
    () => (source !== undefined ? compileProject(source) : null),
    [source]
  );

  useEffect(() => {
    if (compiled) {
      onDiagnostics?.(compiled.diagnostics);
    }
  }, [compiled, onDiagnostics]);

  const resolvedModel = source !== undefined ? compiled?.model ?? null : model ?? null;

  return (
    <div className={className} style={{ width: "100%", height: "100%", ...style }}>
      <DiagramCanvas model={resolvedModel} theme={theme} />
    </div>
  );
}
