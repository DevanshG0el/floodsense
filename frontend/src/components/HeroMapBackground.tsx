"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import React, { useEffect, useRef } from "react";

setWorkerUrl("/maplibre/maplibre-gl-worker.js");

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

export default function HeroMapBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = new MapLibreMap({
        container: containerRef.current,
        style: STYLE_URL,
        center: [77.22, 28.63], // longitude, latitude
        zoom: 13.5,
        pitch: 48, // 3D perspective tilt
        bearing: 20,
        interactive: false,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        // Add animated glowing simulated flood hazard lines
        map.addSource("hero-flood-lines", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { level: "red" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [77.215, 28.635],
                    [77.218, 28.632],
                    [77.222, 28.630],
                    [77.228, 28.633],
                  ],
                },
              },
              {
                type: "Feature",
                properties: { level: "amber" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [77.208, 28.625],
                    [77.214, 28.628],
                    [77.220, 28.626],
                    [77.226, 28.622],
                  ],
                },
              },
              {
                type: "Feature",
                properties: { level: "red" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [77.219, 28.640],
                    [77.221, 28.635],
                    [77.225, 28.628],
                    [77.230, 28.625],
                  ],
                },
              },
            ],
          },
        });

        // Layer glow
        map.addLayer({
          id: "hero-flood-glow",
          type: "line",
          source: "hero-flood-lines",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": [
              "match",
              ["get", "level"],
              "red",
              "#e63946",
              "amber",
              "#f59e0b",
              "#2a9d66",
            ],
            "line-width": 8,
            "line-blur": 6,
            "line-opacity": 0.8,
          },
        });

        // Layer line core
        map.addLayer({
          id: "hero-flood-core",
          type: "line",
          source: "hero-flood-lines",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": [
              "match",
              ["get", "level"],
              "red",
              "#ff4d5a",
              "amber",
              "#fbbf24",
              "#34d399",
            ],
            "line-width": 3.5,
          },
        });

        // Slow cinematic camera pan & rotate
        let angle = 20;
        let lastTime = performance.now();

        const step = (time: number) => {
          const delta = (time - lastTime) / 1000;
          lastTime = time;

          angle = (angle + delta * 0.8) % 360;
          map.setBearing(angle);

          animRef.current = requestAnimationFrame(step);
        };

        animRef.current = requestAnimationFrame(step);
      });
    } catch (e) {
      console.warn("MapLibre background initialization skipped:", e);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Underlying WebGL Map container */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full opacity-65" />

      {/* Atmospheric Dark Oceanic Slate & Pale Aqua Overlay Gradients */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(90deg, #0d242e 0%, rgba(13, 36, 46, 0.92) 42%, rgba(13, 36, 46, 0.65) 75%, rgba(13, 36, 46, 0.45) 100%),
            radial-gradient(circle at 80% 20%, rgba(40, 141, 166, 0.25) 0%, transparent 60%),
            radial-gradient(circle at 10% 90%, rgba(202, 221, 228, 0.15) 0%, transparent 50%)
          `,
        }}
      />

      {/* Subtle animated rain streaks overlay */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />
    </div>
  );
}
