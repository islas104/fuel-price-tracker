import { NextRequest, NextResponse } from "next/server";
import {
  FUEL_SOURCES,
  FuelStation,
  haversineDistance,
  normaliseStation,
} from "@/lib/fuel-sources";

export const runtime = "edge";
export const revalidate = 1800; // cache 30 mins

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat  = parseFloat(searchParams.get("lat")    ?? "0");
  const lng  = parseFloat(searchParams.get("lng")    ?? "0");
  const radius = parseFloat(searchParams.get("radius") ?? "10");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    FUEL_SOURCES.map(async (source) => {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "FuelPriceTracker/1.0" },
        next: { revalidate: 1800 },
      });
      if (!res.ok) throw new Error(`${source.brand}: HTTP ${res.status}`);
      const json = await res.json();

      const raw: unknown[] =
        json.stations ?? json.sites ?? json.data ?? json.results ??
        (Array.isArray(json) ? json : []);

      return raw
        .map((s) => normaliseStation(source.brand, s))
        .filter((s): s is FuelStation => s !== null);
    })
  );

  const allStations: FuelStation[] = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<FuelStation[]>).value)
    .map((s) => ({ ...s, distance: haversineDistance(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  return NextResponse.json({ stations: allStations, count: allStations.length });
}
