"""State that changes at runtime: drain status, citizen reports, broadcasts, photos.

LocalStore keeps everything in a JSON file so the app runs with no cloud account.
DynamoStore keeps the same data in one DynamoDB table and is used when
FLOODSENSE_TABLE is set (on Lambda). Photos go to S3 when FLOODSENSE_BUCKET is set.
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Protocol

from floodsense.config import STATE_DIR


class Store(Protocol):
    def drain_status(self) -> dict[str, str]: ...
    def set_drain(self, drain_id: str, status: str, by: str) -> None: ...
    def reports(self) -> list[dict]: ...
    def add_report(self, report: dict) -> dict: ...
    def broadcasts(self) -> list[dict]: ...
    def add_broadcast(self, broadcast: dict) -> dict: ...
    def reset(self) -> None: ...


def _stamp(item: dict) -> dict:
    return {"id": uuid.uuid4().hex[:10],
            "created_at": datetime.now().isoformat(timespec="seconds"), **item}


class LocalStore:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or STATE_DIR / "state.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        if not self.path.exists():
            self._write({"drains": {}, "reports": [], "drain_log": [], "broadcasts": []})

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
        report = _stamp(report)
        with self._lock:
            d = self._read()
            d["reports"].append(report)
            self._write(d)
        return report

    def broadcasts(self) -> list[dict]:
        return self._read().get("broadcasts", [])

    def add_broadcast(self, broadcast: dict) -> dict:
        broadcast = _stamp(broadcast)
        with self._lock:
            d = self._read()
            d.setdefault("broadcasts", []).append(broadcast)
            self._write(d)
        return broadcast

    def reset(self) -> None:
        with self._lock:
            self._write({"drains": {}, "reports": [], "drain_log": [], "broadcasts": []})


class DynamoStore:
    """One table, partition key `pk` (DRAIN, DRAINLOG, REPORT, BROADCAST), sort key `sk`.

    Reports and broadcasts are stored as a JSON string so floats need no Decimal juggling.
    """

    KINDS = ("DRAIN", "DRAINLOG", "REPORT", "BROADCAST")

    def __init__(self, table: str) -> None:
        import boto3

        self.table = boto3.resource("dynamodb").Table(table)

    def _items(self, pk: str) -> list[dict]:
        from boto3.dynamodb.conditions import Key

        items, kwargs = [], {"KeyConditionExpression": Key("pk").eq(pk)}
        while True:
            page = self.table.query(**kwargs)
            items += page["Items"]
            if "LastEvaluatedKey" not in page:
                return items
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    def drain_status(self) -> dict[str, str]:
        return {i["sk"]: i["status"] for i in self._items("DRAIN")}

    def set_drain(self, drain_id: str, status: str, by: str) -> None:
        now = datetime.now().isoformat(timespec="seconds")
        self.table.put_item(Item={"pk": "DRAIN", "sk": drain_id, "status": status})
        self.table.put_item(Item={"pk": "DRAINLOG", "sk": f"{now}#{uuid.uuid4().hex[:6]}",
                                  "drain": drain_id, "status": status, "by": by})

    def _add(self, pk: str, item: dict) -> dict:
        item = _stamp(item)
        self.table.put_item(Item={"pk": pk, "sk": f"{item['created_at']}#{item['id']}",
                                  "doc": json.dumps(item)})
        return item

    def _docs(self, pk: str) -> list[dict]:
        return [json.loads(i["doc"]) for i in self._items(pk)]  # sk sorts oldest first

    def reports(self) -> list[dict]:
        return self._docs("REPORT")

    def add_report(self, report: dict) -> dict:
        return self._add("REPORT", report)

    def broadcasts(self) -> list[dict]:
        return self._docs("BROADCAST")

    def add_broadcast(self, broadcast: dict) -> dict:
        return self._add("BROADCAST", broadcast)

    def reset(self) -> None:
        with self.table.batch_writer() as batch:
            for pk in self.KINDS:
                for i in self._items(pk):
                    batch.delete_item(Key={"pk": i["pk"], "sk": i["sk"]})


class Photos:
    """Report photos: a local folder, or an S3 bucket served through short-lived links."""

    def __init__(self) -> None:
        self.bucket = os.getenv("FLOODSENSE_BUCKET")
        self.dir = STATE_DIR / "uploads"
        if self.bucket:
            import boto3

            self.s3 = boto3.client("s3")
        else:
            self.dir.mkdir(parents=True, exist_ok=True)

    def put(self, name: str, data: bytes, content_type: str) -> None:
        if self.bucket:
            self.s3.put_object(Bucket=self.bucket, Key=f"uploads/{name}", Body=data,
                               ContentType=content_type)
        else:
            (self.dir / name).write_bytes(data)

    def link(self, name: str) -> str:
        return self.s3.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": f"uploads/{name}"}, ExpiresIn=3600)


def make_store() -> Store:
    table = os.getenv("FLOODSENSE_TABLE")
    return DynamoStore(table) if table else LocalStore()
