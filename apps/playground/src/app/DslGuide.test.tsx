import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DslGuide } from "./DslGuide";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DslGuide", () => {
  it("calls onClose when clicking the backdrop outside the dialog", () => {
    const onClose = vi.fn();
    const { container } = render(<DslGuide onClose={onClose} />);

    const backdrop = container.querySelector(".guide-backdrop");
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the dialog", () => {
    const onClose = vi.fn();
    render(<DslGuide onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog", { name: "Cell DSL Guide" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("orders the guide as a progressive core, multi-cell, and reference path", () => {
    render(<DslGuide onClose={vi.fn()} />);

    const navigation = screen.getByRole("navigation", { name: "DSL guide contents" });
    const links = Array.from(navigation.querySelectorAll(".guide-navigation__link")).map((link) => link.textContent);

    expect(links).toEqual([
      "Initial diagram",
      "Dependencies",
      "Gateways",
      "Metadata",
      "Complete single-cell sample",
      "Cell blocks and project title",
      "Cross-cell links",
      "Connected and decoupled modes",
      "Shared externals",
      "Complete multi-cell sample",
      "Aliases",
      "Comments"
    ]);
    expect(screen.getByText("BETA")).toBeInTheDocument();
  });

  it("navigates to a desktop section and marks it current", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });

    render(<DslGuide onClose={vi.fn()} />);
    const dependenciesLink = screen.getByRole("button", { name: "Dependencies" });

    await user.click(dependenciesLink);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(dependenciesLink).toHaveAttribute("aria-current", "location");
  });

  it("selects the section closest to the reading position when the content scrolls", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    render(<DslGuide onClose={vi.fn()} />);

    const content = document.querySelector<HTMLElement>(".guide-content")!;
    const dependencies = document.getElementById("dependencies")!;
    const gateways = document.getElementById("gateways")!;

    vi.spyOn(content, "getBoundingClientRect").mockReturnValue({ top: 0 } as DOMRect);
    document.querySelectorAll<HTMLElement>(".guide-section").forEach((section) => {
      vi.spyOn(section, "getBoundingClientRect").mockReturnValue({ top: 1_000 } as DOMRect);
    });
    vi.spyOn(dependencies, "getBoundingClientRect").mockReturnValue({ top: -480 } as DOMRect);
    vi.spyOn(gateways, "getBoundingClientRect").mockReturnValue({ top: 140 } as DOMRect);

    act(() => fireEvent.scroll(content));

    expect(screen.getByRole("button", { name: "Gateways" })).toHaveAttribute("aria-current", "location");
  });

  it("opens mobile contents and closes it after selecting a section", async () => {
    const user = userEvent.setup();
    render(<DslGuide onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Open contents" }));
    expect(screen.getByRole("heading", { name: "Contents" })).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "DSL guide contents" })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Shared externals" })[1]);

    expect(screen.queryByRole("heading", { name: "Contents" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shared externals" })).toHaveAttribute("aria-current", "location");
  });

  it("closes mobile contents separately from the guide", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DslGuide onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Open contents" }));
    await user.click(screen.getByRole("button", { name: "Close contents" }));

    expect(screen.queryByRole("heading", { name: "Contents" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close DSL guide" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the complete single-cell and multi-cell samples copyable", async () => {
    const user = userEvent.setup();
    render(<DslGuide onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Copy Single-cell DSL example" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Multi-cell DSL example" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy Single-cell DSL example" }));
    expect(screen.getByRole("button", { name: "Copy Single-cell DSL example" })).toHaveTextContent("Copied");

    await user.click(screen.getByRole("button", { name: "Copy Multi-cell DSL example" }));
    expect(screen.getByRole("button", { name: "Copy Multi-cell DSL example" })).toHaveTextContent("Copied");
  });
});
