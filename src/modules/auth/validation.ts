import { z } from "zod";
import { signupPasswordMinLength } from "./password-policy";

const email = z.string().trim().max(254).pipe(z.email({ error: "Enter a valid email address." }));

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email,
  password: z.string()
    .min(signupPasswordMinLength, `Use at least ${signupPasswordMinLength} characters.`)
    .max(128, "Use at most 128 characters."),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
