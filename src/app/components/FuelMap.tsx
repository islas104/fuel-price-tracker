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
  Shell:         "#f5c400",
  Esso:          "#e60028",
  Ascona:        "#1d4ed8",
  Gulf:          "#f97316",
  Texaco:        "#dc2626",
  MFG:           "#4338ca",
  Rontec:        "#0e7490",
  Moto:          "#eab308",
  SGN:           "#7e22ce",
};

// Module-level promises — loaded once, reused across remounts
let leafletPromise: Promise<typeof import("leaflet")> | null = null;
function loadLeaflet() {
  if (!leafletPromise) leafletPromise = import("leaflet");
  return leafletPromise;
}

let mcPromise: Promise<void> | null = null;
function loadMarkerCluster() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!mcPromise) mcPromise = import("leaflet.markercluster" as any).then(() => {});
  return mcPromise;
}

export default function FuelMap({ userLat, userLng, stations, fuelType, selectedId, onSelectStation, isVisible }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerLayerRef = useRef<any>(null);
  const destroyedRef   = useRef(false);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialise map once — retries once on failure, safe against React Strict Mode double-invoke
  useEffect(() => {
    destroyedRef.current = false;

    const init = async () => {
      if (!mapRef.current || mapInstanceRef.current || destroyedRef.current) return;

      try {
        const [L] = await Promise.all([loadLeaflet(), loadMarkerCluster()]);
        if (destroyedRef.current || !mapRef.current || mapInstanceRef.current) return;

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

        // MarkerClusterGroup — groups overlapping pins in dense areas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markerLayerRef.current = (L as any).markerClusterGroup({
          maxClusterRadius: 50,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          disableClusteringAtZoom: 15,
        }).addTo(map);
      } catch (err) {
        if (process.env.NODE_ENV === "development") console.error("[FuelMap] init error:", err);
        if (!destroyedRef.current) {
          retryTimerRef.current = setTimeout(init, 2000);
        }
      }
    };

    init();

    return () => {
      destroyedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerLayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild markers when stations or fuelType changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markerLayerRef.current) return;

    if (!stations.length) {
      markerLayerRef.current.clearLayers();
      return;
    }

    Promise.all([loadLeaflet(), loadMarkerCluster()]).then(([L]) => {
      if (!markerLayerRef.current) return;

      const t0 = performance.now();

      markerLayerRef.current.clearLayers();

      stations.forEach((station) => {
        const price = station.prices[fuelType];
        const color = BRAND_COLORS[station.brand] ?? "#6b7280";

        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};color:#fff;border-radius:20px;padding:3px 7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;">${price ? price.toFixed(1) + "p" : station.brand}</div>`,
          iconAnchor: [20, 12],
        });

        L.marker([station.lat, station.lng], { icon })
          .bindPopup(`<b>${station.brand}</b><br>${station.name}<br>${price ? `${fuelType === "petrol" ? "Petrol" : "Diesel"}: ${price.toFixed(1)}p/L` : "Price unavailable"}`)
          .on("click", () => onSelectStation(station.id))
          .addTo(markerLayerRef.current);
      });

      if (process.env.NODE_ENV === "development") {
        console.debug(`[FuelMap] ${stations.length} markers in ${(performance.now() - t0).toFixed(1)}ms`);
      }
    });
  }, [stations, fuelType, onSelectStation]);

  // Fix blank tiles when container transitions from hidden → visible on mobile
  useEffect(() => {
    if (!isVisible || !mapInstanceRef.current) return;
    const raf = requestAnimationFrame(() => mapInstanceRef.current?.invalidateSize());
    return () => cancelAnimationFrame(raf);
  }, [isVisible]);

  // Pan/zoom to selected station
  useEffect(() => {
    if (!selectedId || !mapInstanceRef.current) return;
    const station = stations.find((s) => s.id === selectedId);
    if (station) mapInstanceRef.current.setView([station.lat, station.lng], 15);
  }, [selectedId, stations]);

  return <div ref={mapRef} className="w-full h-full rounded-xl" />;
}
