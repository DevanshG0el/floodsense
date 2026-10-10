"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Level } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { LEVEL_DOT } from "@/lib/levels";

export const FloodMap = dynamic(() => import("./RiskMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-panel bg-sunken" />,
});

// ---------------------------------------------------------------- brand + navigation
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <svg viewBox="0 0 36 36" className={compact ? "h-7 w-7" : "h-9 w-9"} aria-hidden>
        <circle cx="18" cy="18" r="17" fill="#0b0b0b" />
        <path d="M18 7c4.2 5.2 7 8.8 7 12.2a7 7 0 1 1-14 0C11 15.8 13.8 12.2 18 7z" fill="#fff" />
        <path d="M13.5 20.5c1.5 1 3 1 4.5 0s3-1 4.5 0" stroke="#0b0b0b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M14.5 23.5c1.2.8 2.3.8 3.5 0s2.3-.8 3.5 0" stroke="#0b0b0b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`${compact ? "text-lg" : "text-[22px]"} font-medium tracking-tight`}>FloodSense</span>
    </Link>
  );
}

const TABS = [
  { href: "/", key: "tabMap" as const, icon: MapIcon },
  { href: "/report", key: "tabReport" as const, icon: CameraIcon },
  { href: "/engineer", key: "tabEngineer" as const, icon: WrenchIcon },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

export function NavPill() {
  const { t } = useApp();
  const isActive = useActive();
  return (
    <nav className="hidden items-center gap-1 rounded-full bg-white p-1.5 md:flex" aria-label="Main">
      {TABS.map(({ href, key }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
            isActive(href) ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {t[key]}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const { t } = useApp();
  const isActive = useActive();
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 rounded-full bg-ink p-1.5 shadow-lg md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      {TABS.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-medium ${
            isActive(href) ? "bg-white text-ink" : "text-white/70"
          }`}
        >
          <Icon className="h-4 w-4" />
          {t[key]}
        </Link>
      ))}
    </nav>
  );
}

/** Top bar of the right-hand column: navigation, optional slot (search), data freshness,
 *  rain source and language. */
export function TopBar({ children, freshness }: { children?: React.ReactNode; freshness?: string | null }) {
  const { t, lang, setLang, mode, setMode } = useApp();
  return (
    <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
      <div className="md:hidden">
        <Brand compact />
      </div>
      <NavPill />
      <div className="order-last w-full md:order-none md:w-auto md:min-w-0 md:flex-1">{children}</div>
      <div className="ml-auto flex items-center gap-2">
        {freshness && (
          <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-ink-2 xl:flex">
            <SyncIcon className="h-4 w-4" />
            {freshness}
          </span>
        )}
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            {
              value: "replay",
              label: (
                <>
                  <span className="hidden lg:inline">{t.modeReplay}</span>
                  <span className="lg:hidden">{t.modeReplayShort}</span>
                </>
              ),
            },
            {
              value: "live",
              label: (
                <>
                  <span className="hidden lg:inline">{t.modeLive}</span>
                  <span className="lg:hidden">{t.modeLiveShort}</span>
                </>
              ),
            },
          ]}
          label="Rain source"
        />
        <IconButton
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          label={lang === "en" ? "हिंदी में देखें" : "View in English"}
        >
          <span className="text-sm font-medium">{lang === "en" ? "हिं" : "EN"}</span>
        </IconButton>
      </div>
    </div>
  );
}

/** Two-column frame used by every screen. Left: white info panel. Right: top bar + content. */
export function Frame({
  left,
  right,
  leftFirstOnMobile = false,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  leftFirstOnMobile?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-[1560px] flex-col gap-3 p-3 pb-24 md:h-dvh md:flex-row md:pb-3">
      <aside
        className={`scroll-quiet flex shrink-0 flex-col rounded-panel bg-panel md:w-[400px] md:overflow-y-auto xl:w-[430px] ${
          leftFirstOnMobile ? "" : "order-2 md:order-none"
        }`}
      >
        <div className="hidden px-6 pb-5 pt-6 md:block">
          <Brand />
        </div>
        <div className="hidden h-px bg-line md:mx-6 md:block" />
        {left}
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">{right}</section>
    </div>
  );
}

// ---------------------------------------------------------------- primitives
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-panel bg-panel p-5 ${className}`}>{children}</section>;
}

/** A divider-separated section inside the left panel. */
export function Section({
  title,
  aside,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-line px-6 py-5 last:border-b-0 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-[13px] font-medium text-ink">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

/** Small grey pill with a coloured dot: "● High". */
export function StatusPill({
  level,
  children,
  tone = "sunken",
}: {
  level?: Level | "ink";
  children: React.ReactNode;
  tone?: "sunken" | "white";
}) {
  const dot = level === "ink" || !level ? "bg-ink" : LEVEL_DOT[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs text-ink ${
        tone === "white" ? "bg-white shadow-sm" : "bg-sunken"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

export function LevelBadge({ level, children }: { level: Level; children?: React.ReactNode }) {
  const { t } = useApp();
  return <StatusPill level={level}>{children ?? t[level]}</StatusPill>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-white p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`whitespace-nowrap rounded-full transition ${size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${
            value === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink transition hover:bg-sunken ${className}`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:bg-ink-4 ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useApp();
  return (
    <div className="m-6 rounded-2xl bg-sunken p-4 text-sm">
      <p className="text-ink-2">{t.apiDown}</p>
      <PrimaryButton onClick={onRetry} className="mt-3 py-2">
        {t.retry}
      </PrimaryButton>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-sunken ${className}`} />;
}

// ---------------------------------------------------------------- icons
type IconProps = { className?: string };
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
export function MapIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
export function CameraIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
export function WrenchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
    </svg>
  );
}
export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}
export function SyncIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </svg>
  );
}
export function InfoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}
export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </svg>
  );
}
export function PauseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" />
      <rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" />
    </svg>
  );
}
export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
