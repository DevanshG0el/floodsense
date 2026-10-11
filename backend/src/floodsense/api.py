"""FloodSense HTTP API. Runs locally with uvicorn; the same app is wrapped for Lambda later.

    uv run uvicorn floodsense.api:app --reload
"""

from __future__ import annotations

import logging
import time
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from shapely.geometry import Point

from floodsense import model, rain, vision
from floodsense.config import AREA_NAME, BBOX, CENTER, DATA_DIR
from floodsense.geo import project
from floodsense.store import LocalStore

log = logging.getLogger("floodsense")

app = FastAPI(title="FloodSense API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=2000)

WORLD = model.World()
STORE = LocalStore()
UPLOADS = DATA_DIR / "state" / "uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS), name="uploads")

Mode = Literal["replay", "live"]
_live_cache: dict = {"at": 0.0, "data": None}
REPORT_REACH_M = 80.0


# ---- helpers ----------------------------------------------------------------------------
def get_rain(mode: Mode) -> dict:
    if mode == "replay":
        return rain.load_replay()  # real clock times of the 9 Jul 2026 storm
    if time.time() - _live_cache["at"] > 900 or _live_cache["data"] is None:
        _live_cache["data"] = rain.live_forecast(hours=6)
        _live_cache["at"] = time.time()
    return _live_cache["data"]


def observed_segments() -> set[str]:
    return {r["segment"] for r in STORE.reports()
            if r.get("category") == "waterlogging" and r.get("segment")}


def run(mode: Mode) -> tuple[dict, dict]:
    r = get_rain(mode)
    return r, model.score_all(WORLD, r, STORE.drain_status(), observed_segments())


def nearest(lon: float, lat: float, items: dict, point_of) -> tuple[str | None, float]:
    q = project(Point(lon, lat))
    best, best_d = None, float("inf")
    for k, v in items.items():
        d = q.distance(project(Point(*point_of(v))))
        if d < best_d:
            best, best_d = k, d
    return best, best_d


# ---- routes -----------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "floodsense", "bedrock": vision.bedrock_enabled()}


@app.get("/meta")
def meta() -> dict:
    return {
        "area": AREA_NAME, "bbox": BBOX, "center": CENTER,
        "segments": len(WORLD.segments), "drains": len(WORLD.drains),
        "drains_osm": sum(d.source == "osm" for d in WORLD.drains.values()),
        "replay": {k: v for k, v in rain.load_replay().items() if k != "hours"},
        "sources": [
            {"what": "Rain", "from": "Open-Meteo forecast (hourly) and historical archive"},
            {"what": "Elevation", "from": "Copernicus DEM GLO-30, Registry of Open Data on AWS"},
            {"what": "Roads and railways", "from": "OpenStreetMap contributors"},
            {"what": "Drains", "from": "OpenStreetMap where mapped, otherwise estimated at road low points"},
            {"what": "Blocked drains", "from": "Citizen photo reports"},
        ],
        "model": {k: getattr(model, k) for k in (
            "RUNOFF_BASE", "CONCENTRATION", "CAPACITY_MAJOR", "CAPACITY_MINOR",
            "CAPACITY_NO_DRAIN", "AMBER_AT", "RED_AT")},
    }


@app.get("/risk")
def risk(mode: Mode = "replay") -> dict:
    """Everything the commuter map needs: a GeoJSON of coloured segments, alerts, rain."""
    r, scored = run(mode)
    feats = []
    for sid, res in scored["segments"].items():
        seg = WORLD.segments[sid]
        feats.append({"type": "Feature", "id": sid, "geometry": seg.geometry, "properties": {
            "id": sid, "name": seg.name, "highway": seg.highway, "rank": seg.rank,
            "level": res["level"], "timeline": res["timeline"],
            "eta": res["eta"], "risky_from": res["risky_from"],
            "reason": res["reason"], "underpass": seg.underpass,
            "blocked_drains": len(res["blocked_drains"]), "observed": res["observed"]}})
    counts = {"green": 0, "amber": 0, "red": 0}
    for res in scored["segments"].values():
        counts[res["level"]] += 1
    return {"generated_at": scored["generated_at"], "mode": mode, "rain": scored["rain"],
            "counts": counts, "alerts": model.alerts(WORLD, scored),
            "validation": model.hotspot_check(WORLD, scored),
            "geojson": {"type": "FeatureCollection", "features": feats}}


@app.get("/segments/{segment_id}")
def segment_detail(segment_id: str, mode: Mode = "replay") -> dict:
    if segment_id not in WORLD.segments:
        raise HTTPException(404, "unknown segment")
    _, scored = run(mode)
    seg = WORLD.segments[segment_id]
    res = scored["segments"][segment_id]
    alt = model.alternative_for(WORLD, segment_id, scored["segments"]) \
        if res["level"] != "green" else None
    return {"id": segment_id, "name": seg.name, "highway": seg.highway,
            "underpass": seg.underpass, "sink_m": seg.sink_m, "drains": seg.drains,
            **res, "alternative": alt, "hours": [h["time"] for h in scored["rain"]["hours"]]}


@app.get("/drains")
def drains() -> dict:
    status = STORE.drain_status()
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": d.id,
         "geometry": {"type": "Point", "coordinates": [d.lon, d.lat]},
         "properties": {"id": d.id, "source": d.source, "road": d.road,
                        "status": status.get(d.id, "unknown")}}
        for d in WORLD.drains.values()]}


class DrainUpdate(BaseModel):
    status: Literal["clear", "partial", "blocked", "unknown"]
    by: str = "engineer"


@app.post("/drains/{drain_id}")
def update_drain(drain_id: str, body: DrainUpdate, mode: Mode = "replay") -> dict:
    if drain_id not in WORLD.drains:
        raise HTTPException(404, "unknown drain")
    _, before = run(mode)
    STORE.set_drain(drain_id, body.status, body.by)
    _, after = run(mode)
    changed = [{"segment": s, "road": WORLD.segments[s].name,
                "from": before["segments"][s]["level"], "to": after["segments"][s]["level"]}
               for s in WORLD.drains[drain_id].segments
               if before["segments"][s]["level"] != after["segments"][s]["level"]]
    return {"drain": drain_id, "status": body.status, "changed": changed}


@app.get("/engineer/priorities")
def priorities(mode: Mode = "replay", top: int = 15) -> dict:
    r, scored = run(mode)
    status = STORE.drain_status()
    items = model.drain_priorities(WORLD, r, status, scored, top=top)
    reports = STORE.reports()
    for it in items:
        it["reports"] = [{**rp, "photo_url": f"/uploads/{rp['id']}.{rp.get('photo_ext', 'jpg')}"}
                         for rp in reports if rp.get("drain") == it["drain"]][-3:]
    return {"rain": {k: v for k, v in scored["rain"].items() if k != "hours"},
            "red_now": sum(v["level"] == "red" for v in scored["segments"].values()),
            "items": items}


@app.get("/reports")
def list_reports() -> list[dict]:
    return [{**r, "photo_url": f"/uploads/{r['id']}.{r.get('photo_ext', 'jpg')}"}
            for r in reversed(STORE.reports())]


@app.post("/reports")
async def create_report(photo: UploadFile = File(...), lat: float = Form(...),
                        lon: float = Form(...), hint: str | None = Form(None),
                        mode: Mode = Form("replay")) -> dict:
    s, w, n, e = BBOX
    if not (s <= lat <= n and w <= lon <= e):
        raise HTTPException(400, "FloodSense currently covers Central Delhi only.")
    data = await photo.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "Photo too large (max 8 MB).")
    ext = (photo.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"

    try:
        check = await run_in_threadpool(vision.verify_photo, data, ext, hint)
    except Exception:  # Bedrock down or throttled: keep the report, marked unverified
        log.exception("photo verification failed")
        check = vision.unverified(hint)
    _, before = run(mode)

    drain_id, d_drain = nearest(lon, lat, WORLD.drains, lambda d: (d.lon, d.lat))
    seg_id, d_seg = nearest(lon, lat, WORLD.segments, lambda sg: sg.low_point)
    linked_drain = drain_id if d_drain <= REPORT_REACH_M else None
    linked_seg = seg_id if d_seg <= REPORT_REACH_M else None

    report = STORE.add_report({
        "lat": lat, "lon": lon, "hint": hint, "photo_ext": ext, **check,
        "drain": linked_drain if check["category"] in ("blocked_drain", "clear_drain") else None,
        "segment": linked_seg if check["category"] == "waterlogging" else None,
    })
    path = UPLOADS / f"{report['id']}.{ext}"
    path.write_bytes(data)

    if check["category"] == "blocked_drain" and linked_drain:
        STORE.set_drain(linked_drain, "blocked" if check["severity"] >= 3 else "partial",
                        f"report {report['id']}")
    elif check["category"] == "clear_drain" and linked_drain:
        STORE.set_drain(linked_drain, "clear", f"report {report['id']}")

    _, after = run(mode)
    impact = None
    affected = (WORLD.drains[linked_drain].segments if report["drain"] else []) + \
        ([linked_seg] if report["segment"] else [])
    for sid in affected:
        b, a = before["segments"][sid]["level"], after["segments"][sid]["level"]
        if b != a:
            impact = {"segment": sid, "road": WORLD.segments[sid].name or "a nearby lane",
                      "from": b, "to": a}
            break
    return {"report": {**report, "photo_url": f"/uploads/{path.name}"}, "impact": impact,
            "message": _report_message(check, linked_drain, linked_seg, impact)}


def _report_message(check: dict, drain: str | None, seg: str | None, impact: dict | None) -> str:
    if check["category"] == "unrelated":
        return "This photo doesn't look like a drain or flooding, so it was not added to the map."
    if impact:
        return (f"Thanks. Your report changed {impact['road']} from "
                f"{impact['from']} to {impact['to']}.")
    if check["category"] in ("blocked_drain", "clear_drain") and not drain:
        return "Thanks. We couldn't match this to a known drain, so the engineer will review it."
    return "Thanks. Your report was added and the engineer can see it."


@app.post("/demo/reset")
def demo_reset() -> dict:
    STORE.reset()
    return {"ok": True}
