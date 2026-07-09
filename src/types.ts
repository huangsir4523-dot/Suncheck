export type Language = "en" | "zh";
export type Theme = "light" | "dark";
export type Sensitivity = "normal" | "tans" | "burns";
export type SunscreenType = "regular" | "waterResistant" | "unsure";
export type ExposurePlace = "outdoor" | "indoor";
export type RiskLevel = "low" | "recommended" | "strong" | "high";

export interface UserSettings {
  language: Language;
  theme: Theme;
  sensitivity: Sensitivity;
  sunscreenType: SunscreenType;
}

export interface SavedLocation {
  id: string;
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  source: "gps" | "manual" | "favorite";
}

export interface SunscreenEvent {
  id: string;
  timestamp: string;
  type: "applied" | "reapplied";
}

export interface DailySunscreenLog {
  date: string;
  events: SunscreenEvent[];
}

export interface ExposureContext {
  place: ExposurePlace;
  nearWindow: boolean;
  expectedOutdoorMinutes: number;
  sweatingOrSwimming: boolean;
}

export interface WeatherSnapshot {
  uvIndex: number | null;
  weatherCode: number | null;
  temperatureC: number | null;
  fetchedAt: string;
  timezone?: string;
  hourlyUv: UvPoint[];
}

export interface UvPoint {
  time: string;
  uvIndex: number | null;
}

export interface RecommendationInput {
  uvIndex: number | null;
  context: ExposureContext;
  settings: UserSettings;
  lastApplicationAt?: string;
  now?: Date;
}

export interface Recommendation {
  conclusion: "apply" | "reapplySoon" | "reapplyNow" | "probablyNot" | "protected";
  risk: RiskLevel;
  reason: "lowUv" | "moderateUvOutdoor" | "highUv" | "indoorProtected" | "nearWindow" | "sensitive" | "missingUv";
  nextAction: "applyNow" | "reapplyNow" | "reapplySoon" | "checkAgain" | "stayAware";
  score: number;
  reapplyAt?: Date;
  minutesUntilReapply?: number;
  reapplyIntervalMinutes?: number;
}

export interface SearchResult {
  id: string;
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export type AppError =
  | "geolocationDenied"
  | "geolocationUnavailable"
  | "geolocationTimeout"
  | "geolocationUnsupported"
  | "cityNotFound"
  | "apiUnavailable"
  | "offline"
  | "missingUv";
