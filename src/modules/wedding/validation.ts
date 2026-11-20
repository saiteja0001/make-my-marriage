import { z } from "zod";

export const defaultWeddingTimeZone = "Asia/Kolkata";
export const weddingFieldLimits = { name: 100, location: 200, title: 60, description: 240 } as const;

const requiredText = (message: string, limit: number) =>
  z.string().trim().min(1, message).max(limit, `Use ${limit} characters or fewer.`);

const boundedText = (limit: number) =>
  z.string().trim().max(limit, `Use ${limit} characters or fewer.`);

const timeZone = z.string().trim().max(100).refine((value) => {
  if (!value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Select a valid timezone.");

export const weddingCreationSchema = z.object({
  brideName: requiredText("Enter the bride’s name.", weddingFieldLimits.name),
  groomName: requiredText("Enter the groom’s name.", weddingFieldLimits.name),
  weddingDate: z.iso.date({ error: "Enter a valid wedding date." }),
  location: z.strictObject({
    formattedAddress: requiredText("Enter your wedding city or location.", weddingFieldLimits.location),
  }),
  timeZone: timeZone.default(defaultWeddingTimeZone),
  title: boundedText(weddingFieldLimits.title).optional(),
  description: boundedText(weddingFieldLimits.description).optional(),
});

export const weddingCreationRequestSchema = weddingCreationSchema.extend({
  draftAccountId: z.string().min(1).max(128).optional(),
});

export type WeddingCreation = z.output<typeof weddingCreationSchema>;
