import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "./ShareButton";

describe("ShareButton", () => {
  afterEach(() => {
    history.replaceState(null, "", location.pathname + location.search);
  });

  it("opens a dialog with a copyable share link", async () => {
    const user = userEvent.setup();
    render(<ShareButton source="title Sample\ncomponent api" />);

    await user.click(screen.getByRole("button", { name: "Share" }));

    const dialog = screen.getByRole("dialog", { name: "Share diagram" });
    const input = screen.getByDisplayValue(new RegExp(`^${location.origin}${location.pathname}#s=`));
    expect(dialog).toContainElement(input);
  });

  it("copies the share link to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(<ShareButton source="title Sample\ncomponent api" />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#s="));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
