import "server-only";
import { memberRoleLabels, type MemberRole } from "@/modules/wedding/member-roles";
import { sendResendEmail } from "./resend";

export async function sendMemberInvitationEmail({ id, email, role, token, weddingName }: {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  weddingName: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) throw new Error("Invitation email configuration is missing");
  const origin = new URL(appUrl);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && origin.hostname === "localhost")) {
    throw new Error("Invalid invitation email origin");
  }
  const url = new URL("/member-invitations/" + token, origin.origin);
  await sendResendEmail({
    email,
    subject: "You’re invited to a Make My Marriage wedding workspace",
    text: [
      `You’ve been invited to join ${weddingName} as a ${memberRoleLabels[role]}.`,
      "Open this link and sign in or create an account with this email address.",
      url.href,
      "This link expires in seven days and can be used once.",
    ].join("\n\n"),
    idempotencyKey: "member-invitation/" + id,
  });
}
