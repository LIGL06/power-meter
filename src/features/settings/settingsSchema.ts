import { z } from "zod";

/** Mirrors CreateUserDto/UpdateUserDto's firstName/lastName/email rules — no password field, the API has no password-change endpoint yet. */
export const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80, "Must be at most 80 characters"),
  lastName: z.string().min(1, "Last name is required").max(80, "Must be at most 80 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

/**
 * Mirrors CreateHistoricalPeriodDto's own checks (startDate < endDate,
 * non-negative kWh/total) — a fast-fail mirror of the server, which stays the
 * final authority (it also rejects an endDate in the future).
 */
export const historicalPeriodSchema = z
  .object({
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    importedKwh: z.number().min(0, "Must be zero or higher"),
    // Genuinely optional (only shown at all when hasExports is true) — SettingsPage registers
    // this field with a `setValueAs` that turns a blank input into `undefined` rather than
    // react-hook-form's default `valueAsNumber` NaN, which would otherwise fail this check
    // and wrongly block submission of an otherwise-complete form. Confirmed live.
    exportedKwh: z.number().min(0, "Must be zero or higher").optional(),
    total: z.number().min(0, "Must be zero or higher"),
    notes: z.string().max(500, "Must be at most 500 characters").optional(),
  })
  .refine((values) => values.startDate < values.endDate, {
    message: "Start date must be before the end date",
    path: ["endDate"],
  });
export type HistoricalPeriodFormValues = z.infer<typeof historicalPeriodSchema>;
