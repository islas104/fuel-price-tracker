import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode")?.replace(/\s+/g, "");
  if (!postcode) {
    return NextResponse.json({ error: "postcode query param required" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
      {
        headers: { "User-Agent": "FuelPriceTracker/1.0" },
        signal: AbortSignal.timeout(5_000),
      }
    );
  } catch {
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Postcode not found" }, { status: 404 });
  }

  const data = await res.json();
  const { latitude, longitude } = data.result ?? {};

  if (!latitude || !longitude) {
    return NextResponse.json({ error: "Postcode not found" }, { status: 404 });
  }

  return NextResponse.json({ lat: latitude as number, lng: longitude as number });
}
