import { z } from "zod";
import { db } from "@/lib/db";
import { getLateDays } from "@/lib/excuse-coverage";
import { parseExcuseDate, validateExcuseDates } from "@/lib/excuse-rules";
import { getSchoolDaysInRange } from "@/lib/school-days";
import { sendExcuseNotification } from "@/lib/slack";
import { createExcuseConfirmation, verifyExcuseConfirmation } from "./confirmation";

export const excusePreviewInputSchema = z.object({
  childIds: z.array(z.string().min(1)).min(1).max(10),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional(),
});

type ParentProfile = Awaited<ReturnType<typeof getMcpParentProfile>>;

export class McpParentError extends Error {
  constructor(
    readonly code:
      | "PARENT_NOT_LINKED"
      | "CHILD_ACCESS_DENIED"
      | "INVALID_DATES"
      | "CONFIRMATION_INVALID"
      | "CREATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "McpParentError";
  }
}

export const getMcpParentProfile = async (workosUserId: string) => {
  const profile = await db.mcp.getParentProfile({ workosUserId });
  if (!profile) {
    throw new McpParentError(
      "PARENT_NOT_LINKED",
      "Tento WorkOS účet není v Habitatu propojený s rodičem.",
    );
  }
  return profile as {
    readonly userId: string;
    readonly children: ReadonlyArray<{
      readonly id: string;
      readonly firstName: string;
      readonly gender: "MALE" | "FEMALE" | null;
    }>;
  };
};

const authorizeChildren = (
  profile: ParentProfile,
  requestedChildIds: ReadonlyArray<string>,
) => {
  const childIds = [...new Set(requestedChildIds)];
  if (childIds.length !== requestedChildIds.length) {
    throw new McpParentError("CHILD_ACCESS_DENIED", "Výběr dětí obsahuje duplicity.");
  }
  const visibleIds = new Set(profile.children.map((child) => child.id));
  if (!childIds.every((childId) => visibleIds.has(childId))) {
    throw new McpParentError(
      "CHILD_ACCESS_DENIED",
      "K jednomu nebo více vybraným dětem nemáte přístup.",
    );
  }
  return childIds;
};

const parseDates = (fromDateValue: string, toDateValue: string) => {
  try {
    const fromDate = parseExcuseDate(fromDateValue);
    const toDate = parseExcuseDate(toDateValue);
    const validation = validateExcuseDates(fromDate, toDate);
    if (!validation.valid) throw new Error(validation.error);
    return { fromDate, toDate };
  } catch (error) {
    throw new McpParentError(
      "INVALID_DATES",
      error instanceof Error ? error.message : "Neplatný rozsah omluvenky.",
    );
  }
};

const getTiming = async (input: {
  readonly excuses: ReadonlyArray<{
    readonly id: string;
    readonly childId: string;
    readonly fromDate: Date;
    readonly toDate: Date;
    readonly submittedAt: Date;
    readonly lateApprovedAt: Date | null;
  }>;
}) => {
  if (input.excuses.length === 0) {
    return {
      schoolDays: [] as Date[],
      summary: { schoolDayCount: 0, lateDayCount: 0, onTimeDayCount: 0 },
    };
  }
  const schoolDays = await getSchoolDaysInRange(
    input.excuses[0].fromDate,
    input.excuses[0].toDate,
  );
  const lateDayCount = input.excuses.reduce(
    (count, excuse) => count + getLateDays(excuse, schoolDays).length,
    0,
  );
  const schoolDayCount = schoolDays.length * input.excuses.length;
  return {
    schoolDays,
    summary: {
      schoolDayCount,
      lateDayCount,
      onTimeDayCount: schoolDayCount - lateDayCount,
    },
  };
};

export const previewMcpExcuse = async (
  workosUserId: string,
  rawInput: z.infer<typeof excusePreviewInputSchema>,
) => {
  const input = excusePreviewInputSchema.parse(rawInput);
  const profile = await getMcpParentProfile(workosUserId);
  const childIds = authorizeChildren(profile, input.childIds);
  const { fromDate, toDate } = parseDates(input.fromDate, input.toDate);
  const reason = input.reason?.trim() || null;
  const selectedChildren = childIds.map((childId) => {
    const child = profile.children.find((candidate) => candidate.id === childId);
    if (!child) throw new McpParentError("CHILD_ACCESS_DENIED", "Dítě nebylo nalezeno.");
    return child;
  });
  const schoolDays = await getSchoolDaysInRange(fromDate, toDate);
  const { token, expiresAt } = await createExcuseConfirmation({
    workosUserId,
    childIds,
    fromDate: input.fromDate,
    toDate: input.toDate,
    reason,
  });

  return {
    confirmationToken: token,
    confirmationExpiresAt: expiresAt,
    children: selectedChildren,
    fromDate: input.fromDate,
    toDate: input.toDate,
    reason,
    schoolDayCount: schoolDays.length * childIds.length,
    confirmationRequired: true as const,
  };
};

export const createMcpExcuse = async (
  workosUserId: string,
  confirmationToken: string,
) => {
  let confirmation;
  try {
    confirmation = await verifyExcuseConfirmation(confirmationToken, workosUserId);
  } catch {
    throw new McpParentError(
      "CONFIRMATION_INVALID",
      "Potvrzení vypršelo nebo nepatří přihlášenému rodiči. Vytvořte nový náhled.",
    );
  }

  const profile = await getMcpParentProfile(workosUserId);
  const childIds = authorizeChildren(profile, confirmation.childIds);
  const { fromDate, toDate } = parseDates(confirmation.fromDate, confirmation.toDate);

  try {
    const result = await db.mcp.createParentExcuses({
      workosUserId,
      requestId: confirmation.jti,
      childIds,
      fromDate: fromDate.getTime(),
      toDate: toDate.getTime(),
      reason: confirmation.reason,
    });
    const excuses = result.excuses.map((excuse: {
      id: string;
      childId: string;
      fromDate: number;
      toDate: number;
    }) => ({
      ...excuse,
      fromDate: new Date(excuse.fromDate),
      toDate: new Date(excuse.toDate),
      submittedAt: new Date(result.submittedAt),
      lateApprovedAt: null,
    }));
    const { schoolDays, summary } = await getTiming({ excuses });

    if (!result.replayed) {
      try {
        const parent = await db.users.get({
          where: { id: profile.userId },
          select: { name: true },
        });
        for (const excuse of excuses) {
          const child = await db.children.get({
            where: { id: excuse.childId },
            select: { firstName: true, lastName: true },
          });
          if (child && parent) {
            sendExcuseNotification({
              childName: `${child.firstName} ${child.lastName}`,
              parentName: parent.name || "Neznámý rodič",
              fromDate: excuse.fromDate,
              toDate: excuse.toDate,
              reason: confirmation.reason,
              isOnTime: getLateDays(excuse, schoolDays).length === 0,
            }).catch((error) => {
              console.error("Failed to send MCP Slack notification", error);
            });
          }
        }
      } catch (error) {
        console.error("Failed to prepare MCP Slack notification", error);
      }
    }

    return {
      replayed: result.replayed,
      excuses: excuses.map((excuse: (typeof excuses)[number]) => ({
        id: excuse.id,
        childId: excuse.childId,
        fromDate: confirmation.fromDate,
        toDate: confirmation.toDate,
      })),
      summary,
    };
  } catch (error) {
    console.error("MCP excuse creation failed", {
      workosUserId,
      requestId: confirmation.jti,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new McpParentError(
      "CREATE_FAILED",
      "Omluvenku se nepodařilo uložit. Zkuste to prosím znovu.",
    );
  }
};
