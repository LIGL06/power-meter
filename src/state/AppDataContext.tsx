import { createContext } from "react";
import type { AppConfig, BillingPeriodDto, Contract, EstimateDto } from "@/domain/types";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "USER";
}

export interface AppDataContextValue {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
  setUser: (user: AuthUser | null) => void;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** False until the initial session check (rehydrating `user` from a stored token) has resolved. */
  authReady: boolean;
  contract: Contract | null;
  setContract: (contract: Contract | null) => void;
  /** False until the post-login contract lookup (`GET /contracts`) has resolved. */
  contractReady: boolean;
  estimate: EstimateDto | null;
  billingPeriods: BillingPeriodDto[];
  /** False until the initial post-contract billing fetch has resolved. */
  billingReady: boolean;
  refetchBilling: () => Promise<void>;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);
