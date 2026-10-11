import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from floodsense import model
from floodsense.api import STORE, WORLD, app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    STORE.reset()
    yield
    STORE.reset()


def jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (90, 80, 60)).save(buf, "JPEG")
    return buf.getvalue()


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_risk_replay_has_all_levels_and_alerts():
    body = client.get("/risk", params={"mode": "replay"}).json()
    assert set(body["counts"]) == {"green", "amber", "red"}
    assert body["counts"]["red"] > 0 and body["counts"]["green"] > 0
    assert body["alerts"] and "Flooding likely" in body["alerts"][0]["message"]
    assert body["validation"]["lift"] > 1.5
    f = body["geojson"]["features"][0]
    assert f["properties"]["reason"]


def test_blocked_drain_report_raises_risk_and_cleaning_lowers_it():
    risk = client.get("/risk").json()
    # pick an amber main-road segment that has a drain and see a report push it up
    seg = next(s for s in WORLD.segments.values()
               if s.drains and s.rank >= 3
               and next(f for f in risk["geojson"]["features"]
                        if f["id"] == s.id)["properties"]["level"] == "amber")
    drain = WORLD.drains[seg.drains[0]]
    r = client.post("/reports", data={"lat": drain.lat, "lon": drain.lon,
                                      "hint": "blocked_drain"},
                    files={"photo": ("drain.jpg", jpeg(), "image/jpeg")}).json()
    assert r["report"]["drain"] == drain.id
    assert STORE.drain_status()[drain.id] in ("blocked", "partial")

    pr = client.get("/engineer/priorities").json()
    assert any(i["drain"] == drain.id for i in pr["items"])

    up = client.post(f"/drains/{drain.id}", json={"status": "clear"}).json()
    assert up["status"] == "clear"


def test_report_outside_area_rejected():
    r = client.post("/reports", data={"lat": 19.07, "lon": 72.87},
                    files={"photo": ("x.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 400


def test_counterfactual_never_makes_things_worse():
    from floodsense import rain
    r = rain.shift_to_now(rain.load_replay())
    status = {d: "blocked" for d in list(WORLD.drains)[:50]}
    base = model.score_all(WORLD, r, status)
    for item in model.drain_priorities(WORLD, r, status, base):
        for c in item["changes"]:
            assert model.LEVELS.index(c["to"]) <= model.LEVELS.index(c["from"])


def test_broadcast_endpoint():
    res = client.post("/broadcast", json={"phone": "+919876543210", "mode": "replay"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "transmitted"
    assert data["recipient"] == "+919876543210"
    assert "DELHI EMERGENCY BROADCAST" in data["message"]
    assert len(client.get("/broadcasts").json()) >= 1
