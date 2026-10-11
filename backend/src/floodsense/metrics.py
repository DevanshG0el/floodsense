"""CloudWatch custom metrics (namespace FloodSense). A no-op unless FLOODSENSE_METRICS=1."""

from __future__ import annotations

import logging
import os

log = logging.getLogger("floodsense.metrics")
_client = None


def put(name: str, value: float = 1, unit: str = "Count") -> None:
    global _client
    if os.getenv("FLOODSENSE_METRICS", "0") != "1":
        return
    try:
        if _client is None:
            import boto3

            _client = boto3.client("cloudwatch")
        _client.put_metric_data(Namespace="FloodSense",
                                MetricData=[{"MetricName": name, "Value": value, "Unit": unit}])
    except Exception as exc:  # metrics must never break a request
        log.warning("metric %s not sent: %s", name, exc)
