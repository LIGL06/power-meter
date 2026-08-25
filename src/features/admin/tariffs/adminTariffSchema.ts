import { z } from "zod";
import { isValidTierStructure } from "@/domain/validation";

const tierSchema = z.object({
  name: z.string().min(1, "Required"),
  upToKwhPer30Days: z.number().positive().nullable(),
  pricePerKwh: z.number().nonnegative("Price can't be negative"),
});

/** Reuses the local `Tier` ordering rule (ascending bounds, exactly one trailing unbounded tier). */
function isValidSeasonTiers(tiers: z.infer<typeof tierSchema>[]): boolean {
  return isValidTierStructure(tiers.map((t) => ({ upToKwh: t.upToKwhPer30Days, ratePerKwh: t.pricePerKwh })));
}

const seasonSchema = z.object({
  name: z.enum(["SUMMER", "NON_SUMMER"]),
  subsidy: z.number().nonnegative("Subsidy can't be negative"),
  tiers: z.array(tierSchema).min(1).refine(isValidSeasonTiers, {
    message: "Tier limits must ascend, and exactly the last tier must be unlimited",
  }),
});

export const adminTariffSchema = z.object({
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  category: z.enum(["RESIDENTIAL", "BUSINESS"]),
  currency: z.string().min(1, "Required"),
  effectiveFrom: z.string().min(1, "Required"),
  /** Empty string means "no end date" (current version). */
  effectiveTo: z.string(),
  summerWindow: z.object({
    startMonth: z.number().int().min(1).max(12),
    startDay: z.number().int().min(1).max(31),
    endMonth: z.number().int().min(1).max(12),
    endDay: z.number().int().min(1).max(31),
  }),
  seasons: z.tuple([seasonSchema, seasonSchema]),
  fixedCharge: z.number().nonnegative("Can't be negative"),
  minimumCharge: z.number().nonnegative("Can't be negative"),
  taxRate: z.number().min(0, "Can't be negative").max(1, "Fraction of 1, e.g. 0.16 for 16%"),
  dacThresholdKwh: z.number().nonnegative().nullable(),
  source: z.enum(["SEED", "USER_PROVIDED", "PLACEHOLDER", "ESTIMATED", "SCRAPED"]),
  sourceUrl: z.string(),
});
export type AdminTariffFormValues = z.infer<typeof adminTariffSchema>;

export const SEASON_ORDER = ["SUMMER", "NON_SUMMER"] as const;
export const SEASON_LABEL: Record<(typeof SEASON_ORDER)[number], string> = {
  SUMMER: "Summer",
  NON_SUMMER: "Non-summer",
};

function blankSeason(name: (typeof SEASON_ORDER)[number]): AdminTariffFormValues["seasons"][number] {
  return { name, subsidy: 0, tiers: [{ name: "unico", upToKwhPer30Days: null, pricePerKwh: 0 }] };
}

export const BLANK_ADMIN_TARIFF: AdminTariffFormValues = {
  code: "1C",
  name: "",
  category: "RESIDENTIAL",
  currency: "MXN",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  summerWindow: { startMonth: 5, startDay: 1, endMonth: 10, endDay: 31 },
  seasons: [blankSeason("SUMMER"), blankSeason("NON_SUMMER")],
  fixedCharge: 0,
  minimumCharge: 0,
  taxRate: 0,
  dacThresholdKwh: null,
  source: "USER_PROVIDED",
  sourceUrl: "",
};
