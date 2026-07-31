import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  listDocuments,
  loadRepository,
  MAX_DOCUMENTS,
  saveDocument,
  STORAGE_KEY
} from "./documentRepository";

describe("documentRepository", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date("2026-07-02T10:00:00Z"));
  });

  it("restores the default sample when storage is empty or corrupt", () => {
    expect(loadRepository().documents).toHaveLength(1);
    expect(loadRepository().documents[0].name).toBe("Storefront");

    localStorage.setItem(STORAGE_KEY, "{broken");

    const recovered = loadRepository();
    expect(recovered.documents).toHaveLength(1);
    expect(recovered.activeDocumentId).toBe(recovered.documents[0].id);
  });

  it("creates, updates, duplicates, and deletes documents", () => {
    const created = createDocument("Payments", "title Payments");
    expect(created).not.toBeNull();
    if (!created) {
      throw new Error("Expected document to be created below the document limit.");
    }

    expect(created.name).toBe("Payments");
    expect(listDocuments()).toHaveLength(2);

    const updated = saveDocument({ ...created, source: "title Payments\nversion v2" });
    expect(updated.updatedAt).toBe("2026-07-02T10:00:00.000Z");

    const duplicate = duplicateDocument(created.id);
    expect(duplicate?.name).toBe("Payments Copy");
    expect(listDocuments()).toHaveLength(3);

    deleteDocument(created.id);
    expect(listDocuments().map((document) => document.id)).not.toContain(created.id);
    expect(listDocuments()).toHaveLength(2);
  });

  it("limits browser-stored documents to ten", () => {
    for (let index = 1; index < MAX_DOCUMENTS; index += 1) {
      expect(createDocument(`Diagram ${index}`, `title Diagram${index}`)).not.toBeNull();
    }

    expect(listDocuments()).toHaveLength(MAX_DOCUMENTS);
    expect(createDocument("Overflow", "title Overflow")).toBeNull();
    expect(duplicateDocument(listDocuments()[0].id)).toBeNull();
    expect(listDocuments()).toHaveLength(MAX_DOCUMENTS);
  });
});
