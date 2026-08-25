import type { AppConfig } from "@/domain/types";
import { addDays, todayISO } from "@/domain/date-utils";

const SEED_DAYS = 364;

export function generateSeedConfig(): AppConfig {
  return {
    profile: {
      firstName: "Alex",
      lastName: "Rivera",
      address: "123 Maple Street, Springfield",
      password: "changeme123",
    },
    tariff: {
      planName: "Standard Residential",
      tiers: [
        { upToKwh: 300, ratePerKwh: 0.14 },
        { upToKwh: 600, ratePerKwh: 0.18 },
        { upToKwh: null, ratePerKwh: 0.24 },
      ],
      fixedServiceCharge: 8.5,
      taxRatePercent: 16,
    },
    solar: {
      enabled: true,
      exportCreditRatePerKwh: 0.1,
    },
    billingPeriodDays: 30,
    billingAnchorDate: addDays(todayISO(), -SEED_DAYS),
  };
}
