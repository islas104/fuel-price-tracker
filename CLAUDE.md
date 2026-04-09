# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
npm start        # Start production server
```

There is no test suite. Verify changes by running `npm run dev` and interacting with the UI in a browser.

## Architecture

This is a Next.js 14 App Router app. The data flow is:

1. **[src/lib/fuel-sources.ts](src/lib/fuel-sources.ts)** — Defines `FUEL_SOURCES` (10 retailer feeds), the `FuelStation` type, and normalisation/parsing utilities (`normaliseStation`, `parseCsvRecords`, `haversineDistance`). Each source has its own schema; normalisation handles field-name variations across retailers.

2. **[src/app/api/fuel-prices/route.ts](src/app/api/fuel-prices/route.ts)** — Server-side GET handler. Fetches all sources in parallel via `Promise.allSettled()` (broken sources don't block others). Each source is independently cached for 15 min via `unstable_cache`. Deduplicates stations at the same physical location (~11m tolerance), filters by radius, caps at 50 results.

3. **[src/app/page.tsx](src/app/page.tsx)** — Client component. Manages geolocation (two-stage: fast coarse fix, then silent GPS upgrade), calls the API when location/radius changes (debounced 400ms), handles fuel type and sort toggles, renders list + map in dual-pane layout with mobile bottom tab bar.

4. **[src/app/components/FuelMap.tsx](src/app/components/FuelMap.tsx)** — Leaflet map. Lazy-loaded (no SSR). Uses `leaflet.markercluster` (clusters disabled at zoom 15+). Custom div icons show brand color + price. Retry logic for initialisation failures; calls `invalidateSize()` on mobile visibility toggle.

5. **[src/app/components/StationCard.tsx](src/app/components/StationCard.tsx)** — Station list row. Shows rank, brand, price, savings vs cheapest, last updated date (parses `DD/MM/YYYY`), and Google Maps directions link.

## Key Constraints

- **BP feed**: Requires a mobile User-Agent header or it returns an error. See `fetchSource()` in the API route.
- **Excluded sources**: Tesco (Akamai WAF), Shell (HTTP 403), Morrisons (returns 1 station), Esso direct (stale data), Karan Retail (expired SSL). Do not re-add without verifying they work server-side.
- **Leaflet**: Must be dynamically imported with `ssr: false`. The map component uses `useEffect` for all DOM interaction. Blank tile bug on mobile is fixed by `invalidateSize()` on visibility change.
- **Path alias**: `@/*` resolves to `./src/*` (configured in `tsconfig.json`).
- **CORS**: `next.config.mjs` adds CORS headers to all `/api/*` routes.
- **CSV source**: The Fuel Finder CSV is read from `public/downloads/` as a local file, not fetched over HTTP.

## Data Model

```ts
interface FuelStation {
  id: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lng: number;
  petrol: number | null;   // pence per litre
  diesel: number | null;   // pence per litre
  lastUpdated: string;     // DD/MM/YYYY
  distance: number;        // miles
}
```

Prices are stored as pence (e.g., `149.9`), displayed as-is with one decimal place.
