const currencyFormatter = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
const kwhFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatKwh(kwh: number): string {
  return `${kwhFormatter.format(kwh)} kWh`;
}

export function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
