"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CloseIcon,
  ErrorState,
  FloodMap,
  Frame,
  IconButton,
  InfoIcon,
  LevelBadge,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  Section,
  Segmented,
  Skeleton,
  StatusPill,
  TopBar,
} from "@/components/Shell";
import { Gauge, HourRuler, RainBars } from "@/components/Viz";
import { api, type Alert, type DrainProps, type Level, type RiskResponse, type SegmentDetail } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { BBOX, CENTER } from "@/lib/area";
import { LEVEL_COLOR, areaSeverity, rainRateCategory, rainTotalCategory } from "@/lib/levels";

type Layer = "all" | "risk" | "drains";
type Focus = { lon: number; lat: number; zoom?: number } | null;
const CHAR: Record<string, Level> = { g: "green", a: "amber", r: "red" };

function midpoint(coords: number[][]) {
  const c = coords[Math.floor(coords.length / 2)];
  return { lon: c[0], lat: c[1] };
}

function levelAt(p: { level: Level; timeline: string }, hour: number | null): Level {
  if (hour === null || !p.timeline) return p.level;
  return CHAR[p.timeline[Math.min(hour, p.timeline.length - 1)]] ?? "green";
}

export default function CommuterPage() {
  const { t, mode, version } = useApp();
  const [data, setData] = useState<RiskResponse | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hour, setHour] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SegmentDetail | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [layer, setLayer] = useState<Layer>("all");
  const [drains, setDrains] = useState<GeoJSON.FeatureCollection<GeoJSON.Point, DrainProps> | null>(null);
  const [allAlerts, setAllAlerts] = useState(false);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .risk(mode)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(false);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [mode, version, attempt]);

  useEffect(() => {
    if (layer !== "drains") return;
    let live = true;
    api
      .drains()
      .then((d) => live && setDrains(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [layer, version]);

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

  // play the storm hour by hour
  const nHours = data?.rain.hours.length ?? 0;
  useEffect(() => {
    if (!playing || !nHours) return;
    const id = window.setInterval(() => {
      setHour((h) => {
        const next = h === null ? 0 : h + 1;
        if (next >= nHours - 1) setPlaying(false);
        return Math.min(next, nHours - 1);
      });
    }, 1100);
    return () => window.clearInterval(id);
  }, [playing, nHours]);

  const counts = useMemo(() => {
    const c: Record<Level, number> = { green: 0, amber: 0, red: 0 };
    data?.geojson.features.forEach((f) => (c[levelAt(f.properties, hour)] += 1));
    return c;
  }, [data, hour]);

  const coordsById = useMemo(() => {
    const m = new Map<string, number[][]>();
    data?.geojson.features.forEach((f) => m.set(f.properties.id, f.geometry.coordinates));
    return m;
  }, [data]);

  const select = (id: string | null) => {
    setSelected(id);
    if (!id) return;
    const c = coordsById.get(id);
    if (c) setFocus({ ...midpoint(c), zoom: 16 });
  };

  const pickHour = (i: number) => {
    setPlaying(false);
    setHour(i);
  };

  const total = data?.geojson.features.length ?? 0;
  const sev = areaSeverity(counts.red, total, t);
  const hours = data?.rain.hours ?? [];
  const stormTotal = hours.reduce((s, h) => s + h.mm, 0);
  const peak = hours.reduce((m, h) => Math.max(m, h.mm), 0);
  const nowMm = hour !== null ? (hours[hour]?.mm ?? 0) : peak;
  const freshness = data
    ? mode === "replay"
      ? `${t.replayOf} ${data.rain.label?.replace("Replay of the ", "").replace(" storm", "") ?? ""}`
      : `${t.updated} ${data.rain.fetched_at?.slice(11, 16) ?? ""}`
    : null;
  const alerts = data?.alerts ?? [];

  const left = (
    <>
      {error && <ErrorState onRetry={() => setAttempt((a) => a + 1)} />}
      {!data && !error && (
        <div className="space-y-4 p-6">
          <Skeleton className="h-28" />
          <Skeleton className="h-44" />
          <Skeleton className="h-32" />
        </div>
      )}
      {data && (
        <>
          <Section>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{t.area}</span>
              <span className="text-ink-3">{t.areaSub}</span>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <span className="num-hero text-[84px] md:text-[96px]">{counts.red}</span>
              <div className="mt-3 flex flex-col items-start gap-2">
                <StatusPill level={sev.level}>{sev.label}</StatusPill>
                <span className="text-xs text-ink-3">
                  {hour === null ? t.worstCase : `${t.showingAt} ${hours[hour]?.time.slice(11, 16)}`}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-2">
              {t.roadsRed} · <span className="text-ink">{counts.amber}</span> {t.roadsAmber}
            </p>
          </Section>

          <Section
            title={t.rainBreakdown}
            aside={
              <span className="text-ink-3" title={data.rain.source}>
                <InfoIcon className="h-4 w-4" />
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 text-xs text-ink-3">{t.stormRain}</div>
                <Gauge value={stormTotal} max={200} unit="mm" {...rainTotalCategory(stormTotal, t)} />
              </div>
              <div className="border-l border-line pl-4">
                <div className="mb-2 text-xs text-ink-3">{t.peakRain}</div>
                <Gauge value={peak} max={50} unit="mm/h" {...rainRateCategory(peak, t)} />
              </div>
            </div>
          </Section>

          <Section>
            <div className="grid grid-cols-[88px_1fr] gap-3">
              <div className="space-y-5 pt-1">
                <div>
                  <div className="text-xs text-ink-3">{hour === null ? t.peakRain : t.rainThisHour}</div>
                  <div className="text-lg tabular-nums">
                    {nowMm.toFixed(0)} <span className="text-xs text-ink-3">mm/h</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-ink-3">{t.stormTotal}</div>
                  <div className="text-lg tabular-nums">
                    {stormTotal.toFixed(0)} <span className="text-xs text-ink-3">mm</span>
                  </div>
                </div>
              </div>
              <RainBars hours={hours} selected={hour} onSelect={pickHour} />
            </div>
          </Section>

          <Section
            title={t.alertsTitle}
            aside={
              alerts.length > 3 && (
                <button type="button" onClick={() => setAllAlerts((v) => !v)} className="text-xs text-ink-2 hover:text-ink">
                  {allAlerts ? t.showLess : `${t.viewAll} (${alerts.length})`}
                </button>
              )
            }
          >
            {alerts.length === 0 ? (
              <p className="text-sm text-ink-2">{t.noAlerts}</p>
            ) : (
              <ul className="-mx-2">
                {(allAlerts ? alerts : alerts.slice(0, 3)).map((a) => (
                  <AlertRow key={a.segment} a={a} active={selected === a.segment} onOpen={() => select(a.segment)} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title={t.howWeKnow}
            aside={
              <button type="button" onClick={() => setShowSources((v) => !v)} className="text-xs text-ink-2 hover:text-ink">
                {t.sources} {showSources ? "−" : "+"}
              </button>
            }
          >
            {data.validation.lift && (
              <p className="text-sm text-ink-2">
                {t.liftLine} <span className="font-medium text-ink">{data.validation.lift}×</span> {t.timesMore}
              </p>
            )}
            {showSources && (
              <ul className="mt-3 space-y-1.5 text-xs text-ink-2">
                <li>Rain · Open-Meteo {data.mode === "replay" ? "historical forecast archive" : "hourly forecast"}</li>
                <li>Elevation · Copernicus DEM 30 m, Registry of Open Data on AWS</li>
                <li>Roads, railways · © OpenStreetMap contributors</li>
                <li>Drains · OpenStreetMap where mapped, otherwise estimated at road low points</li>
                <li>Blocked drains · citizen photo reports</li>
                <li className="text-ink-3">{data.validation.note}</li>
              </ul>
            )}
          </Section>
        </>
      )}
    </>
  );

  const right = (
    <>
      <TopBar freshness={freshness}>
        <RoadSearch data={data} onPick={select} />
      </TopBar>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex items-center gap-2 rounded-panel bg-white p-2">
          <Segmented
            value={hour === null ? "storm" : "hour"}
            onChange={(v) => {
              setPlaying(false);
              setHour(v === "storm" ? null : (hour ?? 0));
            }}
            options={[
              { value: "storm", label: t.worstCase },
              { value: "hour", label: t.hourByHour },
            ]}
            label="Time"
          />
          <IconButton
            label={playing ? t.pause : t.play}
            className="bg-sunken"
            onClick={() => {
              if (!playing && (hour === null || hour >= nHours - 1)) setHour(0);
              setPlaying((p) => !p);
            }}
          >
            {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </IconButton>
        </div>
        <div className="min-h-[56px] flex-1 overflow-x-auto rounded-panel bg-white">
          <HourRuler hours={hours} selected={hour} onSelect={pickHour} />
        </div>
      </div>

      <div className="relative h-[62dvh] overflow-hidden rounded-panel bg-white md:h-auto md:flex-1">
        <FloodMap
          center={CENTER}
          bbox={BBOX}
          segments={data?.geojson}
          hour={hour}
          selectedId={selected}
          onSelectSegment={select}
          focus={focus}
          onlyAtRisk={layer !== "all"}
          drains={layer === "drains" ? (drains ?? undefined) : undefined}
          className="h-full w-full"
        />

        {selected && (
          <SelectedRoad
            detail={detail?.id === selected ? detail : null}
            name={data?.geojson.features.find((f) => f.properties.id === selected)?.properties.name}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
          <div className="pointer-events-auto rounded-2xl bg-white p-3 shadow-sm">
            <div className="mb-2 px-1 text-sm">{t.show}</div>
            <Segmented
              size="sm"
              value={layer}
              onChange={setLayer}
              options={[
                { value: "all", label: t.allRoads },
                { value: "risk", label: t.atRisk },
                { value: "drains", label: t.drainsLayer },
              ]}
              label={t.show}
            />
          </div>
          <div className="pointer-events-auto hidden rounded-2xl bg-white p-3 shadow-sm sm:block">
            <div className="mb-2 px-1 text-sm">{t.legend}</div>
            <div className="flex items-center gap-4 px-1 pb-1 text-xs text-ink-2">
              {(["red", "amber", "green"] as const).map((l) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
                  {t[l]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return <Frame left={left} right={right} />;
}

function AlertRow({ a, active, onOpen }: { a: Alert; active: boolean; onOpen: () => void }) {
  const { t } = useApp();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-sunken ${active ? "bg-sunken" : ""}`}
      >
        <span className="mt-0.5 shrink-0 rounded-full bg-ink px-2 py-0.5 text-xs tabular-nums text-white">{a.eta}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{a.road}</span>
          <span className="block text-xs text-ink-2">
            {a.leave_by ? `${t.passBefore} ${a.leave_by}` : t.avoidNow}
            {a.alternative ? ` ${t.orUse} ${a.alternative}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

function SelectedRoad({
  detail,
  name,
  onClose,
}: {
  detail: SegmentDetail | null;
  name?: string | null;
  onClose: () => void;
}) {
  const { t } = useApp();
  return (
    <div className="absolute left-3 top-3 w-[min(360px,calc(100%-4.5rem))] rounded-2xl bg-white p-4 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-ink-3">{detail?.highway?.replace("_", " ") ?? ""}</div>
          <h3 className="truncate text-lg font-medium">{detail?.name ?? name ?? "Unnamed lane"}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="rounded-full p-1.5 text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      {!detail ? (
        <Skeleton className="mt-3 h-20" />
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LevelBadge level={detail.level} />
            {detail.eta && (
              <span className="text-xs text-ink-2">
                {t.floodsBy} <span className="font-medium tabular-nums text-ink">{detail.eta}</span>
              </span>
            )}
            {!detail.eta && detail.risky_from && (
              <span className="text-xs text-ink-2">
                {t.riskyFrom} <span className="font-medium tabular-nums text-ink">{detail.risky_from}</span>
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{detail.reason}</p>
          {detail.alternative && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sunken px-3 py-2 text-sm">
              <span className="text-ink-2">{t.alternative}</span>
              <span className="text-right font-medium">{detail.alternative}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RoadSearch({ data, onPick }: { data: RiskResponse | null; onPick: (id: string) => void }) {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  // one entry per road name, pointing at its most at-risk segment
  const roads = useMemo(() => {
    const best = new Map<string, { id: string; level: Level }>();
    const rank: Record<Level, number> = { red: 2, amber: 1, green: 0 };
    data?.geojson.features.forEach((f) => {
      const n = f.properties.name;
      if (!n) return;
      const cur = best.get(n);
      if (!cur || rank[f.properties.level] > rank[cur.level]) best.set(n, { id: f.properties.id, level: f.properties.level });
    });
    return [...best.entries()].map(([name, v]) => ({ name, ...v }));
  }, [data]);

  const query = q.trim().toLowerCase();
  const matches = query.length < 2 ? [] : roads.filter((r) => r.name.toLowerCase().includes(query)).slice(0, 6);

  const choose = (m: { id: string; name: string }) => {
    onPick(m.id);
    setQ(m.name);
    setOpen(false);
  };

  return (
    <div className="relative w-full md:max-w-sm">
      <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5">
        <SearchIcon className="h-4 w-4 text-ink-3" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) choose(matches[0]);
          }}
          placeholder={t.search}
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          aria-label={t.search}
        />
      </label>
      {open && query.length >= 2 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-3">{t.noMatch}</li>
          ) : (
            matches.map((m) => (
              <li key={m.name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(m)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-sunken"
                >
                  {m.name}
                  <LevelBadge level={m.level} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
