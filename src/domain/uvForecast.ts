import type { UvPoint } from "../types";

export type UvBand = "low" | "moderate" | "high" | "veryHigh" | "extreme";

const HOUR_MS = 60 * 60 * 1000;

export interface UvForecastSummary {
  peakUv: number | null;
  peakAt?: Date;
  protectionWindows: Array<{ startAt: Date; endAt: Date }>;
  hasIncompleteCoverage: boolean;
  // Compatibility fields describe only the first continuous window.
  protectionStartAt?: Date;
  protectionEndAt?: Date;
}

export function getUvBand(uvIndex: number): UvBand {
  if (uvIndex >= 11) return "extreme";
  if (uvIndex >= 8) return "veryHigh";
  if (uvIndex >= 6) return "high";
  if (uvIndex >= 3) return "moderate";
  return "low";
}

function validForecastPoints(points: UvPoint[], now: Date): Array<{ at: Date; uvIndex: number }> {
  const start = now.getTime();
  const end = start + 24 * HOUR_MS;

  return points
    .map((point) => ({ at: new Date(point.time), uvIndex: point.uvIndex }))
    .filter(
      (point): point is { at: Date; uvIndex: number } =>
        !Number.isNaN(point.at.getTime()) &&
        typeof point.uvIndex === "number" &&
        Number.isFinite(point.uvIndex) &&
        point.uvIndex >= 0 &&
        point.at.getTime() + HOUR_MS > start &&
        point.at.getTime() < end
    )
    .sort((left, right) => left.at.getTime() - right.at.getTime());
}

export function getUvForecastSummary(points: UvPoint[], now = new Date()): UvForecastSummary {
  const forecast = validForecastPoints(points, now);
  const start = now.getTime();
  const end = start + 24 * HOUR_MS;
  const protectionWindows: UvForecastSummary["protectionWindows"] = [];
  let coveredUntil = start;
  let hasIncompleteCoverage = forecast.length === 0;

  for (const point of forecast) {
    const hourStart = Math.max(start, point.at.getTime());
    const hourEnd = Math.min(end, point.at.getTime() + HOUR_MS);
    if (hourStart > coveredUntil) hasIncompleteCoverage = true;
    coveredUntil = Math.max(coveredUntil, hourEnd);

    if (point.uvIndex < 3) continue;
    const previous = protectionWindows.at(-1);
    if (previous && previous.endAt.getTime() === hourStart) {
      previous.endAt = new Date(hourEnd);
    } else {
      protectionWindows.push({ startAt: new Date(hourStart), endAt: new Date(hourEnd) });
    }
  }

  const peak = forecast.reduce<(typeof forecast)[number] | undefined>(
    (highest, point) => (!highest || point.uvIndex > highest.uvIndex ? point : highest),
    undefined
  );
  return {
    peakUv: peak?.uvIndex ?? null,
    peakAt: peak?.at,
    protectionWindows,
    hasIncompleteCoverage: hasIncompleteCoverage || coveredUntil < end,
    protectionStartAt: protectionWindows[0]?.startAt,
    protectionEndAt: protectionWindows[0]?.endAt
  };
}
