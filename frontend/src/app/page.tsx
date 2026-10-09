"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import RainTimeline from "@/components/RainTimeline";
import { Card, ErrorState, FloodMap, LevelBadge, Skeleton } from "@/components/Shell";
import { api, type Alert, type RiskResponse, type SegmentDetail } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { BBOX, CENTER } from "@/lib/area";

function midpoint(coords: number[][]) {
  const c = coords[Math.floor(coords.length / 2)];
  return { lon: c[0], lat: c[1] };
}

export default function CommuterPage() {
  const { t, mode, version } = useApp();
  const [data, setData] = useState<RiskResponse | null>(null);
  const [error, setError] = useState(false);
  const [hour, setHour] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; zoom?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let live = true;
    api
      .risk(mode)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(false);
        setHour(null);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [mode, version, attempt]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    api
      .segment(selected, mode)
      .then((d) => live && setDetail(d))
      .catch(() => live && setDetail(null));
    return () => {
      live = false;
    };
  }, [selected, mode, version]);

  const byId = useMemo(() => {
    const m = new Map<string, number[][]>();
    data?.geojson.features.forEach((f) => m.set(f.properties.id, f.geometry.coordinates));
    return m;
  }, [data]);

  // counts follow the time slider so the numbers match what the map shows
  const counts = useMemo(() => {
    const c = { green: 0, amber: 0, red: 0 };
    if (!data) return c;
    const key = { g: "green", a: "amber", r: "red" } as const;
    for (const f of data.geojson.features) {
      const tl = f.properties.timeline;
      const lv = hour === null || !tl ? f.properties.level : key[tl[Math.min(hour, tl.length - 1)] as "g" | "a" | "r"];
      c[lv] += 1;
    }
    return c;
  }, [data, hour]);

  const openAlert = (a: Alert) => {
    setSelected(a.segment);
    const c = byId.get(a.segment);
    if (c) setFocus({ ...midpoint(c), zoom: 16 });
  };

  const rain = data?.rain;

  return (
    <div className="mx-auto grid max-w-[1400px] md:h-[calc(100dvh-3.5rem)] md:grid-cols-[1fr_420px] md:grid-rows-[minmax(0,1fr)]">
      <div className="relative h-[52dvh] md:h-full">
        <FloodMap
          center={CENTER}
          bbox={BBOX}
          segments={data?.geojson}
          hour={hour}
          selectedId={selected}
          onSelectSegment={setSelected}
          focus={focus}
          className="h-full w-full"
        />
        <Legend />
        {rain && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-xl bg-white/95 px-3 py-2 text-xs shadow-sm ring-1 ring-slate-200">
            <div className="font-semibold text-slate-900">
              {mode === "replay" ? t.replayBanner : t.liveBanner}
            </div>
            <div className="text-slate-600">
              {mode === "replay" ? rain.label : `Open-Meteo · ${rain.fetched_at?.slice(11) ?? ""}`}
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-3 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4">
        {error && <ErrorState onRetry={load} />}
        {!data && !error && (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
            <Skeleton className="h-56" />
          </>
        )}

        {data && (
          <>
            <Card>
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-4xl font-semibold tabular-nums text-red-700">{counts.red}</div>
                  <div className="text-xs text-slate-600">{t.roadsRed}</div>
                </div>
                <div className="pb-1">
                  <div className="text-xl font-semibold tabular-nums text-amber-600">{counts.amber}</div>
                  <div className="text-xs text-slate-600">{t.roadsAmber}</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{t.tapRoad}</p>
            </Card>

            {selected && (
              <SelectedRoad
                detail={detail?.id === selected ? detail : null}
                onClose={() => setSelected(null)}
                fallbackName={data.geojson.features.find((f) => f.properties.id === selected)?.properties.name}
              />
            )}

            <Card>
              <RainTimeline hours={data.rain.hours} hour={hour} onChange={setHour} />
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-900">{t.alertsTitle}</h3>
              {data.alerts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">{t.noAlerts}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.alerts.map((a) => (
                    <li key={a.segment}>
                      <button
                        type="button"
                        onClick={() => openAlert(a)}
                        className={`w-full rounded-xl border p-3 text-left transition hover:border-red-300 hover:bg-red-50/50 ${
                          selected === a.segment ? "border-red-300 bg-red-50/60" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{a.road}</span>
                          <span className="shrink-0 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                            {a.eta}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">
                          {a.leave_by ? `${t.passBefore} ${a.leave_by}` : t.avoidNow}
                          {a.alternative ? ` ${t.orUse} ${a.alternative}.` : "."}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <HowWeKnow data={data} />
          </>
        )}
      </aside>
    </div>
  );
}

function SelectedRoad({
  detail,
  onClose,
  fallbackName,
}: {
  detail: SegmentDetail | null;
  onClose: () => void;
  fallbackName?: string | null;
}) {
  const { t } = useApp();
  return (
    <Card className="border-slate-300 ring-2 ring-blue-100">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{detail?.highway?.replace("_", " ") ?? ""}</div>
          <h3 className="text-lg font-semibold text-slate-900">{detail?.name ?? fallbackName ?? "Unnamed lane"}</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" aria-label={t.close}>
          ✕
        </button>
      </div>
      {!detail ? (
        <Skeleton className="mt-3 h-20" />
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LevelBadge level={detail.level} />
            {detail.eta && (
              <span className="text-sm text-slate-700">
                {t.floodsBy} <b className="tabular-nums">{detail.eta}</b>
              </span>
            )}
            {!detail.eta && detail.risky_from && (
              <span className="text-sm text-slate-700">
                {t.riskyFrom} <b className="tabular-nums">{detail.risky_from}</b>
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">{t.why}: </span>
            {detail.reason}
          </p>
          {detail.alternative && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
              {t.alternative}: <b>{detail.alternative}</b>
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function HowWeKnow({ data }: { data: RiskResponse }) {
  const { t } = useApp();
  const v = data.validation;
  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-900">{t.howWeKnow}</h3>
      {v.lift && (
        <p className="mt-2 text-sm text-slate-700">
          {t.liftLine} <b className="text-slate-900">{v.lift}×</b> {t.timesMore}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">{v.note}</p>
      <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.sources}</h4>
      <ul className="mt-1 space-y-1 text-xs text-slate-600">
        <li>Rain: Open-Meteo, {data.mode === "replay" ? "historical forecast archive" : "hourly forecast"}</li>
        <li>Elevation: Copernicus DEM 30 m, Registry of Open Data on AWS</li>
        <li>Roads, railways: © OpenStreetMap contributors</li>
        <li>Drains: OpenStreetMap where mapped, otherwise estimated at road low points</li>
        <li>Blocked drains: citizen photo reports</li>
      </ul>
    </Card>
  );
}

function Legend() {
  const { t } = useApp();
  return (
    <div className="absolute bottom-3 left-3 flex gap-3 rounded-xl bg-white/95 px-3 py-2 text-xs shadow-sm ring-1 ring-slate-200">
      {(["red", "amber", "green"] as const).map((l) => (
        <span key={l} className="flex items-center gap-1.5 text-slate-700">
          <span
            className="h-1.5 w-5 rounded-full"
            style={{ background: l === "red" ? "#dc2626" : l === "amber" ? "#f59e0b" : "#16a34a" }}
          />
          {t[l]}
        </span>
      ))}
    </div>
  );
}
