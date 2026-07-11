import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
});
