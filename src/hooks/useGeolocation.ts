"use client";
import { useState, useCallback, useEffect } from "react";

interface Location {
  lat: number;
  lng: number;
}

interface UseGeolocationResult {
  location: Location | null;
  /** Override the location (e.g. from a postcode lookup) */
  setLocation: (loc: Location) => void;
  error: string | null;
  locate: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation not supported.");
      return;
    }

    // Fast coarse fix first (network/WiFi), then silently upgrade to GPS
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        setError(
          err.code === 1
            ? "Location access denied. Please allow location in your browser settings."
            : "Couldn't get your location. Please try again."
        ),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Ignore high-accuracy failure — coarse fix is already set
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  return { location, setLocation, error, locate };
}
