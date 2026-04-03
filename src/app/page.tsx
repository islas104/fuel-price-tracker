"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { FuelStation } from "@/lib/fuel-sources";
import StationCard from "./components/StationCard";
import SkeletonCard from "./components/SkeletonCard";
import {
  Fuel, LocateFixed, AlertCircle, Map, List,
  ChevronDown, ArrowUpDown, TrendingDown,
} from "lucide-react";

const FuelMap = dynamic(() => import("./components/FuelMap"), { ssr: false });

type FuelType = "petrol" | "diesel";
type SortBy   = "distance" | "price";
type View     = "list" | "map";

export default function Home() {
  const [location,      setLocation]      = useState<{ lat: number; lng: number } | null>(null);
  const [stations,      setStations]      = useState<FuelStation[]>([]);
  const [fuelType,      setFuelType]      = useState<FuelType>("petrol");
  const [sortBy,        setSortBy]        = useState<SortBy>("price");
  const [radius,        setRadius]        = useState(10);
  const [debouncedRadius, setDebouncedRadius] = useState(10);
  const [loading,       setLoading]       = useState(false);
  const [geoError,      setGeoError]      = useState<string | null>(null);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [mobileView,    setMobileView]    = useState<View>("list");
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce radius so fast changes don't fire multiple API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRadius(radius), 400);
    return () => clearTimeout(t);
  }, [radius]);

  const getLocation = useCallback(() => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError("Geolocation is not supported."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoError(`Location denied: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { getLocation(); }, [getLocation]);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/fuel-prices?lat=${location.lat}&lng=${location.lng}&radius=${debouncedRadius}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setStations(d.stations ?? []); })
      .catch((e) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [location, debouncedRadius]);

  const sorted = [...stations]
    .filter((s) => s.prices[fuelType] !== undefined)
    .sort((a, b) =>
      sortBy === "price"
        ? (a.prices[fuelType] ?? Infinity) - (b.prices[fuelType] ?? Infinity)
        : (a.distance ?? 0) - (b.distance ?? 0)
    );

  const cheapestPrice  = sorted[0]?.prices[fuelType];
  const cheapestDiesel = [...stations]
    .filter((s) => s.prices.diesel !== undefined)
    .sort((a, b) => (a.prices.diesel ?? Infinity) - (b.prices.diesel ?? Infinity))[0]?.prices.diesel;
  const cheapestPetrol = [...stations]
    .filter((s) => s.prices.petrol !== undefined)
    .sort((a, b) => (a.prices.petrol ?? Infinity) - (b.prices.petrol ?? Infinity))[0]?.prices.petrol;

  const handleSelectStation = useCallback((id: string) => {
    setSelectedId(id);
    setMobileView("list");
    setTimeout(() => {
      document.getElementById(`station-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="bg-slate-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center">
            <Fuel size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">FuelFinder</h1>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Live UK prices</p>
          </div>
        </div>
        <button
          onClick={getLocation}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <LocateFixed size={13} />
          {location ? "Re-locate" : "Use my location"}
        </button>
      </header>

      {/* ── Stats bar ── */}
      {!loading && (cheapestPetrol || cheapestDiesel) && (
        <div className="bg-slate-800 px-4 py-2 flex gap-4 flex-shrink-0">
          {cheapestPetrol && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-slate-400">Petrol from</span>
              <span className="text-sm font-bold text-blue-400">{cheapestPetrol.toFixed(1)}p</span>
            </div>
          )}
          {cheapestDiesel && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-slate-400">Diesel from</span>
              <span className="text-sm font-bold text-amber-400">{cheapestDiesel.toFixed(1)}p</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
            <span>{sorted.length} stations</span>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-2 flex-shrink-0 flex-wrap">
        {/* Fuel type */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 p-0.5 bg-gray-50">
          {(["petrol", "diesel"] as FuelType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFuelType(type)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 capitalize ${
                fuelType === type
                  ? type === "petrol"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-amber-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Sort */}
        <button
          onClick={() => setSortBy(sortBy === "price" ? "distance" : "price")}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <ArrowUpDown size={12} />
          {sortBy === "price" ? "Cheapest first" : "Nearest first"}
        </button>

        {/* Radius */}
        <div className="relative flex items-center ml-auto">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="appearance-none text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 pl-3 pr-7 py-1.5 rounded-xl cursor-pointer transition-colors focus:outline-none"
          >
            {[2, 5, 10, 20, 30].map((r) => (
              <option key={r} value={r}>{r} km radius</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 text-gray-400 pointer-events-none" />
        </div>

        {/* Mobile map/list toggle */}
        <div className="flex md:hidden rounded-xl overflow-hidden border border-gray-200 p-0.5 bg-gray-50">
          <button
            onClick={() => setMobileView("list")}
            className={`px-3 py-1.5 rounded-lg transition-all text-xs font-medium flex items-center gap-1 ${mobileView === "list" ? "bg-white shadow-sm text-gray-800" : "text-gray-400"}`}
          >
            <List size={12} /> List
          </button>
          <button
            onClick={() => setMobileView("map")}
            className={`px-3 py-1.5 rounded-lg transition-all text-xs font-medium flex items-center gap-1 ${mobileView === "map" ? "bg-white shadow-sm text-gray-800" : "text-gray-400"}`}
          >
            <Map size={12} /> Map
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map — desktop always visible, mobile conditional */}
        <div className={`${mobileView === "map" ? "flex" : "hidden"} md:flex w-full md:w-1/2 lg:w-3/5 p-3 flex-shrink-0`}>
          {location ? (
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200">
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
            <div className="w-full h-full rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center">
                <Map size={22} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">Waiting for location…</p>
            </div>
          )}
        </div>

        {/* Station list — desktop always visible, mobile conditional */}
        <div
          ref={listRef}
          className={`${mobileView === "list" ? "flex" : "hidden"} md:flex flex-col flex-1 overflow-y-auto`}
        >
          <div className="p-3 space-y-2">
            {/* Errors */}
            {geoError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2 text-red-600 text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Location unavailable</p>
                  <p className="text-xs text-red-400 mt-0.5">{geoError}</p>
                </div>
              </div>
            )}
            {fetchError && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2 text-amber-600 text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Couldn&apos;t load prices</p>
                  <p className="text-xs text-amber-500 mt-0.5">{fetchError}</p>
                </div>
              </div>
            )}

            {/* Skeletons while loading */}
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

            {/* Empty state */}
            {!loading && !geoError && sorted.length === 0 && location && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <TrendingDown size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No stations found</p>
                <p className="text-xs text-gray-300">Try increasing the radius</p>
              </div>
            )}

            {/* Waiting for location */}
            {!location && !geoError && !loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <LocateFixed size={24} className="text-blue-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">Allow location access</p>
                <p className="text-xs text-gray-300 text-center px-8">
                  We need your location to find fuel stations near you
                </p>
                <button
                  onClick={getLocation}
                  className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-xl transition-colors"
                >
                  Allow location
                </button>
              </div>
            )}

            {/* Station cards */}
            {!loading && sorted.map((station, i) => (
              <div key={station.id} id={`station-${station.id}`}>
                <StationCard
                  station={station}
                  rank={i + 1}
                  fuelType={fuelType}
                  isSelected={selectedId === station.id}
                  onSelect={() => handleSelectStation(station.id)}
                  cheapestPrice={cheapestPrice}
                />
              </div>
            ))}

            {/* Bottom padding */}
            {sorted.length > 0 && <div className="h-4" />}
          </div>
        </div>
      </div>
    </div>
  );
}
