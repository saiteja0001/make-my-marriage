import { z } from "zod";
import { vendorCategories, vendorLimits, type VendorCategory } from "./validation";

export const placeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,512}$/, "Choose a valid listing.");
const category = z.enum(Object.keys(vendorCategories) as VendorCategory[], { error: "Choose a vendor category." });

export const discoverySearchSchema = z.strictObject({
  category,
  location: z.string().trim().min(2, "Enter a city or area.").max(200).optional(),
});

const saveFields = {
  name: z.string().trim().min(1, "Enter a vendor label.").max(vendorLimits.name),
  category,
  notes: z.string().trim().max(vendorLimits.notes).optional(),
};

export const savePlaceSchema = z.union([
  z.strictObject({ ...saveFields, googlePlaceId: placeIdSchema }),
  z.strictObject({ ...saveFields, samplePlaceId: placeIdSchema }),
]);
export type PlaceSave = z.output<typeof savePlaceSchema>;
export type DiscoveryMode = "google" | "sample" | "disabled";
export type DiscoveryPlace = {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  mapsUrl?: string;
  attributions: { name: string; url?: string }[];
};
