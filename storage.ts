import { detectLanguage } from "../i18n";
import {
  sanitizeDailyLog,
  sanitizeExposure,
  sanitizeLocation,
  sanitizeSettings,
  sanitizeStoredWeather
} from "../security/validation";
import type { DailySunscreenLog, ExposureContext, SavedLocation, SunscreenEvent, UserSettings, WeatherSnapshot } from "../types";

const SETTINGS_KEY = "suncheck:settings";
const EXPOSURE_KEY = "suncheck:exposure";
const FAVORITES_KEY = "suncheck:favorites";
const LOCATION_KEY = "suncheck:last-location";
const LOG_PREFIX = "suncheck:log:";
const WEATHER_KEY = "suncheck:weather";
/** Hourly forecasts stay useful for a while, so a saved one can bridge a failed refresh. */
export const WEATHER_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

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

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be disabled or full; keep the current session usable.
  }
}

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadSettings(): UserSettings {
  return sanitizeSettings(readJson(SETTINGS_KEY), defaultSettings);
}

export function saveSettings(settings: UserSettings): void {
  writeJson(SETTINGS_KEY, sanitizeSettings(settings, defaultSettings));
}

export function loadExposure(): ExposureContext {
  return sanitizeExposure(readJson(EXPOSURE_KEY), defaultExposure);
}

export function saveExposure(exposure: ExposureContext): void {
  writeJson(EXPOSURE_KEY, sanitizeExposure(exposure, defaultExposure));
}

export function loadFavorites(): SavedLocation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map(sanitizeLocation).filter((location): location is SavedLocation => Boolean(location)).slice(0, 3);
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: SavedLocation[]): void {
  writeJson(
    FAVORITES_KEY,
    favorites.map(sanitizeLocation).filter((location): location is SavedLocation => Boolean(location)).slice(0, 3)
  );
}

export function loadLastLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    return raw ? sanitizeLocation(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function saveLastLocation(location: SavedLocation): void {
  const safeLocation = sanitizeLocation(location);
  if (safeLocation) writeJson(LOCATION_KEY, safeLocation);
}

export function loadTodayLog(date = new Date()): DailySunscreenLog {
  const key = todayKey(date);
  const fallback = { date: key, events: [] };
  try {
    const raw = localStorage.getItem(`${LOG_PREFIX}${key}`);
    return raw ? sanitizeDailyLog(JSON.parse(raw) as unknown, fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function saveTodayLog(log: DailySunscreenLog): void {
  writeJson(`${LOG_PREFIX}${log.date}`, sanitizeDailyLog(log, { date: log.date, events: [] }));
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

/** Weather is cached per place; coordinates are rounded so a renamed GPS fix keeps its cache. */
export function weatherKey(location: Pick<SavedLocation, "latitude" | "longitude">): string {
  return `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
}

export function loadCachedWeather(location: SavedLocation, now = new Date()): WeatherSnapshot | null {
  const raw = readJson(WEATHER_KEY);
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as { key?: unknown; snapshot?: unknown };
  if (record.key !== weatherKey(location)) return null;
  const snapshot = sanitizeStoredWeather(record.snapshot);
  if (!snapshot) return null;
  const age = now.getTime() - new Date(snapshot.fetchedAt).getTime();
  return age >= 0 && age < WEATHER_CACHE_MAX_AGE_MS ? snapshot : null;
}

export function saveCachedWeather(location: SavedLocation, snapshot: WeatherSnapshot): void {
  writeJson(WEATHER_KEY, { key: weatherKey(location), snapshot });
}
