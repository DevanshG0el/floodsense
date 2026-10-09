"""Turn raw OSM roads + DEM into road segments with terrain attributes, plus drain inlets.

Outputs (data/processed):
  segments.geojson  one feature per ~150 m road piece with terrain attributes
  drains.json       drain inlets: OSM-mapped where available, otherwise estimated
    .venv/Scripts/python scripts/build_segments.py
"""

import json
import sys

import numpy as np
import rasterio
from numpy.lib.stride_tricks import sliding_window_view
from shapely.geometry import Point, box, shape
from shapely.strtree import STRtree

sys.path.insert(0, "src")
from floodsense.config import BBOX, PROCESSED_DIR, SEGMENT_LENGTH_M
from floodsense.geo import project, split_line, unproject

ROAD_RANK = {"trunk": 5, "primary": 5, "trunk_link": 4, "primary_link": 4, "secondary": 4,
             "secondary_link": 3, "tertiary": 3, "tertiary_link": 2, "unclassified": 2,
             "residential": 1}
NEIGHBOURHOOD_M = 300  # radius used to judge "lower than its surroundings"


def ground_model(dem: np.ndarray) -> np.ndarray:
    """Copernicus GLO-30 is a surface model (includes buildings and trees). A 3x3
    minimum filter followed by a 3x3 mean approximates street level in dense areas."""
    pad = np.pad(dem, 1, mode="edge")
    mn = sliding_window_view(pad, (3, 3)).min(axis=(2, 3))
    pad = np.pad(mn, 1, mode="edge")
    return sliding_window_view(pad, (3, 3)).mean(axis=(2, 3))


def neighbourhood_mean(g: np.ndarray, radius_px: int) -> np.ndarray:
    k = 2 * radius_px + 1
    pad = np.pad(g, radius_px, mode="edge")
    return sliding_window_view(pad, (k, k)).mean(axis=(2, 3))


def is_below_ground(props: dict) -> bool:
    return props.get("tunnel") == "yes" or str(props.get("layer") or "0").startswith("-")


def main() -> None:
    with rasterio.open(PROCESSED_DIR / "dem_central_delhi.tif") as src:
        dem = src.read(1).astype("float64")
        inv = ~src.transform
        px_m = abs(src.transform.a) * 111_320 * np.cos(np.radians(28.63))
    ground = ground_model(dem)
    local = neighbourhood_mean(ground, max(1, round(NEIGHBOURHOOD_M / px_m)))

    def sample(arr, lon, lat):
        c, r = inv * (lon, lat)
        r = min(max(int(r), 0), arr.shape[0] - 1)
        c = min(max(int(c), 0), arr.shape[1] - 1)
        return float(arr[r, c])

    roads = json.loads((PROCESSED_DIR / "roads.geojson").read_text())["features"]
    rails = json.loads((PROCESSED_DIR / "railways.geojson").read_text())["features"]
    osm_drain = json.loads((PROCESSED_DIR / "osm_drainage.geojson").read_text())["features"]

    # Surface or elevated railways force any road crossing them to dip underneath
    # (Minto Bridge is the classic case). Underground metro lines are ignored.
    over_rails = [project(shape(f["geometry"])) for f in rails
                  if not is_below_ground(f["properties"])
                  and f["properties"].get("railway") != "subway"]
    rail_tree = STRtree(over_rails)

    s, w, n, e = BBOX
    area = box(w, s, e, n)
    segments = []
    for f in roads:
        p = f["properties"]
        if p.get("bridge") == "yes":
            continue  # flyovers do not waterlog
        geom = shape(f["geometry"]).intersection(area)
        if geom.is_empty or geom.geom_type != "LineString":
            continue
        for i, piece in enumerate(split_line(project(geom), SEGMENT_LENGTH_M)):
            if piece.length < 15:
                continue
            ll = unproject(piece)
            pts = [ll.interpolate(t, normalized=True) for t in np.linspace(0, 1, 6)]
            elev = [sample(ground, q.x, q.y) for q in pts]
            low_idx = int(np.argmin(elev))
            low = pts[low_idx]
            sink = sample(local, low.x, low.y) - elev[low_idx]
            under_rail = any(piece.intersects(over_rails[j]) for j in rail_tree.query(piece))
            segments.append({
                "type": "Feature",
                "geometry": {"type": "LineString",
                             "coordinates": [[round(x, 6), round(y, 6)] for x, y in ll.coords]},
                "properties": {
                    "id": f"S{p['osm_id']}-{i}",
                    "name": p.get("name"),
                    "highway": p.get("highway"),
                    "rank": ROAD_RANK.get(p.get("highway"), 1),
                    "length_m": round(piece.length),
                    "ground_m": round(elev[low_idx], 1),
                    "sink_m": round(sink, 2),
                    "underpass": bool(is_below_ground(p) or under_rail),
                    "low_point": [round(low.x, 6), round(low.y, 6)],
                },
            })

    # Terrain index 0..1: squared percentile of sink depth, so only genuinely low places
    # score high; railway underpasses get a floor of 0.9.
    sinks = np.array([sg["properties"]["sink_m"] for sg in segments])
    pct = sinks.argsort().argsort() / max(1, len(sinks) - 1)
    for sg, q in zip(segments, pct):
        t = float(q) ** 2
        if sg["properties"]["underpass"]:
            t = max(t, 0.9)
        sg["properties"]["terrain"] = round(t, 3)

    # Drain inlets: OSM manholes/drains where mapped; otherwise one estimated inlet at the
    # low point of every segment on tertiary-or-bigger roads (side drains run along them).
    drains = []
    for f in osm_drain:
        g = shape(f["geometry"])
        pt = g if g.geom_type == "Point" else g.interpolate(0.5, normalized=True)
        drains.append({"lon": round(pt.x, 6), "lat": round(pt.y, 6), "source": "osm",
                       "road": None})
    osm_pts = [project(Point(d["lon"], d["lat"])) for d in drains]
    for sg in segments:
        if sg["properties"]["rank"] < 3:
            continue
        lon, lat = sg["properties"]["low_point"]
        q = project(Point(lon, lat))
        if any(q.distance(o) < 60 for o in osm_pts):
            continue
        drains.append({"lon": lon, "lat": lat, "source": "estimated",
                       "road": sg["properties"]["name"]})
    for k, d in enumerate(drains, 1):
        d["id"] = f"D-{k:03d}"

    (PROCESSED_DIR / "segments.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": segments}))
    (PROCESSED_DIR / "drains.json").write_text(json.dumps(drains))
    up = sum(sg["properties"]["underpass"] for sg in segments)
    print(f"segments: {len(segments)} (underpass: {up}), drains: {len(drains)} "
          f"(osm {sum(d['source'] == 'osm' for d in drains)})")
    print(f"sink depth m: p50={np.percentile(sinks, 50):.2f} p90={np.percentile(sinks, 90):.2f} "
          f"max={sinks.max():.2f}")
    for sg in sorted(segments, key=lambda x: -x["properties"]["terrain"])[:15]:
        p = sg["properties"]
        print(f"  {p['name']!s:35.35} {p['highway']:14} sink={p['sink_m']:5.2f} "
              f"under={p['underpass']} at {p['low_point']}")


if __name__ == "__main__":
    main()
