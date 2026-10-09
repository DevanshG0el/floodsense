export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

export type Level = "green" | "amber" | "red";
export type Mode = "replay" | "live";

export interface RainHour {
  time: string;
  mm: number;
}

export interface Rain {
  mode: Mode;
  source: string;
  label?: string;
  fetched_at?: string;
  total_mm: number;
  hours: RainHour[];
}

export interface SegmentProps {
  id: string;
  name: string | null;
  highway: string;
  rank: number;
  level: Level;
  timeline: string;
  eta: string | null;
  risky_from: string | null;
  reason: string;
  underpass: boolean;
  blocked_drains: number;
  observed: boolean;
}

export interface Alert {
  road: string;
  segment: string;
  eta: string;
  leave_by: string | null;
  alternative: string | null;
  message: string;
  reason: string;
}

export interface Validation {
  radius_m: number;
  near_red_share: number;
  elsewhere_red_share: number;
  lift: number | null;
  note: string;
  rows: { name: string; segments: number; red: number; red_share: number }[];
}

export interface RiskResponse {
  generated_at: string;
  mode: Mode;
  rain: Rain;
  counts: Record<Level, number>;
  alerts: Alert[];
  validation: Validation;
  geojson: GeoJSON.FeatureCollection<GeoJSON.LineString, SegmentProps>;
}

export interface SegmentDetail extends SegmentProps {
  sink_m: number;
  drains: string[];
  alternative: string | null;
  peak: number;
  series: number[];
  hours: string[];
}

export type DrainStatus = "clear" | "partial" | "blocked" | "unknown";

export interface DrainProps {
  id: string;
  source: "osm" | "estimated";
  road: string | null;
  status: DrainStatus;
}

export interface Report {
  id: string;
  created_at: string;
  lat: number;
  lon: number;
  category: "blocked_drain" | "waterlogging" | "clear_drain" | "unrelated";
  severity: number;
  confidence: number | null;
  observations: string;
  verified: boolean;
  model: string | null;
  drain: string | null;
  segment: string | null;
  photo_url?: string;
}

export interface ReportResult {
  report: Report;
  impact: { segment: string; road: string; from: Level; to: Level } | null;
  message: string;
}

export interface PriorityItem {
  drain: string;
  lon: number;
  lat: number;
  source: "osm" | "estimated";
  road: string | null;
  status: DrainStatus;
  reported: boolean;
  impact: number;
  summary: string;
  changes: { segment: string; road: string; from: Level; to: Level; delay_min: number }[];
  reports: Report[];
}

export interface PrioritiesResponse {
  rain: Omit<Rain, "hours">;
  red_now: number;
  items: PriorityItem[];
}

export interface Meta {
  area: string;
  bbox: [number, number, number, number];
  center: [number, number];
  segments: number;
  drains: number;
  drains_osm: number;
  replay: { label: string; total_mm: number; source: string };
  sources: { what: string; from: string }[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(typeof detail === "string" ? detail : "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => req<Meta>("/meta"),
  risk: (mode: Mode) => req<RiskResponse>(`/risk?mode=${mode}`),
  segment: (id: string, mode: Mode) =>
    req<SegmentDetail>(`/segments/${encodeURIComponent(id)}?mode=${mode}`),
  drains: () => req<GeoJSON.FeatureCollection<GeoJSON.Point, DrainProps>>("/drains"),
  priorities: (mode: Mode) => req<PrioritiesResponse>(`/engineer/priorities?mode=${mode}`),
  setDrain: (id: string, status: DrainStatus, mode: Mode) =>
    req<{ drain: string; status: DrainStatus; changed: { road: string | null; from: Level; to: Level }[] }>(
      `/drains/${id}?mode=${mode}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, by: "engineer" }),
      },
    ),
  reports: () => req<Report[]>("/reports"),
  report: (form: FormData) => req<ReportResult>("/reports", { method: "POST", body: form }),
  reset: () => req<{ ok: boolean }>("/demo/reset", { method: "POST" }),
};

export const photoUrl = (p?: string) => (p ? `${API_URL}${p}` : undefined);
