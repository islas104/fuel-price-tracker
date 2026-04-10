import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  FUEL_SOURCES,
  FuelStation,
  haversineDistance,
  normaliseStation,
  parseCsvRecords,
} from "@/lib/fuel-sources";
import { fetchFuelFinderStations } from "@/lib/fuel-finder-api";

export const runtime = "nodejs";

// Each source is cached independently.
// Previously one shared cache meant a single expired entry forced all 9 sources
// to refetch simultaneously. Now only the stale source re-fetches — the rest
// are served instantly from their own warm cache entries.
const fetchSource = unstable_cache(
  async (
    url: string,
    brand: string,
    mobileUA: boolean,
    format: "json" | "csv",
  ): Promise<FuelStation[]> => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": mobileUA
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          : "FuelPriceTracker/1.0",
        "Accept": "application/json, text/plain, */*",
      },
      signal: AbortSignal.timeout(5_000), // 5s — fail fast, most feeds respond in <1s
    });
    if (!res.ok) throw new Error(`${brand}: HTTP ${res.status}`);
    const text = await res.text();

    let raw: unknown[];
    if (format === "csv") {
      raw = parseCsvRecords(text);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any;
      try { json = JSON.parse(text); }
      catch { throw new Error(`${brand}: non-JSON response`); }

      raw =
        json.stations ?? json.sites ?? json.data ?? json.results ??
        (Array.isArray(json) ? json : []);
    }

    return raw
      .map((s) => normaliseStation(brand, s))
      .filter((s): s is FuelStation => s !== null);
  },
  ["fuel-source"], // Next.js appends the function args to form a unique key per source
  { revalidate: 900 } // 15 minutes per source
);

// Fuel Finder API — cached separately from the retailer feeds.
// The API fetch involves OAuth + pagination so it gets its own cache entry.
const fetchFuelFinderCached = unstable_cache(
  fetchFuelFinderStations,
  ["fuel-finder-api"],
  { revalidate: 900 } // 15 minutes
);

// Remove stations at the same physical location (within ~11m, 4 d.p.).
// BP's own feed and MFG both publish BP-branded forecourts — without this
// the same forecourt appears twice in the results. Keeps the record with
// the most complete price data.
function deduplicateStations(stations: FuelStation[]): FuelStation[] {
  const seen = new Map<string, FuelStation>();
  for (const station of stations) {
    const key = `${station.lat.toFixed(4)},${station.lng.toFixed(4)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, station);
    } else {
      const existingCount = Object.values(existing.prices).filter(Boolean).length;
      const newCount      = Object.values(station.prices).filter(Boolean).length;
      if (newCount > existingCount) seen.set(key, station);
    }
  }
  return Array.from(seen.values());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat    = parseFloat(searchParams.get("lat")    ?? "0");
  const lng    = parseFloat(searchParams.get("lng")    ?? "0");
  const radius = Math.min(parseFloat(searchParams.get("radius") ?? "10"), 30);
  // 200 stations — large enough that price-sorting on the client never misses
  // a cheaper station that distance-sorting would have pushed out of a 50-cap.
  const limit  = Math.min(parseInt(searchParams.get("limit")   ?? "200", 10), 200);

  const inUK = lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2;
  if (!lat || !lng || !inUK) {
    return NextResponse.json({ error: "lat and lng must be valid UK coordinates" }, { status: 400 });
  }

  // Retailer feeds + Fuel Finder API all fetched in parallel from their own caches
  const [retailerResults, fuelFinderResult] = await Promise.all([
    Promise.allSettled(
      FUEL_SOURCES.map((s) => fetchSource(s.url, s.brand, s.mobileUA, s.format))
    ),
    fetchFuelFinderCached().then(
      (stations) => ({ status: "fulfilled" as const, value: stations }),
      (err: Error) => ({ status: "rejected" as const, reason: err }),
    ),
  ]);

  const sourceErrors: string[] = [];
  const allStations: FuelStation[] = [];

  retailerResults.forEach((result, i) => {
    const source = FUEL_SOURCES[i];
    if (result.status === "fulfilled") {
      // Warn if Moto returns 0 stations — it was removed from the CMA list on 08/04/2026
      if (source.brand === "Moto" && result.value.length === 0) {
        console.warn("[fuel-prices] Moto returned 0 stations — feed may be defunct");
      }
      allStations.push(...result.value);
    } else {
      const msg = `${source.brand}: ${(result.reason as Error)?.message ?? "unknown error"}`;
      sourceErrors.push(msg);
      console.warn(`[fuel-prices] ${msg}`);
    }
  });

  if (fuelFinderResult.status === "fulfilled") {
    allStations.push(...fuelFinderResult.value);
  } else {
    const msg = `Fuel Finder API: ${(fuelFinderResult.reason as Error)?.message ?? "unknown error"}`;
    sourceErrors.push(msg);
    console.warn(`[fuel-prices] ${msg}`);
  }

  const all = deduplicateStations(allStations);

  const nearby = all
    .map((s)  => ({ ...s, distance: haversineDistance(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distance <= radius)
    .sort((a, b)  => a.distance - b.distance)
    .slice(0, limit);

  const succeededCount =
    retailerResults.filter((r) => r.status === "fulfilled").length +
    (fuelFinderResult.status === "fulfilled" ? 1 : 0);

  return NextResponse.json(
    {
      stations: nearby,
      count: nearby.length,
      sources: {
        succeeded: succeededCount,
        failed: sourceErrors.length,
        errors: sourceErrors,
      },
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
  );
}
