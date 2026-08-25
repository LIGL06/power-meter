import { z } from "zod";
import { isMonotonicOrEqual } from "@/domain/validation";

/**
 * Built fresh per-render from the currently known latest values, so the
 * "reading can only go up" rule always checks against live data rather than
 * a rule baked in at import time.
 */
export function createReadingSchema(
  latestImportIndex: number | undefined,
  latestExportIndex: number | undefined,
  hasExports: boolean,
) {
  return z.object({
    importIndex: z.number().refine((value) => isMonotonicOrEqual(value, latestImportIndex), {
      message:
        latestImportIndex !== undefined
          ? `Must be ${latestImportIndex} or higher (your last reading)`
          : "Must be zero or higher",
    }),
    exportIndex: hasExports
      ? z.number().refine((value) => isMonotonicOrEqual(value, latestExportIndex), {
          message:
            latestExportIndex !== undefined
              ? `Must be ${latestExportIndex} or higher (your last export reading)`
              : "Must be zero or higher",
        })
      : z.number().optional(),
  });
}

export type ReadingFormValues = z.infer<ReturnType<typeof createReadingSchema>>;
