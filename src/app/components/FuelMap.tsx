"use client";
import { useEffect, useRef } from "react";
import { FuelStation } from "@/lib/fuel-sources";
import { getBrandColor } from "@/lib/brand-colors";

interface Props {
  userLat: number;
  userLng: number;
  stations: FuelStation[];
  fuelType: "petrol" | "diesel";
  selectedId: string | null;
  onSelectStation: (id: string) => void;
  isVisible: boolean;
}

// Module-level promises — loaded once, reused across remounts
let leafletPromise: Promise<typeof import("leaflet")> | null = null;
function loadLeaflet() {
  if (!leafletPromise) leafletPromise = import("leaflet");
  return leafletPromise;
}

let mcPromise: Promise<void> | null = null;
function loadMarkerCluster() {
  if (!mcPromise) {
    mcPromise = import(
      /* webpackChunkName: "leaflet-markercluster" */
      "leaflet.markercluster"
    ).then(() => {}).catch(() => {});
  }
  return mcPromise;
}

// Standalone — no closure over component scope, so never stale
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderStations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer: any,
  stations: FuelStation[],
  fuelType: "petrol" | "diesel",
  onSelect: (id: string) => void,
) {
  layer.clearLayers();
  stations.forEach((station) => {
    const price = station.prices[fuelType];
    const color = getBrandColor(station.brand).hex;
    const label = price ? `${price.toFixed(1)}p` : station.brand;

    const icon = L.divIcon({
      className: "fuel-marker",
      html: `<div style="display:inline-flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
        <div style="background:${color};color:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;white-space:nowrap;border:2.5px solid #fff;letter-spacing:0.01em;">${label}</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${color};margin-top:-1px;"></div>
      </div>`,
      iconAnchor: [24, 30],
    });

    L.marker([station.lat, station.lng], { icon })
      .bindPopup(`<b>${station.brand}</b><br>${station.name}<br>${price ? `${fuelType === "petrol" ? "Petrol" : "Diesel"}: ${price.toFixed(1)}p/L` : "Price unavailable"}`)
      .on("click", () => onSelect(station.id))
      .addTo(layer);
  });
}

export default function FuelMap({ userLat, userLng, stations, fuelType, selectedId, onSelectStation, isVisible }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerLayerRef = useRef<any>(null);
  const destroyedRef   = useRef(false);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Updated synchronously on every render — safe to read from inside the init closure
  const stationsRef        = useRef(stations);
  const fuelTypeRef        = useRef(fuelType);
  const onSelectStationRef = useRef(onSelectStation);
  stationsRef.current        = stations;
  fuelTypeRef.current        = fuelType;
  onSelectStationRef.current = onSelectStation;

  // Initialise map once
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layer = typeof (L as any).markerClusterGroup === "function"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (L as any).markerClusterGroup({
              maxClusterRadius: 50,
              showCoverageOnHover: false,
              zoomToBoundsOnClick: true,
              disableClusteringAtZoom: 15,
            })
          : L.layerGroup();

        layer.addTo(map);
        markerLayerRef.current = layer;

        // Render stations that arrived before init completed — reads the latest ref values
        if (stationsRef.current.length > 0) {
          renderStations(L, layer, stationsRef.current, fuelTypeRef.current, onSelectStationRef.current);
        }
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

  // Redraw markers when stations or fuelType changes after the map is ready
  useEffect(() => {
    if (!markerLayerRef.current) return;
    Promise.all([loadLeaflet(), loadMarkerCluster()]).then(([L]) => {
      if (!markerLayerRef.current) return;
      renderStations(L, markerLayerRef.current, stations, fuelType, onSelectStation);
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
