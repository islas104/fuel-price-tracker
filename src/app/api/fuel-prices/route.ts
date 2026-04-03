import { NextRequest, NextResponse } from "next/server";
import {
  FUEL_SOURCES,
  FuelStation,
  haversineDistance,
  normaliseStation,
} from "@/lib/fuel-sources";

export const runtime = "nodejs";

const FUEL_FINDER_BASE    = "https://api.fuelfinder.service.gov.uk/v1";
const FUEL_FINDER_AUTH    = "https://api.fuelfinder.service.gov.uk/oauth/token";

// Cache the token in memory for the duration of the edge function lifetime
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getFuelFinderToken(): Promise<string | null> {
  const clientId     = process.env.FUEL_FINDER_CLIENT_ID;
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Reuse cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "fuelfinder.read",
  });

  const res = await fetch(FUEL_FINDER_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;

  const { access_token, expires_in } = await res.json();
  cachedToken = {
    value:     access_token,
    expiresAt: Date.now() + (expires_in ?? 3600) * 1000,
  };
  return access_token;
}

// Fetch live prices from the UK Fuel Finder API filtered by location
async function fetchFuelFinderPrices(
  lat: number,
  lng: number,
  radius: number
): Promise<FuelStation[]> {
  const token = await getFuelFinderToken();
  if (!token) return [];

  try {
    // Fetch petrol (unleaded/E10) and diesel in parallel
    const [unleadedRes, dieselRes] = await Promise.all([
      fetch(
        `${FUEL_FINDER_BASE}/prices?fuel_type=unleaded&lat=${lat}&lng=${lng}&radius=${radius}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      fetch(
        `${FUEL_FINDER_BASE}/prices?fuel_type=diesel&lat=${lat}&lng=${lng}&radius=${radius}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    ]);

    const stationMap = new Map<string, FuelStation>();

    const processResponse = async (
      res: Response,
      fuelKey: "petrol" | "diesel"
    ) => {
      if (!res.ok) return;
      const data = await res.json();

      // Handle both array responses and wrapped { stations: [...] }
      const items: unknown[] =
        data.stations ?? data.results ?? data.data ?? (Array.isArray(data) ? data : []);

      for (const item of items as Record<string, unknown>[]) {
        const id      = String(item.id ?? item.site_id ?? item.stationId ?? "");
        const lat_s   = Number(item.lat ?? item.latitude  ?? (item.location as Record<string,unknown>)?.lat ?? 0);
        const lng_s   = Number(item.lng ?? item.longitude ?? (item.location as Record<string,unknown>)?.lng ?? 0);
        const price   = Number(item.price ?? item.ppl ?? item.priceInPence ?? 0);
        const brand   = String(item.brand ?? item.retailer ?? "Unknown");
        const name    = String(item.name  ?? item.site_name ?? brand);
        const address = String(item.address ?? item.site_address ?? "");
        const postcode = String(item.postcode ?? "");

        if (!lat_s || !lng_s || !price) continue;

        if (stationMap.has(id)) {
          stationMap.get(id)!.prices[fuelKey] = price;
        } else {
          stationMap.set(id, {
            id: `ff-${id}`,
            brand,
            name,
            address,
            postcode,
            lat: lat_s,
            lng: lng_s,
            prices: { [fuelKey]: price },
            distance: haversineDistance(lat, lng, lat_s, lng_s),
            lastUpdated: String(item.last_updated ?? item.updated ?? ""),
          });
        }
      }
    };

    await Promise.all([
      processResponse(unleadedRes, "petrol"),
      processResponse(dieselRes,   "diesel"),
    ]);

    return Array.from(stationMap.values()).filter(
      (s) => s.prices.petrol || s.prices.diesel
    );
  } catch {
    return [];
  }
}

// Fetch open CMA feeds (Asda, Tesco, Shell, BP, etc.) — no auth needed
async function fetchOpenFeeds(): Promise<FuelStation[]> {
  const results = await Promise.allSettled(
    FUEL_SOURCES.map(async (source) => {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "FuelPriceTracker/1.0" },
        next: { revalidate: 1800 },
      });
      if (!res.ok) throw new Error(`${source.brand}: HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) throw new Error(`${source.brand}: unexpected content-type ${contentType}`);
      const json = await res.json();
      const raw: unknown[] =
        json.stations ?? json.sites ?? json.data ?? json.results ??
        (Array.isArray(json) ? json : []);
      return raw
        .map((s) => normaliseStation(source.brand, s))
        .filter((s): s is FuelStation => s !== null);
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<FuelStation[]>).value);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat    = parseFloat(searchParams.get("lat")    ?? "0");
  const lng    = parseFloat(searchParams.get("lng")    ?? "0");
  const radius = parseFloat(searchParams.get("radius") ?? "10");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  // Run Fuel Finder API and open CMA feeds in parallel
  const [finderStations, openStations] = await Promise.all([
    fetchFuelFinderPrices(lat, lng, radius),
    fetchOpenFeeds(),
  ]);

  // Deduplicate: Fuel Finder data takes priority (more accurate/real-time)
  const finderIds = new Set(finderStations.map((s) => s.id));
  const merged = [
    ...finderStations,
    ...openStations
      .map((s) => ({ ...s, distance: haversineDistance(lat, lng, s.lat, s.lng) }))
      .filter((s) => !finderIds.has(s.id) && s.distance <= radius),
  ].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

  return NextResponse.json({
    stations: merged,
    count:    merged.length,
    source:   finderStations.length > 0 ? "fuel-finder-api+open-feeds" : "open-feeds-only",
  });
}
