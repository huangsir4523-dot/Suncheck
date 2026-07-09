import type {
  DailySunscreenLog,
  ExposureContext,
  SavedLocation,
  SunscreenEvent,
  UserSettings,
  WeatherSnapshot
} from "../types";
import { safeDisplayText } from "./sanitize";

export function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidCoordinatePair(latitude: unknown, longitude: unknown): latitude is number {
  return isValidLatitude(latitude) && isValidLongitude(longitude);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizeLocation(value: unknown): SavedLocation | null {
  if (!isRecord(value)) return null;
  const latitude = value.latitude;
  const longitude = value.longitude;
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;

  const source = oneOf(value.source, ["gps", "manual", "favorite"] as const, "manual");
  const name = safeDisplayText(value.name) || "GPS";
  const admin1 = safeDisplayText(value.admin1);
  const country = safeDisplayText(value.country);

  return {
    id: safeDisplayText(value.id) || `${source}:${latitude}:${longitude}`,
    name,
    ...(country ? { country } : {}),
    ...(admin1 ? { admin1 } : {}),
    latitude,
    longitude,
    source
  };
}

export function sanitizeSettings(value: unknown, fallback: UserSettings): UserSettings {
  if (!isRecord(value)) return fallback;
  return {
    language: oneOf(value.language, ["en", "zh"] as const, fallback.language),
    theme: oneOf(value.theme, ["light", "dark"] as const, fallback.theme),
    sensitivity: oneOf(value.sensitivity, ["normal", "tans", "burns"] as const, fallback.sensitivity),
    sunscreenType: oneOf(
      value.sunscreenType,
      ["regular", "waterResistant", "unsure"] as const,
      fallback.sunscreenType
    )
  };
}

export function sanitizeExposure(value: unknown, fallback: ExposureContext): ExposureContext {
  if (!isRecord(value)) return fallback;
  const expectedOutdoorMinutes =
    typeof value.expectedOutdoorMinutes === "number" &&
    Number.isFinite(value.expectedOutdoorMinutes) &&
    [15, 30, 60, 120].includes(value.expectedOutdoorMinutes)
      ? value.expectedOutdoorMinutes
      : fallback.expectedOutdoorMinutes;

  return {
    place: oneOf(value.place, ["outdoor", "indoor"] as const, fallback.place),
    nearWindow: bool(value.nearWindow, fallback.nearWindow),
    expectedOutdoorMinutes,
    sweatingOrSwimming: bool(value.sweatingOrSwimming, fallback.sweatingOrSwimming)
  };
}

function sanitizeSunscreenEvent(value: unknown): SunscreenEvent | null {
  if (!isRecord(value)) return null;
  const timestamp = typeof value.timestamp === "string" ? value.timestamp : "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return {
    id: safeDisplayText(value.id) || `${date.getTime()}`,
    timestamp: date.toISOString(),
    type: oneOf(value.type, ["applied", "reapplied"] as const, "applied")
  };
}

export function sanitizeDailyLog(value: unknown, fallback: DailySunscreenLog): DailySunscreenLog {
  if (!isRecord(value) || !Array.isArray(value.events)) return fallback;
  const events = value.events.map(sanitizeSunscreenEvent).filter((event): event is SunscreenEvent => Boolean(event));
  return {
    date: typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : fallback.date,
    events
  };
}

export function sanitizeUvValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(15, value));
}

export function sanitizeWeatherSnapshot(value: WeatherSnapshot): WeatherSnapshot {
  return {
    ...value,
    uvIndex: sanitizeUvValue(value.uvIndex),
    weatherCode:
      typeof value.weatherCode === "number" && Number.isFinite(value.weatherCode) ? Math.round(value.weatherCode) : null,
    temperatureC:
      typeof value.temperatureC === "number" && Number.isFinite(value.temperatureC) ? value.temperatureC : null,
    hourlyUv: value.hourlyUv.map((point) => ({
      time: point.time,
      uvIndex: sanitizeUvValue(point.uvIndex)
    }))
  };
}
