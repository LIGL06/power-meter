import { z } from "zod";
import { isValidTierStructure } from "@/domain/validation";

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  password: z.string().min(1, "Password is required"),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

const tierSchema = z.object({
  upToKwh: z.number().positive().nullable(),
  ratePerKwh: z.number().nonnegative("Rate can't be negative"),
});

export const tariffSchema = z.object({
  planName: z.string().min(1, "Plan name is required"),
  tiers: z
    .array(tierSchema)
    .min(1)
    .refine(isValidTierStructure, {
      message: "Tier limits must ascend, and exactly the last tier must be unlimited",
    }),
  fixedServiceCharge: z.number().nonnegative("Fixed charge can't be negative"),
  taxRatePercent: z.number().min(0, "Can't be negative").max(100, "Can't exceed 100%"),
});
export type TariffFormValues = z.infer<typeof tariffSchema>;

export const solarSchema = z.object({
  enabled: z.boolean(),
  exportCreditRatePerKwh: z.number().nonnegative("Rate can't be negative"),
});
export type SolarFormValues = z.infer<typeof solarSchema>;

export const billingSchema = z.object({
  billingPeriodDays: z.union([z.literal(30), z.literal(60)]),
});
export type BillingFormValues = z.infer<typeof billingSchema>;
