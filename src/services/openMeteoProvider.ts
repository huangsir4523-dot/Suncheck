import type { Language, SavedLocation, SearchResult, UvPoint, WeatherSnapshot } from "../types";
import { safeCityInput, safeDisplayText } from "../security/sanitize";
import { isValidLatitude, isValidLongitude, sanitizeLocation, sanitizeUvValue, sanitizeWeatherSnapshot } from "../security/validation";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
// Independent Open-Meteo host (CAMS model) used as a UV fallback when the main forecast is down or has no UV.
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODING_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
// One timeout per attempt: a quick first try, then a more patient retry for slow mobile networks.
export const WEATHER_ATTEMPT_TIMEOUTS_MS = [8_000, 12_000] as const;
export const FALLBACK_TIMEOUT_MS = 10_000;
export const RETRY_DELAY_MS = 700;
const REVERSE_GEOCODING_TIMEOUT_MS = 8_000;
const HOUR_MS = 60 * 60 * 1000;

interface ForecastResponse {
  timezone?: string;
  utc_offset_seconds?: number;
  current?: {
    time?: string | number;
    temperature_2m?: number;
    weather_code?: number;
    uv_index?: number;
  };
  hourly?: {
    time?: Array<string | number>;
    uv_index?: Array<number | null>;
  };
}

interface GeocodingResponse {
  results?: Array<{
    id?: number | string;
    name?: string;
    country?: string;
    admin1?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

interface ReverseGeocodingResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  latitude?: number;
  longitude?: number;
  lookupSource?: string;
}

interface AirQualityResponse {
  timezone?: string;
  hourly?: {
    time?: Array<string | number>;
    uv_index?: Array<number | null>;
  };
}

export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`Request failed: ${status}`);
    this.name = "HttpError";
  }
}

function isRetryable(error: unknown): boolean {
  // Network errors and timeouts are worth another try; most 4xx responses are not.
  if (error instanceof HttpError) return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  return true;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: URL, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new HttpError(response.status);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithRetry(url: URL, timeouts: readonly number[] = WEATHER_ATTEMPT_TIMEOUTS_MS): Promise<unknown> {
  let lastError: unknown = new Error("Request was not attempted");
  for (let attempt = 0; attempt < timeouts.length; attempt++) {
    if (attempt > 0) await wait(RETRY_DELAY_MS * attempt);
    try {
      return await fetchJson(url, timeouts[attempt]);
    } catch (error) {
      lastError = error;
      console.warn(`[Suncheck] Request attempt ${attempt + 1}/${timeouts.length} failed`, url.hostname, error);
      if (!isRetryable(error)) break;
    }
  }
  throw lastError;
}

function parseHourlyUv(hourly: { time?: Array<string | number>; uv_index?: Array<number | null> } | undefined): UvPoint[] {
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  const uvValues = Array.isArray(hourly?.uv_index) ? hourly.uv_index : [];
  return times
    .map((time, index) => ({
      time: forecastTime(time),
      uvIndex: sanitizeUvValue(uvValues[index])
    }))
    .filter((point): point is UvPoint => point.time !== null);
}

function hasUv(points: UvPoint[]): boolean {
  return points.some((point) => point.uvIndex !== null);
}

function assertValidLocation(location: SavedLocation): void {
  if (!isValidLatitude(location.latitude) || !isValidLongitude(location.longitude)) {
    throw new Error("Invalid location coordinates");
  }
}

function currentHourlyUv(hourly: UvPoint[], now: Date): number | null {
  const point = hourly.find((point) => {
    const age = now.getTime() - new Date(point.time).getTime();
    return age >= 0 && age < HOUR_MS;
  });
  return sanitizeUvValue(point?.uvIndex);
}

function forecastTime(value: unknown): string | null {
  // Unix seconds are requested; ISO strings must carry a timezone to be unambiguous.
  if (typeof value !== "number" &&
      (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))) return null;
  const parsed = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function locationUrl(base: string, location: SavedLocation): URL {
  const url = new URL(base);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("timeformat", "unixtime");
  return url;
}

export async function fetchWeather(location: SavedLocation): Promise<WeatherSnapshot> {
  assertValidLocation(location);
  const url = locationUrl(FORECAST_URL, location);
  url.searchParams.set("current", "temperature_2m,weather_code,uv_index");
  url.searchParams.set("hourly", "uv_index");

  let data: ForecastResponse | null = null;
  let forecastError: unknown = null;
  try {
    data = (await fetchJsonWithRetry(url)) as ForecastResponse | null;
  } catch (error) {
    forecastError = error;
  }

  let hourlyUv = parseHourlyUv(data?.hourly);
  let timezone = safeDisplayText(data?.timezone);
  let uvSource: WeatherSnapshot["uvSource"] = "forecast";

  if (!hasUv(hourlyUv)) {
    // The main forecast failed or came back without UV: try the independent air-quality endpoint.
    try {
      const fallbackUrl = locationUrl(AIR_QUALITY_URL, location);
      fallbackUrl.searchParams.set("hourly", "uv_index");
      const fallback = (await fetchJsonWithRetry(fallbackUrl, [FALLBACK_TIMEOUT_MS])) as AirQualityResponse | null;
      const fallbackUv = parseHourlyUv(fallback?.hourly);
      if (hasUv(fallbackUv)) {
        hourlyUv = fallbackUv;
        timezone = timezone || safeDisplayText(fallback?.timezone);
        uvSource = "airQuality";
      }
    } catch (fallbackError) {
      console.warn("[Suncheck] UV fallback request failed", fallbackError);
    }
  }

  if (forecastError && !hasUv(hourlyUv)) throw forecastError;

  const now = new Date();
  const currentTime = forecastTime(data?.current?.time);
  const currentAge = currentTime ? now.getTime() - new Date(currentTime).getTime() : Number.POSITIVE_INFINITY;
  const currentUv = uvSource === "forecast" && currentAge >= 0 && currentAge < HOUR_MS ? sanitizeUvValue(data?.current?.uv_index) : null;

  return sanitizeWeatherSnapshot({
    uvIndex: currentUv ?? currentHourlyUv(hourlyUv, now),
    weatherCode: data?.current?.weather_code ?? null,
    temperatureC: data?.current?.temperature_2m ?? null,
    fetchedAt: now.toISOString(),
    timezone: timezone || undefined,
    uvSource,
    hourlyUv
  });
}

export async function searchCities(query: string, language: Language): Promise<SearchResult[]> {
  const cityInput = safeCityInput(query);
  if (!cityInput) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", cityInput);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", language);
  url.searchParams.set("format", "json");

  const data = (await fetchJsonWithRetry(url)) as GeocodingResponse | null;
  const results: SearchResult[] = [];

  for (const result of data?.results ?? []) {
    const latitude = result.latitude;
    const longitude = result.longitude;
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) continue;
    const name = safeDisplayText(result.name);
    if (!name) continue;
    const country = safeDisplayText(result.country);
    const admin1 = safeDisplayText(result.admin1);

    results.push({
      id: safeDisplayText(result.id) || `${latitude}:${longitude}`,
      name,
      ...(country ? { country } : {}),
      ...(admin1 ? { admin1 } : {}),
      latitude,
      longitude
    });
  }

  return results;
}

export async function reverseGeocodeLocation(location: SavedLocation, language: Language): Promise<SavedLocation | null> {
  assertValidLocation(location);
  const url = new URL(REVERSE_GEOCODING_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("localityLanguage", language === "zh" ? "zh" : "en");

  const data = ((await fetchJson(url, REVERSE_GEOCODING_TIMEOUT_MS)) ?? {}) as ReverseGeocodingResponse;
  const cityName = safeDisplayText(data.city || data.locality || data.principalSubdivision);

  if (!cityName) return null;

  return sanitizeLocation({
    ...location,
    name: cityName,
    admin1: safeDisplayText(data.principalSubdivision) || undefined,
    country: safeDisplayText(data.countryName) || undefined,
    source: "gps"
  });
}

export function locationFromGeolocation(position: GeolocationPosition): SavedLocation {
  const location = sanitizeLocation({
    id: `gps:${Math.round(position.coords.latitude * 1000)}:${Math.round(position.coords.longitude * 1000)}`,
    name: "GPS",
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    source: "gps"
  });
  if (!location) throw new Error("Invalid browser geolocation coordinates");
  return location;
}

export function savedLocationFromSearch(result: SearchResult): SavedLocation {
  const location = sanitizeLocation({
    ...result,
    source: "manual"
  });
  if (!location) throw new Error("Invalid city search result");
  return location;
}
