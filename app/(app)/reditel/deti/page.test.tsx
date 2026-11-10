import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChildrenManagementPage from "./page";

const mocks = vi.hoisted(() => ({
  getAllChildrenWithParents: vi.fn(),
  getAllParents: vi.fn(),
  createChild: vi.fn(),
  updateChild: vi.fn(),
  toggleChildActive: vi.fn(),
  assignParentToChild: vi.fn(),
  removeParentFromChild: vi.fn(),
  inviteParentToChild: vi.fn(),
}));

vi.mock("@/app/actions/director", () => mocks);
vi.mock("@/app/actions/parent-invitations", () => ({
  inviteParentToChild: mocks.inviteParentToChild,
}));

const invitedParent = { id: "new-parent", name: null, email: "parent@example.com" };

describe("ChildrenManagementPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    mocks.toggleChildActive.mockReset();
    mocks.toggleChildActive.mockResolvedValue(undefined);
    mocks.getAllChildrenWithParents.mockResolvedValue([
      {
        id: "anna",
        firstName: "Anna",
        lastName: "Malá",
        gender: "FEMALE",
        doesNotTakeLunch: false,
        active: true,
        createdAt: new Date(2026, 0, 1),
        parents: [],
      },
    ]);
    mocks.getAllParents.mockResolvedValue([]);
    mocks.createChild.mockReset();
    mocks.updateChild.mockResolvedValue(undefined);
    mocks.inviteParentToChild.mockReset();
    mocks.inviteParentToChild.mockResolvedValue({ parent: invitedParent, emailSent: true });
  });

  it("opens the new-child fields without submitting and keeps the save action on the same button", async () => {
    render(<ChildrenManagementPage />);
    await screen.findByRole("button", { name: "Upravit Anna Malá" });
    expect(screen.queryByLabelText("Jméno")).toBeNull();
    expect(screen.queryByLabelText("Příjmení")).toBeNull();
    expect(screen.queryByLabelText("Pohlaví")).toBeNull();
    expect(screen.queryByLabelText("Datum nástupu")).toBeNull();

    const addButton = screen.getByRole("button", { name: "Přidat dítě" });
    fireEvent.click(addButton);

    expect(screen.getByRole("button", { name: "Ulož dítě" })).toBe(addButton);
    expect((screen.getByLabelText("Jméno") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Příjmení") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Pohlaví") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Datum nástupu") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Vyplňte jméno dítěte.")).toBeNull();
    expect(mocks.createChild).not.toHaveBeenCalled();
  });

  it("shows all missing-field errors and clears each as its field is completed", async () => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Přidat dítě" }));
    fireEvent.click(screen.getByRole("button", { name: "Ulož dítě" }));

    const fields = [
      { label: "Jméno", value: "Eva", error: "Vyplňte jméno dítěte." },
      { label: "Příjmení", value: "Nová", error: "Vyplňte příjmení dítěte." },
      { label: "Pohlaví", value: "FEMALE", error: "Vyberte pohlaví dítěte." },
      { label: "Datum nástupu", value: "2026-11-02", error: "Vyplňte datum nástupu." },
    ];
    for (const field of fields) {
      expect(screen.getByText(field.error)).toBeTruthy();
      const input = screen.getByLabelText(field.label);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      const descriptionId = input.getAttribute("aria-describedby");
      expect(descriptionId).toBeTruthy();
      expect(document.getElementById(descriptionId!)?.textContent).toBe(field.error);
    }
    expect(mocks.createChild).not.toHaveBeenCalled();

    for (const [index, field] of fields.entries()) {
      fireEvent.change(screen.getByLabelText(field.label), { target: { value: field.value } });
      expect(screen.queryByText(field.error)).toBeNull();
      expect(screen.getByLabelText(field.label).getAttribute("aria-invalid")).not.toBe("true");
      for (const remaining of fields.slice(index + 1)) {
        expect(screen.getByText(remaining.error)).toBeTruthy();
      }
    }
    expect(mocks.createChild).not.toHaveBeenCalled();
  });

  it.each([
    { label: "Jméno", error: "Vyplňte jméno dítěte." },
    { label: "Příjmení", error: "Vyplňte příjmení dítěte." },
  ])("rejects a whitespace-only $label without calling the server", async ({ label, error }) => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Přidat dítě" }));
    fireEvent.change(screen.getByLabelText("Jméno"), { target: { value: "Eva" } });
    fireEvent.change(screen.getByLabelText("Příjmení"), { target: { value: "Nová" } });
    fireEvent.change(screen.getByLabelText("Pohlaví"), { target: { value: "FEMALE" } });
    fireEvent.change(screen.getByLabelText("Datum nástupu"), { target: { value: "2026-11-02" } });
    fireEvent.change(screen.getByLabelText(label), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Ulož dítě" }));

    expect(screen.getByText(error)).toBeTruthy();
    expect(mocks.createChild).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(label), { target: { value: "  " } });
    expect(screen.getByText(error)).toBeTruthy();
  });

  it("preserves entered values and keeps the form open after a server error", async () => {
    mocks.createChild.mockRejectedValueOnce(new Error("Dítě se nepodařilo uložit."));
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Přidat dítě" }));
    fireEvent.change(screen.getByLabelText("Jméno"), { target: { value: "Eva" } });
    fireEvent.change(screen.getByLabelText("Příjmení"), { target: { value: "Nová" } });
    fireEvent.change(screen.getByLabelText("Pohlaví"), { target: { value: "FEMALE" } });
    fireEvent.change(screen.getByLabelText("Datum nástupu"), { target: { value: "2026-11-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Ulož dítě" }));

    expect(await screen.findByText("Dítě se nepodařilo uložit.")).toBeTruthy();
    expect((screen.getByLabelText("Jméno") as HTMLInputElement).value).toBe("Eva");
    expect((screen.getByLabelText("Příjmení") as HTMLInputElement).value).toBe("Nová");
    expect((screen.getByLabelText("Pohlaví") as HTMLSelectElement).value).toBe("FEMALE");
    expect((screen.getByLabelText("Datum nástupu") as HTMLInputElement).value).toBe("2026-11-02");
    expect((screen.getByRole("button", { name: "Ulož dítě" }) as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.createChild).toHaveBeenCalledTimes(1);
  });

  it("submits the selected start date when adding a child", async () => {
    mocks.createChild.mockResolvedValue({ id: "eva", firstName: "Eva", lastName: "Nová", gender: "FEMALE", attendanceStartDate: "2026-11-02", active: true });
    render(<ChildrenManagementPage />);
    await screen.findByRole("button", { name: "Upravit Anna Malá" });
    fireEvent.click(screen.getByRole("button", { name: "Přidat dítě" }));
    fireEvent.change(screen.getByLabelText("Jméno"), { target: { value: "Eva" } });
    fireEvent.change(screen.getByLabelText("Příjmení"), { target: { value: "Nová" } });
    fireEvent.change(screen.getByLabelText("Pohlaví"), { target: { value: "FEMALE" } });
    fireEvent.change(screen.getByLabelText("Datum nástupu"), { target: { value: "2026-11-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Ulož dítě" }));
    await waitFor(() => expect(mocks.createChild).toHaveBeenCalledWith("Eva", "Nová", "FEMALE", "2026-11-02"));
    expect(await screen.findByText("Nástup: 2. 11. 2026")).toBeTruthy();
    expect(screen.queryByLabelText("Jméno")).toBeNull();
    expect(screen.queryByLabelText("Datum nástupu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Přidat dítě" }));
    expect((screen.getByLabelText("Jméno") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Příjmení") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Pohlaví") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Datum nástupu") as HTMLInputElement).value).toBe("");
  });
  it("allows the director to correct a child's start date", async () => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Upravit Anna Malá" }));
    fireEvent.change(screen.getByLabelText("Datum nástupu"), { target: { value: "2026-10-13" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() => expect(mocks.updateChild).toHaveBeenCalledWith("anna", expect.objectContaining({ attendanceStartDate: "2026-10-13" })));
    expect(await screen.findByText("Nástup: 13. 10. 2026")).toBeTruthy();
  });

  it("saves the no-lunch setting from child editing", async () => {
    render(<ChildrenManagementPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Upravit Anna Malá" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Neodebírá obědy/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    await waitFor(() =>
      expect(mocks.updateChild).toHaveBeenCalledWith("anna", {
        firstName: "Anna",
        lastName: "Malá",
        gender: "FEMALE",
        doesNotTakeLunch: true,
        attendanceDays: [1, 2, 3, 4],
        attendanceStartDate: "2026-09-01",
      }),
    );
    expect(await screen.findByText("Bez obědů")).toBeTruthy();
  });
  it("defaults to all school days and saves deselected attendance days", async () => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Upravit Anna Malá" }));
    for (const name of ["Pondělí", "Úterý", "Středa", "Čtvrtek"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
    }
    fireEvent.click(screen.getByRole("button", { name: "Úterý" }));
    expect(screen.getByRole("button", { name: "Úterý" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() => expect(mocks.updateChild).toHaveBeenCalledWith("anna", expect.objectContaining({ attendanceDays: [1, 3, 4] })));
    fireEvent.click(await screen.findByRole("button", { name: "Upravit Anna Malá" }));
    expect(screen.getByRole("button", { name: "Úterý" }).getAttribute("aria-pressed")).toBe("false");
  });
  it("edits a child's fund contribution", async () => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Upravit fond Anna Malá" }));
    fireEvent.change(screen.getByLabelText("Posláno do fondu (Kč)"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit fond" }));
    await waitFor(() => expect(mocks.updateChild).toHaveBeenCalledWith("anna", { fundSent: 1500 }));
    expect(await screen.findByText(/Zůstatek:.*1\s*500/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Vyhledat dítě"), { target: { value: "neexistuje" } });
    fireEvent.change(screen.getByLabelText("Vyhledat dítě"), { target: { value: "" } });
    expect(screen.getByText(/Zůstatek:.*1\s*500/)).toBeTruthy();
  });

  it("invites a new parent from the child card when no parents exist", async () => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Pozvat rodiče Anna Malá" }));
    expect(document.activeElement).toBe(screen.getByLabelText("E-mail rodiče"));
    fireEvent.change(screen.getByLabelText("E-mail rodiče"), { target: { value: invitedParent.email } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat pozvánku" }));

    await waitFor(() => expect(mocks.inviteParentToChild).toHaveBeenCalledWith("anna", invitedParent.email));
    expect(await screen.findByText(invitedParent.email)).toBeTruthy();
    expect(screen.queryByText("Žádní přiřazení rodiče")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Pozvánka byla odeslána");
    expect(screen.queryByLabelText("E-mail rodiče")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pozvat rodiče Anna Malá" }));
  });

  it("keeps the assignment and retries failed delivery without duplicating the parent", async () => {
    mocks.inviteParentToChild.mockResolvedValueOnce({ parent: invitedParent, emailSent: false });
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Pozvat rodiče Anna Malá" }));
    fireEvent.change(screen.getByLabelText("E-mail rodiče"), { target: { value: invitedParent.email } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat pozvánku" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Rodič je přiřazen");
    expect(screen.getByText(invitedParent.email)).toBeTruthy();
    expect((screen.getByLabelText("E-mail rodiče") as HTMLInputElement).value).toBe(invitedParent.email);
    fireEvent.click(screen.getByRole("button", { name: "Odeslat pozvánku" }));

    await waitFor(() => expect(mocks.inviteParentToChild).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getAllByText(invitedParent.email)).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows invitation errors and leaves the email available for correction", async () => {
    mocks.inviteParentToChild.mockRejectedValueOnce(new Error("Tento účet není rodičovský účet."));
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Pozvat rodiče Anna Malá" }));
    fireEvent.change(screen.getByLabelText("E-mail rodiče"), { target: { value: invitedParent.email } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat pozvánku" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Tento účet není rodičovský účet.");
    expect((screen.getByLabelText("E-mail rodiče") as HTMLInputElement).value).toBe(invitedParent.email);
    expect((screen.getByRole("button", { name: "Odeslat pozvánku" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("Žádní přiřazení rodiče")).toBeTruthy();
  });

  it("locks the invitation form while sending", async () => {
    let finish!: (result: { parent: typeof invitedParent; emailSent: boolean }) => void;
    mocks.inviteParentToChild.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Pozvat rodiče Anna Malá" }));
    fireEvent.change(screen.getByLabelText("E-mail rodiče"), { target: { value: invitedParent.email } });
    const submit = screen.getByRole("button", { name: "Odeslat pozvánku" }) as HTMLButtonElement;
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByLabelText("E-mail rodiče") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Zrušit pozvánku" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.inviteParentToChild).toHaveBeenCalledTimes(1);
    await act(async () => finish({ parent: invitedParent, emailSent: true }));
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("offers an invitation immediately after creating a child", async () => {
    mocks.createChild.mockResolvedValueOnce({
      id: "eva", firstName: "Eva", lastName: "Nová", gender: "FEMALE",
      active: true, doesNotTakeLunch: false, createdAt: new Date(2026, 0, 1),
    });
    render(<ChildrenManagementPage />);
    await screen.findByText("Anna Malá");
    fireEvent.click(screen.getByRole("button", { name: "Přidat dítě" }));
    fireEvent.change(screen.getByLabelText("Jméno"), { target: { value: "Eva" } });
    fireEvent.change(screen.getByLabelText("Příjmení"), { target: { value: "Nová" } });
    fireEvent.change(screen.getByLabelText("Pohlaví"), { target: { value: "FEMALE" } });
    fireEvent.change(screen.getByLabelText("Datum nástupu"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Ulož dítě" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pozvat rodiče Eva Nová" }));
    fireEvent.change(screen.getByLabelText("E-mail rodiče"), { target: { value: invitedParent.email } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat pozvánku" }));

    await waitFor(() => expect(mocks.inviteParentToChild).toHaveBeenCalledWith("eva", invitedParent.email));
    expect(await screen.findByText(invitedParent.email)).toBeTruthy();
  });

  it("continues to assign an existing parent without sending an invitation", async () => {
    mocks.getAllParents.mockResolvedValueOnce([invitedParent]);
    mocks.assignParentToChild.mockResolvedValueOnce(undefined);
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Přiřadit rodiče" }));
    fireEvent.change(screen.getByLabelText("Vyberte rodiče"), { target: { value: invitedParent.id } });
    fireEvent.click(screen.getByRole("button", { name: "Přiřadit" }));

    await waitFor(() => expect(mocks.assignParentToChild).toHaveBeenCalledWith(invitedParent.id, "anna"));
    expect(await screen.findByText(invitedParent.email)).toBeTruthy();
    expect(mocks.inviteParentToChild).not.toHaveBeenCalled();
  });

  it("filters names without accents and sorts both sections by Czech surname or start date", async () => {
    const child = { gender: "FEMALE", active: true, doesNotTakeLunch: false, parents: [] };
    mocks.getAllChildrenWithParents.mockResolvedValue([
      { ...child, id: "z", firstName: "Žofie", lastName: "Žížalka", attendanceStartDate: "2026-08-01" },
      { ...child, id: "c", firstName: "Cyril", lastName: "Cibulka", attendanceStartDate: "2026-10-01" },
      { ...child, id: "b", firstName: "Božena", lastName: "Červená" },
      { ...child, id: "a", firstName: "Adam", lastName: "Červený", active: false, attendanceStartDate: "2026-07-01" },
    ]);
    render(<ChildrenManagementPage />);
    await screen.findByRole("button", { name: "Žofie Žížalka" });
    const names = () => screen.getAllByRole("button").filter(button => button.hasAttribute("aria-controls") && button.getAttribute("aria-controls")?.startsWith("child-details-")).map(button => button.textContent);
    expect(names()).toEqual(["Cyril Cibulka", "Božena Červená", "Žofie Žížalka", "Adam Červený"]);
    fireEvent.change(screen.getByLabelText("Řadit podle"), { target: { value: "surname-desc" } });
    expect(names()).toEqual(["Žofie Žížalka", "Božena Červená", "Cyril Cibulka", "Adam Červený"]);
    fireEvent.change(screen.getByLabelText("Řadit podle"), { target: { value: "start-asc" } });
    expect(names()).toEqual(["Žofie Žížalka", "Božena Červená", "Cyril Cibulka", "Adam Červený"]);
    fireEvent.change(screen.getByLabelText("Řadit podle"), { target: { value: "start-desc" } });
    expect(names()).toEqual(["Cyril Cibulka", "Božena Červená", "Žofie Žížalka", "Adam Červený"]);
    fireEvent.change(screen.getByLabelText("Vyhledat dítě"), { target: { value: "  CERVEN  " } });
    expect(names()).toEqual(["Božena Červená", "Adam Červený"]);
    fireEvent.change(screen.getByLabelText("Vyhledat dítě"), { target: { value: "zizalka ZOFIE" } });
    expect(names()).toEqual(["Žofie Žížalka"]);
    fireEvent.change(screen.getByLabelText("Vyhledat dítě"), { target: { value: "neexistuje" } });
    expect(screen.queryByRole("button", { name: /^Upravit / })).toBeNull();
    expect(screen.getByText("Vyhledávání neodpovídají žádné aktivní děti.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Vyhledat dítě"), { target: { value: "" } });
    expect(names()).toHaveLength(4);
  });

  it("collapses each child's details independently and shows parent names and emails", async () => {
    const child = { lastName: "Malá", gender: "FEMALE", active: true, doesNotTakeLunch: false, parents: [{ id: "p", name: "Petra Malá", email: "petra@example.cz" }] };
    mocks.getAllChildrenWithParents.mockResolvedValue([{ ...child, id: "anna", firstName: "Anna" }, { ...child, id: "eva", firstName: "Eva" }]);
    render(<ChildrenManagementPage />);
    const anna = await screen.findByRole("button", { name: "Anna Malá" });
    const eva = screen.getByRole("button", { name: "Eva Malá" });
    expect(anna.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Pozvat rodiče Anna Malá" })).toBeNull();
    fireEvent.click(anna);
    expect(anna.getAttribute("aria-expanded")).toBe("true");
    expect(eva.getAttribute("aria-expanded")).toBe("false");
    const details = document.getElementById(anna.getAttribute("aria-controls")!)!;
    expect(within(details).getByText("Petra Malá")).toBeTruthy();
    expect(within(details).getByText("petra@example.cz")).toBeTruthy();
    fireEvent.click(eva);
    fireEvent.click(anna);
    expect(eva.getAttribute("aria-expanded")).toBe("true");
    expect(anna.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Upravit Anna Malá" }));
    expect(anna.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Jméno dítěte")).toBeTruthy();
  });

  it("requires confirmation, supports cancellation, and locks deactivation while saving", async () => {
    let finish!: () => void;
    mocks.toggleChildActive.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Deaktivovat" }));
    let dialog = screen.getByRole("dialog", { name: "Deaktivovat dítě?" });
    expect(dialog.textContent).toContain("Anna Malá");
    expect(mocks.toggleChildActive).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Zrušit" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.toggleChildActive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Deaktivovat" }));
    dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Deaktivovat dítě" }) as HTMLButtonElement;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(confirm.disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Zrušit" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.toggleChildActive).toHaveBeenCalledExactlyOnceWith("anna", false);
    await act(async () => finish());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Neaktivní děti (1)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aktivovat" }));
    await waitFor(() => expect(mocks.toggleChildActive).toHaveBeenLastCalledWith("anna", true));
  });

  it("keeps the confirmation open on failure and permits retry", async () => {
    mocks.toggleChildActive.mockRejectedValueOnce(new Error("Uložení selhalo."));
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Anna Malá" }));
    fireEvent.click(screen.getByRole("button", { name: "Deaktivovat" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deaktivovat dítě" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Uložení selhalo.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deaktivovat dítě" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toggleChildActive).toHaveBeenCalledTimes(2);
  });
});
