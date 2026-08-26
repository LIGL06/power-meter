/**
 * Pure planning math for the solar sizing calculator (ui-features-v1.md Phase 6).
 * A planning tool, not a certified engineering estimate: no bank-forward
 * simulation, no per-state peak-sun-hours dataset — the user supplies their
 * own figure. See the page for how these are wired to live contract data.
 */

/** `0.620 kW × 0.80 × 5 h = 2.48 kWh/day/panel` — the worked example this must match. */
export function dailyGenerationPerPanelKwh(wattageW: number, efficiency: number, peakSunHours: number): number {
  return (wattageW / 1000) * efficiency * peakSunHours;
}

export interface SizingRow {
  panels: number;
  generationPerDayKwh: number;
  generationPerPeriodKwh: number;
  offsetPercent: number;
  /** Estimated remaining daily import once this many panels offset consumption. */
  remainingImportKwh: number;
  /** First row to reach ≥100% offset — only this one bills the flat fixed/minimum charge. */
  clearsFullOffset: boolean;
}

const MAX_ROWS = 20;
/** Extra rows shown past the first one that clears 100%, so the table doesn't stop abruptly. */
const ROWS_PAST_FULL_OFFSET = 2;

/**
 * Rows for panel count 1 through however many it takes to clear 100% offset,
 * plus a couple past that point, capped at `MAX_ROWS` so an unrealistic input
 * (e.g. near-zero consumption) can't produce an unbounded table.
 */
export function buildSizingTable(
  dailyConsumptionKwh: number,
  perPanelKwh: number,
  periodDays: number,
): SizingRow[] {
  if (dailyConsumptionKwh <= 0 || perPanelKwh <= 0) return [];

  const rows: SizingRow[] = [];
  let clearedAtPanels: number | null = null;

  for (let panels = 1; panels <= MAX_ROWS; panels++) {
    const generationPerDayKwh = perPanelKwh * panels;
    const generationPerPeriodKwh = generationPerDayKwh * periodDays;
    const offsetPercent = (generationPerDayKwh / dailyConsumptionKwh) * 100;
    const remainingImportKwh = Math.max(dailyConsumptionKwh - generationPerDayKwh, 0);
    const clearsFullOffset = offsetPercent >= 100;

    rows.push({ panels, generationPerDayKwh, generationPerPeriodKwh, offsetPercent, remainingImportKwh, clearsFullOffset });

    if (clearsFullOffset) {
      clearedAtPanels ??= panels;
      if (panels >= clearedAtPanels + ROWS_PAST_FULL_OFFSET) break;
    }
  }

  return rows;
}

/** The subset of `Reading` this needs — kept structural so a test fixture doesn't need every field. */
export interface DailyRateReading {
  readAt: string;
  deltaImportKwh: number;
}

/**
 * One implied daily consumption rate per consecutive reading pair — the divisor
 * is the real gap between the two `readAt` timestamps, floored at 1 day so two
 * readings logged hours apart can't produce a wildly inflated rate.
 */
export function impliedDailyRates(readings: DailyRateReading[]): number[] {
  const sorted = [...readings].sort((a, b) => new Date(a.readAt).getTime() - new Date(b.readAt).getTime());
  const rates: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const days = Math.max((new Date(sorted[i].readAt).getTime() - new Date(sorted[i - 1].readAt).getTime()) / 86_400_000, 1);
    rates.push(sorted[i].deltaImportKwh / days);
  }

  return rates;
}

/** The highest implied daily rate observed this period, or `null` with fewer than two readings. */
export function peakDailyImportKwh(readings: DailyRateReading[]): number | null {
  const rates = impliedDailyRates(readings);
  return rates.length === 0 ? null : Math.max(...rates);
}
