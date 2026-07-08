import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function mockMobileLayout(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width
  });
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockMobileLayout(false);
    setViewportWidth(1440);
  });

  it("renders the default sample full-bleed with the editor open", () => {
    const { container } = render(<App />);

    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Customer App")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");
    expect(container.querySelector('[data-cell-shape="octagon"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-node-shape="circle"]').length).toBeGreaterThanOrEqual(4);
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

  it("creates a new diagram from the diagrams panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    await user.click(screen.getByRole("button", { name: "New diagram" }));

    expect(screen.getByLabelText("Diagram name")).toHaveValue("Untitled Cell");
  });

  it("opens the DSL guide from its icon-only top-right button with a tooltip", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<App />);

    const guideButton = screen.getByRole("button", { name: "Open DSL guide" });
    expect(guideButton).toHaveTextContent("");
    expect(screen.getByRole("tooltip", { name: "DSL Guide" })).toBeInTheDocument();

    await user.click(guideButton);

    expect(screen.getByRole("dialog", { name: "Cell DSL Guide" })).toBeInTheDocument();
  });

  it("opens the diagrams panel, switches documents, and closes it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    expect(screen.getByRole("navigation", { name: "Saved diagrams" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New diagram" }));
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Untitled Cell");

    await user.click(screen.getByText("Order System"));
    expect(screen.getByLabelText("Diagram name")).toHaveValue("Order System");

    await user.click(screen.getByRole("button", { name: "Close diagrams panel" }));
    expect(screen.queryByRole("navigation", { name: "Saved diagrams" })).not.toBeInTheDocument();
  });

  it("duplicates, exports, and deletes a diagram from the diagrams panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    expect(screen.getByText("Order System Copy")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More actions for Order System" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete diagram" });
    expect(dialog).toHaveTextContent('Delete "Order System"? This cannot be undone.');
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByText("Order System", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("prevents creating or duplicating more than ten diagrams", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Diagrams" }));
    for (let index = 1; index < 10; index += 1) {
      await user.click(screen.getByRole("button", { name: "New diagram" }));
    }

    expect(screen.getByRole("button", { name: "New diagram" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import .cell" })).toBeDisabled();

    await user.click(screen.getAllByRole("button", { name: /More actions for/ })[0]);
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
  });

  it("opens the share dialog with a copyable link", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByRole("dialog", { name: "Share diagram" })).toBeInTheDocument();
  });

  it("shows the help popover with the repo link", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open help" }));
    expect(screen.getByRole("dialog", { name: "About Cell Architect" })).toBeInTheDocument();
  });

  it("focuses linked connections when clicking a component and clears with Escape", async () => {
    render(<App />);
    const ordersLabel = screen.getByText("Orders");
    const ordersCircle = ordersLabel.closest(".component-node");
    const ordersNode = ordersLabel.closest(".react-flow__node");

    expect(ordersCircle).toBeInTheDocument();
    await waitFor(() => expect(ordersCircle).toHaveAttribute("data-diagram-node-id", "orders"));

    fireEvent.click(ordersCircle!);
    await waitFor(() => expect(ordersNode).toHaveClass("connection-highlight-node"));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(ordersNode).not.toHaveClass("connection-highlight-node"));
  });

  it("does not show React Flow branding labels in the diagram chrome", () => {
    render(<App />);

    expect(screen.queryByText("React Flow canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "React Flow attribution" })).not.toBeInTheDocument();
  });

  it("defaults mobile layout to the Code tab", () => {
    setViewportWidth(1024);
    render(<App />);

    expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Diagram" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText("Cell DSL source")).toBeInTheDocument();
  });

  it("switches mobile layout between Code and Diagram tabs", async () => {
    setViewportWidth(1024);
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("tab", { name: "Diagram" }));

    expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Diagram" })).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-mobile-tab", "diagram");

    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-mobile-tab", "code");
  });

  it("maps the mobile collapse-editor control to the Diagram tab", async () => {
    setViewportWidth(1024);
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Collapse editor" }));

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-mobile-tab", "diagram");
    expect(screen.getByRole("tab", { name: "Diagram" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the original workbench when the viewport is wider than 2.5 editor widths", () => {
    setViewportWidth(1200);
    const { container } = render(<App />);

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-layout-mode", "desktop");
  });

  it("uses the tabbed workbench when the viewport is not wider than 2.5 editor widths", () => {
    setViewportWidth(1024);
    const { container } = render(<App />);

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-layout-mode", "mobile");
    expect(screen.getByRole("tab", { name: "Code" })).toBeInTheDocument();
  });
});
