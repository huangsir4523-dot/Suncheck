import { describe, expect, it } from "vitest";
import { getUvBand, getUvForecastSummary } from "./uvForecast";

describe("UV forecast analysis", () => {
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
