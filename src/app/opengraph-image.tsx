import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size    = { width: 1200, height: 630 };
export const alt     = "FuelFinder — Live UK Fuel Prices";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        {/* Icon + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "40px" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            ⛽
          </div>
          <span style={{ fontSize: 52, fontWeight: 800, color: "#ffffff" }}>FuelFinder</span>
        </div>

        <div style={{ fontSize: 38, fontWeight: 700, color: "#f1f5f9", marginBottom: 20, lineHeight: 1.2 }}>
          Live UK Fuel Prices
        </div>

        <div style={{ fontSize: 26, color: "#94a3b8", marginBottom: 48 }}>
          Find the cheapest petrol &amp; diesel near you
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "Petrol", color: "#3b82f6" },
            { label: "Diesel", color: "#f59e0b" },
            { label: "3,400+ stations", color: "#10b981" },
          ].map(({ label, color }) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: `1px solid ${color}`,
                borderRadius: 40,
                padding: "10px 24px",
                fontSize: 22,
                color,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
