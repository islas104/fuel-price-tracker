import { NextRequest, NextResponse } from "next/server";
import {
  FUEL_SOURCES,
  FuelStation,
  haversineDistance,
  normaliseStation,
} from "@/lib/fuel-sources";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Fuel Finder API (api.fuelfinder.service.gov.uk)
// This is a UK government API currently in private beta — not yet publicly
// accessible. When it goes live, set FUEL_FINDER_CLIENT_ID and
// FUEL_FINDER_CLIENT_SECRET in .env.local and it will be used automatically.
// ---------------------------------------------------------------------------
const FUEL_FINDER_BASE = "https://api.fuelfinder.service.gov.uk/v1";
const FUEL_FINDER_AUTH = "https://api.fuelfinder.service.gov.uk/oauth/token";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getFuelFinderToken(): Promise<string | null> {
  const clientId     = process.env.FUEL_FINDER_CLIENT_ID;
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  try {
    const body = new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         "fuelfinder.read",
    });

    const res = await fetch(FUEL_FINDER_AUTH, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const { access_token, expires_in } = await res.json();
    cachedToken = { value: access_token, expiresAt: Date.now() + (expires_in ?? 3600) * 1000 };
    return access_token;
  } catch {
    // Domain not yet publicly reachable — fail silently, fall back to open feeds
    return null;
  }
}

async function fetchFuelFinderPrices(lat: number, lng: number, radius: number): Promise<FuelStation[]> {
  const token = await getFuelFinderToken();
  if (!token) return [];

  try {
    const [unleadedRes, dieselRes] = await Promise.all([
      fetch(`${FUEL_FINDER_BASE}/prices?fuel_type=unleaded&lat=${lat}&lng=${lng}&radius=${radius}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${FUEL_FINDER_BASE}/prices?fuel_type=diesel&lat=${lat}&lng=${lng}&radius=${radius}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    const stationMap = new Map<string, FuelStation>();

    const processRes = async (res: Response, fuelKey: "petrol" | "diesel") => {
      if (!res.ok) return;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) return;
      const data = await res.json();
      const items: Record<string, unknown>[] =
        data.stations ?? data.results ?? data.data ?? (Array.isArray(data) ? data : []);

      for (const item of items) {
        const id      = String(item.id ?? item.site_id ?? "");
        const lat_s   = Number(item.lat ?? item.latitude  ?? (item.location as Record<string, unknown>)?.lat  ?? 0);
        const lng_s   = Number(item.lng ?? item.longitude ?? (item.location as Record<string, unknown>)?.lng  ?? 0);
        const price   = Number(item.price ?? item.ppl ?? item.priceInPence ?? 0);
        if (!lat_s || !lng_s || !price || !id) continue;

        if (stationMap.has(id)) {
          stationMap.get(id)!.prices[fuelKey] = price;
        } else {
          stationMap.set(id, {
            id:          `ff-${id}`,
            brand:       String(item.brand ?? item.retailer ?? "Unknown"),
            name:        String(item.name  ?? item.site_name ?? "Station"),
            address:     String(item.address ?? ""),
            postcode:    String(item.postcode ?? ""),
            lat:         lat_s,
            lng:         lng_s,
            prices:      { [fuelKey]: price },
            distance:    haversineDistance(lat, lng, lat_s, lng_s),
            lastUpdated: String(item.last_updated ?? ""),
          });
        }
      }
    };

    await Promise.all([processRes(unleadedRes, "petrol"), processRes(dieselRes, "diesel")]);
    return Array.from(stationMap.values()).filter((s) => s.prices.petrol || s.prices.diesel);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// CMA-mandated open feeds — no auth needed, live right now
// Price data: cache 15 min | Station data: cache 1 hour
// ---------------------------------------------------------------------------
async function fetchOpenFeeds(): Promise<FuelStation[]> {
  const results = await Promise.allSettled(
    FUEL_SOURCES.map(async (source) => {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "FuelPriceTracker/1.0" },
        next:    { revalidate: 900 }, // 15 minutes
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`${source.brand}: HTTP ${res.status}`);
      // Sainsbury's (and others) send JSON with content-type: text/plain — parse by text
      const text = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any;
      try { json = JSON.parse(text); }
      catch { throw new Error(`${source.brand}: non-JSON response`); }
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat    = parseFloat(searchParams.get("lat")    ?? "0");
  const lng    = parseFloat(searchParams.get("lng")    ?? "0");
  const radius = parseFloat(searchParams.get("radius") ?? "10");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const [finderStations, openStations] = await Promise.all([
    fetchFuelFinderPrices(lat, lng, radius),
    fetchOpenFeeds(),
  ]);

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
    source:   finderStations.length > 0 ? "fuel-finder+open-feeds" : "open-feeds",
  });
}
