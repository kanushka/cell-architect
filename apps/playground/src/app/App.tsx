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
import { ShareImportPrompt } from "./ShareImportPrompt";
import "@kanushka/cell-diagram-react/style.css";
import "./styles.css";
import { useDebouncedValue } from "./useDebouncedValue";

const DIAGRAM_MODEL_DEBOUNCE_MS = 120;

/**
 * Ceiling on a `.cell` file chosen through the import picker.
 *
 * Generous next to any real diagram -- the compiler's node limit is the check
 * that decides whether a source is renderable. This only stops the app from
 * reading a wildly oversized file into memory before that check can run.
 */
const MAX_IMPORT_FILE_BYTES = 1_000_000;

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
  layoutError: boolean;
}

// "confirm" asks whether to keep the shared diagram at all; "full" is the
// follow-up shown only when accepting it would exceed the document limit.
type ShareStage = "confirm" | "full";

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
  const [shareStage, setShareStage] = useState<ShareStage>("confirm");
  const [importError, setImportError] = useState<{ title: string; message: string } | null>(null);
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

      // A hash-only change does not reload the SPA, so a second link can arrive
      // while an earlier prompt or error is still on screen. Clear both up front
      // so the new link replaces whatever was showing rather than stacking on it.
      setPendingShare(null);
      setImportError(null);

      const decoded = decodeShareSource(param);

      if (!decoded.ok) {
        setImportError(
          decoded.reason === "too-large"
            ? {
                title: "Share link too large",
                message:
                  "This link expands to more diagram source than Cell Architect will open. Ask whoever sent it to share a .cell file instead."
              }
            : { title: "Share link error", message: "This share link is invalid or corrupted." }
        );
        return;
      }

      const { source, layout, layoutError } = parsePortableSource(decoded.source);
      const compiled = compileProject(source);

      if (!compiled.model) {
        setImportError({
          title: "Shared diagram could not be opened",
          message: compiled.diagnostics[0]?.message ?? "The shared diagram source is not valid Cell DSL."
        });
        return;
      }

      // Never write into the library straight from a URL. Following a link is
      // not consent to have a diagram saved, so ask first.
      setShareStage("confirm");
      setPendingShare({ name: compiled.model.title || "Shared Cell", source, layout, layoutError });
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

  function savePendingShare(share: PendingShare) {
    const created = createDocument(share.name, share.source);
    setSessionLayout(created && share.layout ? { documentId: created.id, layout: share.layout } : null);
    if (share.layoutError) {
      showCanvasMessage("info", "The shared manual layout could not be restored. Auto arrange was used instead.");
    }
    setPendingShare(null);
    refreshRepository();
  }

  function handleAcceptShare() {
    if (!pendingShare) {
      return;
    }

    // Re-read rather than trusting the render-time count: the prompt can sit
    // open while diagrams are created or deleted behind it.
    if (loadRepository().documents.length >= MAX_DOCUMENTS) {
      setShareStage("full");
      return;
    }

    savePendingShare(pendingShare);
  }

  function handleDeleteAndSaveShared(document: DiagramDocument) {
    if (!pendingShare) {
      return;
    }

    deleteDocument(document.id);
    savePendingShare(pendingShare);
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

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      event.target.value = "";
      setImportError({
        title: "File too large",
        message: `"${file.name}" is larger than ${Math.round(MAX_IMPORT_FILE_BYTES / 1000)} KB. Cell files are normally a few kilobytes, so this is unlikely to be a diagram.`
      });
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

      {pendingShare && shareStage === "confirm" ? (
        <ShareImportPrompt
          name={pendingShare.name}
          source={pendingShare.source}
          onConfirm={handleAcceptShare}
          onCancel={() => setPendingShare(null)}
        />
      ) : null}

      {pendingShare && shareStage === "full" ? (
        <ShareImportDialog
          documents={repository.documents}
          onExport={handleExport}
          onDeleteAndSave={handleDeleteAndSaveShared}
          onCancel={() => setPendingShare(null)}
        />
      ) : null}

      {importError ? (
        <Modal title={importError.title} onClose={() => setImportError(null)}>
          <p>{importError.message}</p>
          <div className="modal-actions">
            <button type="button" className="pill-button" onClick={() => setImportError(null)}>
              Close
            </button>
          </div>
        </Modal>
      ) : null}

    </main>
  );
}
