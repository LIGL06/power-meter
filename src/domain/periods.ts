import type {
  BillBreakdown,
  BillingPeriod,
  BillingPeriodDays,
  ISODate,
  MeterReading,
  PeriodProjection,
  SolarConfig,
  TariffConfig,
} from "./types";
import { addDays, diffInDays } from "./date-utils";
import { calculateBill } from "./tariff";

/**
 * Cumulative readings mean gaps between logged days are handled for free:
 * we only ever need the latest known value at or before a boundary date,
 * not a reading on every single day.
 */
function findLatestValueAtOrBefore(
  readingsSortedAscending: MeterReading[],
  date: ISODate,
  selector: (reading: MeterReading) => number | undefined,
): { date: ISODate; value: number } | undefined {
  let result: { date: ISODate; value: number } | undefined;
  for (const reading of readingsSortedAscending) {
    if (reading.date > date) break;
    const value = selector(reading);
    if (value !== undefined) result = { date: reading.date, value };
  }
  return result;
}

/**
 * Derives the full billing-period history from raw readings + config. Never
 * stored — recomputed on every render, so changing `billingPeriodDays` or
 * the tariff regroups/recalculates all of history with zero migration code.
 */
export function buildBillingPeriods(
  readings: MeterReading[],
  anchorDate: ISODate,
  periodDays: BillingPeriodDays,
  tariff: TariffConfig,
  solar: SolarConfig,
  asOfDate: ISODate,
): BillingPeriod[] {
  const sorted = [...readings].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const currentIndex = Math.max(0, Math.floor(diffInDays(anchorDate, asOfDate) / periodDays));

  const periods: BillingPeriod[] = [];

  for (let index = 0; index <= currentIndex; index++) {
    const startDate = addDays(anchorDate, index * periodDays);
    const endDate = addDays(startDate, periodDays - 1);
    const isComplete = endDate < asOfDate;
    const boundaryDate = isComplete ? endDate : asOfDate;
    const dayBeforeStart = addDays(startDate, -1);

    const consumptionBaseline = findLatestValueAtOrBefore(sorted, dayBeforeStart, (r) => r.consumptionReading);
    const consumptionEnd = findLatestValueAtOrBefore(sorted, boundaryDate, (r) => r.consumptionReading);
    // Period 0 always fails this check (no reading can predate the very first one) — intentional,
    // not a bug: it's why the very first period is excluded from the chart and averages.
    const hasBaseline = consumptionBaseline !== undefined;
    const hasInPeriodReading = hasBaseline && consumptionEnd !== undefined && consumptionEnd.date >= startDate;

    let consumptionKwh: number | null = null;
    let exportKwh: number | null = null;
    let bill: BillBreakdown | null = null;
    let periodAsOfDate: ISODate | null = null;

    if (hasInPeriodReading && consumptionEnd) {
      consumptionKwh = consumptionEnd.value - consumptionBaseline!.value;
      periodAsOfDate = consumptionEnd.date;

      // Looked up independently of consumption: if solar was toggled on/off mid-history, or a
      // day's row simply has no export value, the delta naturally freezes/resumes with no
      // special-case code — it either has both boundary values or its export figure stays null.
      const exportBaseline = findLatestValueAtOrBefore(sorted, dayBeforeStart, (r) => r.exportReading);
      const exportEnd = findLatestValueAtOrBefore(sorted, boundaryDate, (r) => r.exportReading);
      exportKwh =
        exportBaseline && exportEnd && exportEnd.date >= startDate ? exportEnd.value - exportBaseline.value : null;

      bill = calculateBill(consumptionKwh, exportKwh ?? 0, tariff, solar);
    }

    periods.push({
      index,
      startDate,
      endDate,
      isComplete,
      hasBaseline,
      consumptionKwh,
      exportKwh,
      bill,
      asOfDate: periodAsOfDate,
    });
  }

  return periods;
}

export function getCurrentPeriod(periods: BillingPeriod[]): BillingPeriod | undefined {
  return periods.find((period) => !period.isComplete);
}

export function getCompletedPeriods(periods: BillingPeriod[]): BillingPeriod[] {
  return periods.filter((period) => period.isComplete && period.hasBaseline);
}

/** Dashboard's "past year" window filter — kept separate from `buildBillingPeriods` (full history) for SRP. */
export function getPeriodsInRange(periods: BillingPeriod[], fromDate: ISODate, toDate: ISODate): BillingPeriod[] {
  return periods.filter((period) => period.endDate >= fromDate && period.startDate <= toDate);
}

/**
 * Extrapolates the current in-progress period to a full-period estimate.
 * Returns `null` right after a period rolls over, before the user has
 * logged any reading within it yet — a real, expected state, not an error.
 */
export function projectCurrentPeriod(
  currentPeriod: BillingPeriod,
  periodDays: BillingPeriodDays,
  tariff: TariffConfig,
  solar: SolarConfig,
): PeriodProjection | null {
  if (!currentPeriod.hasBaseline) return null;
  if (currentPeriod.asOfDate === null || currentPeriod.consumptionKwh === null) return null;

  // Based on the latest logged reading's date, not "today" — if the user hasn't logged yet
  // today, dividing by today's date would understate the daily rate relative to actual coverage.
  const daysElapsed = diffInDays(currentPeriod.startDate, currentPeriod.asOfDate) + 1;
  const daysRemaining = Math.max(0, periodDays - daysElapsed);

  const projectedConsumptionKwh = (currentPeriod.consumptionKwh / daysElapsed) * periodDays;
  const projectedExportKwh =
    currentPeriod.exportKwh !== null ? (currentPeriod.exportKwh / daysElapsed) * periodDays : 0;

  const projectedBill = calculateBill(projectedConsumptionKwh, projectedExportKwh, tariff, solar);

  return {
    period: currentPeriod,
    daysElapsed,
    daysRemaining,
    projectedConsumptionKwh,
    projectedExportKwh,
    projectedBill,
  };
}
