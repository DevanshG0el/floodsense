"""State that changes at runtime: drain status and citizen reports.

LocalStore keeps everything in a JSON file so the app runs with no cloud account.
DynamoStore (added once AWS is set up) implements the same four methods.
"""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Protocol

from floodsense.config import DATA_DIR


class Store(Protocol):
    def drain_status(self) -> dict[str, str]: ...
    def set_drain(self, drain_id: str, status: str, by: str) -> None: ...
    def reports(self) -> list[dict]: ...
    def add_report(self, report: dict) -> dict: ...
    def reset(self) -> None: ...


class LocalStore:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or DATA_DIR / "state" / "state.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        if not self.path.exists():
            self._write({"drains": {}, "reports": [], "drain_log": []})

    def _read(self) -> dict:
        return json.loads(self.path.read_text())

    def _write(self, data: dict) -> None:
        self.path.write_text(json.dumps(data, indent=1))

    def drain_status(self) -> dict[str, str]:
        return self._read()["drains"]

    def set_drain(self, drain_id: str, status: str, by: str) -> None:
        with self._lock:
            d = self._read()
            d["drains"][drain_id] = status
            d["drain_log"].append({"drain": drain_id, "status": status, "by": by,
                                   "at": datetime.now().isoformat(timespec="seconds")})
            self._write(d)

    def reports(self) -> list[dict]:
        return self._read()["reports"]

    def add_report(self, report: dict) -> dict:
        report = {"id": uuid.uuid4().hex[:10],
                  "created_at": datetime.now().isoformat(timespec="seconds"), **report}
        with self._lock:
            d = self._read()
            d["reports"].append(report)
            self._write(d)
        return report

    def reset(self) -> None:
        with self._lock:
            self._write({"drains": {}, "reports": [], "drain_log": []})
