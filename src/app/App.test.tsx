import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads the default sample in a split editor", () => {
    const { container } = render(<App />);

    expect(screen.getByRole("heading", { name: "Cell Architect" })).toBeInTheDocument();
    expect(screen.getByText("Order System")).toBeInTheDocument();
    expect(screen.getAllByText("OrderCell").length).toBeGreaterThan(0);
    expect(screen.getByText("CustomerApp")).toBeInTheDocument();
    expect(container.querySelector('[data-cell-shape="octagon"]')).toBeInTheDocument();
    expect(container.querySelector("[data-cell-title-placement]")).toHaveAttribute(
      "data-cell-title-placement",
      "northwest-outside"
    );
    expect(container.querySelector('[data-cell-outline="octagon"]')).toHaveAttribute("fill", "none");
    expect(container.querySelector('[data-cell-outline="octagon"]')).toHaveAttribute("stroke-width", "3.5");
    expect(container.querySelectorAll('[data-node-shape="circle"]').length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll('[data-external-shape="circle"]').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('[data-gate-label="east"]')).toHaveTextContent("East");
    expect(container.querySelector('[data-gate-label="east"]')).toHaveAttribute("data-gate-placement", "outside");
    expect(container.querySelector('[data-gate-label="south"]')).toHaveTextContent("South");
    expect(container.querySelector('[data-gate-label="south"]')).toHaveAttribute("data-gate-placement", "outside");
    expect(container.querySelector('[data-external-shape="circle"] small')).not.toBeInTheDocument();
    expect(container.querySelector(".react-flow__minimap")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-gateway-bound]").length).toBe(4);
  });

  it("shows parser diagnostics while preserving the workbench", async () => {
    const user = userEvent.setup();
    render(<App />);

    const editor = screen.getByLabelText("Cell DSL source");
    await user.clear(editor);
    await user.type(editor, "title Broken\ncomponent API service\nAPI -> Missing");

    expect(screen.getByText("Internal dependency target \"Missing\" is not a defined component.")).toBeInTheDocument();
    expect(screen.queryByText("Fix the DSL errors to render the diagram.")).not.toBeInTheDocument();
  });

  it("keeps import beside new and exposes diagram actions from each tile menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByText("Diagrams are saved in this browser only. Export any diagrams you need later.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duplicate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sample" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete diagram" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));

    expect(screen.getByRole("menuitem", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Export .cell" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("opens a DSL guide popup with copyable notation examples", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open DSL guide" }));

    expect(screen.getByRole("dialog", { name: "Cell DSL Guide" })).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
    expect(screen.getByText("Boundary dependencies")).toBeInTheDocument();
    expect(screen.getByText("Full sample")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy Metadata example" }));

    expect(writeText).toHaveBeenCalledWith("title OrderCell\nversion v1");
  });

  it("prevents creating or duplicating more than ten diagrams", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (let index = 1; index < 10; index += 1) {
      await user.click(screen.getByRole("button", { name: "New" }));
    }

    expect(screen.getAllByRole("button", { name: /More actions for/ })).toHaveLength(10);
    expect(screen.getByRole("button", { name: "New" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    expect(screen.getByText("Limit reached. Remove a diagram to create or import another.")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /More actions for/ })[0]);
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
  });

  it("confirms before deleting a diagram from the tile menu", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith("Delete \"Order System\"? This cannot be undone.");
    expect(screen.getByText("Order System")).toBeInTheDocument();
  });

  it("removes the topbar while keeping document naming and sidebar controls available", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.querySelector(".topbar")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");
    expect(screen.queryByText("Valid DSL")).not.toBeInTheDocument();
    expect(screen.getByText("No parser issues. The diagram is generated from this source.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide diagrams sidebar" }));

    expect(screen.queryByRole("heading", { name: "Cell Architect" })).not.toBeInTheDocument();
    const showSidebarButton = screen.getByRole("button", { name: "Show diagrams sidebar" });
    expect(showSidebarButton).toBeInTheDocument();
    expect(document.querySelector(".document-title")).toContainElement(showSidebarButton);

    await user.click(showSidebarButton);

    expect(screen.getByRole("heading", { name: "Cell Architect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide diagrams sidebar" })).toBeInTheDocument();
  });

  it("opens a diagram fullscreen mode that hides the editor and sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Open fullscreen diagram" }));

    expect(container.querySelector(".app-shell")).toHaveClass("app-shell--diagram-fullscreen");
    expect(screen.queryByRole("heading", { name: "Cell Architect" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cell DSL source")).not.toBeInTheDocument();
    expect(screen.getAllByText("OrderCell").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Exit fullscreen diagram" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Exit fullscreen diagram" }));

    expect(container.querySelector(".app-shell")).not.toHaveClass("app-shell--diagram-fullscreen");
    expect(screen.getByRole("heading", { name: "Cell Architect" })).toBeInTheDocument();
    expect(screen.getByLabelText("Cell DSL source")).toBeInTheDocument();
  });

  it("uses a light source editor theme", () => {
    const { container } = render(<App />);

    expect(container.querySelector(".source-editor")).toHaveAttribute("data-editor-theme", "light");
  });

  it("does not show React Flow branding labels in the diagram chrome", () => {
    render(<App />);

    expect(screen.queryByText("React Flow canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "React Flow attribution" })).not.toBeInTheDocument();
  });

  it("focuses linked connections when clicking a component and clears with Escape", async () => {
    render(<App />);
    const orderServiceLabel = screen.getByText("OrderService");
    const orderServiceCircle = orderServiceLabel.closest(".component-node");
    const orderServiceNode = orderServiceLabel.closest(".react-flow__node");

    expect(orderServiceCircle).toBeInTheDocument();
    expect(orderServiceNode).toBeInTheDocument();
    expect(screen.getByText("Click a component to focus its connections.")).toBeInTheDocument();
    await waitFor(() => expect(orderServiceCircle).toHaveAttribute("data-diagram-node-id", "OrderService"));

    fireEvent.click(orderServiceCircle!);

    await waitFor(() => expect(orderServiceNode).toHaveClass("connection-highlight-node"));
    expect(screen.getByText("Focus view: click outside or press Esc to return to the full diagram.")).toBeInTheDocument();
    expect(screen.getByText("OrderDB").closest(".react-flow__node")).toHaveClass("connection-highlight-node");
    expect(screen.getByText("Stripe").closest(".react-flow__node")).toHaveClass("connection-highlight-node");

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(orderServiceNode).not.toHaveClass("connection-highlight-node"));
    expect(screen.getByText("Click a component to focus its connections.")).toBeInTheDocument();

    fireEvent.click(orderServiceCircle!);
    await waitFor(() => expect(orderServiceNode).toHaveClass("connection-highlight-node"));

    const pane = document.querySelector(".react-flow__pane");
    expect(pane).toBeInTheDocument();
    fireEvent.click(pane!);

    await waitFor(() => expect(orderServiceNode).not.toHaveClass("connection-highlight-node"));
  });
});
