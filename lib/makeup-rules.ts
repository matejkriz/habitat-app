export function getMakeupLunchDeadline(day: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(day);
  const part = (type: string) => Number(parts.find(value => value.type === type)?.value);
  const wallTime = new Date(Date.UTC(part("year"), part("month") - 1, part("day") - 1, 9));
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague", hour: "2-digit", hourCycle: "h23",
  }).format(wallTime));
  return new Date(wallTime.getTime() - (hour - 9) * 3600000);
}

export function isMakeupLunchOnTime(submittedAt: Date, day: Date): boolean {
  return submittedAt < getMakeupLunchDeadline(day);
}

export function formatMakeupLunchDeadline(day: Date): string {
  return getMakeupLunchDeadline(day).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}
