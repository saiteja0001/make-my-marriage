import "server-only";
import { memberRoleLabels, type MemberRole } from "@/modules/wedding/member-roles";

export async function sendMemberInvitationEmail({ id, email, role, token, weddingName }: {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  weddingName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!apiKey || !from || !appUrl) throw new Error("Invitation email configuration is missing");
  const origin = new URL(appUrl);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && origin.hostname === "localhost")) {
    throw new Error("Invalid invitation email origin");
  }
  const url = new URL("/member-invitations/" + token, origin.origin);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": "member-invitation/" + id,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "You’re invited to a Make My Marriage wedding workspace",
      text: [
        `You’ve been invited to join ${weddingName} as a ${memberRoleLabels[role]}.`,
        "Open this link and sign in or create an account with this email address.",
        url.href,
        "This link expires in seven days and can be used once.",
      ].join("\n\n"),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Invitation email delivery failed");
}
