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
  firstName: string;
  lastName: string;
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

// ---------------------------------------------------------------------------
// API types (power-meter-api). Mirror the server's DTOs field-for-field — see
// api-implementation-v2.md's type-mapping table. Kept alongside the legacy
// local types above (not replacing them) until Phase 3/4 migrate their
// consumers; see that plan's Scope boundary note.
// ---------------------------------------------------------------------------

export type Role = "ADMIN" | "USER";
export type CustomerType = "RESIDENTIAL" | "BUSINESS";
export type TariffCategory = "RESIDENTIAL" | "BUSINESS";
export type Season = "SUMMER" | "NON_SUMMER";
export type ReadingType = "PARTIAL" | "COMPLETE";
export type ReadingSource = "MANUAL" | "IMPORT" | "DEVICE";
export type PeriodStatus = "OPEN" | "CLOSED";
export type PeriodLength = 30 | 60;
export type TariffSource = "SEED" | "USER_PROVIDED" | "PLACEHOLDER" | "ESTIMATED" | "SCRAPED";

export interface PaginatedResponse<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface ServiceAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface Contract {
  id: string;
  owner: string;
  alias: string;
  serviceNumber: string;
  meterSerial?: string;
  address?: ServiceAddress;
  customerType: CustomerType;
  tariffCode: string;
  periodDays: PeriodLength;
  billingAnchorDate: ISODate;
  hasExports: boolean;
  initialImportIndex: number;
  initialExportIndex: number;
  /** Server-managed surplus export kWh carried forward; not user-editable. */
  bankedExportKwh: number;
  isActive: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CreateContractDto {
  alias: string;
  serviceNumber: string;
  meterSerial?: string;
  address?: ServiceAddress;
  customerType?: CustomerType;
  tariffCode?: string;
  periodDays?: PeriodLength;
  /** Start of the first billing period. */
  billingAnchorDate: ISODate;
  hasExports?: boolean;
  initialImportIndex?: number;
  initialExportIndex?: number;
}

/** `serviceNumber`, `billingAnchorDate`, and both `initial*Index` fields are immutable after creation. */
export type UpdateContractDto = Partial<
  Omit<CreateContractDto, "serviceNumber" | "billingAnchorDate" | "initialImportIndex" | "initialExportIndex">
> & { isActive?: boolean };

export interface Reading {
  id: string;
  contractId: string;
  billingPeriodId: string;
  type: ReadingType;
  readAt: ISODate;
  importIndex: number;
  exportIndex: number | null;
  deltaImportKwh: number;
  deltaExportKwh: number;
  source: ReadingSource;
  notes?: string;
  createdBy: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CreateReadingDto {
  /** COMPLETE closes the billing period and opens the next one atomically. */
  type?: ReadingType;
  readAt: ISODate;
  importIndex: number;
  /** Required when the contract has exports; must be omitted otherwise. */
  exportIndex?: number;
  source?: ReadingSource;
  notes?: string;
}

/** Only measured values and annotations are correctable — `readAt`/`type` are not. */
export type UpdateReadingDto = Partial<Pick<CreateReadingDto, "importIndex" | "exportIndex" | "notes" | "source">>;

export interface ListReadingsQuery {
  page?: number;
  limit?: number;
  periodId?: string;
  from?: ISODate;
  to?: ISODate;
  type?: ReadingType;
}

export interface TierCharge {
  name: string;
  kwh: number;
  pricePerKwh: number;
  charge: number;
}

/** One shared shape: identical on `EstimateDto`'s live-computed segments and `periods[].segments`. */
export interface Segment {
  start: ISODate;
  end: ISODate;
  days: number;
  month: string;
  season: Season;
  tariffVersionId: string;
  kwh: number;
  tiers: TierCharge[];
  charge: number;
}

export interface PeriodTotals {
  importedKwh: number;
  exportedKwh: number;
  /** imported − exported − banked; may be negative. */
  netKwh: number;
  /** max(netKwh, 0) — what actually got priced. */
  billableKwh: number;
  energyCharge: number;
  fixedCharge: number;
  minimumChargeApplied: boolean;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

export interface BillingPeriodDto {
  id: string;
  contractId: string;
  sequence: number;
  status: PeriodStatus;
  startDate: ISODate;
  expectedEndDate: ISODate;
  /** null until the period closes, never absent. */
  actualEndDate: ISODate | null;
  /** Snapshot of the contract's periodDays at open. */
  periodDays: PeriodLength;
  openingImportIndex: number;
  openingExportIndex: number;
  closingImportIndex: number | null;
  closingExportIndex: number | null;
  openingBankedKwh: number;
  closingBankedKwh: number;
  /** True when the period rolled on elapsed days rather than a COMPLETE reading. */
  estimatedClose: boolean;
  segments: Segment[];
  /** Frozen copies of every tariff version used to price this period once CLOSED. */
  tariffSnapshot: Record<string, unknown>[];
  totals: PeriodTotals | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** A distinct, lighter shape from a `periods[]` item — don't reuse one Period type for both. */
export interface EstimatePeriodDto {
  id: string;
  sequence: number;
  status: PeriodStatus;
  startDate: ISODate;
  expectedEndDate: ISODate;
  periodDays: PeriodLength;
  daysElapsed: number;
  daysRemaining: number;
}

/** Same shape as `PeriodTotals` plus `bankedKwh` (surplus to carry into the next period). */
export interface BillingBreakdown extends PeriodTotals {
  bankedKwh: number;
  segments: Segment[];
}

export interface EstimateDto {
  period: EstimatePeriodDto;
  /** Charge for consumption recorded to date. */
  actual: BillingBreakdown;
  /** Forecast for the full period; null when there's nothing to extrapolate from. */
  projected: BillingBreakdown | null;
  dailyAverage: { importKwh: number; exportKwh: number };
  bankedExportKwh: number;
  lastReadingAt: ISODate | null;
  projectionAvailable: boolean;
  projectionUnavailableReason: string | null;
}

export interface TariffTier {
  name: string;
  /** null marks the unbounded tier. */
  upToKwhPer30Days: number | null;
  pricePerKwh: number;
}

export interface TariffSeason {
  name: Season;
  tiers: TariffTier[];
  /** Per-kWh reduction applied by the scraper; 0 for seeded data. */
  subsidy: number;
}

export interface SeasonWindow {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

export interface TariffDto {
  id: string;
  code: string;
  name: string;
  category: TariffCategory;
  currency: string;
  effectiveFrom: ISODate;
  /** null means this is the current version. */
  effectiveTo: ISODate | null;
  summerWindow: SeasonWindow;
  seasons: TariffSeason[];
  fixedCharge: number;
  minimumCharge: number;
  taxRate: number;
  dacThresholdKwh: number | null;
  source: TariffSource;
  sourceUrl: string | null;
  scrapedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}
