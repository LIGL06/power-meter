import { getHttpClient } from "@/lib/api";
import type { ISODate, TariffDto } from "@/domain/types";

const client = getHttpClient();

export const tariffRepository = {
  /** The tariff version in force on a date; defaults to today. Read-only for regular users. */
  resolve(code: string, at?: ISODate) {
    return client.get<TariffDto>(`/tariffs/${code}`, { params: at ? { at } : undefined }).then((res) => res.data);
  },
};
