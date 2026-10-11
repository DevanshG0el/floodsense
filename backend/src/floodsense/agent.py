"""The FloodSense agent: Strands Agents SDK on Amazon Bedrock with four tools.

The tools wrap the same model the map uses, so the agent answers from the scored
roads and drains rather than from its own guesses. Every tool call is recorded and
returned with the answer, so the app can show the agent's trace.
"""

from __future__ import annotations

import difflib
import os
import re
import time
from collections.abc import Callable

from strands import Agent, tool
from strands.models import BedrockModel

from floodsense import model, sms
from floodsense.config import AREA_NAME, KNOWN_HOTSPOTS
from floodsense.geo import haversine_m

SYSTEM = f"""You are FloodSense, a flood-warning assistant for commuters and drain engineers
in {AREA_NAME}. Answer only from your tools; never invent roads, times or numbers.
Start with the tool that fits the question:
- rain_forecast for how much rain and when;
- flood_risk for whether a road will flood, when, why, and what to use instead;
- drain_priorities for which drain to clean first and what it changes;
- draft_alert to write the SMS text for the worst road.
Pass the road or place exactly as the user wrote it; the tool understands Hindi and
landmarks. If a road is not found, say so and offer the suggested names; never answer about
a different road as if it were the one asked about. "level" red means it will flood by
"floods_by"; amber means risky from "risky_from".
Drains are already ranked: the first one is the one to clean first.
Reply in at most four short sentences in plain language, with no tags or notes. Always give a
time and an alternative road when a road is at risk. Answer in English when the question
is in English, and in Hindi only when the question is written in Hindi."""


# Hindi spellings of the places people ask about; the map data has English names only
HINDI_NAMES = {
    "जनपथ": "Janpath", "मिंटो": "Minto", "कनॉट": "Connaught", "बाराखंभा": "Barakhamba",
    "टॉल्स्टॉय": "Tolstoy", "आईटीओ": "ITO", "मंडी हाउस": "Mandi House",
    "प्रगति मैदान": "Pragati Maidan", "दिल्ली गेट": "Delhi Gate", "दरियागंज": "Daryaganj",
    "बहादुर शाह ज़फ़र": "Bahadur Shah Zafar", "तिलक": "Tilak", "बाबा खड़क सिंह": "Baba Kharak Singh",
    "जवाहरलाल नेहरू": "Jawaharlal Nehru", "आसफ़ अली": "Asaf Ali", "कस्तूरबा गांधी": "Kasturba Gandhi",
}


def to_english(name: str) -> str:
    for hi, en in HINDI_NAMES.items():
        name = name.replace(hi, en)
    return re.sub(r"\s*(मार्ग|रोड|पुल|ब्रिज)\s*", " ", name).strip()


def ask(question: str, run: Callable[[], tuple[dict, dict]], world: model.World,
        drain_status: Callable[[], dict]) -> dict:
    """Answer one question. `run` returns (rain, scored) for the current mode."""
    trace: list[dict] = []

    def log(name: str, args: dict, summary: str) -> None:
        trace.append({"tool": name, "args": args, "result": summary})

    @tool
    def rain_forecast() -> dict:
        """Hourly rain for the next hours: total mm, the peak hour and its intensity."""
        _, scored = run()
        hours = scored["rain"]["hours"]
        peak = max(hours, key=lambda h: h["mm"])
        out = {"total_mm": scored["rain"]["total_mm"], "peak_mm_per_hour": peak["mm"],
               "peak_at": peak["time"][11:16], "source": scored["rain"].get("source", ""),
               "hours": [{"time": h["time"][11:16], "mm": h["mm"]} for h in hours]}
        log("rain_forecast", {}, f"{out['total_mm']} mm, peak {out['peak_mm_per_hour']} mm/h at {out['peak_at']}")
        return out

    @tool
    def flood_risk(road: str = "") -> dict:
        """Flood risk per road. Give a road name to check one road, or leave empty for the
        roads most likely to flood, with time, reason and an alternative road.

        Args:
            road: part of a road name, for example "Minto" or "Janpath". Empty for all.
        """
        _, scored = run()
        if not road:
            alerts = model.alerts(world, scored, limit=6)
            log("flood_risk", {}, f"{len(alerts)} roads at risk")
            return {"roads_at_risk": [{k: a[k] for k in ("road", "eta", "leave_by", "alternative", "reason")}
                                      for a in alerts]}
        q = to_english(road).lower().strip()
        segs = [(sid, r) for sid, r in scored["segments"].items()
                if q in (world.segments[sid].name or "").lower()]
        exact = [s for s in segs if (world.segments[s[0]].name or "").lower() == q]
        segs = exact or segs  # "Janpath" means Janpath, not Janpath Lane
        if not segs:  # "Minto Road" -> try the most distinctive word on its own
            words = [w for w in q.split() if len(w) > 3 and w not in ("road", "marg", "lane", "bridge")]
            segs = [(sid, r) for sid, r in scored["segments"].items()
                    if words and words[0] in (world.segments[sid].name or "").lower()]
        place = None if segs else next((h for h in KNOWN_HOTSPOTS
                      if any(w in h["name"].lower() for w in q.split() if len(w) > 2)), None)
        if not segs and place:  # landmarks like "Minto Bridge" are not road names in the map data
            segs = [(sid, r) for sid, r in scored["segments"].items()
                    if haversine_m(place["lat"], place["lon"], world.segments[sid].low_point[1],
                                   world.segments[sid].low_point[0]) <= 200]
        if not segs:
            names = sorted({s.name for s in world.segments.values() if s.name})
            close = difflib.get_close_matches(road, names, n=4, cutoff=0.4)
            log("flood_risk", {"road": road}, "no such road")
            return {"error": f"No road matching '{road}' in {AREA_NAME}.",
                    "did_you_mean": close, "landmarks": [h["name"] for h in KNOWN_HOTSPOTS]}
        rank = {"green": 0, "amber": 1, "red": 2}
        sid, worst = max(segs, key=lambda s: (rank[s[1]["level"]], -(s[1]["eta_hours"] or 99)))
        alt = model.alternative_for(world, sid, scored["segments"]) if worst["level"] != "green" else None
        out = {"road": place["name"] if place else world.segments[sid].name,
               "level": worst["level"], "floods_by": worst["eta"],
               "risky_from": worst["risky_from"], "reason": worst["reason"], "alternative": alt,
               "segments_checked": len(segs)}
        log("flood_risk", {"road": road}, f"{out['road']}: {out['level']}"
            + (f" by {out['floods_by']}" if out["floods_by"] else ""))
        return out

    @tool
    def drain_priorities() -> dict:
        """Drains to clean first, ranked by how many roads stop flooding when cleared."""
        rain, scored = run()
        items = model.drain_priorities(world, rain, drain_status(), scored, top=5)
        log("drain_priorities", {}, f"top drain {items[0]['drain']}" if items else "none needed")
        return {"clean_in_this_order": [
            {"rank": n, "drain": i["drain"], "road": i["road"], "status": i["status"],
             "what_changes": i["summary"]} for n, i in enumerate(items, 1)]}

    @tool
    def draft_alert() -> dict:
        """Write the SMS alert text for the road most likely to flood. Does not send it."""
        _, scored = run()
        text = sms.prepare_broadcast_message(model.alerts(world, scored))
        log("draft_alert", {}, text)
        return {"sms": text}

    model_id = os.getenv("BEDROCK_AGENT_MODEL_ID", "amazon.nova-pro-v1:0")
    agent = Agent(
        model=BedrockModel(model_id=model_id, region_name=os.getenv("AWS_REGION", "us-east-1"),
                           temperature=0),
        tools=[rain_forecast, flood_risk, drain_priorities, draft_alert],
        system_prompt=SYSTEM, callback_handler=None)
    t = time.time()
    result = agent(question)
    answer = re.sub(r"<thinking>.*?</thinking>", "", str(result), flags=re.DOTALL).strip()
    return {"answer": answer, "trace": trace, "model": model_id,
            "seconds": round(time.time() - t, 1)}
