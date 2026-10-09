"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Level } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { LEVEL_CHIP, LEVEL_DOT } from "@/lib/levels";

export const FloodMap = dynamic(() => import("./RiskMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#1d4ed8" />
      <path d="M16 6c4 5 7 8.6 7 12a7 7 0 1 1-14 0c0-3.4 3-7 7-12z" fill="#fff" />
      <path d="M11.5 19.5h9" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 22.5h6" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { href: "/", key: "tabMap" as const, icon: MapIcon },
  { href: "/report", key: "tabReport" as const, icon: CameraIcon },
  { href: "/engineer", key: "tabEngineer" as const, icon: WrenchIcon },
];

export function Header() {
  const { t, lang, setLang, mode, setMode } = useApp();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <div className="leading-tight">
            <div className="font-semibold tracking-tight text-slate-900">FloodSense</div>
            <div className="text-[11px] text-slate-500">{t.area}</div>
          </div>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {TABS.map(({ href, key, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t[key]}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium" role="group" aria-label="Rain source">
            {(["replay", "live"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-2.5 py-1.5 ${
                  mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="hidden sm:inline">{m === "replay" ? t.modeReplay : t.modeLive}</span>
                <span className="sm:hidden">{m === "replay" ? t.modeReplayShort : t.modeLiveShort}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            aria-label={lang === "en" ? "हिंदी में देखें" : "View in English"}
          >
            {lang === "en" ? "हिं" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { t } = useApp();
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main"
    >
      {TABS.map(({ href, key, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
              active ? "text-blue-700" : "text-slate-500"
            }`}
          >
            <Icon className="h-5 w-5" />
            {t[key]}
          </Link>
        );
      })}
    </nav>
  );
}

export function LevelBadge({ level, children }: { level: Level; children?: React.ReactNode }) {
  const { t } = useApp();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${LEVEL_CHIP[level]}`}>
      <span className={`h-2 w-2 rounded-full ${LEVEL_DOT[level]}`} />
      {children ?? t[level]}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useApp();
  return (
    <Card className="text-sm">
      <p className="text-slate-700">{t.apiDown}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
      >
        {t.retry}
      </button>
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

type IconProps = { className?: string };
function MapIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
function CameraIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function WrenchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
    </svg>
  );
}
