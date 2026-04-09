export interface BrandColor {
  /** Hex color for Leaflet map markers */
  hex: string;
  /** Tailwind bg class for station card badges */
  bg: string;
  /** Tailwind text class for station card badges */
  text: string;
}

export const BRAND_COLORS: Record<string, BrandColor> = {
  Asda:            { hex: "#16a34a", bg: "bg-green-600",  text: "text-white" },
  Morrisons:       { hex: "#eab308", bg: "bg-yellow-500", text: "text-white" },
  Tesco:           { hex: "#e2001a", bg: "bg-red-600",    text: "text-white" },
  Sainsburys:      { hex: "#f97316", bg: "bg-orange-500", text: "text-white" },
  "Sainsbury's":   { hex: "#f97316", bg: "bg-orange-500", text: "text-white" },
  Jet:             { hex: "#ef4444", bg: "bg-red-700",    text: "text-white" },
  Applegreen:      { hex: "#15803d", bg: "bg-green-700",  text: "text-white" },
  BP:              { hex: "#006B3F", bg: "bg-green-800",  text: "text-white" },
  Shell:           { hex: "#f5c400", bg: "bg-yellow-400", text: "text-slate-900" },
  Esso:            { hex: "#e60028", bg: "bg-red-600",    text: "text-white" },
  Ascona:          { hex: "#1d4ed8", bg: "bg-blue-700",   text: "text-white" },
  Gulf:            { hex: "#f97316", bg: "bg-orange-600", text: "text-white" },
  Texaco:          { hex: "#dc2626", bg: "bg-red-600",    text: "text-white" },
  MFG:             { hex: "#4338ca", bg: "bg-indigo-600", text: "text-white" },
  Rontec:          { hex: "#0e7490", bg: "bg-cyan-700",   text: "text-white" },
  Moto:            { hex: "#eab308", bg: "bg-yellow-500", text: "text-slate-900" },
  SGN:             { hex: "#7e22ce", bg: "bg-purple-700", text: "text-white" },
  "Fuel Finder":   { hex: "#0284c7", bg: "bg-sky-600",    text: "text-white" },
};

const DEFAULT: BrandColor = { hex: "#6b7280", bg: "bg-slate-600", text: "text-white" };

export function getBrandColor(brand: string): BrandColor {
  return BRAND_COLORS[brand] ?? DEFAULT;
}
