"""Read an alert aloud with Amazon Polly, in Hindi or English (Indian English voice)."""

from __future__ import annotations

import os

VOICES = {"hi": ("Kajal", "hi-IN"), "en": ("Kajal", "en-IN")}


def speak(text: str, lang: str = "en") -> bytes:
    import boto3

    voice, code = VOICES.get(lang, VOICES["en"])
    resp = boto3.client("polly", region_name=os.getenv("AWS_REGION", "us-east-1")).synthesize_speech(
        Text=text[:600], OutputFormat="mp3", VoiceId=voice, LanguageCode=code, Engine="neural")
    return resp["AudioStream"].read()
