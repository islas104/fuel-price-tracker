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

export interface FuelSource {
  brand: string;
  url: string;
  mobileUA: boolean;
  format: "json" | "csv";
}

// UK CMA-mandated open fuel price feeds — verified working
// Shell, Tesco, Esso: actively block server-side requests (403)
// Morrisons: feed broken (returns 1 station)
export const FUEL_SOURCES: FuelSource[] = [
  // Standard fetch
  { brand: "Asda",       url: "https://storelocator.asda.com/fuel_prices_data.json",                                        mobileUA: false, format: "json" },
  { brand: "Sainsburys", url: "https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json",                       mobileUA: false, format: "json" },
  { brand: "Jet",        url: "https://jetlocal.co.uk/fuel_prices_data.json",                                               mobileUA: false, format: "json" },
  { brand: "Ascona",     url: "https://fuelprices.asconagroup.co.uk/newfuel.json",                                          mobileUA: false, format: "json" },
  // Requires mobile User-Agent
  { brand: "BP",         url: "https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json",             mobileUA: true,  format: "json" },
  // Motor Fuel Group — 1,200+ stations (BP, Esso, Texaco, Shell-branded sites)
  { brand: "MFG",        url: "https://fuel.motorfuelgroup.com/fuel_prices_data.json",                                     mobileUA: false, format: "json" },
  // Rontec — 265 stations
  { brand: "Rontec",     url: "https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json",           mobileUA: false, format: "json" },
  // Moto — removed from CMA participating retailers list on 08/04/2026; feed may still return data
  { brand: "Moto",       url: "https://moto-way.com/fuel-price/fuel_prices.json",                                          mobileUA: false, format: "json" },
  // SGN Retail — 150 stations
  { brand: "SGN",        url: "https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json",                            mobileUA: false, format: "json" },
  // Fuel Finder publishes CSV files with forecourt and price data. Add the URL here
  // when you have a live export endpoint available.
  // { brand: "Fuel Finder", url: "https://example.com/fuel-finder.csv", mobileUA: false, format: "csv" },
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

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

export function parseCsvRecords(csv: string): Record<string, string>[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalised = value.trim().toLowerCase();
  if (normalised === "true") return true;
  if (normalised === "false") return false;
  return undefined;
}

function choosePrice(...candidates: Array<number | undefined>): number | undefined {
  return candidates.find((value) => typeof value === "number" && value > 0);
}

function joinAddressParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function isFuelFinderRow(raw: Record<string, unknown>): boolean {
  return Boolean(
    raw["forecourts.node_id"] ||
    raw["forecourts.trading_name"] ||
    raw["forecourts.location.latitude"]
  );
}

function normaliseFuelFinderRow(brand: string, raw: Record<string, unknown>): FuelStation | null {
  const lat = parseNumber(raw["forecourts.location.latitude"]);
  const lng = parseNumber(raw["forecourts.location.longitude"]);
  if (!lat || !lng) return null;

  if (
    parseBoolean(raw["forecourts.temporary_closure"]) === true ||
    parseBoolean(raw["forecourts.permanent_closure"]) === true
  ) {
    return null;
  }

  const prices: FuelStation["prices"] = {
    petrol: choosePrice(
      parseNumber(raw["forecourts.fuel_price.E10"]),
      parseNumber(raw["forecourts.fuel_price.E5"])
    ),
    diesel: choosePrice(
      parseNumber(raw["forecourts.fuel_price.B7S"]),
      parseNumber(raw["forecourts.fuel_price.B7P"]),
      parseNumber(raw["forecourts.fuel_price.B10"]),
      parseNumber(raw["forecourts.fuel_price.HVO"])
    ),
  };

  if (!prices.petrol && !prices.diesel) return null;

  const displayBrand =
    String(raw["forecourts.brand_name"] ?? "").trim() ||
    String(raw["forecourts.trading_name"] ?? "").trim() ||
    brand;

  const name =
    String(raw["forecourts.trading_name"] ?? "").trim() ||
    displayBrand;

  return {
    id: `${brand}-${String(raw["forecourts.node_id"] ?? `${lat}-${lng}`)}`,
    brand: displayBrand,
    name,
    address: joinAddressParts([
      String(raw["forecourts.location.address_line_1"] ?? ""),
      String(raw["forecourts.location.address_line_2"] ?? ""),
      String(raw["forecourts.location.city"] ?? ""),
      String(raw["forecourts.location.county"] ?? ""),
      String(raw["forecourts.location.country"] ?? ""),
    ]),
    postcode: String(raw["forecourts.location.postcode"] ?? "").trim(),
    lat,
    lng,
    prices,
    lastUpdated:
      String(
        raw["forecourts.price_submission_timestamp.E10"] ??
        raw["forecourts.price_submission_timestamp.E5"] ??
        raw["forecourts.price_submission_timestamp.B7S"] ??
        raw["forecourts.price_submission_timestamp.B7P"] ??
        raw["forecourts.price_submission_timestamp.B10"] ??
        raw["forecourt_update_timestamp"] ??
        ""
      ).trim() || undefined,
  };
}

// Normalises the varying schemas across UK retailers into a common shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseStation(brand: string, raw: any): FuelStation | null {
  try {
    if (raw && typeof raw === "object" && isFuelFinderRow(raw as Record<string, unknown>)) {
      return normaliseFuelFinderRow(brand, raw as Record<string, unknown>);
    }

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
