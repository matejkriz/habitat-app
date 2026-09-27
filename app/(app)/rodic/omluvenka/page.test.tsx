import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewExcusePage from "./page";

const mocks = vi.hoisted(() => ({
  getParentChildren: vi.fn(),
  submitExcuse: vi.fn(),
  submitMakeup: vi.fn(),
  getExcuseCalendarMonth: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  searchParams: "child=child-1",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));

vi.mock("@/app/actions/parent", () => ({
  getParentChildren: mocks.getParentChildren,
  submitExcuse: mocks.submitExcuse,
  submitMakeup: mocks.submitMakeup,
}));

vi.mock("@/app/actions/calendar", () => ({
  getExcuseCalendarMonth: mocks.getExcuseCalendarMonth,
}));

const children = [
  {
    id: "child-1",
    firstName: "Anna",
    gender: "FEMALE",
    doesNotTakeLunch: false,
  },
  {
    id: "child-2",
    firstName: "Jan",
    gender: "MALE",
    doesNotTakeLunch: false,
  },
];

describe("NewExcusePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams = "child=child-1";
    mocks.getParentChildren.mockResolvedValue(children);
    mocks.getExcuseCalendarMonth.mockResolvedValue({
      monthKey: "2026-09",
      closedDateKeys: ["2026-09-14"],
    });
    mocks.submitExcuse.mockResolvedValue({
      success: true,
      excuses: [
        {
          id: "excuse-1",
          childId: "child-1",
          fromDate: new Date(2026, 8, 10),
          toDate: new Date(2026, 8, 10),
          isOnTime: true,
        },
      ],
      summary: {
        cancelLunch: true,
        schoolDayCount: 1,
        lateDayCount: 0,
        onTimeDayCount: 1,
        automaticallyApprovedDayCount: 0,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the selected date when previewing its deadline west of UTC", async () => {
    vi.stubEnv("TZ", "America/New_York");
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2099-09-22" },
    });

    expect(
      await screen.findByText(/termín do pondělí 21\. září.*09:00/i),
    ).toBeTruthy();
  });
  it("offers makeup only for children with a reduced attendance schedule", async () => {
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 3] }, children[1]]);
    render(<NewExcusePage />);
    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(screen.getByRole("tab", { name: "Náhrada" }));
    expect(mocks.replace).toHaveBeenCalledWith("/rodic/omluvenka?child=child-1&kind=makeup", { scroll: false });
    expect(screen.getByText("Nová náhrada")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Dítě dorazí" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Jan" })).toBeNull();
    expect(screen.getByText("Anna")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText("Pravidla pro omluvenky")).toBeNull();
    expect(screen.getByText("Pravidla pro přihlášení oběda")).toBeTruthy();
  });

  it("has no makeup tab for children with default attendance", async () => {
    render(<NewExcusePage />);
    await screen.findByRole("checkbox", { name: "Anna" });
    expect(screen.queryByRole("tab", { name: "Náhrada" })).toBeNull();
  });

  it("submits makeup arrival and explains late lunch without approval text", async () => {
    mocks.searchParams = "child=child-1&kind=makeup&date=2026-09-10";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 2, 3] }]);
    mocks.submitMakeup.mockResolvedValueOnce({
      excuses: [{ id: "makeup-1" }],
      summary: { schoolDayCount: 1, lateDayCount: 1, onTimeDayCount: 0, cancelLunch: false, automaticallyApprovedDayCount: 0 },
    });
    render(<NewExcusePage />);
    await screen.findByText("Nová náhrada");
    fireEvent.click(screen.getByRole("radio", { name: "Dopoledne" }));
    expect(screen.getByText("Dítě dorazí pouze dopoledne.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat náhradu" }));
    await screen.findByText("Náhrada odeslána");
    expect(mocks.submitExcuse).not.toHaveBeenCalled();
    const formData = mocks.submitMakeup.mock.calls[0][0] as FormData;
    expect(formData.getAll("childIds")).toEqual(["child-1"]);
    expect(formData.get("dayPart")).toBe("MORNING");
    expect(formData.get("requestId")).toEqual(expect.any(String));
    expect(screen.getByText(/Oběd není zajištěný/)).toBeTruthy();
    expect(screen.queryByText(/schválen/i)).toBeNull();
  });

  it("hides lunch rules for a makeup child without lunches", async () => {
    mocks.searchParams = "child=child-1&kind=makeup";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [], doesNotTakeLunch: true }]);
    render(<NewExcusePage />);
    await screen.findByText("Nová náhrada");
    expect(screen.queryByText("Pravidla pro přihlášení oběda")).toBeNull();
    expect(screen.queryByText("Pravidla pro omluvenky")).toBeNull();
  });
  it("does not promise lunch for an afternoon-only makeup", async () => {
    mocks.searchParams = "child=child-1&kind=MAKEUP&date=2026-09-10";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 2, 3] }]);
    mocks.submitMakeup.mockResolvedValueOnce({
      excuses: [{ id: "makeup-afternoon" }],
      summary: { schoolDayCount: 1, lateDayCount: 0, onTimeDayCount: 0, cancelLunch: false, automaticallyApprovedDayCount: 1 },
    });
    render(<NewExcusePage />);
    await screen.findByText("Nová náhrada");
    fireEvent.click(screen.getByRole("radio", { name: "Odpoledne" }));
    expect(screen.getByText("Dítě dorazí pouze odpoledne.")).toBeTruthy();
    expect(screen.queryByText("Pravidla pro přihlášení oběda")).toBeNull();
    expect(screen.queryByText(/Termín pro přihlášení oběda uplynul/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat náhradu" }));
    await screen.findByText("Náhrada odeslána");
    expect(screen.queryByText(/Oběd bude přihlášen/)).toBeNull();
    expect(screen.queryByText(/Oběd není zajištěný/)).toBeNull();
  });
  it("uses general lunch rules for a range that starts on a regular attendance day", async () => {
    mocks.searchParams = "child=child-1&kind=makeup&date=2026-09-21";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 3, 4] }]);
    render(<NewExcusePage />);
    await screen.findByText("Nová náhrada");
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-22" } });
    expect(screen.getByText("Pravidla pro přihlášení oběda")).toBeTruthy();
    expect(screen.queryByText("Termín pro přihlášení oběda uplynul")).toBeNull();
    expect(screen.queryByText("Oběd bude přihlášen")).toBeNull();
    expect(screen.queryByText(/Termín byl do/)).toBeNull();
  });
  it("asks for a regular off day instead of promising lunch for scheduled days", async () => {
    mocks.searchParams = "child=child-1&kind=makeup&date=2099-09-21";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 2, 3] }]);
    render(<NewExcusePage />);
    await screen.findByText("Nová náhrada");
    expect(screen.getByText("Vyberte den, kdy dítě běžně nechodí.")).toBeTruthy();
    expect(screen.queryByText("Oběd bude přihlášen")).toBeNull();
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2099-09-23" } });
    expect(screen.getByText("Vyberte den, kdy dítě běžně nechodí.")).toBeTruthy();
  });
  it("clears full-schedule children selected before switching to makeup", async () => {
    mocks.searchParams = "child=child-2&date=2026-09-10";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 3] }, children[1]]);
    mocks.submitMakeup.mockResolvedValueOnce({ excuses: [{ id: "makeup-1" }], summary: { schoolDayCount: 1, lateDayCount: 1, onTimeDayCount: 0, cancelLunch: false, automaticallyApprovedDayCount: 0 } });
    render(<NewExcusePage />);
    const jan = await screen.findByRole("checkbox", { name: "Jan" });
    expect(jan).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("tab", { name: "Náhrada" }));
    fireEvent.click(screen.getByRole("button", { name: "Odeslat náhradu" }));
    await waitFor(() => expect(mocks.submitMakeup).toHaveBeenCalledOnce());
    expect((mocks.submitMakeup.mock.calls[0][0] as FormData).getAll("childIds")).toEqual(["child-1"]);
  });

  it("prevents a makeup on a regular attendance day", async () => {
    mocks.searchParams = "child=child-1&kind=makeup&date=2026-09-30";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 2, 3] }]);
    render(<NewExcusePage />);
    await screen.findByText("Nová náhrada");
    fireEvent.click(screen.getByRole("button", { name: "Odeslat náhradu" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Vyberte alespoň jeden den, kdy dítě pravidelně nechodí.");
    expect(mocks.submitMakeup).not.toHaveBeenCalled();
  });

  it("requires an extra attendance day for every selected child", async () => {
    mocks.searchParams = "child=child-1&kind=makeup&date=2026-09-30";
    mocks.getParentChildren.mockResolvedValueOnce([
      { ...children[0], attendanceDays: [1, 2, 4] },
      { ...children[1], attendanceDays: [1, 2, 3] },
    ]);
    render(<NewExcusePage />);
    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Jan" }));
    fireEvent.click(screen.getByRole("button", { name: "Odeslat náhradu" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Vyberte alespoň jeden den, kdy dítě pravidelně nechodí.");
    expect(mocks.submitMakeup).not.toHaveBeenCalled();
  });

  it.each(["EXCUSE", "MAKEUP"])("shows returned %s validation without treating it as success", async (kind) => {
    mocks.searchParams = `child=child-1&kind=${kind.toLowerCase()}&date=2026-09-10`;
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 2, 3] }]);
    const action = kind === "MAKEUP" ? mocks.submitMakeup : mocks.submitExcuse;
    action.mockResolvedValueOnce({ success: false, error: "Vyberte jiné datum." });
    render(<NewExcusePage />);
    await screen.findByText(kind === "MAKEUP" ? "Nová náhrada" : "Nová omluvenka");
    fireEvent.click(screen.getByRole("button", { name: kind === "MAKEUP" ? "Odeslat náhradu" : "Odeslat omluvenku" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Vyberte jiné datum.");
    expect(screen.queryByText(/odeslána$/)).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("hides minified production server errors", async () => {
    mocks.searchParams = "child=child-1&kind=makeup&date=2026-09-10";
    mocks.getParentChildren.mockResolvedValueOnce([{ ...children[0], attendanceDays: [1, 2, 3] }]);
    mocks.submitMakeup.mockRejectedValueOnce(Object.assign(new Error("Minified React error #441; visit https://react.dev/errors/441"), { digest: "123456" }));
    render(<NewExcusePage />);
    await screen.findByText("Nová náhrada");
    fireEvent.click(screen.getByRole("button", { name: "Odeslat náhradu" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Nepodařilo se odeslat náhradu. Zkuste to prosím znovu.");
    expect(screen.queryByText(/Minified React/)).toBeNull();
  });

  it("disables closed endpoints but allows a range to span across them", async () => {
    mocks.searchParams = "child=child-1&date=2026-09-10";
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(screen.getByLabelText("Od"));

    const friday = await screen.findByRole("button", {
      name: /pátek 11\. září 2026, habitat je zavřený/i,
    });
    const customClosure = screen.getByRole("button", {
      name: /pondělí 14\. září 2026, habitat je zavřený/i,
    });
    expect((friday as HTMLButtonElement).disabled).toBe(true);
    expect((customClosure as HTMLButtonElement).disabled).toBe(true);
    expect(friday.className).toContain("line-through");
    expect(customClosure.className).toContain("line-through");
    expect(
      (screen.getByRole("button", {
        name: /čtvrtek 10\. září 2026/i,
      }) as HTMLButtonElement).disabled,
    ).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: /čtvrtek 10\. září 2026/i }),
    );
    fireEvent.click(screen.getByLabelText("Do"));
    fireEvent.click(
      await screen.findByRole("button", { name: /úterý 15\. září 2026/i }),
    );

    expect((screen.getByLabelText("Do") as HTMLInputElement).value).toBe("15. 9. 2026");
  });

  it("preselects the current child and lets the parent select both children", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna" });
    const jan = screen.getByRole("checkbox", { name: "Jan" });

    expect((anna as HTMLInputElement).checked).toBe(true);
    expect((jan as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText(/Novák/)).toBeNull();

    fireEvent.click(jan);

    expect((anna as HTMLInputElement).checked).toBe(true);
    expect((jan as HTMLInputElement).checked).toBe(true);
  });

  it("shows an error and does not submit when all children are cleared", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(anna);
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    expect(await screen.findByText("Vyberte alespoň jedno dítě.")).toBeTruthy();
    expect(mocks.submitExcuse).not.toHaveBeenCalled();
  });

  it("can submit the excuse only for the other child", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna" });
    const jan = screen.getByRole("checkbox", { name: "Jan" });
    fireEvent.click(anna);
    fireEvent.click(jan);
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalled());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.getAll("childIds")).toEqual(["child-2"]);
    expect(formData.get("dayPart")).toBe("FULL_DAY");
    expect(formData.get("cancelLunch")).toBe("true");
  });

  it("shows whole day by default and keeps lunch choice visible for an afternoon absence", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    const dayPart = screen.getByRole("group", { name: "Dítě bude chybět" });
    expect(
      screen.getByRole("radio", { name: "Celý den" }),
    ).toHaveProperty("checked", true);
    expect(dayPart).toBeTruthy();
    const lunchToggle = screen.getByRole("switch");
    const reason = screen.getByLabelText("Důvod (volitelné)");
    expect(lunchToggle.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Odpoledne" }));

    expect(
      screen.getByText(
        "Dítě bude ve škole dopoledne, odpoledne bude chybět.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("switch")).toBe(lunchToggle);
    expect((lunchToggle as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText("Oběd zůstává přihlášený.")).toBeNull();
  });

  it("submits an afternoon absence with the parent's lunch choice", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(screen.getByRole("radio", { name: "Odpoledne" }));
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("AFTERNOON");
    expect(formData.get("cancelLunch")).toBe("false");
  });

  it("shows the day-part choice for no date and one day, then hides and resets it for a range", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    expect(screen.getByRole("group", { name: "Dítě bude chybět" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    expect(screen.getByRole("group", { name: "Dítě bude chybět" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Odpoledne" }));

    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-11" },
    });

    expect(screen.queryByRole("group", { name: "Dítě bude chybět" })).toBeNull();
    expect(screen.getByRole("switch")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("FULL_DAY");
  });

  it("can submit the excuse for both children", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Jan" }));
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalled());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.getAll("childIds")).toEqual(["child-1", "child-2"]);
  });

  it("explains a mixed range without claiming that no lunches were canceled", async () => {
    mocks.submitExcuse.mockResolvedValueOnce({
      success: true,
      excuses: [{ id: "excuse-1", childId: "child-1" }],
      summary: {
        cancelLunch: true,
        schoolDayCount: 2,
        lateDayCount: 1,
        onTimeDayCount: 1,
        automaticallyApprovedDayCount: 0,
      },
    });
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-08-19" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-08-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    expect(
      await screen.findByText(/1 oběd bude odhlášen.*1 pozdně omluvený den/i),
    ).toBeTruthy();
    expect(screen.queryByText(/oběd nebude automaticky odhlášen/i)).toBeNull();
  });

  it("confirms automatic approval for a child without lunches", async () => {
    mocks.getParentChildren.mockResolvedValueOnce([
      { ...children[0], doesNotTakeLunch: true },
    ]);
    mocks.submitExcuse.mockResolvedValueOnce({
      success: true,
      excuses: [{ id: "excuse-1", childId: "child-1" }],
      summary: {
        cancelLunch: true,
        schoolDayCount: 1,
        lateDayCount: 0,
        onTimeDayCount: 0,
        automaticallyApprovedDayCount: 1,
      },
    });
    render(<NewExcusePage />);

    await screen.findByText("Nová omluvenka");
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-08-19" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-08-19" },
    });
    expect(screen.getByRole("switch")).toBeTruthy();
    expect(await screen.findByText("Dítě neodebírá obědy.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    expect(
      await screen.findByText(/1 den omluvenky byl automaticky schválen/),
    ).toBeTruthy();
  });

  it("lets the parent keep lunch without sending the excuse for review", async () => {
    mocks.submitExcuse.mockResolvedValueOnce({
      success: true,
      excuses: [{ id: "excuse-1", childId: "child-1" }],
      summary: {
        cancelLunch: false,
        schoolDayCount: 1,
        lateDayCount: 0,
        onTimeDayCount: 0,
        automaticallyApprovedDayCount: 1,
      },
    });
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    const lunchToggle = screen.getByRole("switch");
    expect((lunchToggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(lunchToggle);
    expect(
      screen.getByText(
        "Oběd zůstane přihlášený a omluvenku není potřeba schvalovat.",
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("cancelLunch")).toBe("false");
    expect(
      await screen.findByText(
        "Omluvenku není potřeba schvalovat. Oběd nebude odhlášen.",
      ),
    ).toBeTruthy();
  });
  it("keeps the same request identity and form values when retrying a failed submission", async () => {
    mocks.submitExcuse.mockRejectedValueOnce(new Error("Spojení přerušeno"));
    render(<NewExcusePage />);
    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));
    await screen.findByText("Nepodařilo se odeslat omluvenku. Zkuste to prosím znovu.");
    expect(screen.getByLabelText<HTMLInputElement>("Od").value).toBe("10. 9. 2026");
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));
    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledTimes(2));
    const first = mocks.submitExcuse.mock.calls[0][0] as FormData;
    const second = mocks.submitExcuse.mock.calls[1][0] as FormData;
    expect(first.get("requestId")).toEqual(expect.any(String));
    expect(second.get("requestId")).toBe(first.get("requestId"));
  });

});
