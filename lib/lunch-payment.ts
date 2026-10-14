import type { LunchOverview } from "./lunch-overview";
import { formatLunchAmount, validateLunchPriceMonth } from "./lunch-price";

const account = "2802518214 / 2010";
const iban = "CZ3020100000002802518214";
const pragueDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
});

function pragueDayKey(now: Date): string {
  const parts = pragueDate.formatToParts(now);
  const part = (type: string) => parts.find(part => part.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isLunchMonthClosed(overview: Pick<LunchOverview, "month" | "lastOpenDay">, now = new Date()): boolean {
  const today = pragueDayKey(now);
  const month = today.slice(0, 7);
  return overview.month < month || (overview.month === month && (overview.lastOpenDay === null || overview.lastOpenDay < today));
}

export function getPreviousLunchPaymentMonth(now = new Date()): string {
  const [year, month] = pragueDayKey(now).slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

export type LunchPayment = {
  monthName: string;
  account: string;
  amountCents: number;
  amountText: string;
  note: string;
  payload: string | null;
  clipboardText: string;
};

export function getLunchPayment(overview: LunchOverview): LunchPayment {
  validateLunchPriceMonth(overview.month);
  const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" })
    .format(new Date(`${overview.month}-01T12:00:00Z`));
  const unpaidChildren = overview.children.filter(child => !child.paid);
  const payableLunches = unpaidChildren.reduce((total, child) => total + child.payableLunches, 0);
  const amountCents = payableLunches * overview.priceCents;
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Neplatná částka platby.");

  const prefix = `Obědy ${monthName}: `;
  const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");
  const fullNote = prefix + unpaidChildren.map(child => cleanName(`${child.firstName} ${child.lastName}`)).join(", ");
  const note = Array.from(fullNote).length <= 60 ? fullNote
    : prefix + unpaidChildren.map(child => cleanName(child.firstName)).join(", ");
  const amountText = formatLunchAmount(1, amountCents);
  const encodedNote = encodeURIComponent(note).replaceAll("*", "%2A").replaceAll("%20", " ").replaceAll("%3A", ":").replaceAll("%2C", ",");
  // SPAYD limits MSG to 60 characters and AM to 9,999,999.99 CZK.
  const payload = amountCents > 0 && amountCents <= 999_999_999 && Array.from(note).length <= 60
    ? `SPD*1.0*ACC:${iban}*AM:${(amountCents / 100).toFixed(2)}*CC:CZK*MSG:${encodedNote}`
    : null;

  return { monthName, account, amountCents, amountText, note, payload,
    clipboardText: `Číslo účtu: ${account}\nČástka: ${amountText}\nPoznámka: ${note}`,
  };
}
