import "server-only";
import { z } from "zod";
import { placeIdSchema, type DiscoveryPlace } from "@/modules/vendors/discovery-validation";

const origin = "https://places.googleapis.com/v1/places";
const fields = ["id", "displayName", "formattedAddress", "rating", "googleMapsUri", "attributions"];
const googlePlace = z.object({
  id: placeIdSchema,
  displayName: z.object({ text: z.string().trim().min(1) }),
  formattedAddress: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  googleMapsUri: z.string().optional(),
  attributions: z.array(z.object({ provider: z.string().min(1), providerUri: z.string().optional() })).optional(),
});

export class PlacesRequestError extends Error {
  constructor(public status: number) { super("Places request failed."); }
}

function link(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {
    return undefined;
  }
}

function project(value: unknown): DiscoveryPlace | null {
  const parsed = googlePlace.safeParse(value);
  if (!parsed.success) return null;
  const place = parsed.data;
  return {
    id: place.id, name: place.displayName.text, address: place.formattedAddress,
    rating: place.rating, mapsUrl: link(place.googleMapsUri),
    attributions: (place.attributions ?? []).map(({ provider, providerUri }) => ({ name: provider, url: link(providerUri) })),
  };
}

async function request(path: string, mask: string, body?: object) {
  const headers = { "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "", "X-Goog-FieldMask": mask };
  const response = await fetch(origin + path, {
    ...(body ? { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) } : { headers }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new PlacesRequestError(response.status);
  return response.json() as Promise<unknown>;
}

export async function searchGooglePlaces(textQuery: string) {
  const response = await request(":searchText", fields.map((field) => "places." + field).join(","), {
    textQuery, pageSize: 12, languageCode: "en", regionCode: "IN", includePureServiceAreaBusinesses: true,
  });
  const parsed = z.object({ places: z.array(z.unknown()).optional() }).safeParse(response);
  if (!parsed.success) throw new PlacesRequestError(502);
  return (parsed.data.places ?? []).map(project).filter((place): place is DiscoveryPlace => place !== null);
}

export async function getGooglePlace(id: string) {
  try {
    return project(await request("/" + encodeURIComponent(id), fields.join(",")));
  } catch (error) {
    if (error instanceof PlacesRequestError && error.status === 404) return null;
    throw error;
  }
}
