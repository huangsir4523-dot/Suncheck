import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWeather, searchCities } from "./openMeteoProvider";
import type { SavedLocation } from "../types";

function jsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => data
  } as Response;
}

describe("Open-Meteo provider hardening", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("encodes and limits city search input before calling the API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await searchCities(' New York<script>bad</script> "><img src=x onerror=alert(1)>'.repeat(8), "en");

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("name")).toHaveLength(80);
    expect(String(fetchMock.mock.calls[0][0])).toContain("name=");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("<script>");
  });

  it("sanitizes HTML-like API city names and filters invalid coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          results: [
            {
              id: 1,
              name: "New York<script>bad</script>",
              admin1: "<svg onload=alert(1)>",
              country: "US",
              latitude: 40.7128,
              longitude: -74.006
            },
            {
              id: 2,
              name: "Bad",
              latitude: Number.NaN,
              longitude: 10
            },
            {
              id: 3,
              name: "Outside",
              latitude: 91,
              longitude: 10
            }
          ]
        })
      )
    );

    const results = await searchCities("New York", "en");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("New York‹script›bad‹/script›");
    expect(results[0].admin1).toBe("‹svg onload＝alert(1)›");
  });

  it("rejects invalid location coordinates before weather fetch", async () => {
    const location = {
      id: "bad",
      name: "Bad",
      latitude: Number.POSITIVE_INFINITY,
      longitude: 0,
      source: "manual"
    } as SavedLocation;

    await expect(fetchWeather(location)).rejects.toThrow("Invalid location coordinates");
  });

  it("returns fallback UV data instead of crashing on malformed weather response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          current: {
            temperature_2m: Number.NaN,
            weather_code: Number.POSITIVE_INFINITY,
            uv_index: "bad"
          },
          hourly: {
            time: ["2026-07-09T12:00:00Z"],
            uv_index: [Number.NaN]
          }
        })
      )
    );

    const weather = await fetchWeather({
      id: "nyc",
      name: "New York",
      latitude: 40.7128,
      longitude: -74.006,
      source: "manual"
    });

    expect(weather.uvIndex).toBeNull();
    expect(weather.weatherCode).toBeNull();
    expect(weather.temperatureC).toBeNull();
    expect(weather.hourlyUv[0].uvIndex).toBeNull();
  });

  it("requests timezone-safe timestamps and converts them to ISO instants", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        timezone: "Asia/Shanghai",
        current: { uv_index: 5.2 },
        hourly: { time: [1784649600], uv_index: [4.8] }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const weather = await fetchWeather({
      id: "beijing",
      name: "Beijing",
      latitude: 39.9042,
      longitude: 116.4074,
      source: "manual"
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("timeformat")).toBe("unixtime");
    expect(weather.timezone).toBe("Asia/Shanghai");
    expect(weather.hourlyUv[0].time).toBe("2026-07-21T16:00:00.000Z");
  });

  it("does not substitute stale or future UV for the current hour", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T04:30:00Z"));
    const city: SavedLocation = { id: "test", name: "Test", latitude: 1, longitude: 1, source: "manual" };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      current: { time: "2026-09-30T02:00:00Z", uv_index: 9 },
      hourly: { time: ["2026-09-30T03:00:00Z", "2026-09-30T05:00:00Z"], uv_index: [8, 7] }
    })));
    expect((await fetchWeather(city)).uvIndex).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      hourly: { time: ["2026-09-30T04:00:00Z"], uv_index: [4.2] }
    })));
    expect((await fetchWeather(city)).uvIndex).toBe(4.2);
  });

  it("drops invalid timestamps without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      hourly: { time: [Infinity, 1e30, "bad", "2026-09-30T04:00", "2026-09-30T04:00:00Z"], uv_index: [1, 2, 3, 4, 5] }
    })));
    const weather = await fetchWeather({ id: "test", name: "Test", latitude: 1, longitude: 1, source: "manual" });
    expect(weather.hourlyUv).toEqual([{ time: "2026-09-30T04:00:00.000Z", uvIndex: 5 }]);
  });

  it("aborts a stalled weather request after ten seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    })));
    const request = fetchWeather({ id: "test", name: "Test", latitude: 1, longitude: 1, source: "manual" });
    const assertion = expect(request).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
