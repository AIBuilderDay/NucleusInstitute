// Sector → marker color. Keys are normalized (lowercase, trimmed) but display
// labels stay verbatim from the CSV. Falls back to a neutral blue for sections
// not in the table.

interface SectorStyle {
  color: string;
  label: string;
}

const STYLES: Record<string, SectorStyle> = {
  "b2b software": { color: "#0848b8", label: "B2B Software" }, // nucleus-blue
  "b2c software": { color: "#2d6fe0", label: "B2C Software" }, // blue-500
  software: { color: "#0848b8", label: "Software" },
  fintech: { color: "#d89a36", label: "FinTech" }, // gold
  security: { color: "#7c5aa0", label: "Security" }, // plum
  cybersecurity: { color: "#7c5aa0", label: "Cybersecurity" },
  "ai/ml": { color: "#0e54cc", label: "AI / ML" },
  ai: { color: "#0e54cc", label: "AI" },
  "life sciences": { color: "#5a9d8c", label: "Life Sciences" }, // sage
  biotech: { color: "#5a9d8c", label: "Biotech" },
  healthtech: { color: "#5a9d8c", label: "HealthTech" },
  health: { color: "#5a9d8c", label: "Health" },
  "medical devices": { color: "#5a9d8c", label: "Medical Devices" },
  hardware: { color: "#5a6478", label: "Hardware" },
  manufacturing: { color: "#5a6478", label: "Manufacturing" },
  "advanced manufacturing": { color: "#5a6478", label: "Advanced Manufacturing" },
  energy: { color: "#b07f2a", label: "Energy" }, // gold-deep
  cleantech: { color: "#b07f2a", label: "Cleantech" },
  "defense & aerospace": { color: "#073a98", label: "Defense & Aerospace" },
  defense: { color: "#073a98", label: "Defense" },
  aerospace: { color: "#073a98", label: "Aerospace" },
  "consumer goods": { color: "#e16a4d", label: "Consumer Goods" }, // coral
  consumer: { color: "#e16a4d", label: "Consumer" },
  cpg: { color: "#e16a4d", label: "CPG" },
  ecommerce: { color: "#e16a4d", label: "E-commerce" },
  edtech: { color: "#4a85e5", label: "EdTech" }, // blue-400
  education: { color: "#4a85e5", label: "Education" },
  agtech: { color: "#5a9d8c", label: "AgTech" },
  agriculture: { color: "#5a9d8c", label: "Agriculture" },
  "real estate": { color: "#94a0b5", label: "Real Estate" }, // graphite-light
  proptech: { color: "#94a0b5", label: "PropTech" },
};

const FALLBACK: SectorStyle = { color: "#5a6478", label: "Other" };

function key(section: string): string {
  return section.toLowerCase().trim();
}

export function styleFor(section: string): SectorStyle {
  if (!section) return FALLBACK;
  return STYLES[key(section)] ?? { color: FALLBACK.color, label: section };
}

export function colorFor(section: string): string {
  return styleFor(section).color;
}
