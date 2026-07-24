/** ISO calendar date, "YYYY-MM-DD", no time component and no timezone. */
export type ISODate = string;

export type BillingPeriodDays = 30 | 60;

/**
 * A single price bracket in a tiered/block rate plan. `upToKwh` is the
 * cumulative consumption ceiling for this tier; exactly one tier in a
 * tariff's `tiers` array has `upToKwh: null` (unbounded) and it must be last.
 */
export interface Tier {
  upToKwh: number | null;
  ratePerKwh: number;
}

export interface TariffConfig {
  planName: string;
  tiers: Tier[];
  fixedServiceCharge: number;
  taxRatePercent: number;
}

export interface SolarConfig {
  enabled: boolean;
  exportCreditRatePerKwh: number;
}

/** Plain local fields — no real authentication anywhere in this app. */
export interface ProfileConfig {
  name: string;
  address: string;
  password: string;
}

export interface AppConfig {
  profile: ProfileConfig;
  tariff: TariffConfig;
  solar: SolarConfig;
  billingPeriodDays: BillingPeriodDays;
  /** Start date of the first known billing cycle; all period boundaries are computed from this anchor. */
  billingAnchorDate: ISODate;
}

/** A single day's cumulative meter reading. One per calendar day (upserted by date). */
export interface MeterReading {
  id: string;
  date: ISODate;
  consumptionReading: number;
  exportReading?: number;
}

export interface BillBreakdown {
  consumptionKwh: number;
  exportKwh: number;
  consumptionCost: number;
  fixedServiceCharge: number;
  exportCredit: number;
  subtotalBeforeTax: number;
  tax: number;
  totalAmount: number;
}

export interface BillingPeriod {
  index: number;
  startDate: ISODate;
  endDate: ISODate;
  /** False only for the current, still-running period. */
  isComplete: boolean;
  /** False only when no reading exists before this period's start (always false for period 0). */
  hasBaseline: boolean;
  consumptionKwh: number | null;
  exportKwh: number | null;
  bill: BillBreakdown | null;
  /** Date of the latest reading this period's figures are based on. */
  asOfDate: ISODate | null;
}

export interface PeriodProjection {
  period: BillingPeriod;
  daysElapsed: number;
  daysRemaining: number;
  projectedConsumptionKwh: number;
  projectedExportKwh: number;
  projectedBill: BillBreakdown;
}
