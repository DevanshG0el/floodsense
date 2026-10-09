"use client";

import type { RainHour } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { clock } from "@/lib/area";

interface Props {
  hours: RainHour[];
  hour: number | null;
  onChange: (h: number | null) => void;
}

/** Hourly rain bars with a scrubber. null = show the worst level over the whole storm. */
export default function RainTimeline({ hours, hour, onChange }: Props) {
  const { t } = useApp();
  const max = Math.max(10, ...hours.map((h) => h.mm));
  const total = hours.reduce((s, h) => s + h.mm, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {t.rainNext} · {total.toFixed(0)} mm
        </h3>
        <button
          type="button"
          onClick={() => onChange(hour === null ? hours.length - 1 : null)}
          aria-pressed={hour === null}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
            hour === null ? "bg-blue-700 text-white ring-blue-700" : "text-slate-600 ring-slate-300 hover:bg-slate-50"
          }`}
        >
          {t.worstCase}
        </button>
      </div>

      <div className="mt-3 flex h-20 items-end gap-1.5" aria-hidden>
        {hours.map((h, i) => {
          const active = hour === null || i <= hour;
          return (
            <button
              type="button"
              tabIndex={-1}
              key={h.time}
              onClick={() => onChange(i)}
              className="group flex h-full flex-1 flex-col justify-end"
              title={`${clock(h.time)} · ${h.mm} mm`}
            >
              <span className="mb-1 text-center text-[10px] tabular-nums text-slate-500">{h.mm >= 1 ? h.mm.toFixed(0) : ""}</span>
              <span
                className={`w-full rounded-t-md transition-colors ${
                  hour === i ? "bg-blue-700" : active ? "bg-blue-400" : "bg-slate-200"
                }`}
                style={{ height: `${Math.max(4, (h.mm / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {hours.map((h) => (
          <span key={h.time} className="flex-1 text-center text-[10px] tabular-nums text-slate-500">
            {clock(h.time)}
          </span>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="sr-only">{t.dragToSee}</span>
        <input
          type="range"
          className="timeline w-full"
          min={0}
          max={hours.length - 1}
          step={1}
          value={hour ?? hours.length - 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">
        {hour === null ? t.dragToSee : `${t.showingAt} ${clock(hours[hour].time)}`}
      </p>
    </div>
  );
}
