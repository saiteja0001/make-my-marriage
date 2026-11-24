import { z } from "zod";
import { guestLimits } from "./validation";

export const guestInvitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const rsvpSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ATTENDING"),
    attendingCount: z.number({ error: "Enter a whole-number party size." }).int("Enter a whole-number party size.")
      .min(1, "Select at least one attendee.").max(guestLimits.maxGuests, "Enter a valid party size."),
  }),
  z.strictObject({
    status: z.literal("NOT_ATTENDING"),
    attendingCount: z.literal(0, { error: "A declined RSVP has no attendees." }),
  }),
]);

export type RsvpInput = z.output<typeof rsvpSchema>;
