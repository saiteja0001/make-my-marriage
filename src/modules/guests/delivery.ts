import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { fixedWindowRetryAfter } from "@/modules/auth/rate-limit";
import type { WeddingCreation } from "@/modules/wedding/validation";
import { formatWeddingDate } from "@/modules/wedding/wedding-date";
import { connectDatabase } from "@/server/db/mongoose";
import { ResendRateLimited, sendResendEmail } from "@/server/email/resend";
import { guestInvitationUrl } from "./invitations";
import { guestInvitationSendAvailable, WeddingGuest, type GuestRecord } from "./model";
import { GuestInvitationSending } from "./service";
import type { sendGuestInvitationSchema } from "./validation";

type InvitationWedding = Pick<WeddingCreation, "brideName" | "groomName" | "weddingDate">;

export class GuestDeliveryProblem extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

function digest(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

async function getInvitationGuest(weddingId: string, guestId: string) {
  await connectDatabase();
  return WeddingGuest.findOne({ weddingId, _id: guestId })
    .select("name email phone invitationSentAt +invitationToken").lean();
}

function guestInvitationPreview(guest: Pick<GuestRecord, "name" | "email" | "phone" | "invitationSentAt" | "invitationToken">, wedding: InvitationWedding) {
  const url = guestInvitationUrl(guest.invitationToken);
  if (!url) return null;

  const couple = `${wedding.brideName} & ${wedding.groomName}`;
  const date = formatWeddingDate(wedding.weddingDate);
  const subject = `Wedding invitation from ${couple}`.replace(/[\r\n]+/g, " ");
  const message = `Hi ${guest.name},\n\nWe’d love for you to celebrate our wedding with us on ${date}.\n\n${couple}`;
  const whatsappMessage = `Hi ${guest.name}! We’d love for you to celebrate our wedding with us on ${date}. View your invitation and RSVP here: ${url}\n\n— ${couple}`;
  const phone = guest.phone?.trim() || null;
  const number = /^(?:\+|00)([1-9]\d{6,14})$/.exec(phone?.replace(/[().\s-]/g, "") ?? "")?.[1];
  const whatsappUrl = new URL(number ? `https://wa.me/${number}` : "https://wa.me/");
  whatsappUrl.searchParams.set("text", whatsappMessage);
  const email = guest.email || null;

  return {
    url, email, phone, subject, message, whatsappMessage,
    whatsappUrl: whatsappUrl.href, hasWhatsappNumber: Boolean(number),
    invitationSentAt: guest.invitationSentAt?.toISOString() ?? null,
    previewVersion: digest([email, subject, message, url]),
  };
}

export async function getGuestInvitationPreview(weddingId: string, guestId: string, wedding: InvitationWedding) {
  const guest = await getInvitationGuest(weddingId, guestId);
  return guest && guestInvitationPreview(guest, wedding);
}

export type GuestInvitationPreview = NonNullable<Awaited<ReturnType<typeof getGuestInvitationPreview>>>;

function invitationChanged() {
  return new GuestDeliveryProblem(409, "INVITATION_CHANGED", "The invitation or its send status changed. Reload the preview before sending.");
}

function sendRateLimited(retryAfter: number) {
  return new GuestDeliveryProblem(429, "RATE_LIMITED", "Too many email attempts. Wait and try again.", retryAfter);
}

export async function sendGuestInvitation(weddingId: string, guestId: string, wedding: InvitationWedding,
  expected: z.output<typeof sendGuestInvitationSchema>,
) {
  const guest = await getInvitationGuest(weddingId, guestId);
  if (!guest) return null;
  const preview = guestInvitationPreview(guest, wedding);
  if (!preview) return null;
  if (preview.previewVersion !== expected.previewVersion || preview.invitationSentAt !== expected.invitationSentAt) {
    throw invitationChanged();
  }
  if (!preview.email) {
    throw new GuestDeliveryProblem(400, "GUEST_EMAIL_REQUIRED", "Add an email address to send this invitation by email.");
  }

  const retryAfter = await fixedWindowRetryAfter(["guest-invitation", weddingId, guestId], 10, 15 * 60 * 1000)
    ?? await fixedWindowRetryAfter(["guest-invitation", "wedding", weddingId], 50, 24 * 60 * 60 * 1000);
  if (retryAfter !== null) throw sendRateLimited(retryAfter);

  const previous = expected.invitationSentAt ? new Date(expected.invitationSentAt) : null;
  const scope = { weddingId, _id: guestId };
  const checkedGuest = { name: guest.name, email: preview.email, invitationToken: guest.invitationToken, invitationSentAt: previous };
  const expiresAt = new Date(Date.now() + 60_000);
  const claim = { ...scope, invitationSendExpiresAt: expiresAt };
  const acquired = await WeddingGuest.updateOne({
    ...scope, ...guestInvitationSendAvailable(), ...checkedGuest,
  }, { $set: { invitationSendExpiresAt: expiresAt } }, { timestamps: false });
  if (!acquired.matchedCount) {
    const current = await WeddingGuest.findOne(scope).select("_id +invitationSendExpiresAt").lean();
    if (!current) return null;
    if (current.invitationSendExpiresAt && current.invitationSendExpiresAt > new Date()) throw new GuestInvitationSending();
    throw invitationChanged();
  }

  try {
    // Matching sends reuse a provider key until the last successful send changes.
    await sendResendEmail({
      email: preview.email,
      subject: preview.subject,
      text: `${preview.message}\n\nView invitation & RSVP:\n${preview.url}`,
      idempotencyKey: `guest-invitation/${digest([weddingId, guestId, expected.invitationSentAt, expected.previewVersion])}`,
      deadline: expiresAt,
    });
  } catch (error) {
    await WeddingGuest.updateOne(claim, { $unset: { invitationSendExpiresAt: 1 } }, { timestamps: false }).catch(() => {});
    if (error instanceof ResendRateLimited) throw sendRateLimited(error.retryAfter);
    throw new GuestDeliveryProblem(503, "DELIVERY_FAILED", "We couldn’t send the invitation email. Please try again.");
  }

  const sentAt = new Date(Math.max(Date.now(), (previous?.getTime() ?? 0) + 1));
  const recorded = await WeddingGuest.updateOne({ ...claim, ...checkedGuest }, {
    $set: { invitationSentAt: sentAt }, $unset: { invitationSendExpiresAt: 1 },
  });
  if (!recorded.matchedCount) {
    throw new GuestDeliveryProblem(503, "DELIVERY_FAILED", "We couldn’t record the invitation send. Please try again.");
  }
  return sentAt.toISOString();
}
