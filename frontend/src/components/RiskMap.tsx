"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { DrainProps, Level, SegmentProps } from "@/lib/api";
import { LEVEL_COLOR } from "@/lib/levels";

// see scripts/copy-maplibre-worker.mjs
setWorkerUrl("/maplibre/maplibre-gl-worker.js");

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

type SegFC = GeoJSON.FeatureCollection<GeoJSON.LineString, SegmentProps>;
type DrainFC = GeoJSON.FeatureCollection<GeoJSON.Point, DrainProps>;

interface Props {
  center: [number, number]; // [lat, lon]
  bbox?: [number, number, number, number]; // south, west, north, east
  segments?: SegFC;
  /** hour index into each segment's timeline; null shows the worst level over the storm */
  hour?: number | null;
  selectedId?: string | null;
  onSelectSegment?: (id: string | null) => void;
  drains?: DrainFC;
  highlightDrains?: string[];
  focus?: { lon: number; lat: number; zoom?: number } | null;
  pin?: { lon: number; lat: number } | null;
  onMapClick?: (lon: number, lat: number) => void;
  /** hide green roads (engineer view) */
  onlyAtRisk?: boolean;
  className?: string;
  label?: string;
}

const CHAR_LEVEL: Record<string, Level> = { g: "green", a: "amber", r: "red" };

function withLevel(fc: SegFC, hour: number | null | undefined): SegFC {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const tl = f.properties.timeline;
      const lv =
        hour == null || !tl ? f.properties.level : (CHAR_LEVEL[tl[Math.min(hour, tl.length - 1)]] ?? "green");
      return { ...f, properties: { ...f.properties, lv } };
    }),
  };
}

type GeoSource = { setData: (d: GeoJSON.GeoJSON) => unknown };

export default function RiskMap({
  center,
  bbox,
  segments,
  hour = null,
  selectedId = null,
  onSelectSegment,
  drains,
  highlightDrains = [],
  focus,
  pin,
  onMapClick,
  onlyAtRisk = false,
  className = "",
  label = "Flood risk map",
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const handlers = useRef({ onSelectSegment, onMapClick });
  useEffect(() => {
    handlers.current = { onSelectSegment, onMapClick };
  });

  // create the map once
  useEffect(() => {
    if (!el.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: el.current,
        style: STYLE_URL,
        center: [center[1], center[0]],
        zoom: 14,
        minZoom: 12,
        maxZoom: 18,
        attributionControl: { compact: true },
        maxBounds: bbox
          ? [
              [bbox[1] - 0.03, bbox[0] - 0.03],
              [bbox[3] + 0.03, bbox[2] + 0.03],
            ]
          : undefined,
      });
    } catch {
      queueMicrotask(() => setFailed(true)); // WebGL unavailable
      return;
    }
    mapRef.current = map;
    (window as unknown as { __fsMap?: MapLibreMap }).__fsMap = map; // handy for debugging / demo scripts

    map.on("load", () => {
      // start with the attribution collapsed to its (i) button so it never covers the legend
      el.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
      map.addSource("segments", { type: "geojson", data: empty });
      map.addSource("drains", { type: "geojson", data: empty });
      map.addSource("pin", { type: "geojson", data: empty });

      const color = ["match", ["get", "lv"], "red", LEVEL_COLOR.red, "amber", LEVEL_COLOR.amber, LEVEL_COLOR.green];
      map.addLayer({
        id: "seg-casing",
        type: "line",
        source: "segments",
        filter: ["!=", ["get", "lv"], "green"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 11],
        },
      });
      map.addLayer({
        id: "seg-line",
        type: "line",
        source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // @ts-expect-error expression typing is too strict for match
          "line-color": color,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            ["case", ["==", ["get", "lv"], "green"], 1, 2],
            16,
            ["case", ["==", ["get", "lv"], "green"], 3, 7],
          ],
          "line-opacity": ["case", ["==", ["get", "lv"], "green"], 0.55, 0.95],
        },
      });
      map.addLayer({
        id: "seg-selected",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "id"], ""],
        layout: { "line-cap": "round" },
        paint: { "line-color": "#0f172a", "line-width": 12, "line-opacity": 0.25 },
      });
      map.addLayer({
        id: "drain-dots",
        type: "circle",
        source: "drains",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "hl"], false], 8, 4],
          "circle-color": [
            "match",
            ["get", "status"],
            "blocked",
            LEVEL_COLOR.red,
            "partial",
            LEVEL_COLOR.amber,
            "clear",
            LEVEL_COLOR.green,
            "#64748b",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["boolean", ["get", "hl"], false], 3, 1],
        },
      });
      map.addLayer({
        id: "pin",
        type: "circle",
        source: "pin",
        paint: {
          "circle-radius": 10,
          "circle-color": "#1d4ed8",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });

      map.on("click", (e) => {
        handlers.current.onMapClick?.(e.lngLat.lng, e.lngLat.lat);
        if (!handlers.current.onSelectSegment) return;
        const pad = 8;
        const hits = map.queryRenderedFeatures(
          [
            [e.point.x - pad, e.point.y - pad],
            [e.point.x + pad, e.point.y + pad],
          ],
          { layers: ["seg-line"] },
        );
        // prefer the most at-risk road under the finger
        const order: Record<string, number> = { red: 0, amber: 1, green: 2 };
        hits.sort((a, b) => order[a.properties?.lv as string] - order[b.properties?.lv as string]);
        handlers.current.onSelectSegment(hits[0] ? String(hits[0].properties?.id) : null);
      });
      map.on("mouseenter", "seg-line", () => {
        if (handlers.current.onSelectSegment) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "seg-line", () => {
        map.getCanvas().style.cursor = "";
      });
      setReady(true);
    });
    map.on("error", () => {
      /* tile hiccups are non-fatal */
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // segments + hour
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("segments") as unknown as GeoSource | undefined;
    if (!src) return;
    if (!segments) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const data = withLevel(segments, hour);
    if (onlyAtRisk) data.features = data.features.filter((f) => (f.properties as unknown as { lv: Level }).lv !== "green");
    src.setData(data);
  }, [ready, segments, hour, onlyAtRisk]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("seg-selected", ["==", ["get", "id"], selectedId ?? ""]);
  }, [ready, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("drains") as unknown as GeoSource | undefined;
    if (!src) return;
    const hl = new Set(highlightDrains);
    src.setData(
      drains
        ? {
            ...drains,
            features: drains.features
              .filter((f) => hl.has(f.properties.id) || f.properties.status !== "unknown")
              .map((f) => ({ ...f, properties: { ...f.properties, hl: hl.has(f.properties.id) } })),
          }
        : { type: "FeatureCollection", features: [] },
    );
  }, [ready, drains, highlightDrains]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource("pin") as unknown as GeoSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: pin
        ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [pin.lon, pin.lat] } }]
        : [],
    });
  }, [ready, pin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom ?? 16, duration: 900 });
  }, [ready, focus]);

  return (
    <div className={`relative overflow-hidden ${className}`} role="region" aria-label={label}>
      {/* MapLibre's CSS sets .maplibregl-map to position:relative, so size it explicitly */}
      <div ref={el} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 p-6 text-center text-sm text-slate-600">
          Your browser could not start the map (WebGL is off). The lists below still work.
        </div>
      )}
      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" />
        </div>
      )}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          aria-label="Zoom in"
          className="grid h-9 w-9 place-items-center text-lg text-slate-700 hover:bg-slate-50"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <div className="h-px bg-slate-200" />
        <button
          type="button"
          aria-label="Zoom out"
          className="grid h-9 w-9 place-items-center text-lg text-slate-700 hover:bg-slate-50"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
      </div>
    </div>
  );
}
