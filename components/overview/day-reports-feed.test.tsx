import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDayReports: vi.fn() }));
vi.mock("@/app/actions/day-details", () => ({ getDayReports: mocks.getDayReports }));
import { DayReportsFeed } from "./day-reports-feed";

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

const days = [10, 8, 3].map(day => ({
  date: Date.UTC(2026, 8, day), name: `Výlet ${day}`, report: `Zážitky ze dne ${day}.`,
}));

it("shows one day, navigates across gaps, hides missing neighbors and focuses the new day", () => {
  render(<DayReportsFeed initialPage={{ reports: days, nextBefore: null }} />);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByText("Zážitky ze dne 8.")).toBeNull();
  expect(screen.queryByRole("button", { name: /Novější report/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Starší report.*8\. 9\. 2026/ }));
  expect(screen.getByText("Zážitky ze dne 8.")).toBeTruthy();
  expect(screen.queryByText("Zážitky ze dne 10.")).toBeNull();
  expect(document.activeElement?.textContent).toContain("8. 9. 2026");
  fireEvent.click(screen.getByRole("button", { name: /Starší report.*3\. 9\. 2026/ }));
  expect(screen.queryByRole("button", { name: /Starší report/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Novější report.*8\. 9\. 2026/ }));
  expect(screen.getByText("Zážitky ze dne 8.")).toBeTruthy();
  expect(mocks.getDayReports).not.toHaveBeenCalled();
});

it("renders Markdown and makes existing plain photo URLs clickable", () => {
  const report = "## V lese\n\nPrvní odstavec\nDruhý řádek\n\n- **Pozorování** včel\n- Hraní\n\n[Fotky z výletu](https://example.com/album?a=1&b=2)\n\nDalší album: https://example.com/photos";
  render(<DayReportsFeed initialPage={{ reports: [{ ...days[0], report }], nextBefore: null }} />);
  expect(screen.getByRole("heading", { name: "V lese" })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("Pozorování").tagName).toBe("STRONG");
  expect(screen.getByRole("link", { name: "Fotky z výletu" }).getAttribute("href")).toBe("https://example.com/album?a=1&b=2");
  expect(screen.getByRole("link", { name: "https://example.com/photos" }).getAttribute("href")).toBe("https://example.com/photos");
});

it("renders legacy bullet lists without loading remote images or executing HTML and unsafe links", () => {
  const report = '• První aktivita\n• Druhá aktivita\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n![Fotografie](https://example.com/tracker.png)\n\n[Odkaz](javascript:alert%281%29)';
  const { container } = render(<DayReportsFeed initialPage={{ reports: [{ ...days[0], report }], nextBefore: null }} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(container.querySelector("script, img")).toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
});

it("prefetches the next page to show its real date, retains the current day and reuses loaded days", async () => {
  mocks.getDayReports.mockResolvedValue({ reports: [days[2]], nextBefore: null });
  render(<DayReportsFeed initialPage={{ reports: days.slice(0, 2), nextBefore: days[1].date }} />);
  await waitFor(() => expect(mocks.getDayReports).toHaveBeenCalledWith(days[1].date));
  expect(screen.getByText("Zážitky ze dne 10.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Starší report/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Starší report.*3\. 9\. 2026/ }));
  expect(screen.getByText("Zážitky ze dne 3.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Starší report/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Novější report/ }));
  expect(mocks.getDayReports).toHaveBeenCalledTimes(1);
});

it("keeps the current day on a pagination failure and allows retrying without duplicate days", async () => {
  mocks.getDayReports.mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ reports: [days[1]], nextBefore: null });
  render(<DayReportsFeed initialPage={{ reports: [days[0]], nextBefore: days[0].date }} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("Zážitky ze dne 10.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
  fireEvent.click(await screen.findByRole("button", { name: /Starší report.*8\. 9\. 2026/ }));
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /Starší report/ })).toBeNull();
  expect(mocks.getDayReports).toHaveBeenCalledTimes(2);
});

it("does not offer a phantom older day when the final page is empty", async () => {
  mocks.getDayReports.mockResolvedValue({ reports: [], nextBefore: null });
  render(<DayReportsFeed initialPage={{ reports: [days[0]], nextBefore: days[0].date }} />);
  await waitFor(() => expect(mocks.getDayReports).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText("Načítání starších reportů…")).toBeNull());
  expect(screen.queryByRole("button", { name: /Starší report/ })).toBeNull();
  expect(screen.getByText("Zážitky ze dne 10.")).toBeTruthy();
});

it("discards a stale page response after the initial reports refresh", async () => {
  let resolveOld!: (page: { reports: typeof days; nextBefore: null }) => void;
  mocks.getDayReports.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const { rerender } = render(<DayReportsFeed initialPage={{ reports: [days[0]], nextBefore: days[0].date }} />);
  await waitFor(() => expect(mocks.getDayReports).toHaveBeenCalledTimes(1));
  rerender(<DayReportsFeed initialPage={{ reports: [{ ...days[0], report: "Upravený report" }], nextBefore: null }} />);
  await act(async () => resolveOld({ reports: [days[1]], nextBefore: null }));
  expect(screen.getByText("Upravený report")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Starší report/ })).toBeNull();
});

it("shows an empty state when there are no reports", () => {
  render(<DayReportsFeed initialPage={{ reports: [], nextBefore: null }} />);
  expect(screen.getByText("Zatím nejsou k dispozici žádné reporty.")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
});

it("shows previously imported photo album lines as a descriptive Markdown link", () => {
  const report = 'Výlet byl moc hezký.\n\nFotky z výletu: https://photos.app.goo.gl/example?album=1&view=2';
  render(<DayReportsFeed initialPage={{ reports: [{ ...days[0], report }], nextBefore: null }} />);
  const link = screen.getByRole('link', { name: 'Fotky z výletu' });
  expect(link.getAttribute('href')).toBe('https://photos.app.goo.gl/example?album=1&view=2');
  expect(screen.getByText('Výlet byl moc hezký.')).toBeTruthy();
});

function mockAnimations(oldHeight = 400, newHeight = 800) {
  const animations: { element: Element; frames: Keyframe[]; finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = [];
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (this: HTMLElement, frames: Keyframe[]) {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const cancel = vi.fn();
    animations.push({ element: this, frames, finish, cancel });
    return { finished, cancel };
  } });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { height: this.dataset.reportPanel === "current" ? newHeight : oldHeight } as DOMRect;
  });
  return { animations, restore: () => {
    if (original) Object.defineProperty(HTMLElement.prototype, "animate", original);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  } };
}

it.each([[400, 800], [800, 400]])("slides at %ipx before resizing to %ipx and blocks repeated clicks", async (oldHeight, newHeight) => {
  const { animations, restore } = mockAnimations(oldHeight, newHeight);
  try {
    render(<DayReportsFeed initialPage={{ reports: days, nextBefore: null }} />);
    fireEvent.click(screen.getByRole("button", { name: /Starší report/ }));
    expect(animations).toHaveLength(2);
    const viewport = screen.getByRole("region", { name: "Denní reporty" });
    expect(viewport.style.height).toBe(`${oldHeight}px`);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    const next = screen.getByRole("button", { name: /Starší report.*3\. 9/ });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(next);
    await act(async () => { animations[0].finish(); animations[1].finish(); });
    expect(animations).toHaveLength(3);
    expect(animations[2].frames).toEqual([{ height: `${oldHeight}px` }, { height: `${newHeight}px` }]);
    expect(viewport.style.height).toBe(`${oldHeight}px`);
    expect((next as HTMLButtonElement).disabled).toBe(true);
    await act(async () => animations[2].finish());
    expect(viewport.style.height).toBe("");
    expect(screen.getAllByRole("article", { hidden: true })).toHaveLength(1);
    expect((next as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement?.textContent).toContain("8. 9. 2026");
    fireEvent.click(screen.getByRole("button", { name: /Novější report/ }));
    expect(animations[3].frames[1].transform).toBe(`translateY(${newHeight}px)`);
    expect(animations[4].frames[0].transform).toBe(`translateY(${-newHeight}px)`);
    await act(async () => { animations[3].finish(); animations[4].finish(); });
    await act(async () => animations[5].finish());
    expect(screen.queryByRole("button", { name: /Novější report/ })).toBeNull();
  } finally { cleanup(); restore(); }
});

it("skips movement and height animation when reduced motion is requested", () => {
  const { animations, restore } = mockAnimations();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  try {
    render(<DayReportsFeed initialPage={{ reports: days, nextBefore: null }} />);
    fireEvent.click(screen.getByRole("button", { name: /Starší report/ }));
    expect(animations).toHaveLength(0);
    expect(screen.getByText("Zážitky ze dne 8.")).toBeTruthy();
    expect(screen.getAllByRole("article", { hidden: true })).toHaveLength(1);
  } finally { cleanup(); restore(); }
});

it("cancels a transition when refreshed reports replace the reader", async () => {
  const { animations, restore } = mockAnimations();
  try {
    const { rerender } = render(<DayReportsFeed initialPage={{ reports: days, nextBefore: null }} />);
    fireEvent.click(screen.getByRole("button", { name: /Starší report/ }));
    expect(animations).toHaveLength(2);
    rerender(<DayReportsFeed initialPage={{ reports: [{ ...days[0], report: "Čerstvý report" }], nextBefore: null }} />);
    expect(animations.every(animation => animation.cancel.mock.calls.length > 0)).toBe(true);
    await act(async () => { animations[0].finish(); animations[1].finish(); });
    expect(animations).toHaveLength(2);
    expect(screen.getByText("Čerstvý report")).toBeTruthy();
  } finally { cleanup(); restore(); }
});
