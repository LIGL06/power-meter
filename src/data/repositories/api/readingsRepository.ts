import { getHttpClient } from "@/lib/api";
import type {
  CreateReadingDto,
  ListReadingsQuery,
  PaginatedResponse,
  Reading,
  UpdateReadingDto,
} from "@/domain/types";

const client = getHttpClient();

export const readingsRepository = {
  list(contractId: string, query?: ListReadingsQuery) {
    return client
      .get<PaginatedResponse<Reading>>(`/contracts/${contractId}/readings`, { params: query })
      .then((res) => res.data);
  },

  create(contractId: string, dto: CreateReadingDto) {
    return client.post<Reading>(`/contracts/${contractId}/readings`, dto).then((res) => res.data);
  },

  /** Only allowed while the reading's period is still open. */
  update(id: string, patch: UpdateReadingDto) {
    return client.patch<Reading>(`/readings/${id}`, patch).then((res) => res.data);
  },

  /** Only allowed while the reading's period is still open. */
  remove(id: string) {
    return client.delete<void>(`/readings/${id}`).then((res) => res.data);
  },
};
