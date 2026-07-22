import { BookOpen } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  compileProject,
  DiagramCanvas,
  parsePortableSource,
  serializePortableSource,
  type CanvasMessage,
  type CustomLayout
} from "@kanushka/cell-diagram-react";
import { clearShareUrl, decodeShareSource, readShareParam } from "../share/shareLink";
import {
  createDocument,
  deleteDocument,
  DiagramDocument,
  duplicateDocument,
  loadRepository,
  MAX_DOCUMENTS,
  replaceRepository,
  saveDocument
} from "../storage/documentRepository";
import { computeCanvasInsets, EDITOR_DEFAULT_WIDTH, shouldUseTabbedWorkbench } from "./layoutConstants";
import { ConfirmDialog } from "./ConfirmDialog";
import { DiagramsPanel } from "./DiagramsPanel";
import { DslGuide } from "./DslGuide";
import { EditorPanel } from "./EditorPanel";
import { HelpPanel } from "./HelpPanel";
import { Modal } from "./Modal";
import { ShareButton } from "./ShareButton";
import { ShareImportDialog } from "./ShareImportDialog";
import "@kanushka/cell-diagram-react/style.css";
import "./styles.css";
import { useDebouncedValue } from "./useDebouncedValue";

const DIAGRAM_MODEL_DEBOUNCE_MS = 120;

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface PendingShare {
  name: string;
  source: string;
  layout: CustomLayout | null;
}

interface TimedCanvasMessage extends CanvasMessage {
  durationMs: number;
}

const TEMPORARY_LAYOUT_WARNING =
  "Manual arrangement is temporary. Editing the DSL or choosing Auto arrange will reset it. Export the .cell file to preserve it.";

type MobileTab = "code" | "diagram";

function useIsTabbedWorkbench(editorWidth: number) {
  const [isTabbedWorkbench, setIsTabbedWorkbench] = useState(() =>
    typeof window === "undefined"
      ? false
      : shouldUseTabbedWorkbench({ screenWidth: window.innerWidth, editorWidth })
  );

  useEffect(() => {
    function updateLayoutMode() {
      setIsTabbedWorkbench(shouldUseTabbedWorkbench({ screenWidth: window.innerWidth, editorWidth }));
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, [editorWidth]);

  return isTabbedWorkbench;
}

export function App() {
  const [repository, setRepository] = useState(() => loadRepository());
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorWidth, setEditorWidth] = useState(EDITOR_DEFAULT_WIDTH);
  const [diagramsOpen, setDiagramsOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("code");
  const [guideOpen, setGuideOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiagramDocument | null>(null);
  const [pendingShare, setPendingShare] = useState<PendingShare | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sessionLayout, setSessionLayout] = useState<{ documentId: string; layout: CustomLayout } | null>(null);
  const [canvasMessage, setCanvasMessage] = useState<TimedCanvasMessage | null>(null);
  const canvasMessageIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isTabbedWorkbench = useIsTabbedWorkbench(editorWidth);

  useEffect(() => {
    function processShareLink() {
      const param = readShareParam();
      if (!param) {
        return;
      }

      clearShareUrl();
      const portableSource = decodeShareSource(param);

      if (!portableSource) {
        setShareError("This share link is invalid or corrupted.");
        return;
      }

      const { source, layout, layoutError } = parsePortableSource(portableSource);
      if (layoutError) {
        showCanvasMessage("info", "The shared manual layout could not be restored. Auto arrange was used instead.");
      }

      const name = compileProject(source).model?.title || "Shared Cell";
      const state = loadRepository();

      if (state.documents.length < MAX_DOCUMENTS) {
        const created = createDocument(name, source);
        if (created && layout) {
          setSessionLayout({ documentId: created.id, layout });
        }
        setRepository(loadRepository());
        return;
      }

      setPendingShare({ name, source, layout });
    }

    processShareLink();
    window.addEventListener("hashchange", processShareLink);
    return () => window.removeEventListener("hashchange", processShareLink);
  }, []);

  useEffect(() => {
    if (!canvasMessage) {
      return;
    }
    const timer = window.setTimeout(() => setCanvasMessage(null), canvasMessage.durationMs);
    return () => window.clearTimeout(timer);
  }, [canvasMessage]);

  const activeDocument =
    repository.documents.find((document) => document.id === repository.activeDocumentId) ?? repository.documents[0];
  const customLayout = sessionLayout?.documentId === activeDocument.id ? sessionLayout.layout : null;
  const compiled = useMemo(() => compileProject(activeDocument.source), [activeDocument.source]);
  const lastValidModel = useRef(compiled.model);
  if (compiled.model) {
    lastValidModel.current = compiled.model;
  }
  const visibleModel = compiled.model ?? lastValidModel.current;
  const diagramModel = useDebouncedValue(visibleModel, DIAGRAM_MODEL_DEBOUNCE_MS, activeDocument.id);
  const isAtDocumentLimit = repository.documents.length >= MAX_DOCUMENTS;
  const insets = computeCanvasInsets({
    editorOpen,
    editorWidth,
    diagramsOpen,
    layoutMode: isTabbedWorkbench ? "mobile" : "desktop"
  });
  const editorCollapsed = isTabbedWorkbench ? activeMobileTab !== "code" : !editorOpen;
  const canvasFitKey = isTabbedWorkbench ? `mobile-${activeMobileTab}` : "desktop";

  function refreshRepository() {
    setRepository(loadRepository());
  }

  function showCanvasMessage(tone: CanvasMessage["tone"], text: string, durationMs = 3000) {
    canvasMessageIdRef.current += 1;
    setCanvasMessage({ id: canvasMessageIdRef.current, tone, text, durationMs });
  }

  function setActiveDocument(id: string) {
    setSessionLayout(null);
    setRepository(replaceRepository({ ...repository, activeDocumentId: id }));
  }

  function updateActiveSource(source: string) {
    if (customLayout) {
      setSessionLayout(null);
      showCanvasMessage("info", "Manual layout reset after DSL change.");
    }
    const updated = saveDocument({ ...activeDocument, source });
    setRepository({ ...loadRepository(), activeDocumentId: updated.id });
  }

  function updateActiveName(name: string) {
    const updated = saveDocument({ ...activeDocument, name });
    setRepository({ ...loadRepository(), activeDocumentId: updated.id });
  }

  function handleNewDocument() {
    if (isAtDocumentLimit) {
      return;
    }

    setSessionLayout(null);
    createDocument("Untitled Cell", "title UntitledCell\n\ncomponent API service\n");
    refreshRepository();
  }

  function handleImportClick() {
    if (!isAtDocumentLimit) {
      fileInputRef.current?.click();
    }
  }

  function handleDuplicate(document: DiagramDocument) {
    if (isAtDocumentLimit) {
      return;
    }

    setSessionLayout(null);
    duplicateDocument(document.id);
    refreshRepository();
  }

  function handleDelete(document: DiagramDocument) {
    setDeleteTarget(document);
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setSessionLayout(null);
    deleteDocument(deleteTarget.id);
    setDeleteTarget(null);
    refreshRepository();
  }

  function handleExport(document: DiagramDocument) {
    const layout = document.id === activeDocument.id ? customLayout : null;
    downloadText(`${document.name || "cell-diagram"}.cell`, serializePortableSource(document.source, layout));
  }

  function handleDeleteAndSaveShared(document: DiagramDocument) {
    if (!pendingShare) {
      return;
    }

    deleteDocument(document.id);
    const created = createDocument(pendingShare.name, pendingShare.source);
    setSessionLayout(created && pendingShare.layout ? { documentId: created.id, layout: pendingShare.layout } : null);
    setPendingShare(null);
    refreshRepository();
  }

  function handleEditorToggle() {
    if (isTabbedWorkbench) {
      setActiveMobileTab((current) => (current === "code" ? "diagram" : "code"));
      return;
    }

    setEditorOpen((current) => !current);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (isAtDocumentLimit) {
      event.target.value = "";
      return;
    }

    const portableSource = await file.text();
    const { source, layout, layoutError } = parsePortableSource(portableSource);
    const created = createDocument(file.name.replace(/\.[^.]+$/, "") || "Imported Cell", source);
    setSessionLayout(created && layout ? { documentId: created.id, layout } : null);
    if (layoutError) {
      showCanvasMessage("info", "The imported manual layout could not be restored. Auto arrange was used instead.");
    }
    event.target.value = "";
    refreshRepository();
  }

  function handleCustomLayoutChange(layout: CustomLayout) {
    if (!customLayout) {
      showCanvasMessage("warning", TEMPORARY_LAYOUT_WARNING, 5000);
    }
    setSessionLayout({ documentId: activeDocument.id, layout });
  }

  function handleSourceFocus() {
    if (customLayout) {
      showCanvasMessage("warning", TEMPORARY_LAYOUT_WARNING, 5000);
    }
  }

  function handleAutoArrange() {
    if (!customLayout) {
      return;
    }
    setSessionLayout(null);
    showCanvasMessage("info", "Components returned to automatic layout.");
  }

  return (
    <main
      className="app-shell"
      data-layout-mode={isTabbedWorkbench ? "mobile" : "desktop"}
      data-mobile-tab={activeMobileTab}
    >
      <DiagramCanvas
        model={diagramModel}
        insets={insets}
        fitKey={canvasFitKey}
        motionContextKey={activeDocument.id}
        source={activeDocument.source}
        customLayout={customLayout}
        onCustomLayoutChange={handleCustomLayoutChange}
        onAutoArrange={handleAutoArrange}
        canvasMessage={canvasMessage}
      />

      <div className="mobile-tab-bar" role="tablist" aria-label="Mobile workbench views">
        <button
          type="button"
          role="tab"
          aria-selected={activeMobileTab === "code"}
          className="mobile-tab-bar__tab"
          onClick={() => setActiveMobileTab("code")}
        >
          Code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMobileTab === "diagram"}
          className="mobile-tab-bar__tab"
          onClick={() => setActiveMobileTab("diagram")}
        >
          Diagram
        </button>
      </div>

      <div className="overlay overlay--top-left">
        <EditorPanel
          documentName={activeDocument.name}
          onDocumentNameChange={updateActiveName}
          source={activeDocument.source}
          onSourceChange={updateActiveSource}
          onSourceFocus={handleSourceFocus}
          diagnostics={compiled.diagnostics}
          collapsed={editorCollapsed}
          onToggleCollapsed={handleEditorToggle}
          width={editorWidth}
          onWidthChange={setEditorWidth}
        />
      </div>

      <div className="overlay overlay--top-right">
        <ShareButton source={serializePortableSource(activeDocument.source, customLayout)} />
        <HelpPanel />
        <div className="tooltip-control">
          <button
            type="button"
            className="icon-button"
            aria-label="Open DSL guide"
            aria-describedby="dsl-guide-tooltip"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen size={16} />
          </button>
          <span id="dsl-guide-tooltip" role="tooltip" className="app-tooltip">
            DSL Guide
          </span>
        </div>
        <button
          type="button"
          className="pill-button"
          aria-pressed={diagramsOpen}
          onClick={() => setDiagramsOpen((current) => !current)}
        >
          Diagrams
        </button>
      </div>

      {diagramsOpen ? (
        <DiagramsPanel
          documents={repository.documents}
          activeDocumentId={activeDocument.id}
          isAtDocumentLimit={isAtDocumentLimit}
          onSelect={setActiveDocument}
          onNewDocument={handleNewDocument}
          onImportClick={handleImportClick}
          onDuplicate={handleDuplicate}
          onExport={handleExport}
          onDelete={handleDelete}
          onClose={() => setDiagramsOpen(false)}
        />
      ) : null}

      <input ref={fileInputRef} type="file" accept=".cell,.txt" hidden onChange={handleImport} />

      {guideOpen ? <DslGuide onClose={() => setGuideOpen(false)} /> : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete diagram"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}

      {pendingShare ? (
        <ShareImportDialog
          documents={repository.documents}
          onExport={handleExport}
          onDeleteAndSave={handleDeleteAndSaveShared}
          onCancel={() => setPendingShare(null)}
        />
      ) : null}

      {shareError ? (
        <Modal title="Share link error" onClose={() => setShareError(null)}>
          <p>{shareError}</p>
          <div className="modal-actions">
            <button type="button" className="pill-button" onClick={() => setShareError(null)}>
              Close
            </button>
          </div>
        </Modal>
      ) : null}

    </main>
  );
}
