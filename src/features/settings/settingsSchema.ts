import { z } from "zod";

/** Mirrors CreateUserDto/UpdateUserDto's firstName/lastName/email rules — no password field, the API has no password-change endpoint yet. */
export const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80, "Must be at most 80 characters"),
  lastName: z.string().min(1, "Last name is required").max(80, "Must be at most 80 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;
