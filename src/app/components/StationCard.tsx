"use client";
import { FuelStation } from "@/lib/fuel-sources";
import { MapPin, Navigation, TrendingDown } from "lucide-react";

const BRAND_COLORS: Record<string, { bg: string; text: string }> = {
  Asda:          { bg: "bg-green-600",  text: "text-white" },
  Morrisons:     { bg: "bg-yellow-500", text: "text-white" },
  Tesco:         { bg: "bg-red-600",    text: "text-white" },
  Sainsburys:    { bg: "bg-orange-500", text: "text-white" },
  "Sainsbury's": { bg: "bg-orange-500", text: "text-white" },
  Jet:           { bg: "bg-red-700",    text: "text-white" },
  Applegreen:    { bg: "bg-green-700",  text: "text-white" },
  BP:            { bg: "bg-green-800",  text: "text-white" },
  Ascona:        { bg: "bg-blue-700",   text: "text-white" },
  Gulf:          { bg: "bg-orange-600", text: "text-white" },
  Texaco:        { bg: "bg-red-600",    text: "text-white" },
};

interface Props {
  station: FuelStation;
  rank: number;
  fuelType: "petrol" | "diesel";
  isSelected: boolean;
  onSelect: () => void;
  cheapestPrice?: number;
}

export default function StationCard({ station, rank, fuelType, isSelected, onSelect, cheapestPrice }: Props) {
  const price  = station.prices[fuelType];
  const brand  = BRAND_COLORS[station.brand] ?? { bg: "bg-slate-600", text: "text-white" };
  const isCheapest = rank === 1;
  const savings = price && cheapestPrice && price > cheapestPrice
    ? (price - cheapestPrice).toFixed(1) : null;

  const openMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`, "_blank");
  };

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-2xl border transition-all duration-200 overflow-hidden active:scale-[0.99] ${
        isSelected
          ? "border-blue-400 shadow-lg shadow-blue-100 bg-white"
          : "border-gray-100 bg-white hover:border-gray-300 hover:shadow-md"
      }`}
    >
      {/* Cheapest banner */}
      {isCheapest && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 flex items-center gap-1.5">
          <TrendingDown size={13} className="text-white" />
          <span className="text-xs font-bold text-white tracking-wide uppercase">Cheapest nearby</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Rank */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
              rank === 1 ? "bg-green-100 text-green-700" :
              rank === 2 ? "bg-blue-100 text-blue-700" :
              rank === 3 ? "bg-orange-100 text-orange-700" :
              "bg-gray-100 text-gray-400"
            }`}>
              {rank}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${brand.bg} ${brand.text}`}>
                  {station.brand}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{station.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin size={10} className="text-gray-300 flex-shrink-0" />
                <span className="text-xs text-gray-400 truncate">
                  {station.address}{station.postcode ? `, ${station.postcode}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Right — price + actions */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {price ? (
              <div className="flex items-baseline gap-0.5">
                <span className={`text-2xl font-black tabular-nums ${isCheapest ? "text-green-600" : "text-gray-900"}`}>
                  {price.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400 font-medium">p/L</span>
              </div>
            ) : (
              <span className="text-sm text-gray-300">N/A</span>
            )}
            {savings && (
              <span className="text-xs text-red-400 font-semibold">+{savings}p</span>
            )}
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="text-xs text-gray-400">{station.distance?.toFixed(1)} km</span>
              <button
                onClick={openMaps}
                className="flex items-center gap-1 text-xs font-bold text-blue-500 active:text-blue-700 py-1 px-2 -mr-1 rounded-lg active:bg-blue-50 transition-colors"
              >
                <Navigation size={11} />
                Go
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
