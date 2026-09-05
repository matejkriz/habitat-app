import {
  ExcuseDayPart,
  type ExcuseDayPart as ExcuseDayPartValue,
} from "./types";

export function parseCancelLunchChoice(value: FormDataEntryValue | null): boolean {
  if (value === null || value === "true") return true;
  if (value === "false") return false;

  throw new Error("Neplatná volba pro odhlášení oběda.");
}

export function parseExcuseDayPart(
  value: FormDataEntryValue | null,
): ExcuseDayPartValue {
  if (value === null || value === ExcuseDayPart.FULL_DAY) {
    return ExcuseDayPart.FULL_DAY;
  }
  if (value === ExcuseDayPart.MORNING) return ExcuseDayPart.MORNING;
  if (value === ExcuseDayPart.AFTERNOON) return ExcuseDayPart.AFTERNOON;

  throw new Error("Neplatná část dne.");
}

export function getExcuseDayPartForRange(
  dayPart: ExcuseDayPartValue,
  fromDate: Date,
  toDate: Date,
): ExcuseDayPartValue {
  const isSingleDay =
    fromDate.getFullYear() === toDate.getFullYear() &&
    fromDate.getMonth() === toDate.getMonth() &&
    fromDate.getDate() === toDate.getDate();

  return isSingleDay ? dayPart : ExcuseDayPart.FULL_DAY;
}
