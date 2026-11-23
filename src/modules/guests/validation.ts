import { z } from "zod";

export const rsvpStatuses = { PENDING: "Pending", ATTENDING: "Attending", NOT_ATTENDING: "Not attending" } as const;
export type RsvpStatus = keyof typeof rsvpStatuses;
export const guestLimits = { name: 120, email: 254, phone: 40, notes: 2000, maxGuests: 10000, events: 100, search: 120 };

export const guestIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Choose a valid record.").toLowerCase();
const status = z.enum(Object.keys(rsvpStatuses) as RsvpStatus[]);
const maxGuests = z.number({ error: "Enter a whole-number party limit." }).int("Enter a whole-number party limit.")
  .min(1, "Allow at least one guest.").max(guestLimits.maxGuests, "Allow up to 10,000 guests.");
const invitedEventIds = z.array(guestIdSchema).max(guestLimits.events)
  .refine((ids) => new Set(ids).size === ids.length, "Select each event once.");
const email = z.email();
const fields = z.strictObject({
  name: z.string().trim().min(1, "Enter the named guest’s name.").max(guestLimits.name),
  email: z.string().trim().max(guestLimits.email)
    .refine((value) => value === "" || email.safeParse(value).success, "Enter a valid email address.").optional(),
  phone: z.string().trim().max(guestLimits.phone)
    .regex(/^(?:[0-9+(). -]*[0-9][0-9+(). -]*)?$/, "Enter a valid phone number.").optional(),
  notes: z.string().trim().max(guestLimits.notes).optional(),
  maxGuests,
  invitedEventIds,
});

export const createGuestSchema = fields.extend({ maxGuests: maxGuests.default(1), invitedEventIds: invitedEventIds.default([]) });
export const updateGuestSchema = fields.partial().refine((input) => Object.keys(input).length > 0, "Provide at least one field to update.");
export const guestListSchema = z.strictObject({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100000)).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
  search: z.string().trim().max(guestLimits.search).optional(),
  eventId: guestIdSchema.optional(),
  rsvpStatus: status.optional(),
  invitationSent: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});
export type GuestValues = z.output<typeof createGuestSchema>;
export type GuestChanges = z.output<typeof updateGuestSchema>;
export type GuestFilters = z.output<typeof guestListSchema>;
