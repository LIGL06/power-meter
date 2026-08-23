import { createContext } from "react";
import type { AppConfig, BillingPeriod, MeterReading, PeriodProjection } from "@/domain/types";

export interface AppDataAverages {
  consumptionKwh: number | null;
  amountPaid: number | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
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
   setUser: (user: AuthUser | null) => void;
   user: AuthUser | null;
   isAuthenticated: boolean;
   /** False until the initial session check (rehydrating `user` from a stored token) has resolved. */
   authReady: boolean;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);
