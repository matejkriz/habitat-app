type ExcuseNotificationInput = {
  readonly childFirstName: string;
  readonly childLastName: string;
  readonly fromTimestamp: number;
  readonly toTimestamp: number;
  readonly reason?: string | null;
};

export function formatCzechDateRange(
  fromTimestamp: number,
  toTimestamp: number,
): string {
  const formatter = new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Prague",
  });
  const from = formatter.format(new Date(fromTimestamp));
  const to = formatter.format(new Date(toTimestamp));
  return from === to ? from : `${from}–${to}`;
}

export function buildExcuseNotificationBody(
  input: ExcuseNotificationInput,
): string {
  const reason = input.reason?.trim() || "";
  const notificationReason =
    reason.length > 280 ? `${reason.slice(0, 279).trimEnd()}…` : reason || null;

  return [
    `${input.childFirstName} ${input.childLastName}`,
    formatCzechDateRange(input.fromTimestamp, input.toTimestamp),
    notificationReason,
  ]
    .filter(Boolean)
    .join(" • ");
}
