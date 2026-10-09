"""Rainfall input from Open-Meteo (free, no key).

- live: hourly precipitation for the next hours from the best-match forecast model
- replay: a real past storm over the study area, from Open-Meteo's historical-forecast
  archive (stored model runs, so convective peaks are kept, unlike ERA5 reanalysis)
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta

import httpx

from floodsense.config import CENTER, PROCESSED_DIR

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HISTORICAL_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
TZ = "Asia/Kolkata"
REPLAY_FILE = PROCESSED_DIR / "storm_replay.json"


def _series(payload: dict) -> list[dict]:
    h = payload["hourly"]
    return [{"time": t, "mm": round(float(v or 0.0), 2)}
            for t, v in zip(h["time"], h["precipitation"])]


def live_forecast(hours: int = 6) -> dict:
    lat, lon = CENTER
    r = httpx.get(FORECAST_URL, params={
        "latitude": lat, "longitude": lon, "hourly": "precipitation",
        "forecast_hours": hours, "timezone": TZ,
    }, timeout=20)
    r.raise_for_status()
    return {"mode": "live", "source": "Open-Meteo forecast (best-match model)",
            "fetched_at": datetime.now().isoformat(timespec="minutes"),
            "hours": _series(r.json())[:hours]}


def find_storm(start: str, end: str, window: int = 6) -> dict:
    """Scan a date range and return the wettest `window`-hour period, padded with
    one dry-ish hour before so the replay shows the build-up."""
    lat, lon = CENTER
    r = httpx.get(HISTORICAL_URL, params={
        "latitude": lat, "longitude": lon, "hourly": "precipitation",
        "start_date": start, "end_date": end, "timezone": TZ,
    }, timeout=60)
    r.raise_for_status()
    series = _series(r.json())
    best_i, best_sum = 0, -1.0
    for i in range(len(series) - window + 1):
        s = sum(x["mm"] for x in series[i:i + window])
        if s > best_sum:
            best_i, best_sum = i, s
    lo = max(0, best_i - 1)
    hours = series[lo:best_i + window]
    return {"mode": "replay",
            "source": "Open-Meteo historical forecast archive",
            "label": f"Replay of the {datetime.fromisoformat(hours[0]['time']):%d %b %Y} storm",
            "total_mm": round(sum(x["mm"] for x in hours), 1),
            "hours": hours}


def load_replay() -> dict:
    return json.loads(REPLAY_FILE.read_text())


def shift_to_now(rain: dict) -> dict:
    """Re-time a replayed storm so its first hour starts at the current hour, which lets
    the app show 'floods by 9:10' style ETAs during a replay. Original times are kept."""
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    hours = [{**h, "original_time": h["time"],
              "time": (now + timedelta(hours=i)).isoformat(timespec="minutes")}
             for i, h in enumerate(rain["hours"])]
    return {**rain, "hours": hours}
