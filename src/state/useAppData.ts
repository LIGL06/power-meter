import { useContext } from "react";
import { AppDataContext, type AppDataAverages, type AuthUser } from "./AppDataContext";
import type { AppConfig, MeterReading, BillingPeriod, PeriodProjection } from "@/domain/types";

export interface AppDataResult {
  config: AppConfig;
  readings: MeterReading[];
  periods: BillingPeriod[];
  completedPeriods: BillingPeriod[];
  currentPeriod: BillingPeriod | undefined;
  projection: PeriodProjection | null;
  averages: AppDataAverages;
  addReading: (input: { consumptionReading: number; exportReading?: number }) => void;
  updateConfig: (patch: Partial<AppConfig>) => void;
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export function useAppData(): AppDataResult {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx as AppDataResult;
}
