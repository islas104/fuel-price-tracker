# FuelFinder

FuelFinder is a live UK fuel price tracker that shows you the cheapest petrol and diesel stations near your current location. It pulls real-time prices directly from retailer feeds that are legally required to publish up-to-date pump prices under the UK Competition and Markets Authority (CMA) mandate, as well as the official government Fuel Finder API.

Open the app, allow location access, and instantly see every nearby station ranked by price — with an interactive map, savings comparisons, and one-tap directions.

![FuelFinder — list view](docs/UserInterface.png)

---

## How it works

1. **Location** — the browser requests your GPS coordinates. A fast network fix is returned immediately, then silently upgraded to a more accurate GPS fix in the background. You can also search by postcode.

2. **Price fetch** — your coordinates and chosen radius are sent to the `/api/fuel-prices` route. Each retailer feed has its own independent `unstable_cache` entry (15-minute TTL). All sources are fetched in parallel via `Promise.allSettled` so a broken feed never blocks the rest. The government Fuel Finder API uses OAuth 2.0 client credentials and is fetched and cached separately. Duplicate stations (e.g. the same BP forecourt appearing in both the BP feed and the MFG feed) are removed by deduplicating on lat/lng rounded to 4 decimal places (~11m).

3. **Filtering & ranking** — stations are filtered to your radius using the Haversine formula (distances in miles), sorted by distance, and capped at 200 results. The client re-sorts by price or distance as needed, so no cheap station within your radius gets cut off.

4. **Auto-refresh** — prices refresh automatically every 10 minutes while the tab is open. If you switch away and come back after the data has gone stale, a refresh triggers immediately on tab focus. A "X min ago" indicator and manual refresh button are shown in the header.

5. **Display** — the list view ranks stations cheapest-first with a savings badge showing how much more each station costs vs the cheapest. Each card shows a freshness label: precise timestamps where available ("Updated 3h ago"), or "Live" for sources that don't publish one. The map view renders colour-coded price labels for every brand.

---

## What it does

- Detects your location (or accepts a postcode) and finds all fuel stations within a chosen radius
- Shows live petrol and diesel prices, refreshed every 15 minutes server-side and every 10 minutes client-side
- Ranks stations cheapest to most expensive with savings comparisons (e.g. +2.1p vs cheapest)
- Shows per-card freshness: exact time since last price update, or "Live" when no timestamp is available
- Displays stations on an interactive map with brand-coloured price labels
- Switch between petrol and diesel, sort by price or distance, and adjust the radius from 2 to 30 miles
- One-tap Google Maps directions from any station
- Fully mobile-friendly with a bottom tab bar and safe-area insets for iPhone
- PWA-ready — installs to home screen, shows a branded offline page when there's no connection

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- npm (comes with Node.js)

### 1. Clone the repo

```bash
git clone https://github.com/islas104/fuel-price-tracker.git
cd fuel-price-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `FUEL_FINDER_CLIENT_ID` | Yes | OAuth client ID from the [Fuel Finder developer portal](https://www.developer.fuel-finder.service.gov.uk/public-api) |
| `FUEL_FINDER_CLIENT_SECRET` | Yes | OAuth client secret from the same portal |

The retailer JSON feeds (Asda, BP, Sainsbury's etc.) require no credentials.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser and allow location access when prompted.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) (App Router, server components, API routes) |
| Language | TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Map | [Leaflet](https://leafletjs.com) + [OpenStreetMap](https://openstreetmap.org) (dynamic import, SSR disabled) |
| Icons | [Lucide React](https://lucide.dev) |
| Caching | Next.js `unstable_cache` — survives serverless cold starts on Vercel |
| Data | UK CMA open retailer feeds + UK Government Fuel Finder API (OAuth 2.0) |
| Offline | Custom service worker — cache-first for static assets, offline fallback for navigation |

---

## Data sources

Prices are fetched server-side from CMA-mandated retailer feeds and the official government Fuel Finder API. UK law requires fuel retailers to publish their pump prices and update them within 30 minutes of any change.

| Source | Type | Approx. stations |
|---|---|---|
| UK Government Fuel Finder API | OAuth REST API | ~9,000+ (all participating retailers incl. Tesco) |
| Motor Fuel Group (MFG) | JSON feed | ~1,223 |
| Asda | JSON feed | ~650 |
| Jet | JSON feed | ~370 |
| Sainsbury's | JSON feed | ~320 |
| BP | JSON feed | ~300 |
| Rontec | JSON feed | ~265 |
| SGN Retail | JSON feed | ~150 |
| Ascona | JSON feed | ~60 |
| Moto | JSON feed | ~50 |

> Stations from overlapping feeds (e.g. the same BP forecourt in both the BP and MFG feeds) are deduplicated server-side on lat/lng, so the unique count is lower than the sum above.

**Retailers not included as direct feeds and why:**

| Retailer | Reason |
|---|---|
| Tesco | Akamai WAF blocks all server-side requests — now covered via the government Fuel Finder API instead. |
| Shell | HTTP 403 on all server-side requests — covered via the government Fuel Finder API. |
| Morrisons | Direct feed only ever returns one station — covered via the government Fuel Finder API. |
| Esso (direct) | Feed data is ~12 days stale. Esso-branded MFG sites are included via the MFG feed. |
| Karan Retail | Expired SSL certificate — fetch fails with `CERT_HAS_EXPIRED`. |
| Moto | Removed from the CMA participating retailers list on 08/04/2026. Feed URL left in as fallback while it still returns data. |

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── fuel-prices/route.ts        # Server route — fetches, caches, deduplicates, filters
│   │   └── geocode/route.ts            # Postcode → lat/lng via postcodes.io
│   ├── components/
│   │   ├── FuelMap.tsx                 # Leaflet map with brand-coloured markers + clustering
│   │   ├── StationCard.tsx             # Station row: price, savings, freshness, directions
│   │   ├── SkeletonCard.tsx            # Loading placeholder
│   │   └── ServiceWorkerRegistration.tsx  # Registers /sw.js on mount (client component)
│   ├── opengraph-image.tsx             # Auto-generated OG share image
│   ├── layout.tsx                      # Root layout, metadata, SW registration
│   ├── page.tsx                        # Main page — geolocation, state, list/map toggle
│   └── globals.css                     # Leaflet CSS + Tailwind + safe-area utilities
├── hooks/
│   ├── useFuelPrices.ts                # Fetch hook with debounce, auto-refresh, abort
│   └── useGeolocation.ts              # Two-stage GPS (coarse + accurate)
└── lib/
    ├── fuel-sources.ts                 # Feed URLs, FuelStation type, haversine, normaliseStation
    ├── fuel-finder-api.ts              # OAuth 2.0 client + paginated Fuel Finder API fetch
    └── brand-colors.ts                 # Brand → hex colour mapping for map markers
public/
├── sw.js                               # Service worker — offline fallback, static asset cache
├── offline.html                        # Branded offline page served when network unavailable
└── manifest.json                       # PWA manifest
```
