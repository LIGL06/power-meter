import { useMemo, useState, type ReactNode } from "react";
import type { AppConfig, MeterReading } from "@/domain/types";
import { todayISO } from "@/domain/date-utils";
import {
  buildBillingPeriods,
  getCompletedPeriods,
  getCurrentPeriod,
  projectCurrentPeriod,
} from "@/domain/periods";
import { averageAmountPaid, averageConsumption } from "@/domain/statistics";
import { generateSeedConfig, generateSeedReadings } from "@/data/seed";
import { configRepository, readingsRepository } from "@/data/repositories";
import { AppDataContext, type AppDataContextValue } from "./AppDataContext";

interface LoadedData {
  config: AppConfig;
  readings: MeterReading[];
}

/** Seeds exactly once, on first-ever load (when the config repository has nothing saved yet). */
function loadOrSeed(): LoadedData {
  const existingConfig = configRepository.getConfig();
  if (existingConfig) {
    return { config: existingConfig, readings: readingsRepository.getAll() };
  }

  const seedConfig = generateSeedConfig();
  const seedReadings = generateSeedReadings(seedConfig.billingAnchorDate);
  configRepository.saveConfig(seedConfig);
  readingsRepository.saveAll(seedReadings);
  return { config: seedConfig, readings: seedReadings };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  // Lazy initializer avoids an empty-then-populated first paint.
  const [{ config, readings }, setState] = useState(loadOrSeed);

  const asOfDate = todayISO();

  const periods = useMemo(
    () =>
      buildBillingPeriods(
        readings,
        config.billingAnchorDate,
        config.billingPeriodDays,
        config.tariff,
        config.solar,
        asOfDate,
      ),
    [readings, config.billingAnchorDate, config.billingPeriodDays, config.tariff, config.solar, asOfDate],
  );

  const currentPeriod = useMemo(() => getCurrentPeriod(periods), [periods]);
  const completedPeriods = useMemo(() => getCompletedPeriods(periods), [periods]);

  const projection = useMemo(
    () =>
      currentPeriod
        ? projectCurrentPeriod(currentPeriod, config.billingPeriodDays, config.tariff, config.solar)
        : null,
    [currentPeriod, config.billingPeriodDays, config.tariff, config.solar],
  );

  const averages = useMemo(
    () => ({
      consumptionKwh: averageConsumption(completedPeriods, 3),
      amountPaid: averageAmountPaid(completedPeriods, 3),
    }),
    [completedPeriods],
  );

  function addReading(input: { consumptionReading: number; exportReading?: number }) {
    const today = todayISO();
    const nextReadings = readingsRepository.upsertReading({ id: today, date: today, ...input });
    setState((prev) => ({ ...prev, readings: nextReadings }));
  }

  function updateConfig(patch: Partial<AppConfig>) {
    setState((prev) => {
      const nextConfig = { ...prev.config, ...patch };
      configRepository.saveConfig(nextConfig);
      return { ...prev, config: nextConfig };
    });
  }

  const value: AppDataContextValue = {
    config,
    readings,
    periods,
    completedPeriods,
    currentPeriod,
    projection,
    averages,
    addReading,
    updateConfig,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
