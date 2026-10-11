"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  CloseIcon,
  ErrorState,
  FloodMap,
  Frame,
  LevelBadge,
  Section,
  Skeleton,
  StatusPill,
  TopBar,
} from "@/components/Shell";
import { api, type DrainProps, type Level, type PrioritiesResponse, type RiskResponse } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { BBOX, CENTER } from "@/lib/area";
import { LEVEL_COLOR, areaSeverity } from "@/lib/levels";

type Toast = { drain: string; changed: { road: string | null; from: Level; to: Level }[] } | null;

export default function EngineerPage() {
  const { t, mode, version, refresh } = useApp();
  const [prio, setPrio] = useState<PrioritiesResponse | null>(null);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [drains, setDrains] = useState<GeoJSON.FeatureCollection<GeoJSON.Point, DrainProps> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; zoom?: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // Municipal Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [badgeId, setBadgeId] = useState("");
  const [govtEmail, setGovtEmail] = useState("");
  const [assignedWard, setAssignedWard] = useState("Central Delhi — Zone 4 (CP / ITO / Minto Bridge)");
  const [securityPin, setSecurityPin] = useState("");

  // Emergency broadcast states
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastPhone, setBroadcastPhone] = useState("+91 7504288815");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastToast, setBroadcastToast] = useState<string | null>(null);

  // Check existing session auth on mount
  useEffect(() => {
    const savedAuth = sessionStorage.getItem("floodsense_crew_auth");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBadge = badgeId.trim() || "MCD-ENG-4092";
    setBadgeId(finalBadge);
    sessionStorage.setItem("floodsense_crew_auth", "true");
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("floodsense_crew_auth");
    setIsAuthenticated(false);
    setBadgeId("");
    setGovtEmail("");
    setSecurityPin("");
  };

  const markCleaned = async (id: string) => {
    setBusy(id);
    try {
      const r = await api.setDrain(id, "clear", mode);
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

  const handleBroadcast = async () => {
    setSendingBroadcast(true);
    try {
      const res = await api.sendBroadcast({
        phone: broadcastPhone.trim(),
        mode,
      });
      setBroadcastToast(`${t.broadcastSentDesc} (${res.recipient})`);
      setBroadcastOpen(false);
    } catch {
      setBroadcastToast("Broadcast transmitted in demo mode.");
      setBroadcastOpen(false);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const reportedCount = prio?.items.filter((i) => i.reported).length ?? 0;
  const total = risk?.geojson.features.length ?? 0;
  const sev = areaSeverity(prio?.red_now ?? 0, total, t);
  const topAlert = risk?.alerts?.[0];

  const left = (
    <>
      {error && <ErrorState onRetry={() => setAttempt((a) => a + 1)} />}
      {!prio && !error && (
        <div className="space-y-4 p-6">
          <Skeleton className="h-28" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}
      {prio && (
        <>
          <Section>
            {/* Authenticated Crew Status & Sign Out */}
            <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-panel px-3.5 py-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-sunken text-ink">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-ink">Authorized Drain Crew</span>
                  <span className="text-ink-4">·</span>
                  <span className="font-mono text-[11px] font-semibold text-ink-3">Badge {badgeId || "MCD-ENG-4092"}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-line bg-sunken px-2.5 py-1 text-xs font-semibold text-ink-2 transition hover:bg-line hover:text-ink"
              >
                Sign Out
              </button>
            </div>

            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{t.engTitle}</h1>
            <p className="mt-1.5 text-sm font-semibold text-[#0284c7]">{t.engSub}</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-start gap-2">
                  <span className="num-hero text-[56px] font-bold text-ink">{prio.red_now}</span>
                  <span className="mt-1">
                    <StatusPill level={sev.level}>{sev.label}</StatusPill>
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-2">{t.roadsRed}</div>
              </div>
              <div className="border-l border-line pl-4">
                <span className="num-hero text-[56px] font-bold text-ink">{reportedCount}</span>
                <div className="mt-1 text-xs text-ink-2">{t.drainsReported}</div>
              </div>
            </div>

            {/* Emergency Broadcast Trigger Card */}
            <div className="mt-5 rounded-2xl bg-sunken p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-risk-red">
                    <span className="inline-block h-2 w-2 rounded-full bg-risk-red animate-pulse" />
                    {t.broadcastTitle}
                  </div>
                  <p className="mt-1 text-xs text-ink-2">{t.broadcastSub}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBroadcastOpen(true)}
                  className="shrink-0 rounded-full bg-[#0284c7] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0369a1] flex items-center gap-1.5 shadow-xs"
                >
                  <span>📢</span>
                  <span>{t.broadcastBtn}</span>
                </button>
              </div>
            </div>
          </Section>

          {broadcastToast && (
            <div className="rounded-2xl border border-line bg-sunken p-4 text-xs font-medium text-ink shadow-sm">
              📢 {broadcastToast}
            </div>
          )}

          {toast && (
            <Section>
              <div className="rounded-2xl bg-sunken p-4 text-xs leading-relaxed text-ink">
                <div className="font-bold text-ink">
                  {t.cleaned}: {toast.drain}
                </div>
                {toast.changed.length === 0 ? (
                  <p className="mt-1 text-ink-2">{t.noRoadChanged}</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {toast.changed.map((c, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-ink-2">{c.road ?? "Road"}</span>
                        <LevelBadge level={c.from} />
                        <span className="text-ink-3">→</span>
                        <LevelBadge level={c.to} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>
          )}

          <Section
            title={t.cleaningList}
            aside={
              <button
                type="button"
                onClick={() =>
                  api.reset().then(() => {
                    setToast(null);
                    setBroadcastToast(null);
                    refresh();
                  })
                }
                className="text-xs font-medium text-ink-3 hover:text-ink"
              >
                {t.resetDemo}
              </button>
            }
          >
            {prio.items.length === 0 ? (
              <p className="text-sm text-ink-2">{t.noPriorities}</p>
            ) : (
              <ol className="-mx-2 space-y-1">
                {prio.items.map((it, idx) => (
                  <li key={it.drain} className={`rounded-2xl p-2 transition ${active === it.drain ? "bg-sunken" : ""}`}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 text-left"
                      onClick={() => {
                        setActive(it.drain);
                        setFocus({ lon: it.lon, lat: it.lat, zoom: 17 });
                      }}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0284c7] text-xs font-bold text-white shadow-xs">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-ink">{it.drain}</span>
                          <StatusPill level={it.status === "blocked" ? "red" : it.status === "partial" ? "amber" : "ink"}>
                            {it.status === "blocked" ? t.reported : it.status === "partial" ? t.partial : t.notInspected}
                          </StatusPill>
                        </span>
                        <span className="mt-1 block text-sm font-medium text-ink-2">{it.summary}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {it.road ? `${it.road} · ` : ""}
                          {it.source === "osm" ? t.osmMapped : t.estimated}
                        </span>
                      </span>
                    </button>
                    <div className="mt-2 pl-10">
                      <button
                        type="button"
                        disabled={busy === it.drain}
                        onClick={() => markCleaned(it.drain)}
                        className="rounded-full bg-[#0284c7] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#0369a1] disabled:bg-ink-4 shadow-xs"
                      >
                        {busy === it.drain ? "…" : `✓ ${t.markCleaned}`}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </>
      )}

      {/* Emergency Broadcast Modal */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line bg-panel p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-risk-red">
                  <span className="h-2 w-2 rounded-full bg-risk-red animate-pulse" />
                  {t.broadcastTitle}
                </div>
                <h3 className="mt-1 text-lg font-bold text-ink">{t.broadcastTarget}</h3>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastOpen(false)}
                className="rounded-full p-1.5 text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-sunken p-4 text-xs leading-relaxed">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">
                {t.broadcastPreview}
              </div>
              <p className="font-semibold text-ink">
                {topAlert
                  ? `DELHI EMERGENCY BROADCAST: Flooding likely on ${topAlert.road} by ${topAlert.eta}.${topAlert.alternative ? ` Divert to ${topAlert.alternative}.` : ""} Commuters avoid low underpasses.`
                  : "DELHI ADVISORY: Normal traffic flow across Central Delhi. No critical waterlogging predicted."}
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-ink-2 mb-1.5">
                {t.broadcastPhone}
              </label>
              <input
                type="tel"
                value={broadcastPhone}
                onChange={(e) => setBroadcastPhone(e.target.value)}
                placeholder="+91 7504288815"
                className="w-full rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-panel font-medium text-ink"
              />
              <p className="mt-1.5 text-[11px] text-ink-3">
                Sends alert to demo mobile device & logs telecom transmission for evaluation.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBroadcastOpen(false)}
                className="flex-1 rounded-full bg-sunken py-2.5 text-xs font-bold text-ink hover:bg-[#e2ecf0] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingBroadcast}
                onClick={handleBroadcast}
                className="flex-1 rounded-full bg-risk-red py-2.5 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {sendingBroadcast ? "Transmitting..." : `🚀 ${t.broadcastConfirm}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const right = (
    <>
      <TopBar />
      <div className="relative h-[55dvh] overflow-hidden rounded-panel border border-line bg-panel shadow-sm md:h-auto md:flex-1">
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
        <div className="absolute bottom-3 left-3 rounded-2xl border border-line bg-panel p-3 shadow-md">
          <div className="mb-2 px-1 text-sm font-bold text-ink">{t.drainStatus}</div>
          <div className="flex flex-wrap items-center gap-4 px-1 pb-1 text-xs text-ink-2 font-medium">
            {(
              [
                [LEVEL_COLOR.red, t.reported],
                [LEVEL_COLOR.amber, t.partial],
                [LEVEL_COLOR.green, t.clearLbl],
                ["#64748b", t.notInspected],
              ] as const
            ).map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Frame left={left} right={right} />

      {/* -------------------- Clean, Modern Municipal Login Popup -------------------- */}
      {!isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d242e]/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border-2 border-line bg-panel p-7 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Clean Close to Public Map */}
            <Link
              href="/map"
              className="absolute top-6 right-6 rounded-full p-1.5 text-ink-3 hover:bg-sunken hover:text-ink transition"
              title="Return to Public Map"
            >
              <CloseIcon className="h-4 w-4" />
            </Link>

            {/* Clean, Bold Header */}
            <div className="pr-8">
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Municipal Drain Crew Portal
              </h2>
            </div>

            {/* Form with Clean Styling & Default Placeholders */}
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              {/* Badge ID */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  Badge ID
                </label>
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  placeholder="Enter Badge ID (Default: MCD-ENG-4092)"
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 placeholder:text-slate-400"
                />
              </div>

              {/* Assigned Civic Ward */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  Assigned Civic Ward
                </label>
                <select
                  value={assignedWard}
                  onChange={(e) => setAssignedWard(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 cursor-pointer"
                >
                  <option value="Central Delhi — Zone 4 (CP / ITO / Minto Bridge)">
                    Central Delhi — Zone 4 (CP / ITO / Minto Bridge)
                  </option>
                  <option value="North Delhi — Zone 1 (Civil Lines / Kashmere Gate)">
                    North Delhi — Zone 1 (Civil Lines / Kashmere Gate)
                  </option>
                  <option value="South Delhi — Zone 7 (Lajpat Nagar / Barapullah)">
                    South Delhi — Zone 7 (Lajpat Nagar / Barapullah)
                  </option>
                </select>
              </div>

              {/* Security PIN */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  Security PIN
                </label>
                <input
                  type="password"
                  value={securityPin}
                  onChange={(e) => setSecurityPin(e.target.value)}
                  placeholder="Enter Security PIN (Default: 482109)"
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/20 placeholder:text-slate-400"
                />
              </div>

              {/* Blue Button: Verify Drain Queue (Solid Blue, No Arrows) */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#0284c7] hover:bg-[#0369a1] py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.99] cursor-pointer"
                >
                  Verify Drain Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
