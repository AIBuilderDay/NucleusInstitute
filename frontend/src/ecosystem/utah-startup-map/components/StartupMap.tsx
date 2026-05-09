import { useEffect, useRef } from "react";
import maplibregl, { Map as MaplibreMap, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EcosystemStartup } from "../types";
import { colorFor } from "../data/sectorStyle";

interface StartupMapProps {
  startups: EcosystemStartup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  focusCoords?: [number, number] | null; // [lng, lat] — flies here when set / changes
  focusZoom?: number;
}

// Carto Positron Light — open tile source, no API key required, plays nicely
// with Nucleus's pearl/blue palette.
const STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const UTAH_CENTER: [number, number] = [-111.6, 39.8];

export function StartupMap({
  startups,
  selectedId,
  onSelect,
  focusCoords,
  focusZoom = 10.5,
}: StartupMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<Popup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // — init map (once) —
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: UTAH_CENTER,
      zoom: 6.4,
      minZoom: 5,
      maxZoom: 16,
      attributionControl: { compact: true },
      maxBounds: [
        [-115.0, 36.5], // SW — past UT corner
        [-108.5, 42.5], // NE — past UT corner
      ],
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, []);

  // — sync markers when startups change —
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = markersRef.current;
    const incomingIds = new Set(startups.map((s) => s.id));

    // remove markers no longer in the set
    for (const [id, marker] of existing) {
      if (!incomingIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    // add or update markers
    for (const s of startups) {
      const existingMarker = existing.get(s.id);
      if (existingMarker) {
        existingMarker.setLngLat([s.lng, s.lat]);
        continue;
      }
      const el = document.createElement("button");
      el.className = "ecosystem-marker";
      el.type = "button";
      el.setAttribute("aria-label", s.name);
      el.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${colorFor(s.section)};
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 1px rgba(15,44,79,0.18), 0 1px 2px rgba(15,44,79,0.16);
        cursor: pointer;
        padding: 0;
        transition: transform 0.12s ease;
      `;
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.35)";
        showPopup(map, s);
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
        hidePopup();
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(s.id);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      existing.set(s.id, marker);
    }
  }, [startups]);

  // — fly to a focus point when it changes (used for the matched-mode zoom) —
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoords) return;
    const apply = () =>
      map.flyTo({
        center: focusCoords,
        zoom: focusZoom,
        duration: 900,
        essential: true,
      });
    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [focusCoords, focusZoom]);

  // — highlight selected marker —
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement() as HTMLElement;
      if (id === selectedId) {
        el.style.outline = "3px solid var(--nucleus-blue)";
        el.style.outlineOffset = "2px";
        el.style.transform = "scale(1.4)";
      } else {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.transform = "";
      }
    }
  }, [selectedId]);

  function showPopup(map: MaplibreMap, s: EcosystemStartup) {
    hidePopup();
    const html = `
      <div style="font-family: var(--font-sans); padding: 4px 2px; min-width: 180px;">
        <div style="font-family: var(--font-display); font-weight: 500; font-size: 15px; color: var(--nucleus-blue); margin-bottom: 2px;">
          ${escapeHtml(s.name)}
        </div>
        <div style="font-size: 11px; color: var(--slate); text-transform: uppercase; letter-spacing: 0.06em;">
          ${escapeHtml(s.section || "—")} · ${escapeHtml(s.city || "Utah")}
        </div>
      </div>
    `;
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "ecosystem-popup",
    })
      .setLngLat([s.lng, s.lat])
      .setHTML(html)
      .addTo(map);
  }

  function hidePopup() {
    popupRef.current?.remove();
    popupRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        background: "var(--pearl-100)",
      }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
