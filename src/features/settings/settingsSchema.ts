import { z } from "zod";

export const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address: z.string().min(1, "Address is required"),
  password: z.string().min(1, "Password is required"),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;
