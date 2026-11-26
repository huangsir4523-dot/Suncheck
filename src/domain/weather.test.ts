import { describe, expect, it } from "vitest";
import type { WeatherSnapshot } from "../types";
import { getCurrentUv, getUsableWeather, selectWeatherAfterRefresh } from "./weather";

const now = new Date("2026-11-26T11:30:00Z");
const cached: WeatherSnapshot = {
  uvIndex: 9,
  weatherCode: 0,
  temperatureC: 30,
  fetchedAt: "2026-11-26T05:30:00Z",
  hourlyUv: [{ time: "2026-11-26T11:00:00Z", uvIndex: 1 }]
};
const missing: WeatherSnapshot = { ...cached, fetchedAt: now.toISOString(), uvIndex: null, hourlyUv: [] };

describe("weather cache and current UV", () => {
  it("uses the current forecast hour instead of an old high reading", () => {
    expect(getCurrentUv(cached, now)).toBe(1);
    expect(getCurrentUv({ ...cached, fetchedAt: "2026-11-26T11:00:00Z" }, now)).toBe(9);
    expect(getCurrentUv({ ...cached, fetchedAt: "2026-11-26T10:30:00Z" }, now)).toBe(1);
    expect(getCurrentUv({ ...cached, hourlyUv: [] }, now)).toBeNull();
  });

  it("expires a forecast at exactly 12 hours and rejects future or invalid timestamps", () => {
    const expiresAt = new Date("2026-11-26T17:30:00Z");
    expect(getUsableWeather(cached, new Date(expiresAt.getTime() - 1))).toBe(cached);
    expect(getUsableWeather(cached, expiresAt)).toBeNull();
    expect(getCurrentUv(cached, expiresAt)).toBeNull();
    for (const fetchedAt of ["2026-11-27T00:00:00Z", "invalid"]) {
      expect(getUsableWeather({ ...cached, fetchedAt }, now)).toBeNull();
    }
  });

  it("keeps usable cached UV when a refresh has no current UV, including zero UV", () => {
    expect(selectWeatherAfterRefresh(cached, missing, now)).toBe(cached);
    const zero = { ...cached, hourlyUv: [{ time: "2026-11-26T11:00:00Z", uvIndex: 0 }] };
    expect(selectWeatherAfterRefresh(zero, missing, now)).toBe(zero);
    const futureOnly = { ...missing, hourlyUv: [{ time: "2026-11-26T12:00:00Z", uvIndex: 7 }] };
    expect(selectWeatherAfterRefresh(cached, futureOnly, now)).toBe(cached);
  });

  it("accepts recovered readings and does not revive expired or unusable caches", () => {
    const recovered = { ...missing, uvIndex: 0 };
    expect(selectWeatherAfterRefresh(cached, recovered, now)).toBe(recovered);
    expect(selectWeatherAfterRefresh(null, missing, now)).toBe(missing);
    expect(selectWeatherAfterRefresh({ ...cached, fetchedAt: "2026-11-25T23:30:00Z" }, missing, now)).toBe(missing);
    expect(selectWeatherAfterRefresh({ ...cached, hourlyUv: [] }, missing, now)).toBe(missing);
  });
});
