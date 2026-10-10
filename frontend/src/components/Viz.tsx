"use client";

import type { Level, RainHour } from "@/lib/api";
import { clock } from "@/lib/area";
import { rateColor } from "@/lib/levels";

import { StatusPill } from "./Shell";

/** Circular dial with tick marks; ticks up to value/max are drawn dark. */
export function Gauge({
  value,
  max,
  unit,
  label,
  level,
  decimals = 0,
}: {
  value: number;
  max: number;
  unit: string;
  label: string;
  level: Level;
  decimals?: number;
}) {
  const N = 72;
  const frac = Math.max(0, Math.min(1, value / max));
  const lit = Math.round(frac * N);
  const ticks = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const on = i < lit;
    const r1 = on ? 70 : 73;
    const r2 = 79;
    return (
      <line
        key={i}
        x1={100 + r1 * Math.cos(a)}
        y1={100 + r1 * Math.sin(a)}
        x2={100 + r2 * Math.cos(a)}
        y2={100 + r2 * Math.sin(a)}
        stroke={on ? "#0b0b0b" : "#cfcfcf"}
        strokeWidth={on ? 1.6 : 1}
        strokeLinecap="round"
      />
    );
  });
  return (
    <figure className="relative mx-auto aspect-square w-full max-w-[170px]" aria-label={`${value.toFixed(decimals)} ${unit}, ${label}`}>
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <circle cx="100" cy="100" r="92" fill="none" stroke="#e9e9e9" strokeWidth="9" />
        <circle cx="100" cy="100" r="86" fill="#fff" />
        {ticks}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <span className="text-[28px] font-light tabular-nums tracking-tight">
          {value.toFixed(decimals)}
          <span className="ml-0.5 text-xs text-ink-3">{unit}</span>
        </span>
        <StatusPill level={level}>{label}</StatusPill>
      </figcaption>
    </figure>
  );
}

/** Thin grey bars with a coloured dot on top (rain intensity) and a cumulative line. */
export function RainBars({
  hours,
  selected,
  onSelect,
}: {
  hours: RainHour[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const W = 300;
  const H = 120;
  const top = 12;
  const base = H - 18;
  const max = Math.max(10, ...hours.map((h) => h.mm));
  const step = W / hours.length;
  const total = hours.reduce((s, h) => s + h.mm, 0) || 1;
  const running = hours.map((_, i) => hours.slice(0, i + 1).reduce((sum, h) => sum + h.mm, 0));
  const cum = running.map((acc, i) => {
    const x = step * i + step / 2;
    const y = base - (acc / total) * (base - top);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Hourly rain">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={W} y1={base - g * (base - top)} y2={base - g * (base - top)} stroke="#f0f0f0" />
      ))}
      <path d={cum.join(" ")} fill="none" stroke="#7cb8e6" strokeWidth="1.6" />
      {hours.map((h, i) => {
        const x = step * i + step / 2;
        const y = base - (h.mm / max) * (base - top);
        const active = selected === i;
        return (
          <g key={h.time} onClick={() => onSelect(i)} className="cursor-pointer">
            <rect x={x - step / 2} y={0} width={step} height={H} fill="transparent" />
            <rect x={x - 3} y={y} width={6} height={base - y} rx={3} fill={active ? "#0b0b0b" : "#e3e3e3"} />
            <circle cx={x} cy={y - 6} r={4} fill={rateColor(h.mm)} />
            <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill={active ? "#0b0b0b" : "#8f8f8f"}>
              {clock(h.time)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Ruler with one tick per hour; a black marker shows the selected hour. */
export function HourRuler({
  hours,
  selected,
  onSelect,
}: {
  hours: RainHour[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="relative flex h-full items-stretch px-2" role="tablist" aria-label="Hour">
      {hours.map((h, i) => {
        const active = selected === i;
        return (
          <button
            key={h.time}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className="group relative flex flex-1 flex-col items-center justify-end gap-1.5 pb-2 pt-2"
          >
            {active && <span className="absolute inset-y-1 left-1/2 w-[2px] -translate-x-1/2 rounded bg-ink" />}
            <span className={`h-2.5 w-px ${active ? "bg-transparent" : "bg-ink-3"}`} />
            <span
              className={`relative rounded-full px-1.5 text-[11px] tabular-nums ${
                active ? "bg-ink text-white" : "text-ink-2 group-hover:text-ink"
              }`}
            >
              {clock(h.time)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Sparkline({ values, color = "#0b0b0b" }: { values: number[]; color?: string }) {
  const W = 120;
  const H = 32;
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - 2 - (v / max) * (H - 6)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <line key={i} x1={(i / 23) * W} x2={(i / 23) * W} y1={H - 3} y2={H} stroke="#d9d9d9" />
      ))}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
