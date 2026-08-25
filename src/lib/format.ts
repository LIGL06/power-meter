const kwhFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function formatCurrency(amount: number, currency: string = "MXN"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function formatKwh(kwh: number): string {
  return `${kwhFormatter.format(kwh)} kWh`;
}

/** Accepts a bare "YYYY-MM-DD" or a full ISO instant (e.g. from the API). */
export function formatShortDate(isoDateOrInstant: string): string {
  const date = isoDateOrInstant.includes("T") ? new Date(isoDateOrInstant) : new Date(`${isoDateOrInstant}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
