import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HelpPanel } from "./HelpPanel";

describe("HelpPanel", () => {
  it("toggles a popover with the GitHub link and storage note, without a star-the-repo link", async () => {
    const user = userEvent.setup();
    render(<HelpPanel />);

    expect(screen.queryByRole("dialog", { name: "About Cell Architect" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open help" }));

    const dialog = screen.getByRole("dialog", { name: "About Cell Architect" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/kanushka/cell-architect"
    );
    expect(screen.queryByRole("link", { name: /Star the repo/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("Diagrams are stored in this browser only. You can keep up to 10 at a time.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close help" }));
    expect(screen.queryByRole("dialog", { name: "About Cell Architect" })).not.toBeInTheDocument();
  });
});
