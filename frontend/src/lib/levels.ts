import type { Level } from "./api";

export const LEVEL_COLOR: Record<Level, string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
};

/** Tailwind classes for chips and badges (kept literal so Tailwind can see them). */
export const LEVEL_CHIP: Record<Level, string> = {
  green: "bg-green-50 text-green-800 ring-green-600/20",
  amber: "bg-amber-50 text-amber-900 ring-amber-600/25",
  red: "bg-red-50 text-red-800 ring-red-600/25",
};

export const LEVEL_DOT: Record<Level, string> = {
  green: "bg-green-600",
  amber: "bg-amber-500",
  red: "bg-red-600",
};
