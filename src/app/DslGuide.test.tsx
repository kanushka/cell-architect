import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DslGuide } from "./DslGuide";

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
});
