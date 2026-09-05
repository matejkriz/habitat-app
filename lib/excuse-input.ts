export function parseCancelLunchChoice(value: FormDataEntryValue | null): boolean {
  if (value === null || value === "true") return true;
  if (value === "false") return false;

  throw new Error("Neplatná volba pro odhlášení oběda.");
}
