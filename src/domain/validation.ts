import type { Tier } from "./types";

/**
 * A valid tariff has at least one tier, exactly one unbounded tier
 * (`upToKwh: null`) which must be last, strictly ascending bounds otherwise,
 * and non-negative rates. Shared by the Settings zod schema and by
 * `tariff.ts`'s defensive guard so "what's valid" has one definition.
 */
export function isValidTierStructure(tiers: Tier[]): boolean {
  if (tiers.length === 0) return false;

  const unboundedCount = tiers.filter((tier) => tier.upToKwh === null).length;
  if (unboundedCount !== 1) return false;
  if (tiers[tiers.length - 1].upToKwh !== null) return false;

  let previousBound = 0;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (tier.ratePerKwh < 0) return false;

    const isLast = i === tiers.length - 1;
    if (isLast) {
      if (tier.upToKwh !== null) return false;
    } else {
      if (tier.upToKwh === null || tier.upToKwh <= previousBound) return false;
      previousBound = tier.upToKwh;
    }
  }

  return true;
}

/** Cumulative meter readings can only ever hold steady or increase. */
export function isMonotonicOrEqual(newValue: number, previousValue: number | undefined): boolean {
  if (previousValue === undefined) return newValue >= 0;
  return newValue >= previousValue;
}
