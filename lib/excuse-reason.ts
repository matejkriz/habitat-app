import { ExcuseValidationError } from "./excuse-rules";

export const EXCUSE_REASON_MAX_LENGTH = 500;
export const EXCUSE_REASON_LENGTH_ERROR =
  `Důvod nebo poznámka může mít nejvýše ${EXCUSE_REASON_MAX_LENGTH} znaků.`;

/** Validate before trimming so whitespace cannot bypass the input limit. */
export function validateExcuseReason(reason: unknown): asserts reason is string | null {
  if (reason === null) return;
  if (typeof reason !== "string") {
    throw new ExcuseValidationError("Neplatný důvod nebo poznámka.");
  }
  if (reason.length > EXCUSE_REASON_MAX_LENGTH) {
    throw new ExcuseValidationError(EXCUSE_REASON_LENGTH_ERROR);
  }
}

export function parseExcuseReason(reason: unknown): string | null {
  validateExcuseReason(reason);
  return reason?.trim() || null;
}
