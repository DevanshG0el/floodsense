"""Flood alert SMS through Amazon SNS.

SNS is in the SMS sandbox, so it only delivers to phone numbers verified in the console.
When FLOODSENSE_USE_SNS is not 1, nothing is sent and the result says so.
"""

from __future__ import annotations

import logging
import os
import re

import boto3

from floodsense.config import AREA_NAME

logger = logging.getLogger("floodsense.sms")


def sns_enabled() -> bool:
    return os.getenv("FLOODSENSE_USE_SNS", "0") == "1"


def default_phone() -> str | None:
    """The verified demo number, kept in backend/.env rather than in the code."""
    phone = os.getenv("SNS_DEMO_PHONE", "")
    return phone if re.fullmatch(r"\+\d{10,15}", phone) else None


def normalise(phone: str) -> str | None:
    digits = re.sub(r"[\s-]", "", phone)
    if re.fullmatch(r"\d{10}", digits):
        digits = "+91" + digits
    return digits if re.fullmatch(r"\+\d{10,15}", digits) else None


def send_sms(phone: str, message: str) -> dict:
    if not sns_enabled():
        return {"sent": False, "provider": "demo", "phone": phone,
                "error": "SMS is switched off on this server, so nothing was sent."}
    try:
        resp = boto3.client("sns", region_name=os.getenv("AWS_REGION", "us-east-1")).publish(
            PhoneNumber=phone, Message=message,
            MessageAttributes={"AWS.SNS.SMS.SMSType": {"DataType": "String",
                                                       "StringValue": "Transactional"}})
    except Exception as exc:  # unverified number in the sandbox, throttling, no credentials
        logger.warning("SNS send failed: %s", exc)
        return {"sent": False, "provider": "aws_sns", "phone": phone, "error": str(exc)[:200]}
    logger.info("SNS SMS sent: %s", resp.get("MessageId"))
    return {"sent": True, "provider": "aws_sns", "phone": phone,
            "message_id": resp.get("MessageId")}


def prepare_broadcast_message(alerts: list[dict]) -> str:
    """One SMS from the top model alert: road, time, and where to go instead."""
    if not alerts:
        return f"FloodSense: no roads in {AREA_NAME} are expected to flood in the next hours."
    top = alerts[0]
    msg = f"FloodSense alert: {top.get('road') or 'A road'} in {AREA_NAME} likely floods by {top['eta']}."
    if top.get("alternative"):
        msg += f" Use {top['alternative']} instead."
    return msg + " Avoid low underpasses."
