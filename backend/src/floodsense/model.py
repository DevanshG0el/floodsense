"""FloodSense risk model: couples rainfall, terrain and drain condition per road segment.

For every ~150 m road segment we run a tiny hourly water balance ("bucket model"):

    inflow_h  = rain_h * (RUNOFF_BASE + CONCENTRATION * terrain)
                    sloped/crowned roads shed part of the rain, low spots collect run-off
    outflow_h = drain capacity * drain condition factor     blocked drains carry less
    water_h   = max(0, water_{h-1} + inflow_h - outflow_h)

Water above AMBER_AT / RED_AT gives the colour, and the moment it crosses the red line
gives the "floods by 9:10" ETA. Because drains are an explicit input, we can answer the
engineer's question directly: re-run with one drain cleared and see what changes.

This is a transparent screening model, not a hydraulic simulation. Parameters are
chosen to be physically sensible for Delhi (storm drains sized for roughly 20-25 mm/h)
and are documented here so anyone can challenge them. They were calibrated on the
9 July 2026 storm so that roughly one road in eight turns red in a 125 mm event, then
checked against known hotspots with hotspot_check (lift, not hit count).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from floodsense.config import KNOWN_HOTSPOTS, PROCESSED_DIR
from floodsense.geo import haversine_m, project

# ---- parameters -------------------------------------------------------------------------
RUNOFF_BASE = 0.3         # share of rain that stays on a road that is not low-lying
CONCENTRATION = 2.0       # the lowest spots collect up to 2.3x the rain falling on them
CAPACITY_MAJOR = 30.0     # mm/h a clear drain on a tertiary-or-bigger road can carry
CAPACITY_MINOR = 26.0     # mm/h on lanes (smaller side drains)
CAPACITY_NO_DRAIN = 18.0  # mm/h when no inlet is within reach (surface run-off only)
DRAIN_REACH_M = 80.0      # drains within this distance of a segment's low point serve it
DRAIN_FACTOR = {"clear": 1.0, "unknown": 0.9, "partial": 0.55, "blocked": 0.2}
AMBER_AT = 27.0           # ponding index (mm) where the road becomes risky
RED_AT = 80.0             # ponding index (mm) where waterlogging is likely
LEVELS = ["green", "amber", "red"]


@dataclass
class Segment:
    id: str
    name: str | None
    highway: str
    rank: int
    terrain: float
    sink_m: float
    underpass: bool
    low_point: tuple[float, float]
    geometry: dict
    drains: list[str] = field(default_factory=list)


@dataclass
class Drain:
    id: str
    lon: float
    lat: float
    source: str
    road: str | None
    segments: list[str] = field(default_factory=list)


class World:
    """Static geography loaded once: segments, drains and which drains serve which road."""

    def __init__(self) -> None:
        feats = json.loads((PROCESSED_DIR / "segments.geojson").read_text())["features"]
        self.segments: dict[str, Segment] = {}
        for f in feats:
            p = f["properties"]
            self.segments[p["id"]] = Segment(
                id=p["id"], name=p["name"], highway=p["highway"], rank=p["rank"],
                terrain=p["terrain"], sink_m=p["sink_m"], underpass=p["underpass"],
                low_point=tuple(p["low_point"]), geometry=f["geometry"])
        raw = json.loads((PROCESSED_DIR / "drains.json").read_text())
        self.drains: dict[str, Drain] = {d["id"]: Drain(**d) for d in raw}

        ids = list(self.drains)
        pts = [project(Point(self.drains[i].lon, self.drains[i].lat)) for i in ids]
        tree = STRtree(pts)
        for seg in self.segments.values():
            lp = project(Point(*seg.low_point))
            for j in tree.query(lp.buffer(DRAIN_REACH_M)):
                if lp.distance(pts[j]) <= DRAIN_REACH_M:
                    seg.drains.append(ids[j])
                    self.drains[ids[j]].segments.append(seg.id)

        # centroids of named roads, used to suggest alternatives
        self.mid: dict[str, tuple[float, float]] = {
            s.id: _midpoint(s.geometry) for s in self.segments.values()}


def _midpoint(geom: dict) -> tuple[float, float]:
    line = shape(geom)
    p = line.interpolate(0.5, normalized=True)
    return p.x, p.y


# ---- core simulation --------------------------------------------------------------------
def capacity(seg: Segment, drain_status: dict[str, str]) -> float:
    if not seg.drains:
        return CAPACITY_NO_DRAIN
    base = CAPACITY_MAJOR if seg.rank >= 3 else CAPACITY_MINOR
    f = sum(DRAIN_FACTOR[drain_status.get(d, "unknown")] for d in seg.drains) / len(seg.drains)
    return base * f


def simulate(seg: Segment, rain_mm: list[float], cap: float) -> tuple[list[float], float | None]:
    """Return the ponding index after each hour and the fractional hour at which it first
    crosses RED_AT (None if it never does)."""
    water, out, eta = 0.0, [], None
    mult = RUNOFF_BASE + CONCENTRATION * seg.terrain
    for h, r in enumerate(rain_mm):
        before = water
        water = max(0.0, water + r * mult - cap)
        if eta is None and water >= RED_AT > before:
            eta = h + (RED_AT - before) / max(water - before, 1e-6)
        out.append(round(water, 1))
    return out, eta


def level_of(peak: float) -> str:
    return "red" if peak >= RED_AT else "amber" if peak >= AMBER_AT else "green"


# ---- scoring the whole area -------------------------------------------------------------
def score_all(world: World, rain: dict, drain_status: dict[str, str],
              observed_flooding: set[str] | None = None) -> dict:
    hours = rain["hours"]
    rain_mm = [h["mm"] for h in hours]
    t0 = datetime.fromisoformat(hours[0]["time"])
    total = round(sum(rain_mm), 1)
    peak_i = max(range(len(rain_mm)), key=lambda i: rain_mm[i])
    observed_flooding = observed_flooding or set()

    results = {}
    for seg in world.segments.values():
        cap = capacity(seg, drain_status)
        series, eta = simulate(seg, rain_mm, cap)
        peak = max(series) if series else 0.0
        level = level_of(peak)
        if seg.id in observed_flooding:
            level, eta = "red", 0.0
        first_amber = next((i for i, w in enumerate(series) if w >= AMBER_AT), None)
        blocked = [d for d in seg.drains if drain_status.get(d) in ("blocked", "partial")]
        timeline = "".join(level_of(w)[0] for w in series)
        if seg.id in observed_flooding:
            timeline = "r" * len(series)
        results[seg.id] = {
            "level": level,
            "timeline": timeline,
            "peak": round(peak, 1),
            "series": series,
            "eta": _clock(t0, eta) if eta is not None else None,
            "eta_hours": round(eta, 2) if eta is not None else None,
            "risky_from": _clock(t0, first_amber) if first_amber is not None else None,
            "blocked_drains": blocked,
            "observed": seg.id in observed_flooding,
            "reason": reason(seg, level, total, rain_mm[peak_i], _clock(t0, peak_i),
                             blocked, seg.id in observed_flooding),
        }
    return {"generated_at": datetime.now().isoformat(timespec="seconds"),
            "rain": {**rain, "total_mm": total}, "segments": results}


def _clock(t0: datetime, hours: float) -> str:
    return (t0 + timedelta(hours=hours)).strftime("%H:%M")


def reason(seg: Segment, level: str, total: float, peak_mm: float, peak_at: str,
           blocked: list[str], observed: bool) -> str:
    if observed:
        return "Residents have reported water on this road right now."
    rain_txt = f"{total:.0f} mm of rain is expected, heaviest around {peak_at} ({peak_mm:.0f} mm/h)"
    if seg.underpass:
        land = "this stretch is an underpass, so water runs into it"
    elif seg.sink_m >= 4:
        land = "this is one of the lowest points in the area"
    elif seg.sink_m >= 1.5:
        land = f"this stretch sits about {seg.sink_m:.1f} m below the area around it"
    elif seg.terrain >= 0.4:
        land = "this stretch is slightly lower than the roads around it"
    else:
        land = "this stretch is not low-lying"
    if blocked:
        n = len(blocked)
        drain = f"{n} nearby drain{'s are' if n > 1 else ' is'} reported blocked"
    elif not seg.drains:
        drain = "there is no mapped drain inlet close by"
    else:
        drain = "nearby drains have no blockage reports"
    if level == "green":
        if total < 2:
            return "No significant rain expected in the next few hours."
        return f"Low risk: {rain_txt}, but {land} and {drain}."
    word = "Flooding likely" if level == "red" else "Water may collect"
    return f"{word}: {rain_txt}, {land}, and {drain}."


# ---- engineer view: which drain to clean first ------------------------------------------
def drain_priorities(world: World, rain: dict, drain_status: dict[str, str],
                     base: dict, top: int = 15) -> list[dict]:
    """For every drain that is reported blocked/partial (or serves a red road), re-run the
    model with that drain cleared and measure what improves. This is the counterfactual."""
    rain_mm = [h["mm"] for h in rain["hours"]]
    segs = base["segments"]
    candidates = {d for d, s in drain_status.items() if s in ("blocked", "partial")}
    for sid, r in segs.items():
        if r["level"] == "red":
            candidates.update(world.segments[sid].drains)

    out = []
    for did in candidates:
        drain = world.drains.get(did)
        if not drain:
            continue
        trial = {**drain_status, did: "clear"}
        gain, changes = 0.0, []
        for sid in drain.segments:
            seg = world.segments[sid]
            before = segs[sid]
            if before["observed"]:
                continue
            series, eta = simulate(seg, rain_mm, capacity(seg, trial))
            after_level = level_of(max(series) if series else 0.0)
            drop = LEVELS.index(before["level"]) - LEVELS.index(after_level)
            delay = 0.0
            if before["eta_hours"] is not None:
                delay = (eta if eta is not None else len(rain_mm)) - before["eta_hours"]
            weight = 1 + seg.rank
            gain += weight * (drop * 3 + max(0.0, delay))
            if drop > 0 or delay >= 0.25:
                changes.append({"segment": sid, "road": seg.name or "an unnamed lane",
                                "rank": seg.rank,
                                "from": before["level"], "to": after_level,
                                "delay_min": round(delay * 60) if delay else 0})
        status = drain_status.get(did, "unknown")
        reported = status in ("blocked", "partial")
        if gain <= 0 and not reported:
            continue
        out.append({"drain": did, "lon": drain.lon, "lat": drain.lat, "source": drain.source,
                    "road": drain.road, "status": status, "impact": round(gain, 1),
                    "reported": reported,
                    "changes": changes, "summary": _drain_summary(did, changes)})
    # Drains residents reported come first (they are confirmed problems), each group
    # ordered by how much clearing it helps. Then preventive picks on red roads.
    out.sort(key=lambda x: (not x["reported"], -x["impact"], x["drain"]))
    n_reported = sum(x["reported"] for x in out)
    return out[:max(top, n_reported)]


def _drain_summary(did: str, changes: list[dict]) -> str:
    if not changes:
        return f"Clear {did}: no road changes colour in this storm, but it is reported blocked."
    best = max(changes, key=lambda c: (LEVELS.index(c["from"]) - LEVELS.index(c["to"]),
                                       c["road"] != "an unnamed lane",
                                       c["rank"], c["delay_min"]))
    if best["from"] != best["to"]:
        txt = f"Clear {did}: {best['road']} goes {best['from']} to {best['to']}"
    else:
        txt = f"Clear {did}: flooding on {best['road']} starts {best['delay_min']} min later"
    more = len({c["road"] for c in changes}) - 1
    return txt + (f", plus {more} more road{'s' if more > 1 else ''}." if more > 0 else ".")


# ---- commuter view: alerts and alternatives ---------------------------------------------
def alternative_for(world: World, seg_id: str, scored: dict, max_m: float = 900) -> str | None:
    """Nearest differently-named road, preferably a main road, that stays green."""
    seg = world.segments[seg_id]
    lon, lat = world.mid[seg_id]
    by_name: dict[str, list[str]] = {}
    for s in world.segments.values():
        if (s.name and s.name != seg.name and s.rank >= 2
                and not any(k in s.name for k in ("Chowk", "Circle", "Roundabout", "Crossing"))):
            by_name.setdefault(s.name, []).append(s.id)
    best, best_d = None, max_m
    for name, ids in by_name.items():
        if any(scored[i]["level"] != "green" for i in ids):
            continue
        d = min(haversine_m(lat, lon, world.mid[i][1], world.mid[i][0]) for i in ids)
        d -= 150 * max(world.segments[i].rank for i in ids) / 5  # prefer main roads
        if d < best_d:
            best, best_d = name, d
    return best


def alerts(world: World, scored: dict, limit: int = 8) -> list[dict]:
    """One alert per named road that turns red, earliest first."""
    segs = scored["segments"]
    first: dict[str, str] = {}
    for sid, r in segs.items():
        name = world.segments[sid].name
        if r["level"] != "red" or not name:
            continue
        cur = first.get(name)
        if cur is None or (r["eta_hours"] or 0) < (segs[cur]["eta_hours"] or 0):
            first[name] = sid
    # main roads first (that is where most commuters are), then earliest flooding
    items = sorted(first.items(), key=lambda kv: (-min(world.segments[kv[1]].rank, 3),
                                                  segs[kv[1]]["eta_hours"] or 0))[:limit]
    out = []
    for name, sid in items:
        r = segs[sid]
        alt = alternative_for(world, sid, segs)
        eta = r["eta"]
        leave = None
        if r["eta_hours"] and r["eta_hours"] >= 1:
            t0 = datetime.fromisoformat(scored["rain"]["hours"][0]["time"])
            leave = _clock(t0, max(0.0, r["eta_hours"] - 0.75))
        msg = f"Flooding likely on {name} by {eta}."
        if leave:
            msg += f" Pass before {leave}"
            msg += f" or use {alt}." if alt else "."
        elif alt:
            msg += f" Use {alt} instead."
        out.append({"road": name, "segment": sid, "eta": eta, "leave_by": leave,
                    "alternative": alt, "message": msg, "reason": r["reason"]})
    return out


# ---- validation against known hotspots --------------------------------------------------
def hotspot_check(world: World, scored: dict, radius_m: float = 150) -> dict:
    """Honest validation: compare how often roads near press-reported hotspots go red
    with how often roads elsewhere do. A lift well above 1 means the model is finding
    the right places; counting 'any red segment nearby' would be inflated by chance."""
    segs = scored["segments"]
    near: set[str] = set()
    rows = []
    for h in KNOWN_HOTSPOTS:
        ids = [sid for sid, s in world.segments.items()
               if haversine_m(h["lat"], h["lon"], s.low_point[1], s.low_point[0]) <= radius_m]
        near.update(ids)
        red = sum(segs[i]["level"] == "red" for i in ids)
        rows.append({**h, "segments": len(ids), "red": red,
                     "red_share": round(red / len(ids), 2) if ids else 0.0})
    rest = [sid for sid in segs if sid not in near]
    near_share = sum(segs[i]["level"] == "red" for i in near) / max(1, len(near))
    rest_share = sum(segs[i]["level"] == "red" for i in rest) / max(1, len(rest))
    return {"radius_m": radius_m, "near_red_share": round(near_share, 3),
            "elsewhere_red_share": round(rest_share, 3),
            "lift": round(near_share / rest_share, 1) if rest_share else None,
            "rows": rows,
            "note": "Hotspot locations are approximate, taken from Delhi Traffic Police "
                    "and PWD lists reported in the press. They are never used as model input."}
