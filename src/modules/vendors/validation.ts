import { z } from "zod";

export const vendorCategories = {
  PHOTOGRAPHER: "Photographer", VIDEOGRAPHER: "Videographer", VENUE: "Venue", CATERER: "Caterer",
  DECORATOR: "Decorator", DJ: "DJ", MAKEUP_ARTIST: "Makeup artist", MEHENDI_ARTIST: "Mehendi artist",
  PANDIT: "Pandit", CHOREOGRAPHER: "Choreographer", FLORIST: "Florist", WEDDING_PLANNER: "Wedding planner",
  TRANSPORT: "Transport", OTHER: "Other",
} as const;
export type VendorCategory = keyof typeof vendorCategories;
export const vendorLimits = { name: 120, contactPerson: 100, phone: 38, email: 254, address: 300, website: 500, notes: 1000, events: 50, costPaise: 9_999_999_999 };
export const vendorIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Choose a valid item.").toLowerCase();
const category = z.enum(Object.keys(vendorCategories) as VendorCategory[], { error: "Choose a vendor category." });
const text = (limit: number) => z.string().trim().max(limit).nullish();

const phone = z.string().trim().max(vendorLimits.phone).refine((value) => {
  const digits = value.replace(/\D/g, "");
  return !value || (/^\+?[\d ().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15);
}, "Enter a phone number with 7 to 15 digits.").nullish();

const website = z.string().trim().max(vendorLimits.website).transform((value, context) => {
  if (!value) return "";
  try {
    const url = new URL(/^\w+:/.test(value) ? value : "https://" + value);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      && !/\s/.test(value) && url.href.length <= vendorLimits.website) return url.href;
  } catch {
    // The field error below covers invalid URL syntax.
  }
  context.addIssue({ code: "custom", message: "Enter a valid website address." });
  return z.NEVER;
}).nullish();

const fields = z.strictObject({
  name: z.string().trim().min(1, "Enter the vendor name.").max(vendorLimits.name),
  category,
  contactPerson: text(vendorLimits.contactPerson),
  phone,
  email: z.string().trim().max(vendorLimits.email).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address.").nullish(),
  address: text(vendorLimits.address),
  website,
  totalAgreedCostPaise: z.number().int().min(0, "Agreed cost can’t be negative.").max(vendorLimits.costPaise, "Enter a cost up to ₹9,99,99,999.99.").nullish(),
  eventIds: z.array(vendorIdSchema).max(vendorLimits.events).transform((ids) => Array.from(new Set(ids)).sort()),
  notes: text(vendorLimits.notes),
});

export const createVendorSchema = fields.extend({ eventIds: fields.shape.eventIds.default([]) });
export const updateVendorSchema = fields.partial().refine((input) => Object.keys(input).length > 0, "Provide a vendor change.");
export const vendorListSchema = z.strictObject({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100_000)).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional().default(20),
  category: category.optional(),
  search: z.string().trim().max(120).optional(),
  includeArchived: z.enum(["true", "false"]).transform((value) => value === "true").optional().default(false),
  status: z.enum(["active", "archived"]).optional(),
});

export type VendorValues = z.output<typeof createVendorSchema>;
export type VendorChanges = z.output<typeof updateVendorSchema>;
export type VendorFilters = z.output<typeof vendorListSchema>;
