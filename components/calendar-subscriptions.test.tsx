import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  getCalendarSubscriptionLinks: vi.fn(),
  rotateCalendarSubscriptionLinks: vi.fn(),
  revokeCalendarSubscriptionLinks: vi.fn(),
}));
vi.mock("@/app/actions/calendar-subscriptions", () => actions);

import { CalendarSubscriptions } from "./calendar-subscriptions";

const links = {
  habitat: "https://app.habitatzbraslav.cz/api/calendars/personal-token/habitat.ics",
  jidelnicek: "https://app.habitatzbraslav.cz/api/calendars/personal-token/jidelnicek.ics",
};
const newLinks = {
  habitat: links.habitat.replace("personal-token", "new-personal-token"),
  jidelnicek: links.jidelnicek.replace("personal-token", "new-personal-token"),
};
const writeText = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  actions.getCalendarSubscriptionLinks.mockResolvedValue(links);
  actions.rotateCalendarSubscriptionLinks.mockResolvedValue(newLinks);
  actions.revokeCalendarSubscriptionLinks.mockResolvedValue(undefined);
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openLinks() {
  render(<CalendarSubscriptions />);
  fireEvent.click(screen.getByRole("button", { name: "Zobrazit odběrové odkazy" }));
  await screen.findByRole("textbox", { name: "Odkaz na kalendář Habitat" });
}

describe("calendar subscriptions", () => {
  it("creates links only on request and offers distinct read-only subscriptions", async () => {
    let resolveLinks!: (value: typeof links) => void;
    actions.getCalendarSubscriptionLinks.mockImplementation(() => new Promise(resolve => { resolveLinks = resolve; }));
    render(<CalendarSubscriptions />);
    expect(actions.getCalendarSubscriptionLinks).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Zobrazit odběrové odkazy" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(actions.getCalendarSubscriptionLinks).toHaveBeenCalledTimes(1);
    expect(button).toHaveProperty("disabled", true);
    await act(async () => resolveLinks(links));

    expect(screen.getByRole("textbox", { name: "Odkaz na kalendář Habitat" })).toHaveProperty("value", links.habitat);
    expect(screen.getByRole("textbox", { name: "Odkaz na kalendář Habitat jídelníček" })).toHaveProperty("value", links.jidelnicek);
    expect(screen.getAllByRole("link", { name: "Apple Kalendář" }).map(link => link.getAttribute("href"))).toEqual([
      links.habitat.replace("https:", "webcal:"), links.jidelnicek.replace("https:", "webcal:"),
    ]);
    expect(screen.getByText(/Odběr neobsahuje docházku ani omluvenky dětí/)).toBeTruthy();
    expect(screen.getByText(/Změny se mohou projevit se zpožděním/)).toBeTruthy();
  });

  it("allows retry after a load failure without exposing the server error", async () => {
    actions.getCalendarSubscriptionLinks.mockRejectedValueOnce(new Error("internal secret must stay hidden"));
    render(<CalendarSubscriptions />);
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit odběrové odkazy" }));
    expect(await screen.findByRole("alert")).not.toHaveProperty("textContent", expect.stringContaining("internal secret"));
    fireEvent.click(screen.getByRole("button", { name: "Zobrazit odběrové odkazy" }));
    await screen.findByRole("textbox", { name: "Odkaz na kalendář Habitat" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("copies the chosen feed and keeps its URL selectable when clipboard access fails", async () => {
    await openLinks();
    fireEvent.click(screen.getByRole("button", { name: "Kopírovat odkaz: Habitat jídelníček" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Odkaz na kalendář Habitat jídelníček je zkopírovaný.");
    expect(writeText).toHaveBeenLastCalledWith(links.jidelnicek);

    writeText.mockRejectedValueOnce(new Error("NotAllowedError"));
    fireEvent.click(screen.getByRole("button", { name: "Kopírovat odkaz: Habitat" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("ručně"));
    const input = screen.getByRole("textbox", { name: "Odkaz na kalendář Habitat" });
    expect(input).toHaveProperty("readOnly", true);
    expect(input).toHaveProperty("value", links.habitat);
  });

  it("requires confirmation before rotating both links and explains re-subscription", async () => {
    await openLinks();
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Obnovit oba odkazy" }));
    expect(actions.rotateCalendarSubscriptionLinks).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Odkaz na kalendář Habitat" })).toHaveProperty("value", links.habitat);

    fireEvent.click(screen.getByRole("button", { name: "Obnovit oba odkazy" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Odkaz na kalendář Habitat" })).toHaveProperty("value", newLinks.habitat));
    expect(screen.getByRole("textbox", { name: "Odkaz na kalendář Habitat jídelníček" })).toHaveProperty("value", newLinks.jidelnicek);
    expect(screen.getByRole("status")).toHaveProperty("textContent", expect.stringContaining("přidejte oba kalendáře"));
  });

  it("keeps working links after failed revocation, then hides them only after success", async () => {
    await openLinks();
    actions.revokeCalendarSubscriptionLinks.mockRejectedValueOnce(new Error("temporary failure"));
    fireEvent.click(screen.getByRole("button", { name: "Zneplatnit oba odkazy" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "Odkaz na kalendář Habitat" })).toHaveProperty("value", links.habitat);
    fireEvent.click(screen.getByRole("button", { name: "Zneplatnit oba odkazy" }));
    await screen.findByRole("button", { name: "Zobrazit odběrové odkazy" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("status")).toHaveProperty("textContent", expect.stringContaining("zneplatněné"));
  });
});
