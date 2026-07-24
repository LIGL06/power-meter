import type { ISODate } from "./types";

const MS_PER_DAY = 86_400_000;

/**
 * The only place in the domain layer allowed to touch the system clock.
 * Every other domain function takes dates as explicit parameters so the
 * business logic stays pure and testable without mocking `Date`.
 */
export function todayISO(): ISODate {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Days-since-epoch for a calendar date, computed via `Date.UTC` purely as an
 * arithmetic helper (never as a real instant) so results never shift with
 * the host's timezone or DST — round-tripping through `new Date(isoString)`
 * would silently misparse at timezone boundaries.
 */
function epochDay(date: ISODate): number {
  const { year, month, day } = parseISODate(date);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function addDays(date: ISODate, n: number): ISODate {
  const ms = (epochDay(date) + n) * MS_PER_DAY;
  const d = new Date(ms);
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from `a` to `b` (positive when `b` is after `a`). */
export function diffInDays(a: ISODate, b: ISODate): number {
  return epochDay(b) - epochDay(a);
}
