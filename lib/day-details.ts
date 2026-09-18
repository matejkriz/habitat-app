export const DAY_NAME_MAX_LENGTH = 160;
// Leave room below Convex's 1 MiB document limit for metadata.
export const DAY_REPORT_MAX_BYTES = 900 * 1024;

export type DayDetails = {
  readonly name: string | null;
  readonly expense?: number | null;
  readonly report?: string | null;
};

export type DayDetailsPatch = {
  name?: string | null;
  expense?: number | null;
  report?: string | null;
};

export function validateCrowns(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Částka musí být nezáporné celé číslo v Kč");
  }
}

export function validateDayDetails(details: DayDetailsPatch): void {
  if (details.name != null && (typeof details.name !== "string" || details.name.length > DAY_NAME_MAX_LENGTH)) {
    throw new Error("Jméno dne může mít nejvýše 160 znaků");
  }
  if (details.expense != null) validateCrowns(details.expense);
  if (details.report != null && (typeof details.report !== "string" || new TextEncoder().encode(details.report).length > DAY_REPORT_MAX_BYTES)) {
    throw new Error("Report může mít nejvýše 900 KiB textu v UTF-8");
  }
}

export function parseDayDate(dateKey: string): Date {
  const date = new Date(`${dateKey}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(date.getTime()) ||
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` !== dateKey) {
    throw new Error("Neplatné datum");
  }
  return date;
}

export type DaySummary = { date: number; name: string | null; expense: number | null };
export type TripFund = { childId: string; fundSent: number | null; fundSpent: number; fundBalance: number };
export type ChildTripExpense = { childId: string; name: string; amount: number; override: number | null };

export type ExtraFundPerson = {
  personId: string;
  name: string;
  fundSent: number;
  fundSpent: number;
  fundBalance: number;
  amounts: number[];
};

export type ExtraFundPersonPatch = { name?: string; fundSent?: number };

export function validateExtraFundPersonPatch(patch: ExtraFundPersonPatch): ExtraFundPersonPatch {
  const result: ExtraFundPersonPatch = {};
  if (patch.name !== undefined) {
    if (typeof patch.name !== "string" || !patch.name.trim() || patch.name.trim().length > 160) {
      throw new Error("Zadejte jméno osoby (nejvýše 160 znaků).");
    }
    result.name = patch.name.trim();
  }
  if (patch.fundSent !== undefined) {
    validateCrowns(patch.fundSent);
    result.fundSent = patch.fundSent;
  }
  return result;
}

export type TripFundOverview = {
  extraPeople?: ExtraFundPerson[];
  days: DaySummary[];
  children: (TripFund & {
    firstName: string;
    lastName: string;
    amounts: (number | null)[];
  })[];
};
