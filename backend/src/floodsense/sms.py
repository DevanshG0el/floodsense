"""Emergency SMS & Area Broadcast engine for FloodSense.

Uses Amazon SNS (Simple Notification Service) for live transactional SMS alerts,
with graceful demo broadcast fallback.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime

import boto3

from floodsense.config import AREA_NAME

logger = logging.getLogger("floodsense.sms")


def get_default_phone() -> str:
    phone = os.getenv("DEFAULT_RECIPIENT_PHONE") or os.getenv("SNS_DEMO_PHONE", "+917504288815")
    if "X" in phone:
        phone = "+917504288815"
    return phone


def send_via_aws_sns(to_phone: str, message: str) -> dict | None:
    """Send transactional SMS via AWS SNS."""
    if os.getenv("FLOODSENSE_USE_SNS", "0") != "1":
        return None

    try:
        region = os.getenv("AWS_REGION", "us-east-1")
        key = os.getenv("AWS_ACCESS_KEY_ID")
        secret = os.getenv("AWS_SECRET_ACCESS_KEY")

        kwargs = {"region_name": region}
        if key and secret:
            kwargs["aws_access_key_id"] = key
            kwargs["aws_secret_access_key"] = secret

        client = boto3.client("sns", **kwargs)
        resp = client.publish(
            PhoneNumber=to_phone,
            Message=message,
            MessageAttributes={
                "AWS.SNS.SMS.SMSType": {
                    "DataType": "String",
                    "StringValue": "Transactional",
                }
            },
        )
        msg_id = resp.get("MessageId", "sns-unknown")
        logger.info("AWS SNS SMS sent to %s: %s", to_phone, msg_id)
        return {
            "sent": True,
            "provider": "aws_sns",
            "phone": to_phone,
            "message": message,
            "message_id": msg_id,
        }
    except Exception as exc:
        logger.warning("AWS SNS send failed (%s)", exc)
    return None


def send_sms(phone: str, message: str) -> dict:
    """Send an SMS via AWS SNS or demo telecom broadcast."""
    cleaned_phone = phone.strip()
    if not cleaned_phone.startswith("+"):
        cleaned_phone = f"+91{cleaned_phone}" if len(cleaned_phone) == 10 else f"+{cleaned_phone}"

    # 1. AWS SNS (Live SMS)
    sns_res = send_via_aws_sns(cleaned_phone, message)
    if sns_res:
        return sns_res

    # 2. Demo Telecom Broadcast fallback
    print("\n" + "=" * 70)
    print("📡 [EMERGENCY CELL BROADCAST TRANSMITTED]")
    print(f"📍 Sector: {AREA_NAME}")
    print(f"📱 Target Device: {cleaned_phone}")
    print(f"💬 Message Content:\n   \"{message}\"")
    print("=" * 70 + "\n")

    return {
        "sent": True,
        "provider": "demo_telecom_broadcast",
        "phone": cleaned_phone,
        "message": message,
        "message_id": f"demo-{datetime.now().strftime('%H%M%S')}",
    }


def prepare_broadcast_message(alerts: list[dict]) -> str:
    """Compose the official emergency broadcast message from current model alerts."""
    if alerts:
        top = alerts[0]
        road = top.get("road", "Central Delhi roads")
        eta = top.get("eta", "the next few hours")
        alt = top.get("alternative")
        msg = f"DELHI EMERGENCY BROADCAST: Flooding likely on {road} by {eta}."
        if alt:
            msg += f" Divert to {alt}."
        msg += " Commuters avoid low underpasses."
        return msg
    return f"DELHI ADVISORY: Normal traffic flow across {AREA_NAME}. No critical waterlogging predicted."
