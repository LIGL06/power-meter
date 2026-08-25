import { z } from "zod";

export const addMeterSchema = z.object({
  alias: z.string().min(1, "Required"),
  serviceNumber: z.string().min(1, "Required"),
  meterSerial: z.string().optional(),
  customerType: z.enum(["RESIDENTIAL", "BUSINESS"]),
  tariffCode: z.string().min(1, "Required"),
  periodDays: z.union([z.literal(30), z.literal(60)]),
  /** Calendar date from a native date input, "YYYY-MM-DD" — converted to an ISO instant on submit. */
  billingAnchorDate: z.string().min(1, "Required"),
  hasExports: z.boolean(),
  initialImportIndex: z.number().min(0, "Must be 0 or higher"),
  initialExportIndex: z.number().min(0, "Must be 0 or higher"),
});

export type AddMeterFormValues = z.infer<typeof addMeterSchema>;
