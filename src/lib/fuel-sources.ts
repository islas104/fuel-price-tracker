export interface FuelStation {
  id: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  prices: {
    petrol?: number; // pence per litre e.g. 149.9 = 149.9p/L
    diesel?: number;
  };
  distance?: number; // miles from user
  lastUpdated?: string;
}

// UK CMA-mandated open fuel price feeds — verified working
// Shell, Tesco, Esso: actively block server-side requests (403)
// Morrisons: feed broken (returns 1 station)
export const FUEL_SOURCES: { brand: string; url: string; mobileUA: boolean }[] = [
  // Standard fetch
  { brand: "Asda",       url: "https://storelocator.asda.com/fuel_prices_data.json",                                        mobileUA: false },
  { brand: "Sainsburys", url: "https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json",                       mobileUA: false },
  { brand: "Jet",        url: "https://jetlocal.co.uk/fuel_prices_data.json",                                               mobileUA: false },
  { brand: "Ascona",     url: "https://fuelprices.asconagroup.co.uk/newfuel.json",                                          mobileUA: false },
  // Requires mobile User-Agent
  { brand: "BP",         url: "https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json",             mobileUA: true  },
  // Motor Fuel Group — 1,200+ stations (BP, Esso, Texaco, Shell-branded sites)
  { brand: "MFG",        url: "https://fuel.motorfuelgroup.com/fuel_prices_data.json",                                     mobileUA: false },
  // Rontec — 265 stations
  { brand: "Rontec",     url: "https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json",           mobileUA: false },
  // Moto — removed from CMA participating retailers list on 08/04/2026; feed may still return data
  { brand: "Moto",       url: "https://moto-way.com/fuel-price/fuel_prices.json",                                          mobileUA: false },
  // SGN Retail — 150 stations
  { brand: "SGN",        url: "https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json",                            mobileUA: false },
  // Tesco: Akamai blocks all server-side requests including ScraperAPI free tier
  // Shell: HTTP 403 even with mobile User-Agent
  // Esso (direct): stale feed (~12 days old) — excluded
  // Karan Retail: expired SSL certificate — excluded
  // Morrisons: feed only returns 1 station — excluded
];

// Returns distance in miles
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
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

    // Prefer the raw brand (e.g. MFG stations carry BP/Shell/Esso/Texaco branding)
    // Keep source brand in the ID to avoid collisions across networks
    const displayBrand =
      typeof raw.brand === "string" && raw.brand.trim() ? raw.brand.trim() : brand;

    return {
      id:          `${brand}-${raw.site_id ?? raw.id ?? lat}-${lng}`,
      brand:       displayBrand,
      name:        raw.site_name ?? raw.name ?? displayBrand,
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
