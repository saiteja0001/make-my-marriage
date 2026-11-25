import "server-only";
import { fixedWindowRetryAfter } from "@/modules/auth/rate-limit";
import { WeddingEvent } from "@/modules/events/model";
import { Wedding } from "@/modules/wedding/models";
import { connectDatabase } from "@/server/db/mongoose";
import { WeddingGuest, type GuestRecord } from "./model";
import { guestInvitationTokenSchema, type RsvpInput } from "./rsvp-validation";

export class RsvpPartySizeChanged extends Error {
  constructor(public limit: number) {
    super(`Your hosts have set a limit of ${limit} ${limit === 1 ? "person" : "people"} for your group. Review your party size and try again.`);
  }
}

export class RsvpConflict extends Error {
  constructor() {
    super("Your invitation changed while you were responding. Review the latest details and try again.");
  }
}

export class RsvpRateLimited extends Error {
  constructor(public retryAfter: number) {
    super("There have been too many responses. Please wait before trying again.");
  }
}

export class InvitationOriginUnavailable extends Error {
  constructor() {
    super("The invitation link is temporarily unavailable. Try again later.");
  }
}

export function guestInvitationUrl(token: string) {
  if (!guestInvitationTokenSchema.safeParse(token).success) return null;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const parsed = URL.parse(configured);
  if (!parsed || !["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new InvitationOriginUnavailable();
  }
  return new URL(`/invite/${token}`, parsed.origin).href;
}

async function findInvitation(token: string) {
  if (!guestInvitationTokenSchema.safeParse(token).success) return null;
  await connectDatabase();
  const guest = await WeddingGuest.findOne({ invitationToken: token })
    .select("weddingId name maxGuests invitedEventIds rsvpStatus attendingCount rsvpUpdatedAt __v").lean();
  if (!guest) return null;
  const wedding = await Wedding.findById(guest.weddingId)
    .select("brideName groomName title weddingDate timeZone location.formattedAddress").lean();
  return wedding ? { guest, wedding } : null;
}

export async function getPublicInvitation(token: string) {
  const invitation = await findInvitation(token);
  if (!invitation) return null;
  const { guest, wedding } = invitation;
  const events = guest.invitedEventIds?.length
    ? await WeddingEvent.find({ weddingId: guest.weddingId, _id: { $in: guest.invitedEventIds }, archivedAt: null })
      .select("name startsAt endsAt venueName address dressCode description").sort({ startsAt: 1, _id: 1 }).lean()
    : [];
  return {
    guest: {
      name: guest.name, maxGuests: guest.maxGuests,
      rsvpStatus: guest.rsvpStatus ?? "PENDING", attendingCount: guest.attendingCount ?? null,
      revision: guest.__v ?? 0,
    },
    wedding: {
      brideName: wedding.brideName, groomName: wedding.groomName, title: wedding.title ?? null,
      weddingDate: wedding.weddingDate, timeZone: wedding.timeZone, location: wedding.location.formattedAddress,
    },
    events: events.map(({ name, startsAt, endsAt, venueName, address, dressCode, description }) => ({
      name, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null,
      venueName: venueName ?? null, address: address ?? null, dressCode: dressCode ?? null, description: description ?? null,
    })),
  };
}

export type PublicInvitation = NonNullable<Awaited<ReturnType<typeof getPublicInvitation>>>;

function savedResponse(guest: GuestRecord, input: RsvpInput) {
  if (guest.rsvpStatus !== input.status || guest.attendingCount !== input.attendingCount) return null;
  return {
    status: input.status, attendingCount: input.attendingCount,
    updatedAt: guest.rsvpUpdatedAt?.toISOString() ?? null, revision: guest.__v ?? 0,
  };
}

export async function submitGuestRsvp(token: string, input: RsvpInput, revision: number) {
  const invitation = await findInvitation(token);
  if (!invitation) return null;
  const { guest } = invitation;
  if (input.attendingCount > guest.maxGuests) throw new RsvpPartySizeChanged(guest.maxGuests);

  const retryAfter = await fixedWindowRetryAfter(["guest-rsvp", "invitation", token], 20, 15 * 60 * 1000)
    ?? await fixedWindowRetryAfter(["guest-rsvp", "shared"], 300, 60 * 1000);
  if (retryAfter !== null) throw new RsvpRateLimited(retryAfter);
  const saved = savedResponse(guest, input);
  if (saved) return saved;
  if (revision !== (guest.__v ?? 0)) throw new RsvpConflict();

  const scope = { _id: guest._id, weddingId: guest.weddingId, invitationToken: token };
  const response = await WeddingGuest.findOneAndUpdate({
    ...scope, __v: revision === 0 ? { $in: [0, null] } : revision, maxGuests: { $gte: input.attendingCount },
  }, {
    $set: { rsvpStatus: input.status, attendingCount: input.attendingCount, rsvpUpdatedAt: new Date() }, $inc: { __v: 1 },
  }, { returnDocument: "after" }).select("rsvpStatus attendingCount rsvpUpdatedAt __v").lean();
  if (response) return savedResponse(response, input);

  const latest = await WeddingGuest.findOne(scope).select("maxGuests rsvpStatus attendingCount rsvpUpdatedAt __v").lean();
  if (!latest) return null;
  if (input.attendingCount > latest.maxGuests) throw new RsvpPartySizeChanged(latest.maxGuests);
  const concurrent = savedResponse(latest, input);
  if (concurrent) return concurrent;
  throw new RsvpConflict();
}
