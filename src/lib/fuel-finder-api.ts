/**
 * UK Government Fuel Finder API client.
 *
 * Uses OAuth 2.0 client credentials to authenticate, then pages through
 * /api/v1/pfs (station metadata) and /api/v1/pfs/fuel-prices (live prices),
 * joins them on node_id, and returns normalised FuelStation records.
 *
 * Credentials are read from FUEL_FINDER_CLIENT_ID / FUEL_FINDER_CLIENT_SECRET.
 * The access token is cached in process memory (valid for 1 hour per the API).
 *
 * Rate limits (live): 30 RPM, 1 concurrent request per client.
 * We fetch stations then prices sequentially and join in memory.
 */

import type { FuelStation } from "./fuel-sources";

// ─── Config ─────────────────────────────────────────────────────────────────

const API_BASE    = "https://api.fuelfinder.service.gov.uk";
const TOKEN_URL   = `${API_BASE}/api/v1/oauth/generate_access_token`;
const STATIONS_URL = `${API_BASE}/api/v1/pfs`;
const PRICES_URL  = `${API_BASE}/api/v1/pfs/fuel-prices`;

// Per-page size for pagination. 1 000 keeps request count low vs the 30 RPM cap.
const PAGE_SIZE = 1_000;

// ─── Token cache ─────────────────────────────────────────────────────────────

let tokenCache: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  // Reuse if token still has >60 s remaining
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.value;
  }

  const clientId     = process.env.FUEL_FINDER_CLIENT_ID     ?? "";
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("FUEL_FINDER_CLIENT_ID / FUEL_FINDER_CLIENT_SECRET env vars not set");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         "fuelfinder.read",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fuel Finder auth failed: HTTP ${res.status} — ${body}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    value:     json.access_token,
    expiresAt: now + (json.expires_in ?? 3_600) * 1_000,
  };
  return tokenCache.value;
}

// ─── Typed API shapes ────────────────────────────────────────────────────────

interface ApiLocation {
  latitude?:      number | string;
  longitude?:     number | string;
  postcode?:      string;
  address_line_1?: string;
  address_line_2?: string;
  city?:          string;
  county?:        string;
  country?:       string;
}

interface ApiStation {
  node_id:             string;
  trading_name?:       string;
  brand_name?:         string;
  location?:           ApiLocation;
  temporary_closure?:  boolean;
  permanent_closure?:  boolean;
}

interface ApiFuelPrice {
  fuel_type:                      string; // E5 | E10 | B7_Standard | B7_Premium | B10 | HVO
  price?:                         number | string;
  price_last_updated?:            string;
  price_change_effective_timestamp?: string;
}

interface ApiPriceRecord {
  node_id:      string;
  trading_name?: string;
  brand_name?:  string;
  location?:    ApiLocation;             // present on some API versions
  temporary_closure?: boolean;
  permanent_closure?: boolean;
  fuel_prices?: ApiFuelPrice[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAllPages<T>(baseUrl: string, token: string): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  while (true) {
    const url = `${baseUrl}?page=${page}&per_page=${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:        "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Fuel Finder fetch error: HTTP ${res.status} at ${url}`);
    }

    const json = (await res.json()) as unknown;

    // Unwrap common envelope shapes: { data: [] }, { stations: [] }, plain array
    const items = (
      (json as { data?: T[] }).data ??
      (json as { stations?: T[] }).stations ??
      (json as { results?: T[] }).results ??
      (Array.isArray(json) ? (json as T[]) : [])
    );

    all.push(...items);

    // Stop when the page returned fewer records than we asked for
    if (items.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

function toPrice(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = parseFloat(String(value));
  return isFinite(n) && n > 0 ? n : undefined;
}

function joinAddress(loc: ApiLocation | undefined): string {
  if (!loc) return "";
  return [loc.address_line_1, loc.address_line_2, loc.city, loc.county, loc.country]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

function normalisePriceRecord(
  pr: ApiPriceRecord,
  stationMeta: ApiStation | undefined,
): FuelStation | null {
  // Location can come from the price record itself or the separate stations endpoint
  const loc = pr.location ?? stationMeta?.location;
  const lat  = parseFloat(String(loc?.latitude  ?? "0"));
  const lng  = parseFloat(String(loc?.longitude ?? "0"));
  if (!lat || !lng) return null;

  const closedOnPriceRecord  = pr.temporary_closure    || pr.permanent_closure;
  const closedOnStationMeta  = stationMeta?.temporary_closure || stationMeta?.permanent_closure;
  if (closedOnPriceRecord || closedOnStationMeta) return null;

  const prices: FuelStation["prices"] = {};
  let latestTimestamp: string | undefined;

  for (const fp of pr.fuel_prices ?? []) {
    const ft    = fp.fuel_type.toUpperCase().replace(/_/g, "");
    const price = toPrice(fp.price);
    if (price === undefined) continue;

    // Petrol: E10 preferred over E5
    if ((ft === "E10" || ft === "E5") && !prices.petrol) {
      prices.petrol = price;
    }
    // Diesel: B7STANDARD preferred, then B7PREMIUM / B10 / HVO
    if ((ft === "B7STANDARD" || ft === "B7" || ft === "B7PREMIUM" || ft === "B10" || ft === "HVO") && !prices.diesel) {
      prices.diesel = price;
    }

    if (fp.price_last_updated && (!latestTimestamp || fp.price_last_updated > latestTimestamp)) {
      latestTimestamp = fp.price_last_updated;
    }
  }

  if (!prices.petrol && !prices.diesel) return null;

  const brand = (pr.brand_name ?? stationMeta?.brand_name ?? "").trim() || "Fuel Finder";
  const name  = (pr.trading_name ?? stationMeta?.trading_name ?? brand).trim();

  // Convert ISO timestamp to DD/MM/YYYY for the existing UI
  let lastUpdated: string | undefined;
  if (latestTimestamp) {
    const d = new Date(latestTimestamp);
    if (!isNaN(d.getTime())) {
      lastUpdated = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  }

  return {
    id:          `FuelFinder-${pr.node_id}`,
    brand,
    name,
    address:     joinAddress(loc),
    postcode:    (loc?.postcode ?? "").trim(),
    lat,
    lng,
    prices,
    lastUpdated,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches all UK fuel stations + live prices from the government Fuel Finder API.
 * Joins station metadata (location, brand) with price records on node_id.
 * Results are not filtered by radius here — that happens in the API route.
 */
export async function fetchFuelFinderStations(): Promise<FuelStation[]> {
  const token = await getToken();

  // Fetch prices first — they may already include location on some API versions.
  // Fetch station metadata in parallel to avoid two sequential full-table scans.
  // (Rate limit is 1 concurrent request, so we serialise if that becomes an issue.)
  const [priceRecords, stationRecords] = await Promise.all([
    fetchAllPages<ApiPriceRecord>(PRICES_URL, token),
    fetchAllPages<ApiStation>(STATIONS_URL, token),
  ]);

  // Index station metadata by node_id for O(1) lookup
  const stationMap = new Map<string, ApiStation>(
    stationRecords.map((s) => [s.node_id, s])
  );

  const stations: FuelStation[] = [];
  for (const pr of priceRecords) {
    const meta = stationMap.get(pr.node_id);
    const station = normalisePriceRecord(pr, meta);
    if (station) stations.push(station);
  }

  console.log(`[fuel-finder-api] fetched ${stations.length} stations from API`);
  return stations;
}
