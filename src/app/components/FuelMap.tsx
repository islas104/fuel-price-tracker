"use client";
import { useEffect, useRef } from "react";
import { FuelStation } from "@/lib/fuel-sources";

interface Props {
  userLat: number;
  userLng: number;
  stations: FuelStation[];
  fuelType: "petrol" | "diesel";
  selectedId: string | null;
  onSelectStation: (id: string) => void;
  isVisible: boolean;
}

const BRAND_COLORS: Record<string, string> = {
  Asda:          "#16a34a",
  Morrisons:     "#eab308",
  Tesco:         "#e2001a",
  Sainsburys:    "#f97316",
  "Sainsbury's": "#f97316",
  Jet:           "#ef4444",
  Applegreen:    "#15803d",
  BP:            "#006B3F",
  Ascona:        "#1d4ed8",
  Gulf:          "#f97316",
  Texaco:        "#dc2626",
  MFG:           "#4338ca",
  Rontec:        "#0e7490",
  Moto:          "#eab308",
  SGN:           "#7e22ce",
};

export default function FuelMap({ userLat, userLng, stations, fuelType, selectedId, onSelectStation, isVisible }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef     = useRef<any[]>([]);

  // Initialise map once — cleanup on unmount so React strict mode doesn't double-init
  useEffect(() => {
    if (!mapRef.current) return;

    let destroyed = false;

    import("leaflet").then((L) => {
      if (destroyed || !mapRef.current || mapInstanceRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current).setView([userLat, userLng], 13);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.circleMarker([userLat, userLng], {
        radius: 10, fillColor: "#3b82f6", color: "#fff",
        weight: 2, opacity: 1, fillOpacity: 0.9,
      }).addTo(map).bindPopup("Your location");
    });

    return () => {
      destroyed = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = [];
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when stations or fuelType changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      stations.forEach((station) => {
        const price = station.prices[fuelType];
        const color = BRAND_COLORS[station.brand] ?? "#6b7280";

        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};color:#fff;border-radius:20px;padding:3px 7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;">${price ? price.toFixed(1) + "p" : station.brand}</div>`,
          iconAnchor: [20, 12],
        });

        const marker = L.marker([station.lat, station.lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<b>${station.brand}</b><br>${station.name}<br>${price ? `${fuelType === "petrol" ? "Petrol" : "Diesel"}: ${price.toFixed(1)}p/L` : "Price unavailable"}`)
          .on("click", () => onSelectStation(station.id));

        markersRef.current.push(marker);
      });
    });
  }, [stations, fuelType, onSelectStation]);

  // Recalculate size when map becomes visible (hidden → shown on mobile)
  useEffect(() => {
    if (!isVisible || !mapInstanceRef.current) return;
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
  }, [isVisible]);

  // Pan to selected station
  useEffect(() => {
    if (!selectedId || !mapInstanceRef.current) return;
    const station = stations.find((s) => s.id === selectedId);
    if (station) mapInstanceRef.current.setView([station.lat, station.lng], 15);
  }, [selectedId, stations]);

  return <div ref={mapRef} className="w-full h-full rounded-xl" />;
}
