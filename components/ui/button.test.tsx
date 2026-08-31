import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("keeps its label inside the control at narrow widths", () => {
    render(<Button>Nová omluvenka</Button>);

    const button = screen.getByRole("button", { name: "Nová omluvenka" });

    expect(button.className).toContain("whitespace-nowrap");
    expect(button.className).toContain("leading-none");
  });
});
