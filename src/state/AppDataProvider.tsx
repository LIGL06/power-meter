import { useState, useCallback, useEffect } from "react";
import type { AppConfig, BillingPeriodDto, Contract, EstimateDto } from "@/domain/types";
import { generateSeedConfig } from "@/data/seed";
import { configRepository } from "@/data/repositories";
import { contractRepository, billingRepository } from "@/data/repositories/api";
import { getAccessToken, getProfile, clearTokens } from "@/lib/api";
import { AppDataContext, type AuthUser } from "./AppDataContext";

interface LoadedData {
  config: AppConfig;
  user: AuthUser | null;
}

/** Seeds exactly once, on first-ever load (when the config repository has nothing saved yet). */
function loadOrSeed(): LoadedData {
  const existingConfig = configRepository.getConfig();
  if (existingConfig) {
    return { config: existingConfig, user: null };
  }

  const seedConfig = generateSeedConfig();
  configRepository.saveConfig(seedConfig);
  return { config: seedConfig, user: null };
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer avoids an empty-then-populated first paint.
  const [{ config, user }, setState] = useState<LoadedData>(loadOrSeed);
  const [authReady, setAuthReady] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [contractReady, setContractReady] = useState(false);
  const [estimate, setEstimate] = useState<EstimateDto | null>(null);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodDto[]>([]);
  const [billingReady, setBillingReady] = useState(false);

  // Rehydrates the session from a stored access token so a page refresh doesn't drop the user.
  useEffect(() => {
    if (!getAccessToken()) {
      setAuthReady(true);
      return;
    }
    getProfile()
      .then((res) => setState((prev) => ({ ...prev, user: res.data })))
      .catch(() => clearTokens())
      .finally(() => setAuthReady(true));
  }, []);

  // Once a session is confirmed, look up the user's most-recently-created contract
  // (GET /contracts already sorts newest-first server-side). No contracts yet routes
  // to onboarding; this effect only ever needs to run once per login.
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setContract(null);
      setContractReady(false);
      return;
    }
    let cancelled = false;
    contractRepository
      .list()
      .then((res) => {
        if (!cancelled) setContract(res.items[0] ?? null);
      })
      .finally(() => {
        if (!cancelled) setContractReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  const fetchBilling = useCallback(async (contractId: string) => {
    const [nextEstimate, nextPeriods] = await Promise.all([
      billingRepository.estimate(contractId),
      billingRepository.periods(contractId),
    ]);
    setEstimate(nextEstimate);
    setBillingPeriods(nextPeriods);
  }, []);

  // Mirrors the contract effect above, one link further down the chain: fires once a
  // contract is confirmed. A later refetchBilling() call (after posting a reading, or
  // closing a period) updates this state in place without re-flipping billingReady.
  useEffect(() => {
    if (!contractReady) return;
    if (!contract) {
      setEstimate(null);
      setBillingPeriods([]);
      setBillingReady(false);
      return;
    }
    let cancelled = false;
    fetchBilling(contract.id)
      .catch((error) => console.error("Failed to load billing data", error))
      .finally(() => {
        if (!cancelled) setBillingReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contractReady, contract, fetchBilling]);

  const refetchBilling = useCallback(async () => {
    if (!contract) return;
    try {
      await fetchBilling(contract.id);
    } catch (error) {
      console.error("Failed to refresh billing data", error);
    }
  }, [contract, fetchBilling]);

  function updateConfig(patch: Partial<AppConfig>) {
    const nextConfig = { ...config, ...patch };
    configRepository.saveConfig(nextConfig);
    setState((prev) => ({ ...prev, config: nextConfig }));
  }

  function setUser(user: AuthUser | null) {
    setState((prev) => ({ ...prev, user }));
  }

  return (
    <AppDataContext.Provider
      value={{
        config,
        updateConfig,
        user,
        isAuthenticated: !!user,
        setUser,
        authReady,
        contract,
        setContract,
        contractReady,
        estimate,
        billingPeriods,
        billingReady,
        refetchBilling,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}
