"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  CameraIcon,
  FloodMap,
  Frame,
  LevelBadge,
  PinIcon,
  PrimaryButton,
  Section,
  StatusPill,
  TopBar,
} from "@/components/Shell";
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
      setResult(await api.report(form));
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

  const left = (
    <>
      <Section>
        <h1 className="text-[28px] font-light leading-tight tracking-tight">{t.reportTitle}</h1>
        <p className="mt-1.5 text-sm text-ink-2">{t.reportSub}</p>
      </Section>

      {result ? (
        <Section>
          <ResultCard result={result} onAgain={startOver} />
        </Section>
      ) : (
        <>
          <Section title={<Step n={1} title={t.step1} done={!!kind} />}>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["blocked_drain", t.blockedDrain, t.blockedDrainHint],
                  ["waterlogging", t.waterlogging, t.waterloggingHint],
                ] as const
              ).map(([k, label, hint]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`rounded-2xl p-4 text-left transition ${
                    kind === k ? "bg-ink text-white" : "bg-sunken text-ink hover:bg-[#ebebeb]"
                  }`}
                >
                  <KindIcon kind={k} className="h-6 w-6" />
                  <div className="mt-3 text-sm font-medium">{label}</div>
                  <div className={`mt-0.5 text-xs ${kind === k ? "text-white/70" : "text-ink-3"}`}>{hint}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title={<Step n={2} title={t.step2} done={!!file} />}>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Your photo" className="h-20 w-20 rounded-2xl object-cover" />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="rounded-full bg-sunken px-4 py-2 text-sm hover:bg-[#ebebeb]"
                >
                  {t.changePhoto}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-4 py-7 text-sm text-ink-2 transition hover:border-ink hover:text-ink"
              >
                <CameraIcon className="h-6 w-6" />
                {t.takePhoto}
              </button>
            )}
          </Section>

          <Section title={<Step n={3} title={t.step3} done={!!pin} />}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={locate}
                className="flex items-center gap-1.5 rounded-full bg-sunken px-4 py-2 text-sm hover:bg-[#ebebeb]"
              >
                <PinIcon className="h-4 w-4" />
                {t.useMyLocation}
              </button>
              {pin ? (
                <StatusPill level="green">
                  {t.pinPlaced} · {pin.lat.toFixed(4)}, {pin.lon.toFixed(4)}
                </StatusPill>
              ) : (
                <span className="text-xs text-ink-3">{locMsg ?? t.tapMapToPlace}</span>
              )}
            </div>
          </Section>

          <Section>
            {error && <p className="mb-3 rounded-2xl bg-sunken px-3 py-2 text-sm text-risk-red">{error}</p>}
            <PrimaryButton onClick={submit} disabled={!kind || !file || !pin || sending} className="w-full py-3.5">
              {sending ? t.sending : t.submit}
            </PrimaryButton>
          </Section>
        </>
      )}
    </>
  );

  const right = (
    <>
      <TopBar />
      <div className="relative h-[55dvh] overflow-hidden rounded-panel bg-white md:h-auto md:flex-1">
        <FloodMap
          center={CENTER}
          bbox={BBOX}
          pin={pin}
          focus={focus}
          onMapClick={(lon, lat) => !result && inArea(lat, lon) && setPin({ lon, lat })}
          className="h-full w-full"
          label="Pick the report location"
        />
        {!pin && !result && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
            <StatusPill level="ink" tone="white">
              {t.tapMap}
            </StatusPill>
          </div>
        )}
        <div className="absolute bottom-3 left-3 w-[min(340px,calc(100%-1.5rem))] rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm">{t.recent}</div>
          {recent === null ? (
            <div className="h-14 animate-pulse rounded-xl bg-sunken" />
          ) : recent.length === 0 ? (
            <p className="text-xs text-ink-3">{t.noReports}</p>
          ) : (
            <ul className="space-y-2">
              {recent.slice(0, 3).map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(r.photo_url)}
                    alt=""
                    onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                    className="h-10 w-10 shrink-0 rounded-xl bg-sunken object-cover"
                  />
                  <div className="min-w-0 text-sm">
                    <div className="truncate">{CATEGORY_LABEL[r.category]}</div>
                    <div className="truncate text-xs text-ink-3">
                      {r.created_at.slice(11, 16)} · {r.drain ?? r.segment ?? "unmatched"} ·{" "}
                      {r.verified ? t.aiVerified : t.aiUnverified}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );

  return <Frame left={left} right={right} leftFirstOnMobile />;
}

function Step({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
          done ? "bg-ink text-white" : "bg-sunken text-ink-2"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {title}
    </span>
  );
}

function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const };
  return kind === "blocked_drain" ? (
    <svg viewBox="0 0 24 24" {...s} className={className} aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M8 6v12M12 6v12M16 6v12" />
      <path d="M6 14c2-1 4 1 6 0s4-1 6 0" strokeWidth="2.2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" {...s} className={className} aria-hidden>
      <path d="M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
      <path d="M3 19c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
      <path d="M12 3c2 2.6 3.5 4.4 3.5 6.2a3.5 3.5 0 0 1-7 0C8.5 7.4 10 5.6 12 3z" />
    </svg>
  );
}

function ResultCard({ result, onAgain }: { result: ReportResult; onAgain: () => void }) {
  const { t } = useApp();
  const r = result.report;
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(r.photo_url)} alt="Reported photo" className="h-24 w-24 rounded-2xl object-cover" />
        <div className="min-w-0">
          <StatusPill level={r.verified ? "green" : "ink"}>{r.verified ? t.aiVerified : t.aiUnverified}</StatusPill>
          <div className="mt-2 text-lg">{CATEGORY_LABEL[r.category]}</div>
          <div className="text-xs text-ink-3">
            {t.severity} {r.severity}/5
          </div>
        </div>
      </div>
      {r.observations && <p className="text-sm text-ink-2">{r.observations}</p>}
      <div className="rounded-2xl bg-sunken p-4 text-sm">
        {result.message}
        {result.impact && (
          <div className="mt-3 flex items-center gap-2">
            <LevelBadge level={result.impact.from} />
            <span aria-hidden className="text-ink-3">
              →
            </span>
            <LevelBadge level={result.impact.to} />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Link href="/" className="flex-1 rounded-full bg-ink py-3 text-center text-sm font-medium text-white hover:bg-black/80">
          {t.seeOnMap}
        </Link>
        <button type="button" onClick={onAgain} className="flex-1 rounded-full bg-sunken py-3 text-sm hover:bg-[#ebebeb]">
          {t.another}
        </button>
      </div>
    </div>
  );
}
