import { getHttpClient } from "@/lib/api";
import type { CreateHistoricalPeriodDto, HistoricalPeriodEntryDto, UpdateHistoricalPeriodDto } from "@/domain/types";

const client = getHttpClient();

export const historicalPeriodsRepository = {
  /** Sorted startDate ascending. */
  list(contractId: string) {
    return client
      .get<HistoricalPeriodEntryDto[]>(`/contracts/${contractId}/historical-periods`)
      .then((res) => res.data);
  },

  create(contractId: string, dto: CreateHistoricalPeriodDto) {
    return client
      .post<HistoricalPeriodEntryDto>(`/contracts/${contractId}/historical-periods`, dto)
      .then((res) => res.data);
  },

  /** Correct a typo in an already-saved entry. */
  update(contractId: string, entryId: string, patch: UpdateHistoricalPeriodDto) {
    return client
      .patch<HistoricalPeriodEntryDto>(`/contracts/${contractId}/historical-periods/${entryId}`, patch)
      .then((res) => res.data);
  },

  remove(contractId: string, entryId: string) {
    return client.delete<void>(`/contracts/${contractId}/historical-periods/${entryId}`).then((res) => res.data);
  },
};
