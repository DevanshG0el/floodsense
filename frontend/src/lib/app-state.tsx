"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { Mode } from "./api";
import { dictionaries, type Dict, type Lang } from "./i18n";

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  t: Dict;
  /** bump to make every page refetch (after a report or a drain clean) */
  version: number;
  refresh: () => void;
}

const Ctx = createContext<AppState | null>(null);

// ---- tiny preference store backed by localStorage (survives reloads, never required) ----
const PREF_EVENT = "fs-pref";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(PREF_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(PREF_EVENT, cb);
  };
}

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: preference just isn't remembered */
  }
  window.dispatchEvent(new Event(PREF_EVENT));
}

function usePref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = useSyncExternalStore(subscribe, () => readPref(key), () => null);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const lang = usePref<Lang>("fs.lang", ["en", "hi"], "en");
  const mode = usePref<Mode>("fs.mode", ["replay", "live"], "replay");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => writePref("fs.lang", l), []);
  const setMode = useCallback((m: Mode) => writePref("fs.mode", m), []);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ lang, setLang, mode, setMode, t: dictionaries[lang], version, refresh }),
    [lang, setLang, mode, setMode, version, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppStateProvider");
  return v;
}
