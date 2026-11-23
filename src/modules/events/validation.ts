import { z } from "zod";

export const eventTypes = {
  ROKA: "Roka",
  ENGAGEMENT: "Engagement",
  MEHENDI: "Mehendi",
  HALDI: "Haldi",
  SANGEET: "Sangeet",
  COCKTAIL: "Cocktail",
  WEDDING: "Wedding",
  RECEPTION: "Reception",
  CUSTOM: "Custom",
} as const;
export type EventType = keyof typeof eventTypes;

export const eventFieldLimits = { name: 100, venueName: 150, address: 250, description: 1000, dressCode: 120 };

const instant = z.iso.datetime({ offset: true, error: "Enter a date and time with a timezone offset." })
  .refine((value) => Number.isFinite(Date.parse(value)), "Enter a valid date and time.");

const fields = z.strictObject({
  name: z.string().trim().min(1, "Enter an event name.").max(eventFieldLimits.name),
  type: z.enum(Object.keys(eventTypes) as EventType[]).nullable().optional(),
  startsAt: instant,
  endsAt: instant.nullable().optional(),
  venueName: z.string().trim().max(eventFieldLimits.venueName).optional(),
  address: z.string().trim().max(eventFieldLimits.address).optional(),
  description: z.string().trim().max(eventFieldLimits.description).optional(),
  dressCode: z.string().trim().max(eventFieldLimits.dressCode).optional(),
});

export const endTimeMessage = "End time must be after the start time.";

export function validEventRange(start: Date, end?: Date | null) {
  return !end || end.getTime() > start.getTime();
}

export const createEventSchema = fields.refine(
  ({ startsAt, endsAt }) => validEventRange(new Date(startsAt), endsAt ? new Date(endsAt) : null),
  { path: ["endsAt"], message: endTimeMessage },
);
export const updateEventSchema = fields.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Provide at least one field to update.",
);
export const eventIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);
export const eventListSchema = z.object({
  includeArchived: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  from: instant.optional(),
  to: instant.optional(),
}).refine(({ from, to }) => !from || !to || Date.parse(from) <= Date.parse(to), {
  path: ["to"], message: "The end of the range must be on or after the start.",
});

export type EventValues = z.output<typeof createEventSchema>;
export type EventChanges = z.output<typeof updateEventSchema>;
