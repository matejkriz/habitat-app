import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_DURATION_MS, ToastProvider, useToast } from "./toast-provider";

const success = { title: "Omluvenka odeslána", description: "Oběd byl odhlášen.", tone: "success" as const };
const warning = { title: "Omluvenka uložena", description: "Oběd zůstává přihlášený.", tone: "warning" as const };

function Controls() {
  const toast = useToast();
  return <>
    <input aria-label="Důvod" />
    <button onClick={() => toast(success)}>Odeslat včas</button>
    <button onClick={() => toast(warning)}>Odeslat pozdě</button>
  </>;
}

function showSuccess() {
  fireEvent.click(screen.getByRole("button", { name: "Odeslat včas" }));
  return screen.getByRole("article", { name: success.title });
}

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps a polite live region mounted and allows closing without moving focus", () => {
    render(<ToastProvider><Controls /></ToastProvider>);
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion.getAttribute("aria-atomic")).toBe("true");
    expect(liveRegion.textContent).toBe("");
    const input = screen.getByRole("textbox", { name: "Důvod" });
    input.focus();

    showSuccess();

    expect(screen.getByText(success.description)).toBeTruthy();
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByRole("button", { name: "Zavřít oznámení" }));
    expect(screen.queryByText(success.title)).toBeNull();
    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("dismisses after exactly fifteen seconds", () => {
    render(<ToastProvider><Controls /></ToastProvider>);
    showSuccess();
    advance(TOAST_DURATION_MS - 1);
    expect(screen.getByText(success.title)).toBeTruthy();
    advance(1);
    expect(screen.queryByText(success.title)).toBeNull();
  });

  it("survives the child route unmount without restarting its remaining time", () => {
    const view = render(<ToastProvider><Controls /></ToastProvider>);
    showSuccess();
    advance(5000);
    view.rerender(<ToastProvider><p>Nová stránka</p></ToastProvider>);

    advance(TOAST_DURATION_MS - 5001);
    expect(screen.getByText(success.title)).toBeTruthy();
    advance(1);
    expect(screen.queryByText(success.title)).toBeNull();
  });

  it("replaces the previous message and gives the fresh message fifteen seconds", () => {
    render(<ToastProvider><Controls /></ToastProvider>);
    showSuccess();
    advance(10000);
    fireEvent.click(screen.getByRole("button", { name: "Odeslat pozdě" }));

    expect(screen.queryByText(success.title)).toBeNull();
    expect(screen.getByText(warning.description)).toBeTruthy();
    advance(TOAST_DURATION_MS - 1);
    expect(screen.getByText(warning.title)).toBeTruthy();
    advance(1);
    expect(screen.queryByText(warning.title)).toBeNull();
  });

  it("pauses both the remaining duration and background animation while hovered", () => {
    render(<ToastProvider><Controls /></ToastProvider>);
    const toast = showSuccess();
    const background = toast.querySelector<HTMLElement>(".toast-lifetime")!;
    expect(background.style.animationDuration).toBe(`${TOAST_DURATION_MS}ms`);
    expect(background.style.animationPlayState).toBe("running");
    advance(4000);
    fireEvent.mouseEnter(toast);
    expect(background.style.animationPlayState).toBe("paused");
    advance(TOAST_DURATION_MS);
    expect(screen.getByText(success.title)).toBeTruthy();
    fireEvent.mouseLeave(toast);
    expect(background.style.animationPlayState).toBe("running");
    advance(TOAST_DURATION_MS - 4001);
    expect(screen.getByText(success.title)).toBeTruthy();
    advance(1);
    expect(screen.queryByText(success.title)).toBeNull();
  });

  it("keeps the timer paused until both hover and focus have left", () => {
    render(<ToastProvider><Controls /></ToastProvider>);
    const toast = showSuccess();
    advance(3000);
    fireEvent.mouseEnter(toast);
    const close = screen.getByRole("button", { name: "Zavřít oznámení" });
    act(() => close.focus());
    fireEvent.mouseLeave(toast);
    advance(TOAST_DURATION_MS);
    expect(screen.getByText(success.title)).toBeTruthy();
    act(() => screen.getByRole("textbox", { name: "Důvod" }).focus());
    advance(TOAST_DURATION_MS - 3001);
    expect(screen.getByText(success.title)).toBeTruthy();
    advance(1);
    expect(screen.queryByText(success.title)).toBeNull();
  });

  it("pauses while the document is hidden and resumes with its remaining duration", () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(<ToastProvider><Controls /></ToastProvider>);
    const toast = showSuccess();
    advance(6000);
    visibility = "hidden";
    fireEvent(document, new Event("visibilitychange"));
    expect(toast.querySelector<HTMLElement>(".toast-lifetime")!.style.animationPlayState).toBe("paused");
    advance(TOAST_DURATION_MS);
    expect(screen.getByText(success.title)).toBeTruthy();
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    advance(TOAST_DURATION_MS - 6001);
    expect(screen.getByText(success.title)).toBeTruthy();
    advance(1);
    expect(screen.queryByText(success.title)).toBeNull();
  });

  it("starts paused if a toast is shown while the document is already hidden", () => {
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(<ToastProvider><Controls /></ToastProvider>);
    const toast = showSuccess();
    expect(toast.querySelector<HTMLElement>(".toast-lifetime")!.style.animationPlayState).toBe("paused");
    advance(TOAST_DURATION_MS);
    expect(screen.getByText(success.title)).toBeTruthy();
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    advance(TOAST_DURATION_MS);
    expect(screen.queryByText(success.title)).toBeNull();
  });

  it("clears the pending dismissal when the provider unmounts", () => {
    const view = render(<ToastProvider><Controls /></ToastProvider>);
    showSuccess();
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
