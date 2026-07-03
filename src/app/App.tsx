import { BookOpen } from "lucide-react";
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
import { computeCanvasInsets, EDITOR_DEFAULT_WIDTH } from "./layoutConstants";
import { DiagramsPanel } from "./DiagramsPanel";
import { DslGuide } from "./DslGuide";
import { EditorPanel } from "./EditorPanel";
import { HelpPanel } from "./HelpPanel";
import { ShareButton } from "./ShareButton";
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
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorWidth, setEditorWidth] = useState(EDITOR_DEFAULT_WIDTH);
  const [diagramsOpen, setDiagramsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
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
  const insets = computeCanvasInsets({ editorOpen, editorWidth, diagramsOpen });

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
    if (!window.confirm(`Delete "${document.name}"? This cannot be undone.`)) {
      return;
    }

    deleteDocument(document.id);
    refreshRepository();
  }

  function handleExport(document: DiagramDocument) {
    downloadText(`${document.name || "cell-diagram"}.cell`, document.source);
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
    <main className="app-shell">
      <DiagramCanvas model={visibleModel} insets={insets} />

      <div className="overlay overlay--top-left">
        <EditorPanel
          documentName={activeDocument.name}
          onDocumentNameChange={updateActiveName}
          source={activeDocument.source}
          onSourceChange={updateActiveSource}
          diagnostics={compiled.diagnostics}
          collapsed={!editorOpen}
          onToggleCollapsed={() => setEditorOpen((current) => !current)}
          width={editorWidth}
          onWidthChange={setEditorWidth}
        />
      </div>

      <div className="overlay overlay--top-right">
        <ShareButton />
        <HelpPanel />
        <button type="button" className="pill-button" onClick={() => setGuideOpen(true)}>
          <BookOpen size={15} />
          <span>Guide</span>
        </button>
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
    </main>
  );
}
