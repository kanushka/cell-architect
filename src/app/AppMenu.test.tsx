import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppMenu } from "./AppMenu";

describe("AppMenu", () => {
  it("opens the dropdown and triggers the selected action, then closes", async () => {
    const user = userEvent.setup();
    const onNewDocument = vi.fn();

    render(
      <AppMenu
        onNewDocument={onNewDocument}
        onImportClick={vi.fn()}
        onOpenGuide={vi.fn()}
        disableCreateActions={false}
      />
    );

    expect(screen.queryByRole("menuitem", { name: "New diagram" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    expect(screen.getByRole("menuitem", { name: "New diagram" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "New diagram" }));
    expect(onNewDocument).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "New diagram" })).not.toBeInTheDocument();
  });

  it("disables New and Import when the document limit is reached", async () => {
    const user = userEvent.setup();
    render(
      <AppMenu onNewDocument={vi.fn()} onImportClick={vi.fn()} onOpenGuide={vi.fn()} disableCreateActions />
    );

    await user.click(screen.getByRole("button", { name: "Open main menu" }));

    expect(screen.getByRole("menuitem", { name: "New diagram" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Import .cell" })).toBeDisabled();
  });

  it("triggers the guide action and closes the menu", async () => {
    const user = userEvent.setup();
    const onOpenGuide = vi.fn();

    render(
      <AppMenu onNewDocument={vi.fn()} onImportClick={vi.fn()} onOpenGuide={onOpenGuide} disableCreateActions={false} />
    );

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "DSL Guide" }));

    expect(onOpenGuide).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "DSL Guide" })).not.toBeInTheDocument();
  });
});
