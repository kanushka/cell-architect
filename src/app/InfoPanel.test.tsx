import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoPanel } from "./InfoPanel";

describe("InfoPanel", () => {
  it("toggles a popover with the GitHub link, star ask, and storage note", async () => {
    const user = userEvent.setup();
    render(<InfoPanel />);

    expect(screen.queryByRole("dialog", { name: "About Cell Architect" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open info" }));

    const dialog = screen.getByRole("dialog", { name: "About Cell Architect" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/kanushka/cell-architect"
    );
    expect(screen.getByRole("link", { name: /Star the repo/ })).toHaveAttribute(
      "href",
      "https://github.com/kanushka/cell-architect"
    );
    expect(
      screen.getByText("Diagrams are stored in this browser only. You can keep up to 10 at a time.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close info" }));
    expect(screen.queryByRole("dialog", { name: "About Cell Architect" })).not.toBeInTheDocument();
  });
});
