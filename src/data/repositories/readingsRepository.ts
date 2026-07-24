import type { MeterReading } from "@/domain/types";
import type { KeyValueStore } from "../storage";

const READINGS_KEY = "power-meter:readings";

function sortByDateAscending(readings: MeterReading[]): MeterReading[] {
  return [...readings].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function createReadingsRepository(store: KeyValueStore) {
  function getAll(): MeterReading[] {
    return store.get<MeterReading[]>(READINGS_KEY) ?? [];
  }

  function saveAll(readings: MeterReading[]): void {
    store.set(READINGS_KEY, sortByDateAscending(readings));
  }

  /** One reading per calendar day — a same-day resubmission overwrites rather than duplicating. */
  function upsertReading(reading: MeterReading): MeterReading[] {
    const withoutSameDay = getAll().filter((r) => r.date !== reading.date);
    const next = sortByDateAscending([...withoutSameDay, reading]);
    store.set(READINGS_KEY, next);
    return next;
  }

  return { getAll, saveAll, upsertReading };
}

export type ReadingsRepository = ReturnType<typeof createReadingsRepository>;
