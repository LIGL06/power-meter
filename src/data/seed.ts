import type { AppConfig, MeterReading } from "@/domain/types";
import { addDays, todayISO } from "@/domain/date-utils";

const SEED_DAYS = 364;
const BASE_DAILY_CONSUMPTION_KWH = 14;
const BASE_DAILY_EXPORT_KWH = 6;

export function generateSeedConfig(): AppConfig {
  return {
    profile: {
      name: "Alex Rivera",
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

/** Loosely simulates summer AC/solar peaks: highest mid-way through the seeded year. */
function seasonalFactor(dayIndex: number, totalDays: number): number {
  const radians = (dayIndex / totalDays) * Math.PI * 2;
  return 1 + 0.35 * Math.sin(radians - Math.PI / 2);
}

/** Generates ~12 months of daily cumulative readings ending yesterday, so the current period has a partial reading and a projection is immediately visible. */
export function generateSeedReadings(anchorDate: string, days: number = SEED_DAYS): MeterReading[] {
  const readings: MeterReading[] = [];
  let consumptionTotal = 10_000;
  let exportTotal = 2_000;

  for (let i = 0; i < days; i++) {
    const date = addDays(anchorDate, i);
    const seasonal = seasonalFactor(i, days);
    const dailyConsumption = Math.max(2, BASE_DAILY_CONSUMPTION_KWH * seasonal + (Math.random() - 0.5) * 4);
    const dailyExport = Math.max(0, BASE_DAILY_EXPORT_KWH * seasonal + (Math.random() - 0.5) * 3);

    consumptionTotal += dailyConsumption;
    exportTotal += dailyExport;

    readings.push({
      id: date,
      date,
      consumptionReading: Math.round(consumptionTotal * 10) / 10,
      exportReading: Math.round(exportTotal * 10) / 10,
    });
  }

  return readings;
}
