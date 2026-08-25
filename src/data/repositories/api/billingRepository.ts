import { getHttpClient } from "@/lib/api";
import type { BillingPeriodDto, EstimateDto } from "@/domain/types";

const client = getHttpClient();

export const billingRepository = {
  /** Actual + projected charge for the open period. */
  estimate(contractId: string) {
    return client.get<EstimateDto>(`/contracts/${contractId}/estimate`).then((res) => res.data);
  },

  /** All periods, newest first. Unpaginated — includes a tariffSnapshot on every item. */
  periods(contractId: string) {
    return client.get<BillingPeriodDto[]>(`/contracts/${contractId}/periods`).then((res) => res.data);
  },

  period(contractId: string, periodId: string) {
    return client.get<BillingPeriodDto>(`/contracts/${contractId}/periods/${periodId}`).then((res) => res.data);
  },

  /** Closes the current period early, using its latest reading. */
  closeCurrent(contractId: string) {
    return client.post<BillingPeriodDto>(`/contracts/${contractId}/periods/current/close`).then((res) => res.data);
  },
};
