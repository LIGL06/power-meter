import { z } from "zod";
import { todayISO } from "@/domain/date-utils";

export const addMeterSchema = z.object({
  alias: z.string().min(1, "Required"),
  serviceNumber: z.string().min(1, "Required"),
  meterSerial: z.string().optional(),
  customerType: z.enum(["RESIDENTIAL", "BUSINESS"]),
  tariffCode: z.string().min(1, "Required"),
  periodDays: z.union([z.literal(30), z.literal(60)]),
  /**
   * Calendar date from a native date input, "YYYY-MM-DD" — converted to an ISO instant on
   * submit. Capped at today: a future anchor opens a period the server won't accept any
   * reading against until that date arrives (`readAt` can't precede `period.startDate`,
   * and also can't be in the future — a date past today satisfies neither), silently
   * bricking the meter until then. Backdating (the opposite direction) is fine and is what
   * the amber warning below this field is about.
   */
  billingAnchorDate: z.string().min(1, "Required").refine((date) => date <= todayISO(), "Can't be in the future"),
  hasExports: z.boolean(),
  initialImportIndex: z.number().min(0, "Must be 0 or higher"),
  initialExportIndex: z.number().min(0, "Must be 0 or higher"),
});

export type AddMeterFormValues = z.infer<typeof addMeterSchema>;
