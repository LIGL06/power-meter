import { getHttpClient } from "@/lib/api";
import type {
  CreateTariffDto,
  ISODate,
  ImportTariffsDto,
  ImportTariffsResult,
  TariffDto,
  UpdateTariffDto,
} from "@/domain/types";

const client = getHttpClient();

export const tariffRepository = {
  /** All versions, newest first; optionally filtered to one code. Admin surfaces only — regular users go through `resolve`. */
  list(code?: string) {
    return client.get<TariffDto[]>("/tariffs", { params: code ? { code } : undefined }).then((res) => res.data);
  },

  /** The tariff version in force on a date; defaults to today. Read-only for regular users. */
  resolve(code: string, at?: ISODate) {
    return client.get<TariffDto>(`/tariffs/${code}`, { params: at ? { at } : undefined }).then((res) => res.data);
  },

  /** ADMIN only: publish a new tariff version. */
  create(dto: CreateTariffDto) {
    return client.post<TariffDto>("/tariffs", dto).then((res) => res.data);
  },

  /** ADMIN only: correct an existing version (code/effectiveFrom are immutable). */
  update(id: string, patch: UpdateTariffDto) {
    return client.patch<TariffDto>(`/tariffs/${id}`, patch).then((res) => res.data);
  },

  /** ADMIN only: bulk append versions, the scraper entry point. Existing (code, effectiveFrom) pairs are skipped. */
  import(dto: ImportTariffsDto) {
    return client.post<ImportTariffsResult>("/tariffs/import", dto).then((res) => res.data);
  },
};
