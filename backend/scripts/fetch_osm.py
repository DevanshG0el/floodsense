"""Pull roads and drainage features for the study area from OpenStreetMap (Overpass API).

Run once; output is committed so the app never depends on Overpass at runtime.
    .venv/Scripts/python scripts/fetch_osm.py
"""

import json
import sys

import httpx

sys.path.insert(0, "src")
from floodsense.config import BBOX, PROCESSED_DIR

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
S, W, N, E = BBOX
bbox = f"{S},{W},{N},{E}"

ROAD_TYPES = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link"

QUERY = f"""
[out:json][timeout:90];
(
  way["highway"~"^({ROAD_TYPES})$"]({bbox});
  way["waterway"~"^(drain|ditch|canal|stream)$"]({bbox});
  node["manhole"~"drain|storm|sewer"]({bbox});
  node["man_made"~"storm_drain|drain"]({bbox});
  node["highway"="storm_drain"]({bbox});
  way["railway"~"^(rail|subway|light_rail)$"]["bridge"]({bbox});
  way["railway"~"^(rail|subway|light_rail)$"]({bbox});
);
out geom tags;
"""


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    elements = None
    for url in MIRRORS:
        try:
            resp = httpx.post(url, data={"data": QUERY}, timeout=120,
                              headers={"User-Agent": "FloodSense-hackathon/0.1"})
            resp.raise_for_status()
            elements = resp.json()["elements"]
            print(f"fetched from {url}")
            break
        except Exception as exc:  # try the next mirror
            print(f"{url} failed: {exc.__class__.__name__}")
    if elements is None:
        raise SystemExit("all Overpass mirrors failed")

    roads, drains, rails = [], [], []
    for el in elements:
        tags = el.get("tags", {})
        if el["type"] == "way" and "geometry" in el:
            coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
            feat = {"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {"osm_id": el["id"], **{k: tags.get(k) for k in ("name", "highway", "waterway", "oneway", "bridge", "tunnel", "layer")}}}
            if "highway" in tags:
                roads.append(feat)
            elif "railway" in tags:
                feat["properties"]["railway"] = tags.get("railway")
                rails.append(feat)
            else:
                drains.append(feat)
        elif el["type"] == "node":
            drains.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
                           "properties": {"osm_id": el["id"], "kind": "inlet", **tags}})

    for name, feats in (("roads", roads), ("osm_drainage", drains), ("railways", rails)):
        path = PROCESSED_DIR / f"{name}.geojson"
        path.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
        print(f"{name}: {len(feats)} features -> {path}")


if __name__ == "__main__":
    main()
