import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getExcuse: vi.fn(), update: vi.fn(), audit: vi.fn(),
  revalidate: vi.fn(), slack: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getUser }));
vi.mock("@/lib/db", () => ({ db: {
  excuses: { get: mocks.getExcuse, update: mocks.update },
  parentLinks: { get: vi.fn().mockResolvedValue({ id: "link-1" }) },
  auditLogs: { create: mocks.audit },
  children: { get: vi.fn().mockResolvedValue({ firstName: "Anna", lastName: "Malá" }) },
  users: { get: vi.fn().mockResolvedValue({ name: "Rodič" }) },
} }));
vi.mock("@/lib/school-days", () => ({ getSchoolDaysInRange: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/slack", () => ({ sendExcuseNotification: mocks.slack }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { editParentExcuse } from "./parent";
import { editExcuse } from "./director";

const excuse = {
  id: "excuse-1", childId: "child-1", reason: "Nemoc", dayPart: "FULL_DAY",
  fromDate: new Date(2026, 8, 10), toDate: new Date(2026, 8, 12),
  submittedById: "parent-1", submittedAt: new Date(2026, 8, 1),
  lateApprovedAt: null, lateApprovedById: null, cancelLunch: true,
};
const input = { fromDate: "2026-09-10", toDate: "2026-09-12", reason: "Kontrola" };

for (const [role, action] of [["DIRECTOR", editExcuse], ["PARENT", editParentExcuse]] as const) {
  describe(`${role} excuse edits`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mocks.getUser.mockResolvedValue({ id: "user-1", role });
      mocks.getExcuse.mockResolvedValue(excuse);
      mocks.update.mockImplementation(({ data }) => Promise.resolve({ ...excuse, ...data }));
      mocks.slack.mockResolvedValue(true);
    });

    it.each([
      [{ fromDate: "2026-09-09" }, "Rozsah omluvenky nelze rozšířit. Na další dny podejte novou omluvenku."],
      [{ toDate: "2026-09-13" }, "Rozsah omluvenky nelze rozšířit. Na další dny podejte novou omluvenku."],
      [{ fromDate: "2026-02-31" }, "Zadejte platné datum."],
      [{ fromDate: "2026-09-12", toDate: "2026-09-10" }, "Datum konce nesmí být před datem začátku."],
      [{ dayPart: "INVALID" }, "Neplatná část dne."],
    ])("returns a safe validation result for %j without saving or notifying", async (changes, error) => {
      await expect(action(excuse.id, { ...input, ...changes })).resolves.toEqual({ success: false, error });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
      expect(mocks.slack).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });

    it("still saves a shorter period and sends the update notification", async () => {
      await expect(action(excuse.id, { ...input, toDate: "2026-09-10", dayPart: "MORNING" }))
        .resolves.toEqual({ success: true, excuse: expect.objectContaining({
          reason: "Kontrola", dayPart: "MORNING", toDate: new Date(2026, 8, 10),
        }) });
      expect(mocks.slack).toHaveBeenCalledOnce();
      expect(mocks.revalidate).toHaveBeenCalled();
    });

    it("does not expose unexpected backend errors as validation messages", async () => {
      mocks.getExcuse.mockRejectedValueOnce(new Error("Internal database detail"));
      await expect(action(excuse.id, input)).rejects.toThrow("Internal database detail");
    });

    it("still rejects unauthorized callers", async () => {
      mocks.getUser.mockResolvedValue(null);
      await expect(action(excuse.id, input)).rejects.toThrow("Unauthorized");
      expect(mocks.update).not.toHaveBeenCalled();
    });
  });
}
