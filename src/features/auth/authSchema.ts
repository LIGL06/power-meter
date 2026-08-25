import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  // Login only checks length — password composition (upper/lower/digit) is a
  // create-time rule, an already-registered password may predate it.
  password: z
    .string()
    .min(8, "Must be at least 8 characters")
    .max(128, "Must be at most 128 characters"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80, "Must be at most 80 characters"),
  lastName: z.string().min(1, "Last name is required").max(80, "Must be at most 80 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Must be at least 8 characters")
    .max(128, "Must be at most 128 characters")
    .regex(/(?=.*[a-z])/, "Must contain a lower case letter")
    .regex(/(?=.*[A-Z])/, "Must contain an upper case letter")
    .regex(/(?=.*\d)/, "Must contain a digit"),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;
