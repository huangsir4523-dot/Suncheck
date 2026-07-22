import { describe, expect, it } from "vitest";
import { getSunscreenRecommendation } from "./recommendation";
import type { RecommendationInput } from "../types";

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    uvIndex: 0,
    context: {
      place: "outdoor",
      nearWindow: false,
      expectedOutdoorMinutes: 30,
      sweatingOrSwimming: false
    },
    settings: {
      language: "en",
      theme: "light",
      sensitivity: "normal",
      sunscreenType: "unsure"
    },
    ...overrides
  };
}

describe("sunscreen recommendation", () => {
  it("does not recommend applying sunscreen when current UV is zero", () => {
    const recommendation = getSunscreenRecommendation(input());

    expect(recommendation.risk).toBe("low");
    expect(recommendation.conclusion).toBe("probablyNot");
  });

  it("keeps conservative exposure adjustments when UV data is missing", () => {
    const recommendation = getSunscreenRecommendation(input({ uvIndex: null }));

    expect(recommendation.risk).not.toBe("low");
    expect(recommendation.reason).toBe("missingUv");
  });
});
