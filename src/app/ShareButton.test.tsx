import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareButton } from "./ShareButton";

describe("ShareButton", () => {
  it("renders a disabled button described by a coming-soon tooltip", () => {
    render(<ShareButton />);

    const button = screen.getByRole("button", { name: "Share" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Sharing is coming soon");
  });
});
