import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

function installLocalStorage() {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      clear: vi.fn(() => store.clear()),
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
      removeItem: vi.fn((key: string) => store.delete(key)),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, String(value));
      }),
      get length() {
        return store.size;
      }
    }
  });
}

describe("localStorage poisoning recovery", () => {
  beforeEach(() => {
    store.clear();
    installLocalStorage();
  });

  it("keeps the session usable when storage writes are blocked", async () => {
    const { saveSettings, defaultSettings } = await import("./storage");
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error("QuotaExceededError"); });
    expect(() => saveSettings(defaultSettings)).not.toThrow();
  });

  it("recovers from corrupted saved settings", async () => {
    const { loadSettings } = await import("./storage");
    localStorage.setItem("suncheck:settings", '{"language":"<script>","theme":42,"sensitivity":"bad"}');

    expect(loadSettings()).toMatchObject({
      theme: "light",
      sensitivity: "normal",
      sunscreenType: "unsure"
    });
  });

  it("filters corrupted favorite cities", async () => {
    const { loadFavorites } = await import("./storage");
    localStorage.setItem(
      "suncheck:favorites",
      JSON.stringify([
        {
          id: "1",
          name: "New York<script>bad</script>",
          latitude: 40.7128,
          longitude: -74.006,
          source: "favorite"
        },
        {
          id: "2",
          name: "<img src=x>",
          latitude: Number.POSITIVE_INFINITY,
          longitude: -74.006,
          source: "favorite"
        },
        "not-a-location"
      ])
    );

    const favorites = loadFavorites();
    expect(favorites).toHaveLength(1);
    expect(favorites[0].name).toBe("New York‹script›bad‹/script›");
    expect(favorites[0].latitude).toBe(40.7128);
  });

  it("ignores corrupted last location", async () => {
    const { loadLastLocation } = await import("./storage");
    localStorage.setItem("suncheck:last-location", '{"name":"Bad","latitude":999,"longitude":null}');
    expect(loadLastLocation()).toBeNull();
  });

  it("recovers from corrupted sunscreen history", async () => {
    const { loadTodayLog, todayKey } = await import("./storage");
    const date = new Date("2026-07-09T12:00:00Z");
    localStorage.setItem(
      `suncheck:log:${todayKey(date)}`,
      JSON.stringify({
        date: todayKey(date),
        events: [
          { id: "<script>", timestamp: "not-a-date", type: "bad" },
          { id: "safe", timestamp: "2026-07-09T11:00:00.000Z", type: "reapplied" }
        ]
      })
    );

    const log = loadTodayLog(date);
    expect(log.events).toHaveLength(1);
    expect(log.events[0]).toMatchObject({
      id: "safe",
      timestamp: "2026-07-09T11:00:00.000Z",
      type: "reapplied"
    });
  });

  it("restores a recent weather snapshot only for the same place", async () => {
    const { loadCachedWeather, saveCachedWeather } = await import("./storage");
    const shanghai = { id: "sh", name: "Shanghai", latitude: 31.23, longitude: 121.47, source: "manual" as const };
    const beijing = { id: "bj", name: "Beijing", latitude: 39.9, longitude: 116.4, source: "manual" as const };
    const fetchedAt = new Date("2026-09-30T04:00:00Z");
    saveCachedWeather(shanghai, {
      uvIndex: 5,
      weatherCode: 1,
      temperatureC: 22,
      fetchedAt: fetchedAt.toISOString(),
      timezone: "Asia/Shanghai",
      hourlyUv: [{ time: "2026-09-30T04:00:00.000Z", uvIndex: 5 }]
    });
    expect(loadCachedWeather(shanghai, new Date("2026-09-30T06:00:00Z"))?.hourlyUv[0].uvIndex).toBe(5);
    expect(loadCachedWeather({ ...shanghai, name: "Renamed GPS fix", latitude: 31.231 }, new Date("2026-09-30T06:00:00Z"))).not.toBeNull();
    expect(loadCachedWeather(beijing, new Date("2026-09-30T06:00:00Z"))).toBeNull();
    expect(loadCachedWeather(shanghai, new Date("2026-09-30T17:00:00Z"))).toBeNull();
  });

  it("rejects a poisoned weather cache", async () => {
    const { loadCachedWeather } = await import("./storage");
    const place = { id: "sh", name: "Shanghai", latitude: 31.23, longitude: 121.47, source: "manual" as const };
    store.set("suncheck:weather", JSON.stringify({ key: "31.23,121.47", snapshot: { fetchedAt: "nope", hourlyUv: "x" } }));
    expect(loadCachedWeather(place)).toBeNull();
    store.set("suncheck:weather", "{not json");
    expect(loadCachedWeather(place)).toBeNull();
    store.set(
      "suncheck:weather",
      JSON.stringify({
        key: "31.23,121.47",
        snapshot: { fetchedAt: new Date().toISOString(), timezone: "Bad/Zone", uvIndex: 99, hourlyUv: [{ time: "bad", uvIndex: 3 }, { time: new Date().toISOString(), uvIndex: -4 }] }
      })
    );
    const restored = loadCachedWeather(place);
    expect(restored?.timezone).toBeUndefined();
    expect(restored?.uvIndex).toBe(15);
    expect(restored?.hourlyUv).toHaveLength(1);
    expect(restored?.hourlyUv[0].uvIndex).toBe(0);
  });
});
