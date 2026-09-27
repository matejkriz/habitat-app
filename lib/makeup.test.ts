import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createParentBatch: vi.fn(), getChild: vi.fn(), getUser: vi.fn(), sendSlack: vi.fn() }));
vi.mock("./db", () => ({ db: { excuses: { createParentBatch: mocks.createParentBatch }, children: { get: mocks.getChild }, users: { get: mocks.getUser } } }));
vi.mock("./slack", () => ({ sendExcuseNotification: mocks.sendSlack }));
import { createParentExcuses } from "./excuse";

const input = {
  parentId: "parent", requestId: "makeup-request-123456", childIds: ["child"],
  fromDate: new Date(2026, 8, 21), toDate: new Date(2026, 8, 22), reason: null,
  kind: "MAKEUP" as const, cancelLunch: false,
};
const record = {
  ...input, id: "makeup", childId: "child", dayPart: "FULL_DAY",
  submittedAt: new Date(2026, 8, 21, 8), lateApprovedAt: null,
};
const schoolDays = [new Date(2026, 8, 21), new Date(2026, 8, 22)];

beforeEach(() => {
  mocks.createParentBatch.mockResolvedValue({ replayed: false, excuses: [record] });
  mocks.getChild.mockResolvedValue({ firstName: "Anna", lastName: "Malá", attendanceDays: [1, 3, 4], doesNotTakeLunch: false });
  mocks.getUser.mockResolvedValue({ name: "Rodič" });
  mocks.sendSlack.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("makeup secondary notifications", () => {
  it("awaits the Slack webhook before completing a new arrival", async () => {
    let release!: () => void;
    mocks.sendSlack.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    let completed = false;
    const promise = createParentExcuses(input, schoolDays).then(() => { completed = true; });
    await vi.waitFor(() => expect(mocks.sendSlack).toHaveBeenCalled());
    expect(completed).toBe(false);
    release();
    await promise;
    expect(mocks.sendSlack).toHaveBeenCalledWith(expect.objectContaining({ kind: "MAKEUP", isOnTime: true }));
  });

  it("does not send another Slack notification for an idempotent replay", async () => {
    mocks.createParentBatch.mockResolvedValue({ replayed: true, excuses: [record] });
    await createParentExcuses(input, schoolDays);
    expect(mocks.sendSlack).not.toHaveBeenCalled();
  });

  it("keeps the committed arrival successful when the secondary webhook fails", async () => {
    mocks.sendSlack.mockRejectedValue(new Error("Slack unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createParentExcuses(input, schoolDays)).resolves.toEqual([record]);
    error.mockRestore();
  });
});
