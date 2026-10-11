"use client";

import { useState } from "react";

import { API_URL } from "@/lib/api";
import { useApp } from "@/lib/app-state";

/** Reads a short alert aloud with Amazon Polly, for people who find reading hard. */
export function ListenButton({ text, className = "" }: { text: string; className?: string }) {
  const { t, lang } = useApp();
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");

  const play = async () => {
    setState("loading");
    try {
      const res = await fetch(`${API_URL}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setState("idle");
      };
      setState("playing");
      await audio.play();
    } catch {
      setState("error");
    }
  };

  return (
    <button
      type="button"
      onClick={play}
      disabled={state === "loading" || state === "playing"}
      className={`inline-flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1.5 text-xs text-ink transition hover:bg-[#ebebeb] disabled:opacity-60 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
      </svg>
      {state === "loading" ? t.loading : state === "playing" ? t.listening : state === "error" ? t.listenFailed : t.listen}
    </button>
  );
}
