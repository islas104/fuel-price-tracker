"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { FuelStation } from "@/lib/fuel-sources";
import StationCard from "./components/StationCard";
import { Fuel, Loader2, LocateFixed, AlertCircle, SlidersHorizontal } from "lucide-react";

const FuelMap = dynamic(() => import("./components/FuelMap"), { ssr: false });

type FuelType = "petrol" | "diesel";
type SortBy = "distance" | "price";

export default function Home() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [fuelType, setFuelType] = useState<FuelType>("petrol");
  const [sortBy, setSortBy] = useState<SortBy>("price");
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const getLocation = useCallback(() => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setGeoError(`Location access denied: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/fuel-prices?lat=${location.lat}&lng=${location.lng}&radius=${radius}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStations(data.stations ?? []);
      })
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [location, radius]);

  const sorted = [...stations]
    .filter((s) => s.prices[fuelType] !== undefined)
    .sort((a, b) => {
      if (sortBy === "price") {
        return (a.prices[fuelType] ?? Infinity) - (b.prices[fuelType] ?? Infinity);
      }
      return (a.distance ?? 0) - (b.distance ?? 0);
    });

  const cheapest = sorted[0]?.prices[fuelType];

  const handleSelectStation = useCallback((id: string) => {
    setSelectedId(id);
    // Scroll card into view
    setTimeout(() => {
      const el = document.getElementById(`station-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Fuel className="text-blue-600" size={24} />
          <h1 className="text-lg font-bold text-gray-900">Fuel Price Tracker</h1>
        </div>
        {location && (
          <button
            onClick={getLocation}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <LocateFixed size={16} />
            Re-locate
          </button>
        )}
      </header>

      {/* Controls */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex flex-wrap items-center gap-3 flex-shrink-0">
        {/* Fuel type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          <button
            onClick={() => setFuelType("petrol")}
            className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
              fuelType === "petrol"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Petrol
          </button>
          <button
            onClick={() => setFuelType("diesel")}
            className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
              fuelType === "diesel"
                ? "bg-yellow-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Diesel
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <SlidersHorizontal size={14} />
          <span>Sort:</span>
          <button
            onClick={() => setSortBy("price")}
            className={`px-2.5 py-1 rounded ${sortBy === "price" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"} text-sm font-medium`}
          >
            Cheapest
          </button>
          <button
            onClick={() => setSortBy("distance")}
            className={`px-2.5 py-1 rounded ${sortBy === "distance" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"} text-sm font-medium`}
          >
            Nearest
          </button>
        </div>

        {/* Radius */}
        <div className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
          <span>Radius:</span>
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="border border-gray-200 rounded px-2 py-1 text-sm"
          >
            {[2, 5, 10, 20, 30].map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </select>
        </div>
      </div>

      {/* Body: Map + List */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="hidden md:block w-1/2 lg:w-3/5 p-3 flex-shrink-0">
          {location ? (
            <div className="w-full h-full rounded-xl overflow-hidden shadow-sm border border-gray-200">
              <FuelMap
                userLat={location.lat}
                userLng={location.lng}
                stations={sorted}
                fuelType={fuelType}
                selectedId={selectedId}
                onSelectStation={handleSelectStation}
              />
            </div>
          ) : (
            <div className="w-full h-full rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
              Waiting for location…
            </div>
          )}
        </div>

        {/* Station list */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Summary bar */}
          {cheapest && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-green-700 font-medium">
                Cheapest {fuelType} nearby
              </span>
              <span className="text-xl font-bold text-green-700">
                {(cheapest / 10).toFixed(1)}p/L
              </span>
            </div>
          )}

          {/* Errors */}
          {geoError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-red-700 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {geoError}
            </div>
          )}
          {fetchError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 text-amber-700 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {fetchError}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm">Fetching live prices…</p>
            </div>
          )}

          {/* No results */}
          {!loading && !geoError && sorted.length === 0 && location && (
            <div className="text-center py-20 text-gray-400 text-sm">
              No {fuelType} stations found within {radius} km. Try increasing the radius.
            </div>
          )}

          {/* Station cards */}
          {!loading &&
            sorted.map((station, i) => (
              <div key={station.id} id={`station-${station.id}`}>
                <StationCard
                  station={station}
                  rank={i + 1}
                  fuelType={fuelType}
                  isSelected={selectedId === station.id}
                  onSelect={() => handleSelectStation(station.id)}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
