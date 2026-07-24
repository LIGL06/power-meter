import { z } from "zod";
import { isMonotonicOrEqual } from "@/domain/validation";

/**
 * Built fresh per-render from the currently known latest values, so the
 * "reading can only go up" rule always checks against live data rather than
 * a rule baked in at import time.
 */
export function createReadingSchema(
  latestConsumption: number | undefined,
  latestExport: number | undefined,
  solarEnabled: boolean,
) {
  return z.object({
    consumptionReading: z.number().refine((value) => isMonotonicOrEqual(value, latestConsumption), {
      message:
        latestConsumption !== undefined
          ? `Must be ${latestConsumption} or higher (your last reading)`
          : "Must be zero or higher",
    }),
    exportReading: solarEnabled
      ? z.number().refine((value) => isMonotonicOrEqual(value, latestExport), {
          message:
            latestExport !== undefined
              ? `Must be ${latestExport} or higher (your last export reading)`
              : "Must be zero or higher",
        })
      : z.number().optional(),
  });
}

export type ReadingFormValues = z.infer<ReturnType<typeof createReadingSchema>>;
