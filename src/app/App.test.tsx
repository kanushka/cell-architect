import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the default sample full-bleed with the editor open", () => {
    const { container } = render(<App />);

    expect(screen.getAllByText("OrderProject").length).toBeGreaterThan(0);
    expect(screen.getByText("CustomerApp")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");
    expect(container.querySelector('[data-cell-shape="octagon"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-node-shape="circle"]').length).toBeGreaterThanOrEqual(5);
  });

  it("shows parser diagnostics in the editor panel while preserving the canvas", async () => {
    const user = userEvent.setup();
    render(<App />);

    const editor = screen.getByLabelText("Cell DSL source");
    await user.clear(editor);
    await user.type(editor, "title Broken\ncomponent API service\nAPI -- Missing");

    expect(
      screen.getByText("Unknown statement. Expected title, version, component, or dependency arrow.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Fix the DSL errors to render the diagram.")).not.toBeInTheDocument();
  });

  it("collapses and expands the editor panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Collapse editor" }));
    expect(screen.queryByLabelText("Cell DSL source")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand editor" }));
    expect(screen.getByLabelText("Cell DSL source")).toBeInTheDocument();
  });

  it("opens the hamburger menu and creates a new diagram", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "New diagram" }));

    expect(screen.getByLabelText("Diagram name")).toHaveValue("Untitled Cell");
  });

  it("opens the DSL guide from the hamburger menu", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "DSL Guide" }));

    expect(screen.getByRole("dialog", { name: "Cell DSL Guide" })).toBeInTheDocument();
  });

  it("opens the diagrams panel, switches documents, and closes it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    expect(screen.getByRole("navigation", { name: "Saved diagrams" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    await user.click(screen.getByRole("menuitem", { name: "New diagram" }));
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Untitled Cell");

    await user.click(screen.getByText("Order System"));
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");

    await user.click(screen.getByRole("button", { name: "Close diagrams panel" }));
    expect(screen.queryByRole("navigation", { name: "Saved diagrams" })).not.toBeInTheDocument();
  });

  it("duplicates, exports, and deletes a diagram from the diagrams panel", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    expect(screen.getByText("Order System Copy")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith('Delete "Order System"? This cannot be undone.');
    expect(screen.queryByText("Order System", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("prevents creating or duplicating more than ten diagrams", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (let index = 1; index < 10; index += 1) {
      await user.click(screen.getByRole("button", { name: "Open main menu" }));
      await user.click(screen.getByRole("menuitem", { name: "New diagram" }));
    }

    await user.click(screen.getByRole("button", { name: "Open main menu" }));
    expect(screen.getByRole("menuitem", { name: "New diagram" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Import .cell" })).toBeDisabled();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    await user.click(screen.getAllByRole("button", { name: /More actions for/ })[0]);
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
  });

  it("shows a disabled Share button with a coming-soon tooltip", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("shows the info popover with the repo link", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open info" }));
    expect(screen.getByRole("dialog", { name: "About Cell Architect" })).toBeInTheDocument();
  });

  it("focuses linked connections when clicking a component and clears with Escape", async () => {
    render(<App />);
    const orderServiceLabel = screen.getByText("OrderService");
    const orderServiceCircle = orderServiceLabel.closest(".component-node");
    const orderServiceNode = orderServiceLabel.closest(".react-flow__node");

    expect(orderServiceCircle).toBeInTheDocument();
    await waitFor(() => expect(orderServiceCircle).toHaveAttribute("data-diagram-node-id", "OrderService"));

    fireEvent.click(orderServiceCircle!);
    await waitFor(() => expect(orderServiceNode).toHaveClass("connection-highlight-node"));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(orderServiceNode).not.toHaveClass("connection-highlight-node"));
  });

  it("does not show React Flow branding labels in the diagram chrome", () => {
    render(<App />);

    expect(screen.queryByText("React Flow canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "React Flow attribution" })).not.toBeInTheDocument();
  });
});
