import { describe, expect, it } from "vitest";
import { getUvBand, getUvForecastSummary } from "./uvForecast";

describe("UV forecast analysis", () => {
  it("separates nights and missing hours instead of joining them into one window", () => {
    const now = new Date("2026-09-30T08:00:00Z");
    const values = [4, 5, 0, 0, 3, null, 4];
    const points = values.map((uvIndex, i) => ({ time: new Date(now.getTime() + i * 3600000).toISOString(), uvIndex }));
    const summary = getUvForecastSummary(points, now);
    expect(summary.protectionWindows.map(w => [w.startAt.toISOString(), w.endAt.toISOString()])).toEqual([
      ["2026-09-30T08:00:00.000Z", "2026-09-30T10:00:00.000Z"],
      ["2026-09-30T12:00:00.000Z", "2026-09-30T13:00:00.000Z"],
      ["2026-09-30T14:00:00.000Z", "2026-09-30T15:00:00.000Z"]
    ]);
    expect(summary.hasIncompleteCoverage).toBe(true);
  });

  it("clips windows to now and the 24-hour boundary and recognizes complete coverage", () => {
    const start = new Date("2026-09-30T08:00:00Z").getTime();
    const points = Array.from({ length: 25 }, (_, i) => ({ time: new Date(start + i * 3600000).toISOString(), uvIndex: 4 }));
    const summary = getUvForecastSummary(points, new Date(start + 1800000));
    expect(summary.hasIncompleteCoverage).toBe(false);
    expect(summary.protectionWindows).toEqual([{ startAt: new Date(start + 1800000), endAt: new Date(start + 24.5 * 3600000) }]);
  });
  it("uses WHO UV Index thresholds", () => {
    expect(getUvBand(2.9)).toBe("low");
    expect(getUvBand(3)).toBe("moderate");
    expect(getUvBand(6)).toBe("high");
    expect(getUvBand(8)).toBe("veryHigh");
    expect(getUvBand(11)).toBe("extreme");
  });

  it("finds the next 24-hour peak and protection window", () => {
    const now = new Date("2026-07-22T01:30:00.000Z");
    const summary = getUvForecastSummary(
      [
        { time: "2026-07-22T01:00:00.000Z", uvIndex: 1 },
        { time: "2026-07-22T02:00:00.000Z", uvIndex: 3.2 },
        { time: "2026-07-22T03:00:00.000Z", uvIndex: 7.1 },
        { time: "2026-07-22T04:00:00.000Z", uvIndex: 4 },
        { time: "2026-07-22T05:00:00.000Z", uvIndex: 2.8 },
        { time: "2026-07-23T03:00:00.000Z", uvIndex: 12 }
      ],
      now
    );

    expect(summary.peakUv).toBe(7.1);
    expect(summary.peakAt?.toISOString()).toBe("2026-07-22T03:00:00.000Z");
    expect(summary.protectionStartAt?.toISOString()).toBe("2026-07-22T02:00:00.000Z");
    expect(summary.protectionEndAt?.toISOString()).toBe("2026-07-22T05:00:00.000Z");
  });

  it("returns a peak without a protection window when UV stays low", () => {
    const summary = getUvForecastSummary(
      [
        { time: "2026-07-22T02:00:00.000Z", uvIndex: 1.2 },
        { time: "2026-07-22T03:00:00.000Z", uvIndex: 2.4 }
      ],
      new Date("2026-07-22T01:30:00.000Z")
    );

    expect(summary.peakUv).toBe(2.4);
    expect(summary.protectionStartAt).toBeUndefined();
  });
});
