import type { Archetype } from "@/lib/profile";

export type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating?: number;
  price_level?: string;
  map_url?: string;
};

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.rating",
  "places.priceLevel",
  "places.googleMapsUri",
].join(",");

type RawPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  rating?: number;
  priceLevel?: string;
  googleMapsUri?: string;
};

function queryForArchetype(location: string, archetype: Archetype): string {
  switch (archetype) {
    case "traveler":
      return `restaurants and cafes near ${location}`;
    case "home_based":
      return `grocery stores and markets near ${location}`;
    case "institutional":
      return `cafes and healthy restaurants near ${location}`;
    case "mixed":
      return `restaurants near ${location}`;
  }
}

function normalize(p: RawPlace): Place {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    category: p.primaryTypeDisplayName?.text ?? categoryFromTypes(p.types),
    address: p.formattedAddress ?? "",
    rating: p.rating,
    price_level: priceLevelFromEnum(p.priceLevel),
    map_url: p.googleMapsUri,
  };
}

function categoryFromTypes(types?: string[]): string {
  if (!types || types.length === 0) return "Place";
  const t = types[0].replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function priceLevelFromEnum(level?: string): string | undefined {
  switch (level) {
    case "PRICE_LEVEL_FREE": return "Free";
    case "PRICE_LEVEL_INEXPENSIVE": return "$";
    case "PRICE_LEVEL_MODERATE": return "$$";
    case "PRICE_LEVEL_EXPENSIVE": return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$";
    default: return undefined;
  }
}

export async function searchNearby(
  location: string,
  archetype: Archetype,
  limit = 5,
): Promise<Place[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY not set");

  const query = queryForArchetype(location, archetype);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: limit,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { places?: RawPlace[] };
  return (data.places ?? []).slice(0, limit).map(normalize);
}
