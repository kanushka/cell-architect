import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useClickOutside } from "./useClickOutside";

function TestComponent({ active, onOutsideClick }: { active: boolean; onOutsideClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onOutsideClick, active);

  return (
    <div>
      <div ref={ref} data-testid="inside">
        <button type="button">Inside button</button>
      </div>
      <button type="button" data-testid="outside">
        Outside button
      </button>
    </div>
  );
}

describe("useClickOutside", () => {
  it("calls the handler when clicking outside the referenced element", () => {
    const onOutsideClick = vi.fn();
    const { getByTestId } = render(<TestComponent active onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(getByTestId("outside"));

    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it("does not call the handler when clicking inside the referenced element", () => {
    const onOutsideClick = vi.fn();
    const { getByTestId } = render(<TestComponent active onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(getByTestId("inside"));

    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it("does nothing when inactive", () => {
    const onOutsideClick = vi.fn();
    const { getByTestId } = render(<TestComponent active={false} onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(getByTestId("outside"));

    expect(onOutsideClick).not.toHaveBeenCalled();
  });
});
