import { nanoid } from "nanoid";
import { defaultSampleSource } from "./defaultSample";

export const STORAGE_KEY = "cell-architect.documents.v1";
export const MAX_DOCUMENTS = 10;

export interface DiagramDocument {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRepositoryState {
  schemaVersion: 1;
  activeDocumentId: string;
  documents: DiagramDocument[];
}

function now() {
  return new Date().toISOString();
}

function defaultState(): DocumentRepositoryState {
  const timestamp = now();
  const document: DiagramDocument = {
    id: "order-system",
    name: "Order System",
    source: defaultSampleSource,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    schemaVersion: 1,
    activeDocumentId: document.id,
    documents: [document]
  };
}

function isValidState(value: unknown): value is DocumentRepositoryState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as DocumentRepositoryState;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.activeDocumentId === "string" &&
    Array.isArray(candidate.documents) &&
    candidate.documents.every(
      (document) =>
        document &&
        typeof document.id === "string" &&
        typeof document.name === "string" &&
        typeof document.source === "string" &&
        typeof document.createdAt === "string" &&
        typeof document.updatedAt === "string"
    )
  );
}

function persist(state: DocumentRepositoryState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function loadRepository(): DocumentRepositoryState {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return persist(defaultState());
  }

  try {
    const parsed = JSON.parse(stored);

    if (isValidState(parsed) && parsed.documents.length > 0) {
      return parsed;
    }
  } catch {
    return persist(defaultState());
  }

  return persist(defaultState());
}

export function replaceRepository(state: DocumentRepositoryState) {
  return persist(state);
}

export function listDocuments() {
  return loadRepository().documents;
}

export function createDocument(name = "Untitled Cell", source = "title UntitledCell\n") {
  const state = loadRepository();

  if (state.documents.length >= MAX_DOCUMENTS) {
    return null;
  }

  const timestamp = now();
  const document: DiagramDocument = {
    id: nanoid(10),
    name,
    source,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  persist({
    ...state,
    activeDocumentId: document.id,
    documents: [document, ...state.documents]
  });

  return document;
}

export function saveDocument(document: DiagramDocument) {
  const state = loadRepository();
  const updated: DiagramDocument = {
    ...document,
    updatedAt: now()
  };

  persist({
    ...state,
    activeDocumentId: updated.id,
    documents: state.documents.map((existing) => (existing.id === updated.id ? updated : existing))
  });

  return updated;
}

export function duplicateDocument(id: string) {
  const state = loadRepository();

  if (state.documents.length >= MAX_DOCUMENTS) {
    return null;
  }

  const source = state.documents.find((document) => document.id === id);

  if (!source) {
    return null;
  }

  const timestamp = now();
  const duplicate: DiagramDocument = {
    ...source,
    id: nanoid(10),
    name: `${source.name} Copy`,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  persist({
    ...state,
    activeDocumentId: duplicate.id,
    documents: [duplicate, ...state.documents]
  });

  return duplicate;
}

export function deleteDocument(id: string) {
  const state = loadRepository();

  if (state.documents.length === 1) {
    return persist(defaultState());
  }

  const documents = state.documents.filter((document) => document.id !== id);
  const activeDocumentId = state.activeDocumentId === id ? documents[0].id : state.activeDocumentId;

  return persist({
    ...state,
    activeDocumentId,
    documents
  });
}
