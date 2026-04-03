# FuelFinder

Live UK petrol and diesel prices near you. Built with Next.js 14, Leaflet maps, and real-time data from CMA-mandated open feeds (Asda, Sainsbury's, Jet).

## Features

- Live prices updated every 15–30 minutes direct from retailers
- Interactive map with price labels at each station
- Sort by cheapest price or nearest station
- Petrol and diesel toggle
- Adjustable search radius (2–30 km)
- Savings badge showing how much more each station costs vs the cheapest
- Works on mobile and desktop

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

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Allow location access when prompted — this is used to find stations near you. No data is stored or sent anywhere.

## Data sources

Prices are fetched server-side from retailer feeds mandated by the UK Competition and Markets Authority (CMA). Retailers are legally required to publish their pump prices and update them within 30 minutes of any change.

| Retailer | Stations | Update frequency |
|---|---|---|
| Asda | ~790 | Hourly |
| Sainsbury's | ~316 | Every few hours |
| Jet | ~11 | Hourly |

## Build for production

```bash
npm run build
npm start
```

## Deploy to Vercel

The easiest way to deploy is with [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Click Deploy — no environment variables needed

## Tech stack

- [Next.js 14](https://nextjs.org) — React framework with API routes
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Leaflet](https://leafletjs.com) / [React Leaflet](https://react-leaflet.js.org) — interactive map
- [Lucide React](https://lucide.dev) — icons
- [OpenStreetMap](https://openstreetmap.org) — map tiles
