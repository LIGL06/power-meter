import type { BillingPeriod } from "./types";

export function lastNCompleted(periods: BillingPeriod[], n: number): BillingPeriod[] {
  return periods.filter((period) => period.isComplete && period.consumptionKwh !== null).slice(-n);
}

/**
 * `null` (not `0`/`NaN`) is the explicit "not enough data yet" signal, so the
 * UI can render an empty state instead of a misleading zero.
 */
export function averageConsumption(periods: BillingPeriod[], n = 3): number | null {
  const recent = lastNCompleted(periods, n);
  if (recent.length === 0) return null;
  const total = recent.reduce((sum, period) => sum + (period.consumptionKwh ?? 0), 0);
  return total / recent.length;
}

export function averageAmountPaid(periods: BillingPeriod[], n = 3): number | null {
  const recent = lastNCompleted(periods, n);
  if (recent.length === 0) return null;
  const total = recent.reduce((sum, period) => sum + (period.bill?.totalAmount ?? 0), 0);
  return total / recent.length;
}
