import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const getLinks = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/calendar-subscriptions", () => ({ getCalendarSubscriptionLinks: getLinks }));
import { CalendarSubscriptions } from "./calendar-subscriptions";
const links = { habitat: "https://app.example/api/calendars/token/habitat.ics", jidelnicek: "https://app.example/api/calendars/token/jidelnicek.ics" };
const writeText = vi.fn();
beforeEach(() => {
  vi.resetAllMocks(); getLinks.mockResolvedValue(links); writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } }); vi.stubGlobal("ClipboardItem", undefined);
});
afterEach(() => vi.unstubAllGlobals());
async function open(name = "Odebírat události") {
  fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("link", { name: "Apple Kalendář" });
}
describe("calendar subscription choices", () => {
  it("offers subscriptions on demand and pre-fills the chosen feed in all providers", async () => {
    render(<CalendarSubscriptions />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(getLinks).not.toHaveBeenCalled();
    await open();
    expect(screen.getByRole("link", { name: "Apple Kalendář" }).getAttribute("href")).toBe(links.habitat.replace("https:", "webcal:"));
    const google = new URL(screen.getByRole("link", { name: "Google Kalendář" }).getAttribute("href")!);
    expect(google.searchParams.get("cid")).toBe(links.habitat);
    const outlook = new URL(screen.getByRole("link", { name: "Outlook" }).getAttribute("href")!);
    expect(outlook.searchParams.get("url")).toBe(links.habitat);
    expect(outlook.searchParams.get("name")).toBe("Habitat");
    expect(writeText).not.toHaveBeenCalled();
    await open("Odebírat jídelníček");
    expect(screen.getByRole("link", { name: "Apple Kalendář" }).getAttribute("href")).toBe(links.jidelnicek.replace("https:", "webcal:"));
    expect(getLinks).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Kopírovat odkaz" }));
    await screen.findByRole("button", { name: "Zkopírováno" });
    expect(writeText).toHaveBeenCalledWith(links.jidelnicek);
  });
  it("dismisses with Escape and outside clicks, restoring trigger focus for Escape", async () => {
    render(<CalendarSubscriptions />); await open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Odebírat události" }));
    await open(); fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("anchors each menu to its trigger, switches feeds directly and toggles the current trigger", async () => {
    render(<CalendarSubscriptions />);
    const events = screen.getByRole("button", { name: "Odebírat události" });
    const meals = screen.getByRole("button", { name: "Odebírat jídelníček" });
    vi.spyOn(meals, "getBoundingClientRect").mockReturnValue({ left: 240, bottom: 144 } as DOMRect);
    await open("Odebírat jídelníček");
    const menu = screen.getByRole("group", { name: "Odběr kalendáře Habitat jídelníček" });
    expect(menu.style.left).toBe("240px");
    expect(menu.style.top).toBe("144px");
    expect(meals.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(events);
    await screen.findByRole("group", { name: "Odběr kalendáře Habitat" });
    await waitFor(() => expect(screen.getByRole("link", { name: "Apple Kalendář" }).getAttribute("href")).toBe(links.habitat.replace("https:", "webcal:")));
    expect(events.getAttribute("aria-expanded")).toBe("true");
    expect(meals.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("group", { name: "Odběr kalendáře Habitat" }).style.left).not.toBe("240px");
    fireEvent.click(events);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("allows retry after link loading fails", async () => {
    getLinks.mockRejectedValueOnce(new Error("private error"));
    render(<CalendarSubscriptions />);
    fireEvent.click(screen.getByRole("button", { name: "Odebírat události" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Odkazy se nepodařilo načíst. Zkuste odběr otevřít znovu.");
    fireEvent.click(screen.getByRole("button", { name: "Odebírat události" }));
    await open(); expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows a selectable URL when copying is denied", async () => {
    writeText.mockRejectedValueOnce(new Error("denied")); render(<CalendarSubscriptions />); await open();
    fireEvent.click(screen.getByRole("button", { name: "Kopírovat odkaz" }));
    const input = await screen.findByRole("textbox"); expect(input).toHaveProperty("value", links.habitat);
    expect(document.activeElement).toBe(input);
    await waitFor(() => expect(screen.getByRole("button", { name: "Kopírovat odkaz" })).toHaveProperty("disabled", false));
  });
});
