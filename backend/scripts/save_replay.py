"""Pick the wettest 6-hour window of the 2026 monsoon over the study area and save it.
    .venv/Scripts/python scripts/save_replay.py
"""
import json
import sys

sys.path.insert(0, "src")
from floodsense.rain import REPLAY_FILE, find_storm

storm = find_storm("2026-06-15", "2026-09-30")
REPLAY_FILE.write_text(json.dumps(storm, indent=1))
print(storm["label"], storm["total_mm"], "mm:", [h["mm"] for h in storm["hours"]])
