import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  FUEL_SOURCES,
  FuelStation,
  haversineDistance,
  normaliseStation,
} from "@/lib/fuel-sources";

export const runtime = "nodejs";

// Fetch and normalise all stations from every retailer feed.
// unstable_cache persists this on Vercel's shared cache infrastructure
// (survives across serverless function instances) and revalidates every 15 min.
const getAllStations = unstable_cache(
  async (): Promise<FuelStation[]> => {
    const results = await Promise.allSettled(
      FUEL_SOURCES.map(async (source) => {
        const scraperKey = process.env.SCRAPER_API_KEY;
        const fetchUrl = source.scraperApi && scraperKey
          ? `https://api.scraperapi.com/?api_key=${scraperKey}&url=${encodeURIComponent(source.url)}`
          : source.url;

        const res = await fetch(fetchUrl, {
          headers: {
            "User-Agent": source.mobileUA
              ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
              : "FuelPriceTracker/1.0",
            "Accept": "application/json, text/plain, */*",
          },
          signal: AbortSignal.timeout(30_000), // ScraperAPI needs more time
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

    return results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (r as PromiseFulfilledResult<FuelStation[]>).value);
  },
  ["fuel-stations"],
  { revalidate: 900 } // 15 minutes
);

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
    .sort((a, b)  => a.distance - b.distance);

  return NextResponse.json(
    { stations: nearby, count: nearby.length },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
  );
}
