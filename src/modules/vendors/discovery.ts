import "server-only";
import { fixedWindowRetryAfter } from "@/modules/auth/rate-limit";
import { connectDatabase } from "@/server/db/mongoose";
import { getGooglePlace, PlacesRequestError, searchGooglePlaces } from "@/server/places/google";
import { getSamplePlace, searchSamplePlaces } from "./discovery-samples";
import type { DiscoveryMode, DiscoveryPlace, PlaceSave } from "./discovery-validation";
import { prepareVendorStorage, WeddingVendor } from "./model";
import { VendorProblem, vendorView } from "./service";
import { vendorCategories, type VendorCategory } from "./validation";

type AvailableMode = Exclude<DiscoveryMode, "disabled">;
const sources = { google: "GOOGLE_PLACES", sample: "DISCOVERY_SAMPLE" } as const;
const quarterHour = 15 * 60 * 1000;

export function discoveryMode(): DiscoveryMode {
  const mode = process.env.VENDOR_DISCOVERY_MODE?.trim();
  if (mode === "google") return process.env.GOOGLE_PLACES_API_KEY?.trim() ? "google" : "disabled";
  if (mode === "sample" || (!mode && process.env.NODE_ENV === "development")) return "sample";
  return "disabled";
}

function enabledMode() {
  const mode = discoveryMode();
  if (mode === "disabled") throw new VendorProblem(503, "DISCOVERY_DISABLED", "Vendor discovery isn’t configured.");
  return mode;
}

async function requestPlaces<T>(weddingId: string, kind: "search" | "details", request: () => Promise<T>) {
  const retryAfter = await fixedWindowRetryAfter(["vendor-discovery", weddingId, kind], kind === "search" ? 30 : 60, quarterHour);
  if (retryAfter !== null) throw new VendorProblem(429, "DISCOVERY_RATE_LIMITED", "Too many vendor requests. Wait a moment and try again.", undefined, retryAfter);
  try {
    return await request();
  } catch (error) {
    if (error instanceof PlacesRequestError && error.status === 429) {
      throw new VendorProblem(503, "PLACES_QUOTA", "Google Maps is temporarily unavailable. Try again later.");
    }
    throw new VendorProblem(503, "PLACES_UNAVAILABLE", "We couldn’t load Google Maps results. Try again.");
  }
}

function findPlace(weddingId: string, mode: AvailableMode, id: string) {
  return mode === "sample" ? getSamplePlace(id) : requestPlaces(weddingId, "details", () => getGooglePlace(id));
}

export type DiscoveryResult = DiscoveryPlace & { saved: { id: string; archived: boolean } | null };
export type DiscoverySearch = { mode: AvailableMode; results: DiscoveryResult[] };

export async function discoverVendors(weddingId: string, category: VendorCategory, location: string): Promise<DiscoverySearch> {
  const mode = enabledMode();
  const places = mode === "sample" ? searchSamplePlaces(category, location)
    : await requestPlaces(weddingId, "search", () => searchGooglePlaces(`wedding ${vendorCategories[category]} in ${location}`));
  if (!places.length) return { mode, results: [] };
  await connectDatabase();
  const matching = await WeddingVendor.find({ weddingId, source: sources[mode], providerPlaceId: { $in: places.map(({ id }) => id) } })
    .select("_id archivedAt +providerPlaceId").lean();
  const saved = new Map(matching.map(({ _id, providerPlaceId, archivedAt }) =>
    [providerPlaceId, { id: _id.toString(), archived: Boolean(archivedAt) }]));
  return { mode, results: Array.from(new Map(places.map((place) => [place.id, {
    ...place, saved: saved.get(place.id) ?? null,
  }])).values()) };
}

export async function saveDiscoveredVendor(weddingId: string, input: PlaceSave) {
  const mode = enabledMode();
  const id = "googlePlaceId" in input ? input.googlePlaceId : input.samplePlaceId;
  const requestedMode = "googlePlaceId" in input ? "google" : "sample";
  if (mode !== requestedMode) throw new VendorProblem(409, "DISCOVERY_CHANGED", "Search again to open the current vendor listings.");
  await connectDatabase();
  await prepareVendorStorage();
  const scope = { weddingId, source: sources[mode], providerPlaceId: id };
  const existing = await WeddingVendor.findOne(scope).lean();
  if (existing) return { vendor: vendorView(existing), created: false };
  const listing = await findPlace(weddingId, mode, id);
  if (!listing || listing.id !== id) throw new VendorProblem(404, "PLACE_UNAVAILABLE", "This listing is no longer available. Search again.");

  try {
    const vendor = await new WeddingVendor({
      ...scope, name: input.name, category: input.category, notes: input.notes || undefined,
    }).save();
    return { vendor: vendorView(vendor), created: true };
  } catch (error) {
    if ((error as { code?: number } | null)?.code === 11000) {
      const saved = await WeddingVendor.findOne(scope).lean();
      if (saved) return { vendor: vendorView(saved), created: false };
    }
    throw error;
  }
}

export async function savedVendorListing(weddingId: string, vendorId: string) {
  await connectDatabase();
  const vendor = await WeddingVendor.findOne({ _id: vendorId, weddingId }).select("source +providerPlaceId").lean();
  if (!vendor?.providerPlaceId || vendor.source === "MANUAL") return null;
  const mode = enabledMode();
  if (vendor.source !== sources[mode]) {
    throw new VendorProblem(503, "LISTING_UNAVAILABLE", "This listing is unavailable in the current discovery mode.");
  }
  const place = await findPlace(weddingId, mode, vendor.providerPlaceId);
  return place ? { mode, place } : null;
}
