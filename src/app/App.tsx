import {
  Copy,
  Download,
  Eye,
  FilePlus2,
  BookOpen,
  Maximize2,
  Minimize2,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Upload
} from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { compileCellSource } from "../compiler/compileCellSource";
import { DiagramCanvas } from "../renderer/DiagramCanvas";
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
import { DslGuide } from "./DslGuide";
import { SourceEditor } from "./SourceEditor";
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

export function App() {
  const [repository, setRepository] = useState(() => loadRepository());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openDocumentMenuId, setOpenDocumentMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeDocument =
    repository.documents.find((document) => document.id === repository.activeDocumentId) ?? repository.documents[0];
  const compiled = useMemo(() => compileCellSource(activeDocument.source), [activeDocument.source]);
  const lastValidModel = useRef(compiled.model);
  if (compiled.model) {
    lastValidModel.current = compiled.model;
  }
  const visibleModel = compiled.model ?? lastValidModel.current;
  const isAtDocumentLimit = repository.documents.length >= MAX_DOCUMENTS;

  function refreshRepository() {
    setRepository(loadRepository());
  }

  function setActiveDocument(id: string) {
    setOpenDocumentMenuId(null);
    setRepository(replaceRepository({ ...repository, activeDocumentId: id }));
  }

  function updateActiveSource(source: string) {
    const updated = saveDocument({ ...activeDocument, source });
    setRepository({
      ...loadRepository(),
      activeDocumentId: updated.id
    });
  }

  function updateActiveName(name: string) {
    const updated = saveDocument({ ...activeDocument, name });
    setRepository({
      ...loadRepository(),
      activeDocumentId: updated.id
    });
  }

  function handleNewDocument() {
    if (isAtDocumentLimit) {
      return;
    }

    createDocument("Untitled Cell", "title UntitledCell\n\ncomponent API service\n");
    refreshRepository();
  }

  function handleDuplicate(document: DiagramDocument) {
    if (isAtDocumentLimit) {
      return;
    }

    duplicateDocument(document.id);
    setOpenDocumentMenuId(null);
    refreshRepository();
  }

  function handleDelete(document: DiagramDocument) {
    if (!window.confirm(`Delete "${document.name}"? This cannot be undone.`)) {
      return;
    }

    deleteDocument(document.id);
    setOpenDocumentMenuId(null);
    refreshRepository();
  }

  function handleExport(document: DiagramDocument) {
    downloadText(`${document.name || "cell-diagram"}.cell`, document.source);
    setOpenDocumentMenuId(null);
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
    <main className={diagramFullscreen ? "app-shell app-shell--diagram-fullscreen" : "app-shell"}>
      <aside
        className={`document-rail ${
          sidebarOpen && !diagramFullscreen ? "document-rail--open" : "document-rail--closed"
        }`}
      >
        {sidebarOpen && !diagramFullscreen ? (
          <>
            <div className="rail-header">
              <div className="brand-block">
                <p>Cell DSL Workbench</p>
                <h1>Cell Architect</h1>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Hide diagrams sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <PanelLeftClose size={18} />
              </button>
            </div>

            <div className="document-actions">
              <button
                type="button"
                onClick={handleNewDocument}
                title={isAtDocumentLimit ? "Remove a diagram to create a new one" : "New diagram"}
                disabled={isAtDocumentLimit}
              >
                <FilePlus2 size={16} />
                <span>New</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={isAtDocumentLimit ? "Remove a diagram to import another" : "Import .cell"}
                disabled={isAtDocumentLimit}
              >
                <Upload size={16} />
                <span>Import</span>
              </button>
              <button type="button" aria-label="Open DSL guide" onClick={() => setGuideOpen(true)}>
                <BookOpen size={16} />
                <span>Guide</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".cell,.txt" hidden onChange={handleImport} />
            </div>

            <div className="storage-notice" role="note">
              <p>Diagrams are saved in this browser only. Export any diagrams you need later.</p>
              <small>You can keep up to {MAX_DOCUMENTS} diagrams at a time.</small>
              {isAtDocumentLimit ? (
                <strong>Limit reached. Remove a diagram to create or import another.</strong>
              ) : null}
            </div>

            <nav className="document-list" aria-label="Saved diagrams">
              {repository.documents.map((document) => (
                <div
                  key={document.id}
                  className={document.id === activeDocument.id ? "document-list__item active" : "document-list__item"}
                >
                  <button
                    type="button"
                    className="document-list__select"
                    onClick={() => setActiveDocument(document.id)}
                  >
                    <strong>{document.name}</strong>
                    <small>{new Date(document.updatedAt).toLocaleString()}</small>
                  </button>
                  <button
                    type="button"
                    className="document-list__menu-button"
                    aria-label={`More actions for ${document.name}`}
                    aria-haspopup="menu"
                    aria-expanded={openDocumentMenuId === document.id}
                    onClick={() =>
                      setOpenDocumentMenuId((currentDocumentId) =>
                        currentDocumentId === document.id ? null : document.id
                      )
                    }
                  >
                    <MoreVertical size={16} />
                  </button>
                  {openDocumentMenuId === document.id ? (
                    <div className="document-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => setActiveDocument(document.id)}>
                        <Eye size={15} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleDuplicate(document)}
                        disabled={isAtDocumentLimit}
                      >
                        <Copy size={15} />
                        <span>Duplicate</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => handleExport(document)}>
                        <Download size={15} />
                        <span>Export .cell</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="document-menu__danger"
                        onClick={() => handleDelete(document)}
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>
          </>
        ) : null}
      </aside>

      <section className="workbench">
        <div className={diagramFullscreen ? "split-editor split-editor--diagram-fullscreen" : "split-editor"}>
          {!diagramFullscreen ? (
            <section className="editor-pane">
              <div className="pane-header pane-header--document">
                <div className="document-title">
                  {!sidebarOpen ? (
                    <button
                      type="button"
                      className="icon-button sidebar-reopen-button"
                      aria-label="Show diagrams sidebar"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <PanelLeftOpen size={18} />
                    </button>
                  ) : null}
                  <input
                    aria-label="Diagram name"
                    value={activeDocument.name}
                    onChange={(event) => updateActiveName(event.target.value)}
                  />
                </div>
              </div>
              <SourceEditor value={activeDocument.source} onChange={updateActiveSource} />
              <div className="diagnostics-panel">
                {compiled.diagnostics.length === 0 ? (
                  <p>No parser issues. The diagram is generated from this source.</p>
                ) : (
                  compiled.diagnostics.map((diagnostic) => (
                    <p key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}`}>
                      <strong>
                        Line {diagnostic.line}, col {diagnostic.column}
                      </strong>
                      {diagnostic.message}
                    </p>
                  ))
                )}
              </div>
            </section>
          ) : null}

          <section className="canvas-pane">
            <div className="pane-header">
              <span>{visibleModel?.title ?? activeDocument.name}</span>
              <div className="canvas-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={diagramFullscreen ? "Exit fullscreen diagram" : "Open fullscreen diagram"}
                  title={diagramFullscreen ? "Exit fullscreen diagram" : "Open fullscreen diagram"}
                  onClick={() => setDiagramFullscreen((isFullscreen) => !isFullscreen)}
                >
                  {diagramFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
              </div>
            </div>
            <DiagramCanvas model={visibleModel} />
          </section>
        </div>
      </section>

      {guideOpen ? <DslGuide onClose={() => setGuideOpen(false)} /> : null}
    </main>
  );
}
