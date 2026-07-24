import type { BillBreakdown, SolarConfig, TariffConfig, Tier } from "./types";
import { isValidTierStructure } from "./validation";

/**
 * Walks tiers in ascending order, charging each kWh at its bracket's rate.
 * A zero-width tier (`upToKwh` equal to the previous bound) safely
 * contributes nothing rather than dividing by zero.
 */
export function calculateTieredConsumptionCost(kwh: number, tiers: Tier[]): number {
  if (kwh <= 0) return 0;

  let remaining = kwh;
  let cost = 0;
  let previousBound = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;

    const capacity = tier.upToKwh === null ? Infinity : tier.upToKwh - previousBound;
    if (capacity > 0) {
      const usedInTier = Math.min(remaining, capacity);
      cost += usedInTier * tier.ratePerKwh;
      remaining -= usedInTier;
    }

    if (tier.upToKwh !== null) previousBound = tier.upToKwh;
  }

  return cost;
}

/**
 * Gross metering with a flat bill credit: the full tiered consumption cost
 * is charged, then the export credit (a separate rate from the tier rates)
 * is netted out before tax, and the pre-tax subtotal is clamped at zero
 * (no "utility pays you back" concept in this app).
 */
export function calculateBill(
  consumptionKwh: number,
  exportKwh: number,
  tariff: TariffConfig,
  solar: SolarConfig,
): BillBreakdown {
  if (!isValidTierStructure(tariff.tiers)) {
    throw new Error(`Invalid tariff tier structure for plan "${tariff.planName}"`);
  }

  const consumptionCost = calculateTieredConsumptionCost(consumptionKwh, tariff.tiers);
  const exportCredit = solar.enabled ? exportKwh * solar.exportCreditRatePerKwh : 0;
  const subtotalBeforeTax = Math.max(0, consumptionCost + tariff.fixedServiceCharge - exportCredit);
  const tax = subtotalBeforeTax * (tariff.taxRatePercent / 100);
  const totalAmount = subtotalBeforeTax + tax;

  return {
    consumptionKwh,
    exportKwh,
    consumptionCost,
    fixedServiceCharge: tariff.fixedServiceCharge,
    exportCredit,
    subtotalBeforeTax,
    tax,
    totalAmount,
  };
}
