import type { DiscoveryPlace } from "./discovery-validation";
import type { VendorCategory } from "./validation";

const listings = [
  ["sample-paper-lantern", "PHOTOGRAPHER", "Pune", "Paper Lantern Wedding Studio", "Koregaon Park, Pune", 4.9],
  ["sample-amber-frame", "PHOTOGRAPHER", "Pune", "Amber Frame Collective", "Shivajinagar, Pune", 4.7],
  ["sample-silk-portraits", "PHOTOGRAPHER", "Pune", "Silk & Light Portraits", "Erandwane, Pune"],
  ["sample-fable-venue", "VENUE", "Pune", "Fable Courtyard", "Baner, Pune", 4.6],
  ["sample-mango-catering", "CATERER", "Pune", "Mango Leaf Catering", "Kothrud, Pune", 4.5],
  ["sample-gold-thread", "DECORATOR", "Pune", "Gold Thread Décor", "Aundh, Pune", 4.8],
  ["sample-river-portrait", "PHOTOGRAPHER", "Hyderabad", "Riverlight Portrait Studio", "Banjara Hills, Hyderabad", 4.8],
  ["sample-hill-portrait", "PHOTOGRAPHER", "Dehradun", "Hilllight Wedding Studio", "Rajpur Road, Dehradun", 4.8],
] as const satisfies readonly (readonly [string, VendorCategory, string, string, string, number?])[];

function project([id, , , name, address, rating]: (typeof listings)[number]): DiscoveryPlace {
  return { id, name, address, rating, attributions: [] };
}

export function searchSamplePlaces(category: VendorCategory, location: string) {
  const area = location.toLowerCase();
  return listings.filter(([, kind, city]) => kind === category && area.includes(city.toLowerCase())).map(project);
}

export function getSamplePlace(id: string) {
  const found = listings.find((row) => row[0] === id);
  return found ? project(found) : null;
}
