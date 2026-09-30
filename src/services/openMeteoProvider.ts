import type { Language, SavedLocation, SearchResult, UvPoint, WeatherSnapshot } from "../types";
import { safeCityInput, safeDisplayText } from "../security/sanitize";
import { isValidLatitude, isValidLongitude, sanitizeLocation, sanitizeUvValue, sanitizeWeatherSnapshot } from "../security/validation";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODING_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const REQUEST_TIMEOUT_MS = 10_000;
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

function assertOk(response: Response): Response {
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response;
}

async function fetchJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = assertOk(await fetch(url, { signal: controller.signal }));
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
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

export async function fetchWeather(location: SavedLocation): Promise<WeatherSnapshot> {
  assertValidLocation(location);
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,uv_index");
  url.searchParams.set("hourly", "uv_index");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("timeformat", "unixtime");

  const data = (await fetchJson(url)) as ForecastResponse | null;
  const now = new Date();
  const times = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
  const uvValues = Array.isArray(data?.hourly?.uv_index) ? data.hourly.uv_index : [];
  const hourlyUv = times
    .map((time, index) => ({
      time: forecastTime(time),
      uvIndex: sanitizeUvValue(uvValues[index])
    }))
    .filter((point): point is UvPoint => point.time !== null);
  const currentTime = forecastTime(data?.current?.time);
  const currentAge = currentTime ? now.getTime() - new Date(currentTime).getTime() : Number.POSITIVE_INFINITY;

  return sanitizeWeatherSnapshot({
    uvIndex: (currentAge >= 0 && currentAge < HOUR_MS ? sanitizeUvValue(data?.current?.uv_index) : null) ?? currentHourlyUv(hourlyUv, now),
    weatherCode: data?.current?.weather_code ?? null,
    temperatureC: data?.current?.temperature_2m ?? null,
    fetchedAt: now.toISOString(),
    timezone: safeDisplayText(data?.timezone) || undefined,
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

  const data = (await fetchJson(url)) as GeocodingResponse;
  const results: SearchResult[] = [];

  for (const result of data.results ?? []) {
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

  const data = (await fetchJson(url)) as ReverseGeocodingResponse;
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
