"""Photo verification with Amazon Bedrock (Nova vision via the Converse API).

The model decides whether a citizen photo shows a blocked drain, waterlogging, a clear
drain, or something unrelated, and rates severity. If Bedrock is not configured yet the
report is accepted as 'unverified' and the app says so, rather than pretending.
"""

from __future__ import annotations

import json
import os
import re

PROMPT = """You are verifying a citizen report for a city flood-warning app in Delhi.
Look at the photo and answer with JSON only, no prose:
{"category": "blocked_drain" | "waterlogging" | "clear_drain" | "unrelated",
 "severity": 1-5 (1 = minor, 5 = road impassable / drain fully choked),
 "confidence": 0.0-1.0,
 "observations": "one short sentence describing what you see, for the drain engineer"}
Blocked drain means a storm drain, gutter or inlet clogged with garbage, silt, leaves or
plastic. Waterlogging means standing water on a road or footpath."""

CATEGORIES = {"blocked_drain", "waterlogging", "clear_drain", "unrelated"}


def bedrock_enabled() -> bool:
    return os.getenv("FLOODSENSE_USE_BEDROCK", "0") == "1"


def verify_photo(image: bytes, fmt: str, hint: str | None = None) -> dict:
    if not bedrock_enabled():
        return {"category": hint if hint in CATEGORIES else "blocked_drain",
                "severity": 3, "confidence": None, "verified": False,
                "observations": "AI verification is not connected yet; using the reporter's choice.",
                "model": None}
    import boto3

    model_id = os.getenv("BEDROCK_VISION_MODEL_ID", "amazon.nova-lite-v1:0")
    client = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_REGION", "us-east-1"))
    fmt = {"jpg": "jpeg"}.get(fmt.lower(), fmt.lower())
    resp = client.converse(
        modelId=model_id,
        messages=[{"role": "user", "content": [
            {"image": {"format": fmt, "source": {"bytes": image}}},
            {"text": PROMPT + (f"\nThe reporter says this is: {hint}." if hint else "")},
        ]}],
        inferenceConfig={"maxTokens": 300, "temperature": 0},
    )
    text = resp["output"]["message"]["content"][0]["text"]
    match = re.search(r"\{.*\}", text, re.DOTALL)
    data = json.loads(match.group(0)) if match else {}
    cat = data.get("category") if data.get("category") in CATEGORIES else "unrelated"
    return {"category": cat,
            "severity": int(min(5, max(1, int(data.get("severity", 3))))),
            "confidence": float(data.get("confidence", 0.5)),
            "observations": str(data.get("observations", ""))[:300],
            "verified": True, "model": model_id}
