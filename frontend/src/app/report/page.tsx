"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, FloodMap, LevelBadge } from "@/components/Shell";
import { api, photoUrl, type Report, type ReportResult } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { BBOX, CENTER, inArea } from "@/lib/area";

type Kind = "blocked_drain" | "waterlogging";

const CATEGORY_LABEL: Record<Report["category"], string> = {
  blocked_drain: "Blocked drain",
  waterlogging: "Water on the road",
  clear_drain: "Drain is clear",
  unrelated: "Not a drain or flooding",
};

export default function ReportPage() {
  const { t, mode, version, refresh } = useApp();
  const [kind, setKind] = useState<Kind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pin, setPin] = useState<{ lon: number; lat: number } | null>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; zoom?: number } | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [recent, setRecent] = useState<Report[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.reports().then(setRecent).catch(() => setRecent([]));
  }, [version]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setLocMsg(t.outsideArea);
      return;
    }
    setLocMsg(t.locating);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lon } = p.coords;
        if (inArea(lat, lon)) {
          setPin({ lat, lon });
          setFocus({ lat, lon, zoom: 17 });
          setLocMsg(null);
        } else {
          setLocMsg(t.outsideArea);
        }
      },
      () => setLocMsg(t.outsideArea),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const ready = kind && file && pin && !sending;

  const submit = async () => {
    if (!kind || !file || !pin) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    form.append("photo", file);
    form.append("lat", String(pin.lat));
    form.append("lon", String(pin.lon));
    form.append("hint", kind);
    form.append("mode", mode);
    try {
      const r = await api.report(form);
      setResult(r);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const startOver = () => {
    setKind(null);
    setFile(null);
    setPin(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t.reportTitle}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.reportSub}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {result ? (
            <ResultCard result={result} onAgain={startOver} />
          ) : (
            <>
              <Card>
                <Step n={1} title={t.step1} done={!!kind} />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(
                    [
                      ["blocked_drain", t.blockedDrain, t.blockedDrainHint, "🕳️"],
                      ["waterlogging", t.waterlogging, t.waterloggingHint, "🌊"],
                    ] as const
                  ).map(([k, label, hint, icon]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      aria-pressed={kind === k}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        kind === k ? "border-blue-700 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-2xl" aria-hidden>
                        {icon}
                      </div>
                      <div className="mt-2 font-semibold text-slate-900">{label}</div>
                      <div className="text-xs text-slate-600">{hint}</div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <Step n={2} title={t.step2} done={!!file} />
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {preview ? (
                  <div className="mt-3 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Your photo" className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200" />
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t.changePhoto}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="mt-3 flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 py-8 text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50/40"
                  >
                    <span className="text-2xl" aria-hidden>
                      📷
                    </span>
                    {t.takePhoto}
                  </button>
                )}
              </Card>

              <Card>
                <Step n={3} title={t.step3} done={!!pin} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={locate}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    📍 {t.useMyLocation}
                  </button>
                  <span className="text-xs text-slate-500">{locMsg ?? t.tapMapToPlace}</span>
                </div>
                <FloodMap
                  center={CENTER}
                  bbox={BBOX}
                  pin={pin}
                  focus={focus}
                  onMapClick={(lon, lat) => inArea(lat, lon) && setPin({ lon, lat })}
                  className="mt-3 h-64 rounded-xl ring-1 ring-slate-200"
                  label="Pick the report location"
                />
              </Card>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

              <button
                type="button"
                disabled={!ready}
                onClick={submit}
                className="w-full rounded-xl bg-blue-700 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {sending ? t.sending : t.submit}
              </button>
            </>
          )}
        </div>

        <aside>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{t.recent}</h2>
            {recent === null ? (
              <div className="mt-3 h-20 animate-pulse rounded-lg bg-slate-100" />
            ) : recent.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{t.noReports}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {recent.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex gap-3 py-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(r.photo_url)}
                      alt=""
                      onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                      className="h-12 w-12 shrink-0 rounded-md bg-slate-100 object-cover"
                    />
                    <div className="min-w-0 text-sm">
                      <div className="font-medium text-slate-900">{CATEGORY_LABEL[r.category]}</div>
                      <div className="truncate text-xs text-slate-500">
                        {r.created_at.slice(11, 16)} · {r.drain ?? r.segment ?? "unmatched"} ·{" "}
                        {r.verified ? t.aiVerified : t.aiUnverified}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
          done ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {title}
    </h2>
  );
}

function ResultCard({ result, onAgain }: { result: ReportResult; onAgain: () => void }) {
  const { t } = useApp();
  const r = result.report;
  return (
    <Card className="space-y-4">
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(r.photo_url)} alt="Reported photo" className="h-28 w-28 rounded-xl object-cover ring-1 ring-slate-200" />
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              r.verified ? "bg-blue-50 text-blue-800 ring-blue-600/20" : "bg-slate-100 text-slate-700 ring-slate-300"
            }`}
          >
            {r.verified ? `✓ ${t.aiVerified}` : t.aiUnverified}
          </span>
          <div className="mt-2 text-lg font-semibold text-slate-900">{CATEGORY_LABEL[r.category]}</div>
          <div className="text-sm text-slate-600">
            {t.severity}: {"●".repeat(r.severity)}
            <span className="text-slate-300">{"●".repeat(5 - r.severity)}</span>
          </div>
          {r.observations && <p className="mt-1 text-sm text-slate-600">{r.observations}</p>}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
        {result.message}
        {result.impact && (
          <div className="mt-2 flex items-center gap-2">
            <LevelBadge level={result.impact.from} />
            <span aria-hidden>→</span>
            <LevelBadge level={result.impact.to} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Link href="/" className="flex-1 rounded-xl bg-blue-700 py-3 text-center text-sm font-semibold text-white hover:bg-blue-800">
          {t.seeOnMap}
        </Link>
        <button
          type="button"
          onClick={onAgain}
          className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {t.another}
        </button>
      </div>
    </Card>
  );
}
