import { getHttpClient } from "@/lib/api";
import type { Contract, CreateContractDto, PaginatedResponse, UpdateContractDto } from "@/domain/types";

const client = getHttpClient();

export const contractRepository = {
  list(params?: { page?: number; limit?: number }) {
    return client.get<PaginatedResponse<Contract>>("/contracts", { params }).then((res) => res.data);
  },

  create(dto: CreateContractDto) {
    return client.post<Contract>("/contracts", dto).then((res) => res.data);
  },

  get(id: string) {
    return client.get<Contract>(`/contracts/${id}`).then((res) => res.data);
  },

  update(id: string, patch: UpdateContractDto) {
    return client.patch<Contract>(`/contracts/${id}`, patch).then((res) => res.data);
  },

  /** Soft-deactivate; billing history is retained. Returns the now-inactive contract. */
  deactivate(id: string) {
    return client.delete<Contract>(`/contracts/${id}`).then((res) => res.data);
  },
};
