import { useState, useMemo } from "react";
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
import { AppDataContext, type AuthUser } from "./AppDataContext";

interface LoadedData {
  config: AppConfig;
  readings: MeterReading[];
  user: AuthUser | null;
}

/** Seeds exactly once, on first-ever load (when the config repository has nothing saved yet). */
function loadOrSeed(): LoadedData {
  const existingConfig = configRepository.getConfig();
  if (existingConfig) {
    return { config: existingConfig, readings: readingsRepository.getAll(), user: null };
  }

  const seedConfig = generateSeedConfig();
  const seedReadings = generateSeedReadings(seedConfig.billingAnchorDate);
  configRepository.saveConfig(seedConfig);
  readingsRepository.saveAll(seedReadings);
  return { config: seedConfig, readings: seedReadings, user: null };
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer avoids an empty-then-populated first paint.
  const [{ config, readings, user }, setState] = useState<LoadedData>(loadOrSeed);

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
    const nextConfig = { ...config, ...patch };
    configRepository.saveConfig(nextConfig);
    setState((prev) => ({ ...prev, config: nextConfig }));
  }

  function setUser(user: AuthUser | null) {
    setState((prev) => ({ ...prev, user }));
  }
  return (
    <AppDataContext.Provider value={{ config, readings, periods, completedPeriods, currentPeriod, projection, averages, addReading, updateConfig, user, isAuthenticated: !!user, setUser }}>
      {children}
    </AppDataContext.Provider>
  );
}
