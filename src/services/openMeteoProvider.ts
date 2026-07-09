import type { Language, SavedLocation, SearchResult, UvPoint, WeatherSnapshot } from "../types";
import { safeCityInput, safeDisplayText } from "../security/sanitize";
import { isValidLatitude, isValidLongitude, sanitizeLocation, sanitizeUvValue, sanitizeWeatherSnapshot } from "../security/validation";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODING_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

interface ForecastResponse {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    uv_index?: number;
  };
  hourly?: {
    time?: string[];
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

function assertValidLocation(location: SavedLocation): void {
  if (!isValidLatitude(location.latitude) || !isValidLongitude(location.longitude)) {
    throw new Error("Invalid location coordinates");
  }
}

function nearestUv(hourly: UvPoint[], now = new Date()): number | null {
  if (hourly.length === 0) return null;
  const nearest = hourly.reduce<{ point: UvPoint; diff: number } | null>((best, point) => {
    const uvIndex = sanitizeUvValue(point.uvIndex);
    if (uvIndex === null) return best;
    const diff = Math.abs(new Date(point.time).getTime() - now.getTime());
    if (!best || diff < best.diff) return { point, diff };
    return best;
  }, null);
  return sanitizeUvValue(nearest?.point.uvIndex);
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

  const data = (await fetch(url).then(assertOk).then((response) => response.json())) as ForecastResponse;
  const times = data.hourly?.time ?? [];
  const uvValues = data.hourly?.uv_index ?? [];
  const hourlyUv = times
    .map((time, index) => ({
      time,
      uvIndex: sanitizeUvValue(uvValues[index])
    }))
    .filter((point) => typeof point.time === "string" && point.time.length > 0);

  return sanitizeWeatherSnapshot({
    uvIndex: sanitizeUvValue(data.current?.uv_index) ?? nearestUv(hourlyUv),
    weatherCode: data.current?.weather_code ?? null,
    temperatureC: data.current?.temperature_2m ?? null,
    fetchedAt: new Date().toISOString(),
    timezone: safeDisplayText(data.timezone) || undefined,
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

  const data = (await fetch(url).then(assertOk).then((response) => response.json())) as GeocodingResponse;
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

  const data = (await fetch(url).then(assertOk).then((response) => response.json())) as ReverseGeocodingResponse;
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
