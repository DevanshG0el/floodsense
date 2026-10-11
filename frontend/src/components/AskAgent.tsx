"use client";

import { useState } from "react";

import { api, type AgentAnswer } from "@/lib/api";
import { useApp } from "@/lib/app-state";

import { Section, StatusPill } from "./Shell";

/** "Ask FloodSense": a question to the Strands agent, its answer, and the tools it used. */
export function AskAgent() {
  const { t, mode, lang } = useApp();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AgentAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const examples = lang === "hi" ? t.askExamplesHi : t.askExamples;

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setQ(question);
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.ask(question, mode));
    } catch (e) {
      setRes(null);
      setErr(e instanceof Error ? e.message : t.askFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t.askTitle} aside={<StatusPill level="ink">{t.askBadge}</StatusPill>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-2 rounded-full bg-sunken p-1 pl-4"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.askPlaceholder}
          aria-label={t.askTitle}
          maxLength={300}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-black/80 disabled:bg-ink-4"
        >
          {busy ? t.asking : t.ask}
        </button>
      </form>

      {!res && !busy && !err && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => ask(ex)}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition hover:border-ink hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {busy && <div className="mt-3 h-16 animate-pulse rounded-2xl bg-sunken" />}
      {err && <p className="mt-3 text-sm text-risk-red">{err}</p>}

      {res && !busy && (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed">{res.answer}</p>
          <details className="rounded-2xl bg-sunken px-4 py-3 text-xs text-ink-2" open>
            <summary className="cursor-pointer select-none text-ink">
              {t.askTrace} · {res.trace.length} · {res.seconds}s
            </summary>
            <ol className="mt-2 space-y-1.5">
              {res.trace.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink text-[9px] text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <code className="text-ink">
                      {s.tool}({Object.values(s.args).map((v) => `"${v}"`).join(", ")})
                    </code>{" "}
                    → {s.result}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-2 text-[11px] text-ink-3">Strands Agents · Amazon Bedrock {res.model}</div>
          </details>
        </div>
      )}
    </Section>
  );
}
