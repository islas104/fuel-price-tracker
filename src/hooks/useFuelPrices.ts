"use client";
import { useState, useEffect } from "react";
import { FuelStation } from "@/lib/fuel-sources";

interface Location {
  lat: number;
  lng: number;
}

export interface SourceMeta {
  succeeded: number;
  failed: number;
  errors: string[];
}

interface UseFuelPricesResult {
  stations: FuelStation[];
  loading: boolean;
  error: string | null;
  sourceMeta: SourceMeta | null;
}

export function useFuelPrices(
  location: Location | null,
  radius: number
): UseFuelPricesResult {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  // Debounce radius internally so callers don't have to manage it
  const [debouncedRadius, setDebouncedRadius] = useState(radius);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRadius(radius), 400);
    return () => clearTimeout(t);
  }, [radius]);

  useEffect(() => {
    if (!location) return;

    setLoading(true);
    setError(null);

    const controller = new AbortController();

    fetch(
      `/api/fuel-prices?lat=${location.lat}&lng=${location.lng}&radius=${debouncedRadius}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setStations(d.stations ?? []);
        if (d.sources) setSourceMeta(d.sources);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [location, debouncedRadius]);

  return { stations, loading, error, sourceMeta };
}
