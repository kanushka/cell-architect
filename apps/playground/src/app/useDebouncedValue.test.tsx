import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

function Harness({ value, contextKey }: { value: string; contextKey: string }) {
  const debouncedValue = useDebouncedValue(value, 120, contextKey);
  return <span>{debouncedValue}</span>;
}

describe("useDebouncedValue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for a short quiet period before publishing rapid same-context updates", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness value="W" contextKey="doc-1" />);

    rerender(<Harness value="Wo" contextKey="doc-1" />);
    rerender(<Harness value="Wor" contextKey="doc-1" />);

    expect(screen.getByText("W")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(119));
    expect(screen.getByText("W")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Wor")).toBeInTheDocument();
  });

  it("publishes a new document context immediately", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness value="Old document" contextKey="doc-1" />);

    rerender(<Harness value="New document" contextKey="doc-2" />);

    expect(screen.getByText("New document")).toBeInTheDocument();
  });
});
