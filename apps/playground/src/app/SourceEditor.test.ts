import { describe, expect, it } from "vitest";
import { SOURCE_EDITOR_BASIC_SETUP } from "./sourceEditorConfig";

describe("SourceEditor", () => {
  it("does not make repeated cursor words look like selections", () => {
    expect(SOURCE_EDITOR_BASIC_SETUP.highlightSelectionMatches).toBe(false);
  });
});
