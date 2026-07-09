import { detectLanguage } from "../i18n";
import type { DailySunscreenLog, ExposureContext, SavedLocation, SunscreenEvent, UserSettings } from "../types";

const SETTINGS_KEY = "suncheck:settings";
const EXPOSURE_KEY = "suncheck:exposure";
const FAVORITES_KEY = "suncheck:favorites";
const LOCATION_KEY = "suncheck:last-location";
const LOG_PREFIX = "suncheck:log:";

export const defaultSettings: UserSettings = {
  language: detectLanguage(),
  theme: "light",
  sensitivity: "normal",
  sunscreenType: "unsure"
};

export const defaultExposure: ExposureContext = {
  place: "outdoor",
  nearWindow: false,
  expectedOutdoorMinutes: 30,
  sweatingOrSwimming: false
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadSettings(): UserSettings {
  return readJson<UserSettings>(SETTINGS_KEY, defaultSettings);
}

export function saveSettings(settings: UserSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function loadExposure(): ExposureContext {
  return readJson<ExposureContext>(EXPOSURE_KEY, defaultExposure);
}

export function saveExposure(exposure: ExposureContext): void {
  writeJson(EXPOSURE_KEY, exposure);
}

export function loadFavorites(): SavedLocation[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as SavedLocation[];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: SavedLocation[]): void {
  writeJson(FAVORITES_KEY, favorites.slice(0, 3));
}

export function loadLastLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    return raw ? (JSON.parse(raw) as SavedLocation) : null;
  } catch {
    return null;
  }
}

export function saveLastLocation(location: SavedLocation): void {
  writeJson(LOCATION_KEY, location);
}

export function loadTodayLog(date = new Date()): DailySunscreenLog {
  const key = todayKey(date);
  try {
    const raw = localStorage.getItem(`${LOG_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as DailySunscreenLog) : { date: key, events: [] };
  } catch {
    return { date: key, events: [] };
  }
}

export function saveTodayLog(log: DailySunscreenLog): void {
  writeJson(`${LOG_PREFIX}${log.date}`, log);
}

export function addSunscreenEvent(date = new Date()): DailySunscreenLog {
  const log = loadTodayLog(date);
  const event: SunscreenEvent = {
    id: `${Date.now()}`,
    timestamp: date.toISOString(),
    type: log.events.length === 0 ? "applied" : "reapplied"
  };
  const nextLog = { ...log, events: [...log.events, event] };
  saveTodayLog(nextLog);
  return nextLog;
}

export function clearTodayLog(date = new Date()): DailySunscreenLog {
  const log = { date: todayKey(date), events: [] };
  saveTodayLog(log);
  return log;
}
