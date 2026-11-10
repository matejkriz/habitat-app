import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getLinks = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/calendar-subscriptions", () => ({ getCalendarSubscriptionLinks: getLinks }));
import { CalendarSubscriptions } from "./calendar-subscriptions";

const links = {
  habitat: "https://app.example/api/calendars/personal-token/habitat.ics",
  jidelnicek: "https://app.example/api/calendars/personal-token/jidelnicek.ics",
};
const writeText = vi.fn();
const button = (name: string) => screen.getByRole("button", { name: `Kopírovat odkaz na kalendář ${name}` });

beforeEach(() => {
  vi.resetAllMocks();
  getLinks.mockResolvedValue(links);
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("ClipboardItem", undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("calendar copy buttons", () => {
  it("shows two buttons immediately, copies the chosen URLs and reuses the retrieved links", async () => {
    render(<CalendarSubscriptions />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(button("Habitat").textContent).toBe("Habitat");
    expect(button("Habitat jídelníček").textContent).toBe("Habitat jídelníček");
    expect(getLinks).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(button("Habitat"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(links.habitat));
    await waitFor(() => expect(button("Habitat").textContent).toBe("Zkopírováno"));
    fireEvent.click(button("Habitat jídelníček"));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(links.jidelnicek));
    await waitFor(() => expect(button("Habitat jídelníček").textContent).toBe("Zkopírováno"));
    expect(getLinks).toHaveBeenCalledTimes(1);
  });

  it("starts clipboard permission handling before the server responds, for Safari", async () => {
    let resolveLinks!: (value: typeof links) => void;
    getLinks.mockImplementation(() => new Promise(resolve => { resolveLinks = resolve; }));
    class DeferredClipboardItem {
      constructor(readonly data: Record<string, Promise<Blob>>) {}
    }
    const write = vi.fn(async (items: DeferredClipboardItem[]) => {
      await items[0].data["text/plain"];
    });
    vi.stubGlobal("ClipboardItem", DeferredClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write } });
    render(<CalendarSubscriptions />);
    fireEvent.click(button("Habitat"));
    fireEvent.click(button("Habitat"));
    expect(write).toHaveBeenCalledTimes(1);
    expect(getLinks).toHaveBeenCalledTimes(1);
    expect(button("Habitat jídelníček")).toHaveProperty("disabled", true);
    await act(async () => resolveLinks(links));
    expect(await (await write.mock.calls[0][0][0].data["text/plain"]).text()).toBe(links.habitat);
    expect(button("Habitat").textContent).toBe("Zkopírováno");
  });

  it("retries a failed link request without exposing server details", async () => {
    getLinks.mockRejectedValueOnce(new Error("internal server details"));
    render(<CalendarSubscriptions />);
    fireEvent.click(button("Habitat"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Odkaz se nepodařilo zkopírovat.");
    await waitFor(() => expect(button("Habitat")).toHaveProperty("disabled", false));
    fireEvent.click(button("Habitat"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(links.habitat));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a selected URL only when clipboard access is denied", async () => {
    writeText.mockRejectedValueOnce(new Error("NotAllowedError"));
    render(<CalendarSubscriptions />);
    fireEvent.click(button("Habitat jídelníček"));
    const input = await screen.findByRole("textbox", { name: "Odkaz na kalendář Habitat jídelníček" });
    expect(input).toHaveProperty("value", links.jidelnicek);
    expect(input).toHaveProperty("readOnly", true);
    expect(document.activeElement).toBe(input);
    expect(input).toHaveProperty("selectionStart", 0);
    expect(input).toHaveProperty("selectionEnd", links.jidelnicek.length);
  });
});
