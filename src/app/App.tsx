import { BookOpen } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { compileCellSource } from "../compiler/compileCellSource";
import { DiagramCanvas } from "../renderer/DiagramCanvas";
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
import "./styles.css";

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
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isTabbedWorkbench = useIsTabbedWorkbench(editorWidth);

  useEffect(() => {
    function processShareLink() {
      const param = readShareParam();
      if (!param) {
        return;
      }

      clearShareUrl();
      const source = decodeShareSource(param);

      if (!source) {
        setShareError("This share link is invalid or corrupted.");
        return;
      }

      const name = compileCellSource(source).model?.title || "Shared Cell";
      const state = loadRepository();

      if (state.documents.length < MAX_DOCUMENTS) {
        createDocument(name, source);
        setRepository(loadRepository());
        return;
      }

      setPendingShare({ name, source });
    }

    processShareLink();
    window.addEventListener("hashchange", processShareLink);
    return () => window.removeEventListener("hashchange", processShareLink);
  }, []);

  const activeDocument =
    repository.documents.find((document) => document.id === repository.activeDocumentId) ?? repository.documents[0];
  const compiled = useMemo(() => compileCellSource(activeDocument.source), [activeDocument.source]);
  const lastValidModel = useRef(compiled.model);
  if (compiled.model) {
    lastValidModel.current = compiled.model;
  }
  const visibleModel = compiled.model ?? lastValidModel.current;
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

  function setActiveDocument(id: string) {
    setRepository(replaceRepository({ ...repository, activeDocumentId: id }));
  }

  function updateActiveSource(source: string) {
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

    deleteDocument(deleteTarget.id);
    setDeleteTarget(null);
    refreshRepository();
  }

  function handleExport(document: DiagramDocument) {
    downloadText(`${document.name || "cell-diagram"}.cell`, document.source);
  }

  function handleDeleteAndSaveShared(document: DiagramDocument) {
    if (!pendingShare) {
      return;
    }

    deleteDocument(document.id);
    createDocument(pendingShare.name, pendingShare.source);
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

    const source = await file.text();
    createDocument(file.name.replace(/\.[^.]+$/, "") || "Imported Cell", source);
    event.target.value = "";
    refreshRepository();
  }

  return (
    <main
      className="app-shell"
      data-layout-mode={isTabbedWorkbench ? "mobile" : "desktop"}
      data-mobile-tab={activeMobileTab}
    >
      <DiagramCanvas model={visibleModel} insets={insets} fitKey={canvasFitKey} />

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
          diagnostics={compiled.diagnostics}
          collapsed={editorCollapsed}
          onToggleCollapsed={handleEditorToggle}
          width={editorWidth}
          onWidthChange={setEditorWidth}
        />
      </div>

      <div className="overlay overlay--top-right">
        <ShareButton source={activeDocument.source} />
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
