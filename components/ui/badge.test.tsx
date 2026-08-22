import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PresenceBadge } from "./badge";

describe("Badge", () => {
  it("keeps a status label on one line", () => {
    render(<PresenceBadge present={false} />);

    expect(screen.getByText("Nepřítomno").className).toContain(
      "whitespace-nowrap",
    );
  });
});
