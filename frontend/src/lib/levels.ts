import type { Level } from "./api";
import type { Dict } from "./i18n";

export const LEVEL_COLOR: Record<Level, string> = {
  green: "#30a46c",
  amber: "#f5a524",
  red: "#e5484d",
};

export const LEVEL_DOT: Record<Level, string> = {
  green: "bg-risk-green",
  amber: "bg-risk-amber",
  red: "bg-risk-red",
};

/** Share of roads that are red -> plain-language severity for the hero number. */
export function areaSeverity(red: number, total: number, t: Dict): { label: string; level: Level } {
  const share = total ? red / total : 0;
  if (share >= 0.1) return { label: t.sevSevere, level: "red" };
  if (share >= 0.05) return { label: t.sevHigh, level: "red" };
  if (share >= 0.01) return { label: t.sevModerate, level: "amber" };
  return { label: t.sevLow, level: "green" };
}

/** India Meteorological Department rainfall categories (applied to the storm window). */
export function rainTotalCategory(mm: number, t: Dict): { label: string; level: Level } {
  if (mm < 2.5) return { label: t.rainNone, level: "green" };
  if (mm < 15.6) return { label: t.rainLight, level: "green" };
  if (mm < 64.5) return { label: t.rainModerate, level: "amber" };
  if (mm < 115.6) return { label: t.rainHeavy, level: "red" };
  if (mm < 204.5) return { label: t.rainVeryHeavy, level: "red" };
  return { label: t.rainExtreme, level: "red" };
}

/** Hourly intensity classes (WMO: light < 2.5, moderate < 7.6, heavy < 50, violent >= 50 mm/h). */
export function rainRateCategory(mmh: number, t: Dict): { label: string; level: Level } {
  if (mmh < 0.5) return { label: t.rainNone, level: "green" };
  if (mmh < 2.5) return { label: t.rainLight, level: "green" };
  if (mmh < 7.6) return { label: t.rainModerate, level: "amber" };
  if (mmh < 50) return { label: t.rainHeavy, level: "red" };
  return { label: t.rainExtreme, level: "red" };
}

export function rateColor(mmh: number): string {
  if (mmh < 7.6) return LEVEL_COLOR.green;
  if (mmh < 20) return LEVEL_COLOR.amber;
  return LEVEL_COLOR.red;
}
