"""Project-wide constants: study area, paths, thresholds."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Central Delhi study area: Connaught Place, Minto Bridge, ITO, Mandi House.
# (south, west, north, east) in WGS84 degrees.
BBOX = (28.615, 77.205, 28.645, 77.250)
AREA_NAME = "Central Delhi (Connaught Place to ITO)"
CENTER = (28.630, 77.2275)

# Road segments are split to roughly this length so each one gets its own colour.
SEGMENT_LENGTH_M = 150

# Copernicus DEM GLO-30 tile covering Delhi, served from the Registry of Open Data on AWS.
DEM_TILE = "Copernicus_DSM_COG_10_N28_00_E077_00_DEM"
DEM_URL = f"https://copernicus-dem-30m.s3.amazonaws.com/{DEM_TILE}/{DEM_TILE}.tif"

# Known Delhi waterlogging hotspots named by Delhi Traffic Police / PWD in press reports.
# Used only to validate the model, never as an input to it.
KNOWN_HOTSPOTS = [
    {"name": "Minto Bridge underpass", "lat": 28.6346, "lon": 77.2257},
    {"name": "ITO crossing", "lat": 28.6289, "lon": 77.2410},
    {"name": "Barakhamba Road / Tolstoy Marg", "lat": 28.6293, "lon": 77.2240},
    {"name": "Mandi House roundabout", "lat": 28.6258, "lon": 77.2340},
    {"name": "Pragati Maidan tunnel", "lat": 28.6190, "lon": 77.2403},
    {"name": "Delhi Gate / Daryaganj", "lat": 28.6400, "lon": 77.2410},
]
