import "server-only";
import { fixedWindowRetryAfter } from "@/modules/auth/rate-limit";

export class ResendRateLimited extends Error {
  constructor(public retryAfter: number) {
    super("Email sending is temporarily rate limited.");
  }
}

export async function sendResendEmail({ email, subject, text, idempotencyKey, deadline }: {
  email: string;
  subject: string;
  text: string;
  idempotencyKey: string;
  deadline?: Date;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new Error("Email configuration is missing");

  // Two adjacent one-second windows can start up to ten provider requests.
  const retryAfter = await fixedWindowRetryAfter(["resend", "dispatch"], 5, 1000);
  if (retryAfter !== null) throw new ResendRateLimited(retryAfter);
  const timeout = Math.min(8000, deadline ? deadline.getTime() - Date.now() : 8000);
  if (timeout <= 0) throw new Error("Email dispatch window expired");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [email], subject, text }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error("Email delivery failed");
}
