const invalidPrice = "Zadejte nezápornou cenu v Kč, nejvýše se dvěma desetinnými místy.";

export function validateLunchPriceMonth(month: string): void {
  if (typeof month !== "string" || !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Neplatný měsíc");
  }
}

export function validateLunchPriceCents(priceCents: number): void {
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new Error(invalidPrice);
  }
}

export function parseLunchPrice(value: unknown): number {
  if (typeof value !== "string" || !/^\d+([.,]\d{1,2})?$/.test(value.trim())) {
    throw new Error(invalidPrice);
  }
  const [crowns, fraction = ""] = value.trim().split(/[.,]/);
  const priceCents = Number(crowns) * 100 + Number(fraction.padEnd(2, "0"));
  validateLunchPriceCents(priceCents);
  return priceCents;
}

const wholeCrowns = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});
const fractionalCrowns = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" });

export function formatLunchAmount(payableLunches: number, priceCents: number): string {
  const amountCents = payableLunches * priceCents;
  const formatter = amountCents % 100 === 0 ? wholeCrowns : fractionalCrowns;
  return formatter.format(amountCents / 100);
}
