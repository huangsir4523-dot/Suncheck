import type { Language, SavedLocation, SearchResult, UvPoint, WeatherSnapshot } from "../types";

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
    id: number;
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
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

function nearestUv(hourly: UvPoint[], now = new Date()): number | null {
  if (hourly.length === 0) return null;
  const nearest = hourly.reduce<{ point: UvPoint; diff: number } | null>((best, point) => {
    if (point.uvIndex === null) return best;
    const diff = Math.abs(new Date(point.time).getTime() - now.getTime());
    if (!best || diff < best.diff) return { point, diff };
    return best;
  }, null);
  return nearest?.point.uvIndex ?? null;
}

export async function fetchWeather(location: SavedLocation): Promise<WeatherSnapshot> {
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
  const hourlyUv = times.map((time, index) => ({
    time,
    uvIndex: uvValues[index] ?? null
  }));

  return {
    uvIndex: data.current?.uv_index ?? nearestUv(hourlyUv),
    weatherCode: data.current?.weather_code ?? null,
    temperatureC: data.current?.temperature_2m ?? null,
    fetchedAt: new Date().toISOString(),
    timezone: data.timezone,
    hourlyUv
  };
}

export async function searchCities(query: string, language: Language): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", language);
  url.searchParams.set("format", "json");

  const data = (await fetch(url).then(assertOk).then((response) => response.json())) as GeocodingResponse;
  return (
    data.results?.map((result) => ({
      id: String(result.id),
      name: result.name,
      country: result.country,
      admin1: result.admin1,
      latitude: result.latitude,
      longitude: result.longitude
    })) ?? []
  );
}

export async function reverseGeocodeLocation(location: SavedLocation, language: Language): Promise<SavedLocation | null> {
  const url = new URL(REVERSE_GEOCODING_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("localityLanguage", language === "zh" ? "zh" : "en");

  const data = (await fetch(url).then(assertOk).then((response) => response.json())) as ReverseGeocodingResponse;
  const cityName = data.city || data.locality || data.principalSubdivision;

  if (!cityName) return null;

  return {
    ...location,
    name: cityName,
    admin1: data.principalSubdivision,
    country: data.countryName,
    source: "gps"
  };
}

export function locationFromGeolocation(position: GeolocationPosition): SavedLocation {
  return {
    id: `gps:${Math.round(position.coords.latitude * 1000)}:${Math.round(position.coords.longitude * 1000)}`,
    name: "GPS",
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    source: "gps"
  };
}

export function savedLocationFromSearch(result: SearchResult): SavedLocation {
  return {
    ...result,
    source: "manual"
  };
}
