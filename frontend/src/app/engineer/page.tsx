"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, ErrorState, FloodMap, LevelBadge, Skeleton } from "@/components/Shell";
import { api, type DrainProps, type Level, type PrioritiesResponse, type RiskResponse } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { BBOX, CENTER } from "@/lib/area";

type Toast = { drain: string; changed: { road: string | null; from: Level; to: Level }[] } | null;

export default function EngineerPage() {
  const { t, mode, version, refresh } = useApp();
  const [prio, setPrio] = useState<PrioritiesResponse | null>(null);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [drains, setDrains] = useState<GeoJSON.FeatureCollection<GeoJSON.Point, DrainProps> | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; zoom?: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let live = true;
    Promise.all([api.priorities(mode), api.risk(mode), api.drains()])
      .then(([p, r, d]) => {
        if (!live) return;
        setPrio(p);
        setRisk(r);
        setDrains(d);
        setError(false);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [mode, version, attempt]);

  const highlight = useMemo(() => prio?.items.map((i) => i.drain) ?? [], [prio]);

  const markCleaned = async (id: string) => {
    setBusy(id);
    try {
      const r = await api.setDrain(id, "clear", mode);
      // one line per road, even when several of its segments changed
      const seen = new Set<string>();
      const changed = r.changed.filter((c) => {
        const k = `${c.road ?? "Lane"}|${c.from}|${c.to}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setToast({ drain: id, changed });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const reportedCount = prio?.items.filter((i) => i.reported).length ?? 0;

  return (
    <div className="mx-auto grid max-w-[1400px] md:h-[calc(100dvh-3.5rem)] md:grid-cols-[440px_1fr] md:grid-rows-[minmax(0,1fr)]">
      <aside className="order-2 space-y-3 overflow-y-auto bg-slate-50 p-4 md:order-1 md:border-r md:border-slate-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t.engTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{t.engSub}</p>
        </div>

        {error && <ErrorState onRetry={load} />}
        {!prio && !error && (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        )}

        {prio && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="text-3xl font-semibold tabular-nums text-red-700">{prio.red_now}</div>
                <div className="text-xs text-slate-600">{t.roadsRed}</div>
              </Card>
              <Card className="p-3">
                <div className="text-3xl font-semibold tabular-nums text-slate-900">{reportedCount}</div>
                <div className="text-xs text-slate-600">{t.reported}</div>
              </Card>
            </div>

            {toast && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900" role="status">
                <div className="font-semibold">
                  {toast.drain} {t.cleaned.toLowerCase()} ✓
                </div>
                {toast.changed.length === 0 ? (
                  <div>No road changed colour for this storm.</div>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {toast.changed.slice(0, 4).map((c, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-1.5">
                        <span>{c.road ?? "Lane"}</span>
                        <LevelBadge level={c.from} />→<LevelBadge level={c.to} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {prio.items.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-600">{t.noPriorities}</p>
              </Card>
            ) : (
              <ol className="space-y-2">
                {prio.items.map((it, idx) => (
                  <li key={it.drain}>
                    <Card
                      className={`p-3 transition ${active === it.drain ? "ring-2 ring-blue-200" : ""}`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          setActive(it.drain);
                          setFocus({ lon: it.lon, lat: it.lat, zoom: 17 });
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-900">{it.drain}</span>
                          <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              it.status === "blocked"
                                ? "bg-red-100 text-red-800"
                                : it.status === "partial"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {it.status === "blocked" ? t.reported : it.status === "partial" ? t.partial : t.notInspected}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-800">{it.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {it.road ? `${it.road} · ` : ""}
                          {it.source === "osm" ? t.osmMapped : t.estimated}
                        </p>
                      </button>
                      {it.reports.length > 0 && (
                        <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                          “{it.reports[it.reports.length - 1].observations}”
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={busy === it.drain}
                        onClick={() => markCleaned(it.drain)}
                        className="mt-3 w-full rounded-lg bg-green-700 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:bg-slate-300"
                      >
                        {busy === it.drain ? "…" : `✓ ${t.markCleaned}`}
                      </button>
                    </Card>
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              onClick={() => api.reset().then(() => { setToast(null); refresh(); })}
              className="text-xs text-slate-500 underline-offset-2 hover:underline"
            >
              {t.resetDemo}
            </button>
          </>
        )}
      </aside>

      <div className="order-1 h-[45dvh] md:order-2 md:h-full">
        <FloodMap
          center={CENTER}
          bbox={BBOX}
          segments={risk?.geojson}
          drains={drains ?? undefined}
          highlightDrains={highlight}
          focus={focus}
          onlyAtRisk
          className="h-full w-full"
          label="Drains and at-risk roads"
        />
      </div>
    </div>
  );
}
