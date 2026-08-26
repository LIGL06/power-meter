import { useState, useCallback, useEffect } from "react";
import type { BillingPeriodDto, Contract, EstimateDto, HistoricalPeriodEntryDto } from "@/domain/types";
import { contractRepository, billingRepository, historicalPeriodsRepository } from "@/data/repositories/api";
import { getAccessToken, getProfile, clearTokens, checkHealth } from "@/lib/api";
import { AppDataContext, type AuthUser } from "./AppDataContext";

/** `GET /health` is `@Public()` — a clean, auth-independent signal that the backend itself is (un)reachable. */
async function probeServerHealth(): Promise<boolean> {
  try {
    const res = await checkHealth();
    return res.data.status === "ok";
  } catch {
    return false;
  }
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [contractReady, setContractReady] = useState(false);
  const [estimate, setEstimate] = useState<EstimateDto | null>(null);
  const [billingPeriods, setBillingPeriods] = useState<BillingPeriodDto[]>([]);
  const [historicalPeriodEntries, setHistoricalPeriodEntries] = useState<HistoricalPeriodEntryDto[]>([]);
  const [billingReady, setBillingReady] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const retryConnection = useCallback(() => setRetryTick((t) => t + 1), []);

  // Rehydrates the session from a stored access token so a page refresh doesn't drop the user.
  useEffect(() => {
    if (!getAccessToken()) {
      setAuthReady(true);
      return;
    }
    getProfile()
      .then((res) => setUser(res.data))
      .catch(() => clearTokens())
      .finally(() => setAuthReady(true));
  }, []);

  // Once a session is confirmed, look up the user's most-recently-created *active*
  // contract (GET /contracts already sorts newest-first server-side; it never filters
  // on isActive, so this filters client-side). No active contract routes to onboarding.
  // `ownerId` scopes this to the logged-in user even when they're an ADMIN — omitting
  // it was a real bug found in testing: for an ADMIN, `GET /contracts` with no `ownerId`
  // returns every user's contracts, and `items[0]` would silently pick up whichever
  // contract was most recently created system-wide, attaching the admin's session to a
  // random other user's meter. The isActive filter matters for the same reason once a
  // contract can be deactivated: without it, a deactivated contract would still come
  // back as "the" contract and the app would keep operating against a dead meter
  // instead of routing back to onboarding. A failed fetch does NOT flip contractReady —
  // that would otherwise misroute a "server unreachable" moment to onboarding as if the
  // user had no contracts; it instead probes /health so the loading gate can
  // distinguish "still loading" from "can't reach the server".
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setContract(null);
      setContractReady(false);
      return;
    }
    let cancelled = false;
    contractRepository
      .list({ ownerId: user.id })
      .then((res) => {
        if (cancelled) return;
        setContract(res.items.find((c) => c.isActive) ?? null);
        setContractReady(true);
        setServerUnreachable(false);
      })
      .catch(async (error) => {
        console.error("Failed to load contracts", error);
        const healthy = await probeServerHealth();
        if (cancelled) return;
        if (healthy) {
          // Reachable, but the request still failed for some other reason — don't get stuck.
          setContractReady(true);
        } else {
          setServerUnreachable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, user, retryTick]);

  const fetchBilling = useCallback(async (contractId: string) => {
    const [nextEstimate, nextPeriods, nextHistorical] = await Promise.all([
      billingRepository.estimate(contractId),
      billingRepository.periods(contractId),
      historicalPeriodsRepository.list(contractId),
    ]);
    setEstimate(nextEstimate);
    setBillingPeriods(nextPeriods);
    setHistoricalPeriodEntries(nextHistorical);
  }, []);

  // Mirrors the contract effect above, one link further down the chain: fires once a
  // contract is confirmed. A later refetchBilling() call (after posting a reading, or
  // closing a period) updates this state in place without re-flipping billingReady.
  // Same "don't flip ready on a server-unreachable failure" rule as the contract effect.
  // Resets on `!contractReady` too (not just `!contract`) — otherwise a logout, which
  // flips contractReady back to false, leaves the previous user's estimate/periods
  // sitting in state until the next contract's fetch resolves, briefly leaking one
  // account's billing data into the next login on the same browser session.
  useEffect(() => {
    if (!contractReady || !contract) {
      setEstimate(null);
      setBillingPeriods([]);
      setHistoricalPeriodEntries([]);
      setBillingReady(false);
      return;
    }
    let cancelled = false;
    fetchBilling(contract.id)
      .then(() => {
        if (cancelled) return;
        setBillingReady(true);
        setServerUnreachable(false);
      })
      .catch(async (error) => {
        console.error("Failed to load billing data", error);
        const healthy = await probeServerHealth();
        if (cancelled) return;
        if (healthy) {
          setBillingReady(true);
        } else {
          setServerUnreachable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contractReady, contract, fetchBilling, retryTick]);

  const refetchBilling = useCallback(async () => {
    if (!contract) return;
    try {
      await fetchBilling(contract.id);
    } catch (error) {
      console.error("Failed to refresh billing data", error);
    }
  }, [contract, fetchBilling]);

  return (
    <AppDataContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        setUser,
        authReady,
        contract,
        setContract,
        contractReady,
        estimate,
        billingPeriods,
        historicalPeriodEntries,
        billingReady,
        refetchBilling,
        serverUnreachable,
        retryConnection,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}
