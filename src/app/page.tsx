"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { FuelStation } from "@/lib/fuel-sources";
import StationCard from "./components/StationCard";
import SkeletonCard from "./components/SkeletonCard";
import {
  Fuel, LocateFixed, AlertCircle, MapIcon, ListIcon,
  ArrowUpDown, TrendingDown, ChevronDown,
} from "lucide-react";

const FuelMap = dynamic(() => import("./components/FuelMap"), { ssr: false });

type FuelType = "petrol" | "diesel";
type SortBy   = "distance" | "price";
type View     = "list" | "map";

export default function Home() {
  const [location,        setLocation]        = useState<{ lat: number; lng: number } | null>(null);
  const [stations,        setStations]        = useState<FuelStation[]>([]);
  const [fuelType,        setFuelType]        = useState<FuelType>("petrol");
  const [sortBy,          setSortBy]          = useState<SortBy>("price");
  const [radius,          setRadius]          = useState(10);
  const [debouncedRadius, setDebouncedRadius] = useState(10);
  const [loading,         setLoading]         = useState(false);
  const [geoError,        setGeoError]        = useState<string | null>(null);
  const [fetchError,      setFetchError]      = useState<string | null>(null);
  const [selectedId,      setSelectedId]      = useState<string | null>(null);
  const [mobileView,      setMobileView]      = useState<View>("list");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRadius(radius), 400);
    return () => clearTimeout(t);
  }, [radius]);

  const getLocation = useCallback(() => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
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
  const cheapestPetrol = [...stations].filter((s) => s.prices.petrol).sort((a, b) => (a.prices.petrol ?? Infinity) - (b.prices.petrol ?? Infinity))[0]?.prices.petrol;
  const cheapestDiesel = [...stations].filter((s) => s.prices.diesel).sort((a, b) => (a.prices.diesel ?? Infinity) - (b.prices.diesel ?? Infinity))[0]?.prices.diesel;

  const handleSelectStation = useCallback((id: string) => {
    setSelectedId(id);
    setMobileView("list");
    setTimeout(() => {
      document.getElementById(`station-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-slate-900 px-4 flex items-center justify-between flex-shrink-0 h-14 pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
            <Fuel size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">FuelFinder</p>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Live UK prices</p>
          </div>
        </div>

        {/* Stat pills — desktop only */}
        {!loading && (cheapestPetrol || cheapestDiesel) && (
          <div className="hidden md:flex items-center gap-4">
            {cheapestPetrol && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-xs text-slate-400">Petrol</span>
                <span className="text-sm font-bold text-blue-400">{cheapestPetrol.toFixed(1)}p</span>
              </div>
            )}
            {cheapestDiesel && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-xs text-slate-400">Diesel</span>
                <span className="text-sm font-bold text-amber-400">{cheapestDiesel.toFixed(1)}p</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={getLocation}
          className="flex items-center gap-1.5 bg-slate-800 active:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-xl transition-colors min-h-[36px]"
        >
          <LocateFixed size={13} />
          <span className="hidden sm:inline">{location ? "Re-locate" : "Locate me"}</span>
        </button>
      </header>

      {/* ── Mobile stats strip ── */}
      {!loading && (cheapestPetrol || cheapestDiesel) && (
        <div className="md:hidden bg-slate-800 px-4 py-2 flex items-center gap-4 flex-shrink-0">
          {cheapestPetrol && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-slate-400">Petrol from</span>
              <span className="text-sm font-bold text-blue-400">{cheapestPetrol.toFixed(1)}p</span>
            </div>
          )}
          {cheapestDiesel && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-slate-400">Diesel from</span>
              <span className="text-sm font-bold text-amber-400">{cheapestDiesel.toFixed(1)}p</span>
            </div>
          )}
          <span className="ml-auto text-xs text-slate-600">{sorted.length} stations</span>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center gap-2 flex-shrink-0">
        {/* Fuel type toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 p-0.5 bg-gray-50 flex-shrink-0">
          {(["petrol", "diesel"] as FuelType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFuelType(type)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all capitalize min-h-[36px] ${
                fuelType === type
                  ? type === "petrol" ? "bg-blue-600 text-white shadow-sm" : "bg-amber-500 text-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Sort toggle */}
        <button
          onClick={() => setSortBy(s => s === "price" ? "distance" : "price")}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl min-h-[36px] flex-shrink-0 active:bg-gray-100 transition-colors"
        >
          <ArrowUpDown size={12} />
          <span className="hidden sm:inline">{sortBy === "price" ? "Cheapest" : "Nearest"}</span>
        </button>

        {/* Radius */}
        <div className="relative flex-shrink-0 ml-auto">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="appearance-none text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 pl-3 pr-7 py-2 rounded-xl cursor-pointer focus:outline-none min-h-[36px]"
          >
            {[2, 5, 10, 20, 30].map((r) => (
              <option key={r} value={r}>{r} km</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map — full width on mobile when active, 60% on desktop */}
        <div className={`${mobileView === "map" ? "flex flex-1" : "hidden"} md:flex md:flex-none md:w-1/2 lg:w-3/5 flex-col p-2.5`}>
          {location ? (
            <div className="flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
              <FuelMap
                userLat={location.lat}
                userLng={location.lng}
                stations={sorted}
                fuelType={fuelType}
                selectedId={selectedId}
                onSelectStation={handleSelectStation}
                isVisible={mobileView === "map"}
              />
            </div>
          ) : (
            <div className="flex-1 rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center">
                <MapIcon size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Waiting for location</p>
            </div>
          )}
        </div>

        {/* Station list */}
        <div
          ref={listRef}
          className={`${mobileView === "list" ? "flex" : "hidden"} md:flex flex-col flex-1 overflow-y-auto`}
        >
          <div className="p-3 space-y-2.5">

            {/* Errors */}
            {geoError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-600">Location unavailable</p>
                  <p className="text-xs text-red-400 mt-0.5">{geoError}</p>
                  <button onClick={getLocation} className="mt-2 text-xs font-bold text-red-600 underline">
                    Try again
                  </button>
                </div>
              </div>
            )}
            {fetchError && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-600">Couldn&apos;t load prices</p>
                  <p className="text-xs text-amber-500 mt-0.5">{fetchError}</p>
                </div>
              </div>
            )}

            {/* Skeletons */}
            {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

            {/* Waiting for location */}
            {!location && !geoError && !loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 px-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <LocateFixed size={28} className="text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-gray-700">Find fuel near you</p>
                  <p className="text-sm text-gray-400 mt-1">Allow location access to see live prices at stations nearby</p>
                </div>
                <button
                  onClick={getLocation}
                  className="bg-blue-600 active:bg-blue-700 text-white text-sm font-bold px-6 py-3 rounded-2xl transition-colors min-h-[48px] w-full max-w-xs"
                >
                  Allow location
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !geoError && sorted.length === 0 && location && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <TrendingDown size={26} className="text-gray-300" />
                </div>
                <p className="text-base font-bold text-gray-500">No stations found</p>
                <p className="text-sm text-gray-400">Try a larger radius</p>
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

            {/* Bottom padding — clears mobile tab bar */}
            <div className="h-20 md:h-4" />
          </div>
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe flex-shrink-0">
        <div className="flex">
          <button
            onClick={() => setMobileView("list")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors min-h-[56px] ${
              mobileView === "list" ? "text-blue-600" : "text-gray-400"
            }`}
          >
            <ListIcon size={20} />
            <span className="text-[10px] font-semibold">Prices</span>
          </button>
          <button
            onClick={() => setMobileView("map")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors min-h-[56px] ${
              mobileView === "map" ? "text-blue-600" : "text-gray-400"
            }`}
          >
            <MapIcon size={20} />
            <span className="text-[10px] font-semibold">Map</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
