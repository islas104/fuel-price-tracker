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
export const FUEL_SOURCES = [
  { brand: "Asda",        url: "https://storelocator.asda.com/fuel_prices_data.json" },
  { brand: "Tesco",       url: "https://www.tesco.com/store-locator/fuel-prices/fuel.json" },
  { brand: "Morrisons",   url: "https://www.morrisons.com/fuel-prices/fuel.json" },
  { brand: "Sainsburys",  url: "https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json" },
  { brand: "Jet",         url: "https://jetlocal.co.uk/fuel_prices_data.json" },
  { brand: "Applegreen",  url: "https://applegreenstores.com/fuel-prices/data.json" },
  { brand: "BP",          url: "https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json" },
  { brand: "Shell",       url: "https://www.shell.co.uk/motorist/shell-fuels/shell-price-watch/fuel_prices_data.json" },
  { brand: "Esso",        url: "https://fuelprices.esso.co.uk/fuel_prices_data.json" },
  { brand: "Gulf",        url: "https://www.gulf.co.uk/fuel-prices/fuel_prices_data.json" },
  { brand: "Texaco",      url: "https://www.texaco.co.uk/fuel-prices/fuel_prices_data.json" },
  { brand: "Murco",       url: "https://www.murco.co.uk/fuel-prices/fuel_prices_data.json" },
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
    const lat = parseFloat(raw.location?.lat ?? raw.lat ?? raw.latitude ?? "0");
    const lng = parseFloat(
      raw.location?.lng ?? raw.location?.lon ?? raw.lng ?? raw.lon ?? raw.longitude ?? "0"
    );
    if (!lat || !lng) return null;

    const prices: FuelStation["prices"] = {};

    // Most retailers: array of { fuel_type, price }
    const fuelList: { fuel_type?: string; price?: number }[] =
      raw.prices ?? raw.fuels ?? raw.fuel_prices ?? [];

    for (const f of fuelList) {
      const type = (f.fuel_type ?? "").toUpperCase();
      const ppl = f.price ?? 0;
      // E10 / Unleaded = petrol
      if (["E10", "UNLEADED", "U91", "PETROL", "E5"].some((t) => type.includes(t)))
        prices.petrol = ppl;
      // B7 / Diesel
      if (["B7", "DIESEL"].some((t) => type.includes(t)))
        prices.diesel = ppl;
    }

    // Fallback: some retailers use top-level keys
    if (!prices.petrol && raw.unleaded) prices.petrol = raw.unleaded;
    if (!prices.petrol && raw.petrol)   prices.petrol = raw.petrol;
    if (!prices.diesel && raw.diesel)   prices.diesel = raw.diesel;

    if (!prices.petrol && !prices.diesel) return null;

    return {
      id: `${brand}-${raw.site_id ?? raw.id ?? lat}-${lng}`,
      brand,
      name:    raw.site_name ?? raw.name ?? brand,
      address: raw.address ?? raw.site_address ?? "",
      postcode: raw.postcode ?? "",
      lat,
      lng,
      prices,
      lastUpdated: raw.last_updated ?? raw.updated ?? undefined,
    };
  } catch {
    return null;
  }
}
