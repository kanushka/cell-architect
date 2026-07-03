import { ChevronDown, ChevronUp } from "lucide-react";
import { Diagnostic } from "../domain/cellModel";
import { SourceEditor } from "./SourceEditor";

interface EditorPanelProps {
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  source: string;
  onSourceChange: (source: string) => void;
  diagnostics: Diagnostic[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function EditorPanel({
  documentName,
  onDocumentNameChange,
  source,
  onSourceChange,
  diagnostics,
  collapsed,
  onToggleCollapsed
}: EditorPanelProps) {
  return (
    <div className={collapsed ? "editor-panel editor-panel--collapsed" : "editor-panel"}>
      <div className="editor-panel__header">
        <input
          aria-label="Diagram name"
          className="editor-panel__name"
          value={documentName}
          onChange={(event) => onDocumentNameChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={collapsed ? "Expand editor" : "Collapse editor"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {collapsed ? null : (
        <>
          <SourceEditor value={source} onChange={onSourceChange} />
          <div className="editor-panel__diagnostics">
            {diagnostics.length === 0 ? (
              <p>No parser issues. The diagram is generated from this source.</p>
            ) : (
              diagnostics.map((diagnostic) => (
                <p key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}`}>
                  <strong>
                    Line {diagnostic.line}, col {diagnostic.column}
                  </strong>
                  {diagnostic.message}
                </p>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
