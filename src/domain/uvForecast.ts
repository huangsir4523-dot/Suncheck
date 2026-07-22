import type { UvPoint } from "../types";

export type UvBand = "low" | "moderate" | "high" | "veryHigh" | "extreme";

export interface UvForecastSummary {
  peakUv: number | null;
  peakAt?: Date;
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
  const start = now.getTime() - 60 * 60 * 1000;
  const end = now.getTime() + 24 * 60 * 60 * 1000;

  return points
    .map((point) => ({ at: new Date(point.time), uvIndex: point.uvIndex }))
    .filter(
      (point): point is { at: Date; uvIndex: number } =>
        !Number.isNaN(point.at.getTime()) &&
        typeof point.uvIndex === "number" &&
        Number.isFinite(point.uvIndex) &&
        point.at.getTime() >= start &&
        point.at.getTime() <= end
    )
    .sort((left, right) => left.at.getTime() - right.at.getTime());
}

export function getUvForecastSummary(points: UvPoint[], now = new Date()): UvForecastSummary {
  const forecast = validForecastPoints(points, now);
  if (forecast.length === 0) return { peakUv: null };

  const peak = forecast.reduce((highest, point) => (point.uvIndex > highest.uvIndex ? point : highest));
  const protectionPoints = forecast.filter((point) => point.uvIndex >= 3);

  if (protectionPoints.length === 0) {
    return { peakUv: peak.uvIndex, peakAt: peak.at };
  }

  const lastProtectedHour = protectionPoints.at(-1)!;
  return {
    peakUv: peak.uvIndex,
    peakAt: peak.at,
    protectionStartAt: protectionPoints[0].at,
    protectionEndAt: new Date(lastProtectedHour.at.getTime() + 60 * 60 * 1000)
  };
}
