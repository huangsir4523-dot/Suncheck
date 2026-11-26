import type { WeatherSnapshot } from "../types";
import { getUvAt } from "./uvForecast";

const HOUR_MS = 60 * 60 * 1000;
const WEATHER_CACHE_MAX_AGE_MS = 12 * HOUR_MS;

export function getUsableWeather(weather: WeatherSnapshot | null, now: Date): WeatherSnapshot | null {
  if (!weather) return null;
  const age = now.getTime() - new Date(weather.fetchedAt).getTime();
  return age >= 0 && age < WEATHER_CACHE_MAX_AGE_MS ? weather : null;
}

export function getCurrentUv(snapshot: WeatherSnapshot | null, now: Date): number | null {
  const weather = getUsableWeather(snapshot, now);
  if (!weather) return null;
  const age = now.getTime() - new Date(weather.fetchedAt).getTime();
  const reading = age < HOUR_MS ? weather.uvIndex : null;
  return reading ?? getUvAt(weather.hourlyUv, now);
}

export function selectWeatherAfterRefresh(
  previous: WeatherSnapshot | null,
  incoming: WeatherSnapshot,
  now: Date
): WeatherSnapshot {
  // A successful HTTP response can still be missing the UV needed for current advice.
  return previous && getCurrentUv(previous, now) !== null && getCurrentUv(incoming, now) === null
    ? previous
    : incoming;
}
