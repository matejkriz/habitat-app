import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  switchDevPersona: vi.fn(async () => undefined),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/actions/dev-persona", () => ({
  switchDevPersona: mocks.switchDevPersona,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

import { DevPersonaSwitcher } from "./dev-persona-switcher";

describe("DevPersonaSwitcher", () => {
  it("shows a conspicuous development-only identity control", () => {
    render(
      <DevPersonaSwitcher currentPersonaId="seed-user-director-bohumil" />,
    );

    expect(screen.getByText("DEV PERSONA")).toBeTruthy();
    expect(
      (screen.getByLabelText("Testovací identita") as HTMLSelectElement)
        .value,
    ).toBe("seed-user-director-bohumil");
    expect(screen.getAllByRole("option")).toHaveLength(6);
  });

  it("switches persona and opens its role dashboard", async () => {
    render(
      <DevPersonaSwitcher currentPersonaId="seed-user-director-bohumil" />,
    );

    fireEvent.change(screen.getByLabelText("Testovací identita"), {
      target: { value: "seed-user-teacher-kveta" },
    });

    await waitFor(() => {
      expect(mocks.switchDevPersona).toHaveBeenCalledWith(
        "seed-user-teacher-kveta",
      );
    });
    expect(mocks.push).toHaveBeenCalledWith("/ucitel/dochazka");
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
