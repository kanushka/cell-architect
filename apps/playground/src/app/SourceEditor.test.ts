import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SOURCE_EDITOR_BASIC_SETUP } from "./sourceEditorConfig";
import { SourceEditor } from "./SourceEditor";

describe("SourceEditor", () => {
  it("does not make repeated cursor words look like selections", () => {
    expect(SOURCE_EDITOR_BASIC_SETUP.highlightSelectionMatches).toBe(false);
  });

  it("reports when focus enters the DSL editor", () => {
    const onFocus = vi.fn();
    render(createElement(SourceEditor, { value: "component API", onChange: () => undefined, onFocus }));

    fireEvent.focus(screen.getByLabelText("Cell DSL source"));

    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
