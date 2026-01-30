import { z } from "zod";

// Password: min 12 chars, at least 1 number, 1 symbol
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one symbol");

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase();

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
