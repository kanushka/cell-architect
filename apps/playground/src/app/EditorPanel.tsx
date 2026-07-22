import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Diagnostic } from "@kanushka/cell-diagram-react";
import { CodeHideIcon, CodeShowIcon } from "./EditorIcons";
import {
  clamp,
  EDITOR_DEFAULT_HEIGHT,
  EDITOR_MAX_HEIGHT,
  EDITOR_MAX_WIDTH,
  EDITOR_MIN_HEIGHT,
  EDITOR_MIN_WIDTH
} from "./layoutConstants";
import { SourceEditor } from "./SourceEditor";

interface EditorPanelProps {
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  source: string;
  onSourceChange: (source: string) => void;
  diagnostics: Diagnostic[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

interface DragState {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

export function EditorPanel({
  documentName,
  onDocumentNameChange,
  source,
  onSourceChange,
  diagnostics,
  collapsed,
  onToggleCollapsed,
  width,
  onWidthChange
}: EditorPanelProps) {
  const [height, setHeight] = useState(EDITOR_DEFAULT_HEIGHT);
  const dragStateRef = useRef<DragState | null>(null);

  function handleResizeMove(event: MouseEvent) {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    const nextWidth = clamp(dragState.startWidth + (event.clientX - dragState.startX), EDITOR_MIN_WIDTH, EDITOR_MAX_WIDTH);
    const nextHeight = clamp(
      dragState.startHeight + (event.clientY - dragState.startY),
      EDITOR_MIN_HEIGHT,
      EDITOR_MAX_HEIGHT
    );

    onWidthChange(nextWidth);
    setHeight(nextHeight);
  }

  function handleResizeEnd() {
    dragStateRef.current = null;
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
  }

  function handleResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, startWidth: width, startHeight: height };
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
  }

  if (collapsed) {
    return (
      <div className="tooltip-control">
        <button
          type="button"
          className="icon-button"
          aria-label="Expand editor"
          aria-describedby="show-text-editor-tooltip"
          onClick={onToggleCollapsed}
        >
          <CodeShowIcon size={18} />
        </button>
        <span id="show-text-editor-tooltip" role="tooltip" className="app-tooltip">
          Show text editor
        </span>
      </div>
    );
  }

  return (
    <div className="editor-panel" style={{ width, height }}>
      <div className="editor-panel__header">
        <input
          aria-label="Diagram name"
          className="editor-panel__name"
          value={documentName}
          onChange={(event) => onDocumentNameChange(event.target.value)}
        />
        <div className="tooltip-control">
          <button
            type="button"
            className="icon-button editor-panel__toggle-button"
            aria-label="Collapse editor"
            aria-describedby="hide-text-editor-tooltip"
            onClick={onToggleCollapsed}
          >
            <CodeHideIcon size={18} />
          </button>
          <span id="hide-text-editor-tooltip" role="tooltip" className="app-tooltip">
            Hide text editor
          </span>
        </div>
      </div>
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
      <div
        className="editor-panel__resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor panel"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
