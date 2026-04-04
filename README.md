# FuelFinder

FuelFinder is a live UK fuel price tracker that shows you the cheapest petrol and diesel stations near your current location. It pulls real-time prices directly from retailer feeds that are legally required to publish up-to-date pump prices under the UK Competition and Markets Authority (CMA) mandate.

Open the app, allow location access, and instantly see every nearby station ranked by price — with an interactive map, savings comparisons, and one-tap directions.

![FuelFinder — list view](docs/Ui.png)

---

## What it does

- Detects your location and finds all fuel stations within a set radius
- Shows live petrol and diesel prices updated every 15–30 minutes
- Ranks stations from cheapest to most expensive
- Highlights the cheapest station nearby and shows how much more expensive each other station is (e.g. +2.1p vs cheapest)
- Displays stations on an interactive map with price labels
- Lets you switch between petrol and diesel, sort by price or distance, and adjust the search radius from 2 to 30 miles
- Works on both mobile and desktop

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

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser and allow location access when prompted. No API keys or accounts required — it works out of the box.

---

## Data sources

Prices are fetched server-side from CMA-mandated retailer feeds. UK law requires fuel retailers to publish their pump prices and update them within 30 minutes of any change.

| Retailer | Stations |
|---|---|
| Motor Fuel Group (MFG) | ~1,223 |
| Asda | ~650 |
| BP | ~300 |
| Sainsbury's | ~320 |
| Rontec | ~265 |
| SGN Retail | ~150 |
| Jet | ~370 |
| Moto | ~50 |
| Ascona | ~60 |

---

## Build for production

```bash
npm run build
npm start
```

---

## Tech stack

| | |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Map | [Leaflet](https://leafletjs.com) + [OpenStreetMap](https://openstreetmap.org) |
| Icons | [Lucide React](https://lucide.dev) |
| Data | UK CMA open retailer feeds |
