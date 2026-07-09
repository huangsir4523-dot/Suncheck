import type { Recommendation, RecommendationInput, RiskLevel, SunscreenType } from "../types";

function minutesBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60000);
}

export function getReapplyIntervalMinutes(sunscreenType: SunscreenType, sweatingOrSwimming: boolean): number {
  if (sweatingOrSwimming) {
    return sunscreenType === "waterResistant" ? 90 : 70;
  }
  if (sunscreenType === "waterResistant") return 150;
  return 120;
}

function riskFromScore(score: number, uvIndex: number | null): RiskLevel {
  if (uvIndex !== null && uvIndex >= 8) return "high";
  if (score >= 5.5) return "high";
  if (score >= 4) return "strong";
  if (score >= 2.2) return "recommended";
  return "low";
}

export function getSunscreenRecommendation(input: RecommendationInput): Recommendation {
  const now = input.now ?? new Date();
  const uv = input.uvIndex;
  const { context, settings } = input;
  const expected = context.expectedOutdoorMinutes;

  let score = 0;
  if (uv === null) score += 2.6;
  else if (uv >= 8) score += 5.5;
  else if (uv >= 6) score += 4.2;
  else if (uv >= 3) score += 2.8;
  else if (uv >= 2.5) score += 2.1;
  else score += 0.7;

  if (context.place === "outdoor") score += 1.2;
  if (context.place === "indoor" && context.nearWindow) score += 0.8;
  if (context.place === "indoor" && !context.nearWindow) score -= 1.8;

  if (expected >= 30) score += 0.7;
  if (expected >= 60) score += 0.5;
  if (expected >= 120) score += 0.4;
  if (context.place === "outdoor" && expected >= 15 && uv !== null && uv >= 2.5) score += 0.5;

  if (settings.sensitivity === "tans") score += 0.6;
  if (settings.sensitivity === "burns") score += 0.9;
  if (context.sweatingOrSwimming) score += 0.7;

  score = Math.max(0, score);
  const risk = riskFromScore(score, uv);
  const interval = getReapplyIntervalMinutes(settings.sunscreenType, context.sweatingOrSwimming);

  let reapplyAt: Date | undefined;
  let minutesUntilReapply: number | undefined;
  if (input.lastApplicationAt) {
    const appliedAt = new Date(input.lastApplicationAt);
    if (!Number.isNaN(appliedAt.getTime())) {
      reapplyAt = new Date(appliedAt.getTime() + interval * 60000);
      minutesUntilReapply = minutesBetween(now, reapplyAt);
    }
  }

  let reason: Recommendation["reason"] = "lowUv";
  if (uv === null) reason = "missingUv";
  else if (uv >= 6) reason = "highUv";
  else if (settings.sensitivity !== "normal" && uv >= 2.5) reason = "sensitive";
  else if (context.place === "indoor" && context.nearWindow && uv >= 3) reason = "nearWindow";
  else if (context.place === "indoor" && !context.nearWindow) reason = "indoorProtected";
  else if (uv >= 2.5 && expected >= 15) reason = "moderateUvOutdoor";

  if (reapplyAt && minutesUntilReapply !== undefined) {
    if (minutesUntilReapply <= 0 && risk !== "low") {
      return {
        conclusion: "reapplyNow",
        risk,
        reason,
        nextAction: "reapplyNow",
        score,
        reapplyAt,
        minutesUntilReapply,
        reapplyIntervalMinutes: interval
      };
    }
    if (minutesUntilReapply <= 30 && risk !== "low") {
      return {
        conclusion: "reapplySoon",
        risk,
        reason,
        nextAction: "reapplySoon",
        score,
        reapplyAt,
        minutesUntilReapply,
        reapplyIntervalMinutes: interval
      };
    }
    if (risk !== "low") {
      return {
        conclusion: "protected",
        risk,
        reason,
        nextAction: "stayAware",
        score,
        reapplyAt,
        minutesUntilReapply,
        reapplyIntervalMinutes: interval
      };
    }
  }

  if (risk === "low") {
    return {
      conclusion: "probablyNot",
      risk,
      reason,
      nextAction: "checkAgain",
      score,
      reapplyAt,
      minutesUntilReapply,
      reapplyIntervalMinutes: interval
    };
  }

  return {
    conclusion: "apply",
    risk,
    reason,
    nextAction: "applyNow",
    score,
    reapplyAt,
    minutesUntilReapply,
    reapplyIntervalMinutes: interval
  };
}
