import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("allows native date inputs to shrink inside narrow containers", () => {
    render(<Input aria-label="Od" type="date" />);

    const input = screen.getByLabelText("Od");

    expect(input.parentElement?.className).toContain("min-w-0");
    expect(input.className).toContain("min-w-0");
    expect(input.className).toContain("max-w-full");
  });
});
