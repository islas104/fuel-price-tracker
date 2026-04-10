"use client";
import { useState, useEffect, useRef } from "react";
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
  lastFetched: Date | null;
  refresh: () => void;
}

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useFuelPrices(
  location: Location | null,
  radius: number
): UseFuelPricesResult {
  const [stations, setStations]     = useState<FuelStation[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Debounce radius internally so callers don't have to manage it
  const [debouncedRadius, setDebouncedRadius] = useState(radius);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRadius(radius), 400);
    return () => clearTimeout(t);
  }, [radius]);

  // Incrementing this triggers a fresh fetch without changing location/radius
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((t) => t + 1);

  // Track when data was last fetched so the visibility handler can decide
  // whether to trigger a refresh when the user returns to the tab
  const lastFetchedRef = useRef<Date | null>(null);

  // Auto-refresh every 10 minutes while tab is visible; also refresh on
  // tab focus if the data has gone stale while the tab was in the background
  useEffect(() => {
    if (!location) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        setRefreshTick((t) => t + 1);
      }
    }, REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && lastFetchedRef.current) {
        const staleMs = Date.now() - lastFetchedRef.current.getTime();
        if (staleMs >= REFRESH_INTERVAL_MS) {
          setRefreshTick((t) => t + 1);
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [location]);

  // Core fetch — reruns when location, radius, or refreshTick changes
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
        const now = new Date();
        setLastFetched(now);
        lastFetchedRef.current = now;
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [location, debouncedRadius, refreshTick]);

  return { stations, loading, error, sourceMeta, lastFetched, refresh };
}
