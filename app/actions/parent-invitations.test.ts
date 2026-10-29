import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  assignParent: vi.fn(),
  listInvitations: vi.fn(),
  sendInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/db", () => ({
  db: { parentInvitations: { assign: mocks.assignParent } },
}));
vi.mock("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({ userManagement: {
    listInvitations: mocks.listInvitations,
    sendInvitation: mocks.sendInvitation,
    resendInvitation: mocks.resendInvitation,
  } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { inviteParentToChild } from "./parent-invitations";

const parent = { id: "parent-1", name: null, email: "parent@example.test" };
const future = new Date(Date.now() + 86_400_000).toISOString();

describe("director parent invitations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.assignParent.mockResolvedValue(parent);
    mocks.listInvitations.mockResolvedValue({ autoPagination: async () => [] });
    mocks.sendInvitation.mockResolvedValue({ id: "invitation-1", token: "private" });
  });

  it.each([null, { id: "parent-1", role: "PARENT" }, { id: "teacher-1", role: "TEACHER" }])(
    "requires a director before assigning or emailing (%j)", async (user) => {
      mocks.getDbUser.mockResolvedValue(user);
      await expect(inviteParentToChild("child-1", parent.email)).rejects.toThrow("Unauthorized");
      expect(mocks.assignParent).not.toHaveBeenCalled();
      expect(mocks.listInvitations).not.toHaveBeenCalled();
      expect(mocks.sendInvitation).not.toHaveBeenCalled();
    },
  );

  it.each(["", "not-an-email", "parent@example.test\r\nBcc: other@example.test"])(
    "rejects invalid email before mutations (%j)", async (email) => {
      await expect(inviteParentToChild("child-1", email)).rejects.toThrow("Zadejte platný e-mail");
      expect(mocks.assignParent).not.toHaveBeenCalled();
      expect(mocks.sendInvitation).not.toHaveBeenCalled();
    },
  );

  it("assigns the normalized email before sending a Czech invitation and returns only the parent", async () => {
    const result = await inviteParentToChild("child-1", "  Parent@Example.Test  ");

    expect(mocks.assignParent).toHaveBeenCalledWith({
      directorId: "director-1", childId: "child-1", email: parent.email,
    });
    expect(mocks.assignParent.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendInvitation.mock.invocationCallOrder[0]);
    expect(mocks.listInvitations).toHaveBeenCalledWith({ email: parent.email, limit: 100 });
    expect(mocks.sendInvitation).toHaveBeenCalledWith({ email: parent.email, locale: "cs", expiresInDays: 7 });
    expect(result).toEqual({ parent, emailSent: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/reditel/deti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/rodic");
  });

  it("resends a pending application invitation", async () => {
    mocks.listInvitations.mockResolvedValue({ autoPagination: async () => [
      { id: "organization", state: "pending", organizationId: "org-1", expiresAt: future },
      { id: "pending", state: "pending", organizationId: null, expiresAt: future },
    ] });

    await expect(inviteParentToChild("child-1", parent.email)).resolves.toEqual({ parent, emailSent: true });
    expect(mocks.resendInvitation).toHaveBeenCalledWith("pending", { locale: "cs" });
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it.each(["accepted", "revoked", "expired"])("creates a new invitation after %s", async (state) => {
    mocks.listInvitations.mockResolvedValue({ autoPagination: async () => [
      { id: "old", state, organizationId: null, expiresAt: future },
    ] });
    await inviteParentToChild("child-1", parent.email);
    expect(mocks.sendInvitation).toHaveBeenCalledOnce();
    expect(mocks.resendInvitation).not.toHaveBeenCalled();
  });

  it("does not resend an expired pending invitation", async () => {
    mocks.listInvitations.mockResolvedValue({ autoPagination: async () => [
      { id: "old", state: "pending", organizationId: null, expiresAt: "2020-01-01T00:00:00Z" },
    ] });
    await inviteParentToChild("child-1", parent.email);
    expect(mocks.sendInvitation).toHaveBeenCalledOnce();
  });

  it("does not send an invitation if assignment fails", async () => {
    mocks.assignParent.mockRejectedValue(new Error("Dítě nebylo nalezeno"));
    await expect(inviteParentToChild("child-1", parent.email)).rejects.toThrow("Dítě nebylo nalezeno");
    expect(mocks.listInvitations).not.toHaveBeenCalled();
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it.each(["list", "send", "resend"])("returns the assigned parent on %s failure so the invitation can be retried", async (step) => {
    if (step === "list") mocks.listInvitations.mockResolvedValue({ autoPagination: async () => { throw new Error("private provider response"); } });
    if (step === "send") mocks.sendInvitation.mockRejectedValue(new Error("private provider response"));
    if (step === "resend") {
      mocks.listInvitations.mockResolvedValue({ autoPagination: async () => [
        { id: "pending", state: "pending", organizationId: null, expiresAt: future },
      ] });
      mocks.resendInvitation.mockRejectedValue(new Error("private provider response"));
    }

    await expect(inviteParentToChild("child-1", parent.email)).resolves.toEqual({ parent, emailSent: false });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/reditel/deti");
  });
});
