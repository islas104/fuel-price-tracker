export interface FuelStation {
  id: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  prices: {
    petrol?: number; // pence per litre (e.g. 1489 = 148.9p)
    diesel?: number;
  };
  distance?: number; // km from user
  lastUpdated?: string;
}

// UK CMA-mandated open fuel price feeds — no API key required
// Only verified working endpoints are included
export const FUEL_SOURCES = [
  { brand: "Asda",       url: "https://storelocator.asda.com/fuel_prices_data.json" },
  { brand: "Tesco",      url: "https://www.tesco.com/store-locator/fuel-prices/fuel.json" },
  { brand: "Morrisons",  url: "https://www.morrisons.com/fuel-prices/fuel.json" },
  { brand: "Sainsburys", url: "https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json" },
  { brand: "Jet",        url: "https://jetlocal.co.uk/fuel_prices_data.json" },
  { brand: "Applegreen", url: "https://applegreenstores.com/fuel-prices/data.json" },
];

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Normalises the varying schemas across UK retailers into a common shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseStation(brand: string, raw: any): FuelStation | null {
  try {
    // Location: CMA feeds use location.latitude / location.longitude (sometimes as strings)
    const lat = parseFloat(
      raw.location?.latitude ?? raw.location?.lat ?? raw.lat ?? raw.latitude ?? "0"
    );
    const lng = parseFloat(
      raw.location?.longitude ?? raw.location?.lng ?? raw.location?.lon ??
      raw.lng ?? raw.lon ?? raw.longitude ?? "0"
    );
    if (!lat || !lng) return null;

    const prices: FuelStation["prices"] = {};

    // CMA format: prices is a plain object { "E10": 150.9, "B7": 178.7 }
    if (raw.prices && typeof raw.prices === "object" && !Array.isArray(raw.prices)) {
      for (const [key, val] of Object.entries(raw.prices as Record<string, number>)) {
        const t = key.toUpperCase();
        if (["E10", "E5", "UNLEADED", "PETROL", "U91"].some((k) => t.includes(k)))
          prices.petrol = prices.petrol ?? val;
        if (["B7", "DIESEL"].some((k) => t.includes(k)))
          prices.diesel = val;
      }
    }

    if (!prices.petrol && !prices.diesel) return null;

    return {
      id:          `${brand}-${raw.site_id ?? raw.id ?? lat}-${lng}`,
      brand,
      name:        raw.site_name ?? raw.name ?? brand,
      address:     raw.address ?? raw.site_address ?? "",
      postcode:    raw.postcode ?? "",
      lat,
      lng,
      prices,
      lastUpdated: raw.last_updated ?? raw.updated ?? undefined,
    };
  } catch {
    return null;
  }
}
