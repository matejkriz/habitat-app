import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    mocks.updateChild.mockResolvedValue(undefined);
    mocks.inviteParentToChild.mockReset();
    mocks.inviteParentToChild.mockResolvedValue({ parent: invitedParent, emailSent: true });
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
    fireEvent.click(await screen.findByRole("button", { name: "Upravit fond Anna Malá" }));
    fireEvent.change(screen.getByLabelText("Posláno do fondu (Kč)"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit fond" }));
    await waitFor(() => expect(mocks.updateChild).toHaveBeenCalledWith("anna", { fundSent: 1500 }));
    expect(await screen.findByText(/Zůstatek:.*1\s*500/)).toBeTruthy();
  });

  it("invites a new parent from the child card when no parents exist", async () => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Pozvat rodiče Anna Malá" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Pozvat rodiče Anna Malá" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Pozvat rodiče Anna Malá" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Pozvat rodiče Anna Malá" }));
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
    fireEvent.change(screen.getByLabelText("Jméno"), { target: { value: "Eva" } });
    fireEvent.change(screen.getByLabelText("Příjmení"), { target: { value: "Nová" } });
    fireEvent.change(screen.getByLabelText("Pohlaví"), { target: { value: "FEMALE" } });
    fireEvent.click(screen.getByRole("button", { name: /^(?:Přidat dítě|Ulož dítě)$/ }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Přiřadit rodiče" }));
    fireEvent.change(screen.getByLabelText("Vyberte rodiče"), { target: { value: invitedParent.id } });
    fireEvent.click(screen.getByRole("button", { name: "Přiřadit" }));

    await waitFor(() => expect(mocks.assignParentToChild).toHaveBeenCalledWith(invitedParent.id, "anna"));
    expect(await screen.findByText(invitedParent.email)).toBeTruthy();
    expect(mocks.inviteParentToChild).not.toHaveBeenCalled();
  });

});

it("keeps each child's action locked while other rows finish", async () => {
  const child = { firstName: "Anna", lastName: "Malá", gender: "FEMALE", active: true, doesNotTakeLunch: false, parents: [] };
  mocks.getAllChildrenWithParents.mockResolvedValue([{ ...child, id: "a" }, { ...child, id: "b", firstName: "Eva" }]);
  let finishA!: () => void;
  let finishB!: () => void;
  mocks.toggleChildActive.mockImplementation((id: string) => new Promise<void>(resolve => {
    if (id === "a") finishA = resolve; else finishB = resolve;
  }));
  render(<ChildrenManagementPage />);
  const buttons = await screen.findAllByRole("button", { name: /Deaktivovat/ });
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finishB());
  expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(buttons[0]);
  expect(mocks.toggleChildActive).toHaveBeenCalledTimes(2);
  await act(async () => finishA());
});
