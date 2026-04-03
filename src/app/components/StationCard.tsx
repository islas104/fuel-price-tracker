"use client";
import { FuelStation } from "@/lib/fuel-sources";
import { MapPin, Navigation } from "lucide-react";

const BRAND_COLORS: Record<string, string> = {
  Asda: "bg-green-600",
  Morrisons: "bg-yellow-500",
  Tesco: "bg-red-600",
  Sainsburys: "bg-orange-500",
  Jet: "bg-red-500",
  Applegreen: "bg-green-700",
};

interface Props {
  station: FuelStation;
  rank: number;
  fuelType: "petrol" | "diesel";
  isSelected: boolean;
  onSelect: () => void;
}

export default function StationCard({ station, rank, fuelType, isSelected, onSelect }: Props) {
  const price = station.prices[fuelType];
  const brandColor = BRAND_COLORS[station.brand] ?? "bg-gray-600";

  const openMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`,
      "_blank"
    );
  };

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Rank badge */}
          <div
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              rank === 1 ? "bg-green-500" : rank === 2 ? "bg-blue-500" : "bg-gray-400"
            }`}
          >
            {rank}
          </div>
          {/* Brand pill */}
          <span
            className={`flex-shrink-0 px-2 py-0.5 rounded text-white text-xs font-semibold ${brandColor}`}
          >
            {station.brand}
          </span>
          {/* Name */}
          <p className="text-sm font-medium text-gray-800 truncate">{station.name}</p>
        </div>

        {/* Price */}
        {price ? (
          <div className="flex-shrink-0 text-right">
            <span className="text-2xl font-bold text-gray-900">
              {price.toFixed(1)}
            </span>
            <span className="text-xs text-gray-500">p/L</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">N/A</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1 truncate">
          <MapPin size={12} />
          <span className="truncate">
            {station.address}
            {station.postcode ? ` · ${station.postcode}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="font-medium">{station.distance?.toFixed(1)} km</span>
          <button
            onClick={openMaps}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
          >
            <Navigation size={12} />
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
