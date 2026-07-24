import { createContext } from "react";
import type { AppConfig, BillingPeriod, MeterReading, PeriodProjection } from "@/domain/types";

export interface AppDataAverages {
  consumptionKwh: number | null;
  amountPaid: number | null;
}

export interface AppDataContextValue {
  config: AppConfig;
  readings: MeterReading[];
  periods: BillingPeriod[];
  completedPeriods: BillingPeriod[];
  currentPeriod: BillingPeriod | undefined;
  projection: PeriodProjection | null;
  averages: AppDataAverages;
  addReading: (input: { consumptionReading: number; exportReading?: number }) => void;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);
