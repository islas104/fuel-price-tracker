import { NextRequest, NextResponse } from "next/server";
import {
  FUEL_SOURCES,
  FuelStation,
  haversineDistance,
  normaliseStation,
} from "@/lib/fuel-sources";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Server-side in-memory cache
// Stores ALL normalised stations so concurrent requests share one fetch.
// Expires after 15 minutes — radius filtering happens per-request in memory.
// ---------------------------------------------------------------------------
interface StationCache {
  stations:  FuelStation[];
  fetchedAt: number;
}

let cache: StationCache | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-flight promise deduplication — if a fetch is already running, wait for it
// instead of firing a second one (thundering herd protection).
let inflightFetch: Promise<FuelStation[]> | null = null;

async function getAllStations(): Promise<FuelStation[]> {
  // Return cache if still fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.stations;
  }

  // Deduplicate concurrent requests
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    const results = await Promise.allSettled(
      FUEL_SOURCES.map(async (source) => {
        const res = await fetch(source.url, {
          headers: { "User-Agent": "FuelPriceTracker/1.0" },
          signal:  AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`${source.brand}: HTTP ${res.status}`);

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

    const stations = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (r as PromiseFulfilledResult<FuelStation[]>).value);

    cache = { stations, fetchedAt: Date.now() };
    inflightFetch = null;
    return stations;
  })();

  return inflightFetch;
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

  const all = await getAllStations();

  const nearby = all
    .map((s)  => ({ ...s, distance: haversineDistance(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  const age = cache ? Math.floor((Date.now() - cache.fetchedAt) / 1000) : 0;
  const maxAge = Math.max(0, CACHE_TTL_MS / 1000 - age);

  return NextResponse.json(
    { stations: nearby, count: nearby.length },
    {
      headers: {
        // Tell the browser to cache for however long is left on the server cache
        "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=60`,
      },
    }
  );
}
