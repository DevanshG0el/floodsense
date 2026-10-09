"""Small geometry helpers. Uses a local equirectangular projection, which is accurate to
well under 1% over a few km, so we avoid a pyproj dependency."""

import math

import numpy as np
import shapely
from shapely.geometry import LineString, Point

from floodsense.config import CENTER

LAT0, LON0 = CENTER
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LON = 111_320.0 * math.cos(math.radians(LAT0))


def to_m(lon: float, lat: float) -> tuple[float, float]:
    return (lon - LON0) * M_PER_DEG_LON, (lat - LAT0) * M_PER_DEG_LAT


def to_deg(x: float, y: float) -> tuple[float, float]:
    return x / M_PER_DEG_LON + LON0, y / M_PER_DEG_LAT + LAT0


def project(geom):
    return shapely.transform(geom, lambda c: np.column_stack(
        ((c[:, 0] - LON0) * M_PER_DEG_LON, (c[:, 1] - LAT0) * M_PER_DEG_LAT)))


def unproject(geom):
    return shapely.transform(geom, lambda c: np.column_stack(
        (c[:, 0] / M_PER_DEG_LON + LON0, c[:, 1] / M_PER_DEG_LAT + LAT0)))


def split_line(line_m: LineString, target_len: float) -> list[LineString]:
    """Split a projected line into near-equal pieces of about target_len metres."""
    n = max(1, round(line_m.length / target_len))
    if n == 1:
        return [line_m]
    step = line_m.length / n
    pieces = []
    for i in range(n):
        a, b = i * step, (i + 1) * step
        pts = [line_m.interpolate(a)]
        for c in line_m.coords:
            d = line_m.project(Point(c))
            if a < d < b:
                pts.append(Point(c))
        pts.append(line_m.interpolate(b))
        pieces.append(LineString(pts))
    return pieces


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
