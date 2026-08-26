import { createContext } from "react";
import type { BillingPeriodDto, Contract, EstimateDto, HistoricalPeriodEntryDto } from "@/domain/types";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "USER";
}

export interface AppDataContextValue {
  /** Also used to refresh the cached user after a profile edit — see Settings' Profile tab. */
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
  /** Manually-entered past-bill summaries, oldest first (ui-features-v1.md Phase 5). Fetched and refreshed alongside billingPeriods. */
  historicalPeriodEntries: HistoricalPeriodEntryDto[];
  /** False until the initial post-contract billing fetch has resolved. */
  billingReady: boolean;
  /** Refreshes estimate, billingPeriods, and historicalPeriodEntries together. */
  refetchBilling: () => Promise<void>;
  /** True when the contract-bootstrap or billing fetch failed and `GET /health` confirms the server itself is unreachable — distinct from "not authenticated" or "no contract yet". */
  serverUnreachable: boolean;
  /** Re-runs whichever fetch is currently blocked (contract-bootstrap and/or billing). */
  retryConnection: () => void;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);
