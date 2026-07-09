import type { AppError, Language, Recommendation, RiskLevel, Sensitivity, SunscreenType } from "./types";

type Primitive = string | number;
type TranslationMap = Record<string, string>;

const en: TranslationMap = {
  appName: "Suncheck",
  home: "Home",
  location: "Location",
  settings: "Settings",
  history: "Today",
  language: "Language",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  english: "English",
  chinese: "中文",
  currentLocation: "Current location",
  useCurrentLocation: "Use current location",
  changeLocation: "Change location",
  searchCity: "Search city",
  cityPlaceholder: "City name",
  favorites: "Favorites",
  saveFavorite: "Save favorite",
  remove: "Remove",
  noFavorites: "No favorite cities yet.",
  locationDenied: "Location permission was denied. Search for a city instead.",
  loadingLocation: "Getting your location...",
  loadingWeather: "Checking UV data...",
  refresh: "Refresh",
  appliedButton: "I applied sunscreen",
  reappliedButton: "I reapplied sunscreen",
  outdoor: "Outdoor",
  indoor: "Indoor",
  nearWindow: "Near window",
  awayFromWindow: "Away from window",
  expectedTime: "Outdoor time",
  min15: "15 min",
  min30: "30 min",
  min60: "1 h",
  min120: "2 h+",
  sweat: "Sweating / swimming",
  noSweat: "No heavy sweat",
  uvIndex: "UV Index",
  weather: "Weather",
  uvTrend: "UV trend",
  now: "Now",
  next: "Next action",
  reason: "Reason",
  reapplyAt: "Reapply at {time}",
  reapplyIn: "Reapply in {minutes} min",
  alreadyDue: "Reapplication is due now",
  noHistory: "No sunscreen records yet today.",
  applied: "Applied",
  reapplied: "Reapplied",
  sensitivity: "Sun sensitivity",
  sunscreenType: "Sunscreen type",
  normal: "Normal",
  tans: "Easily tanned",
  burns: "Easily sunburned",
  regular: "Regular sunscreen",
  waterResistant: "Water-resistant",
  unsure: "Not sure",
  attribution: "Weather & UV data by Open-Meteo. Nearby city lookup by BigDataCloud when using current location.",
  privacyTitle: "Privacy",
  privacyBody: "No account is required. Location choices, settings, favorites, and sunscreen records stay in this browser only.",
  aboutTitle: "About Suncheck",
  aboutBody: "Suncheck gives daily sunscreen guidance from UV Index and your current context. It is not a medical diagnosis tool.",
  installHint: "Add Suncheck to your home screen from your browser menu.",
  conclusionApply: "Apply sunscreen now.",
  conclusionReapplySoon: "Reapply sunscreen soon.",
  conclusionReapplyNow: "Reapply sunscreen now.",
  conclusionProbablyNot: "You probably do not need sunscreen right now.",
  conclusionProtected: "You are covered for now.",
  riskLow: "Low risk",
  riskRecommended: "Sunscreen recommended",
  riskStrong: "Strongly recommended",
  riskHigh: "High UV risk",
  actionApplyNow: "Apply sunscreen now",
  actionReapplyNow: "Reapply now",
  actionReapplySoon: "Reapply soon",
  actionCheckAgain: "Check again before going outside",
  actionStayAware: "Stay aware of changing UV",
  reasonLowUv: "UV is low for your current exposure.",
  reasonModerateUvOutdoor: "UV is moderate and your outdoor exposure is long enough to matter.",
  reasonHighUv: "UV is strong; sunscreen and shade are a good idea.",
  reasonIndoorProtected: "You are indoors and away from windows, so exposure is reduced.",
  reasonNearWindow: "Window exposure can still add up, especially when UV is moderate or higher.",
  reasonSensitive: "Your sensitivity setting lowers the threshold for protection.",
  reasonMissingUv: "UV data is unavailable, so the recommendation is conservative.",
  cityNotFound: "City not found. Try a larger nearby city.",
  apiUnavailable: "UV data is unavailable right now. Please try again.",
  offline: "You appear to be offline. Showing the app shell and saved data.",
  missingUv: "UV data is missing for this location.",
  geolocationUnavailable: "Location is unavailable right now. Try again outside, enable device location, or search for a city.",
  geolocationTimeout: "Location lookup timed out. Try again, move near a window, or search for a city.",
  geolocationUnsupported: "This browser does not support location detection. Search for a city instead.",
  clearData: "Clear local records",
  dataCleared: "Local sunscreen records cleared.",
  feelsCloudy: "Cloudy, but UV is still the main signal.",
  clear: "Clear",
  mainlyClear: "Mainly clear",
  partlyCloudy: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  thunderstorm: "Thunderstorm",
  unknownWeather: "Weather unavailable"
};

const zh: TranslationMap = {
  appName: "Suncheck",
  home: "首页",
  location: "位置",
  settings: "设置",
  history: "今日记录",
  language: "语言",
  theme: "主题",
  light: "浅色",
  dark: "深色",
  english: "English",
  chinese: "中文",
  currentLocation: "当前位置",
  useCurrentLocation: "使用当前位置",
  changeLocation: "更改位置",
  searchCity: "搜索城市",
  cityPlaceholder: "城市名称",
  favorites: "常用城市",
  saveFavorite: "保存常用",
  remove: "移除",
  noFavorites: "还没有常用城市。",
  locationDenied: "定位权限被拒绝。可以改用城市搜索。",
  loadingLocation: "正在获取你的位置...",
  loadingWeather: "正在检查紫外线...",
  refresh: "刷新",
  appliedButton: "我已涂防晒",
  reappliedButton: "我已补涂防晒",
  outdoor: "室外",
  indoor: "室内",
  nearWindow: "靠窗",
  awayFromWindow: "不靠窗",
  expectedTime: "预计外出",
  min15: "15 分钟",
  min30: "30 分钟",
  min60: "1 小时",
  min120: "2 小时+",
  sweat: "大量出汗 / 游泳",
  noSweat: "无大量出汗",
  uvIndex: "UV 指数",
  weather: "天气",
  uvTrend: "今日 UV 趋势",
  now: "当前",
  next: "下一步",
  reason: "原因",
  reapplyAt: "{time} 补涂",
  reapplyIn: "{minutes} 分钟后补涂",
  alreadyDue: "现在需要补涂",
  noHistory: "今天还没有防晒记录。",
  applied: "已涂",
  reapplied: "已补涂",
  sensitivity: "日晒敏感度",
  sunscreenType: "防晒类型",
  normal: "普通",
  tans: "容易晒黑",
  burns: "容易晒伤",
  regular: "普通防晒",
  waterResistant: "防水型",
  unsure: "不确定",
  attribution: "天气与 UV 数据来自 Open-Meteo。使用当前位置时，附近城市查询来自 BigDataCloud。",
  privacyTitle: "隐私",
  privacyBody: "无需账号。位置选择、设置、常用城市和防晒记录只保存在当前浏览器本地。",
  aboutTitle: "关于 Suncheck",
  aboutBody: "Suncheck 根据 UV 指数和当前场景给出日常防晒建议，不用于医学诊断。",
  installHint: "可以通过浏览器菜单把 Suncheck 添加到手机主屏幕。",
  conclusionApply: "现在建议涂防晒。",
  conclusionReapplySoon: "很快需要补涂防晒。",
  conclusionReapplyNow: "现在需要补涂防晒。",
  conclusionProbablyNot: "现在大概率不需要防晒。",
  conclusionProtected: "目前防护还在有效时间内。",
  riskLow: "低风险",
  riskRecommended: "建议防晒",
  riskStrong: "强烈建议",
  riskHigh: "高 UV 风险",
  actionApplyNow: "现在涂防晒",
  actionReapplyNow: "现在补涂",
  actionReapplySoon: "准备补涂",
  actionCheckAgain: "外出前再检查",
  actionStayAware: "留意 UV 变化",
  reasonLowUv: "当前 UV 对你的暴露场景来说较低。",
  reasonModerateUvOutdoor: "UV 已达到中等，外出时间足以产生影响。",
  reasonHighUv: "UV 较强，建议防晒并尽量利用阴凉。",
  reasonIndoorProtected: "你在室内且不靠窗，暴露明显降低。",
  reasonNearWindow: "靠窗时日晒会累积，UV 中等及以上时仍需注意。",
  reasonSensitive: "你的敏感度设置会降低防护提醒阈值。",
  reasonMissingUv: "当前没有 UV 数据，因此采用保守建议。",
  cityNotFound: "没有找到城市。可以尝试附近较大的城市。",
  apiUnavailable: "暂时无法获取 UV 数据，请稍后重试。",
  offline: "当前可能离线。已显示应用外壳和本地数据。",
  missingUv: "此位置缺少 UV 数据。",
  geolocationUnavailable: "当前无法获取位置。可重试、开启设备定位，或改用城市搜索。",
  geolocationTimeout: "定位超时。可重试、靠近窗边，或改用城市搜索。",
  geolocationUnsupported: "当前浏览器不支持定位。请改用城市搜索。",
  clearData: "清除本地记录",
  dataCleared: "本地防晒记录已清除。",
  feelsCloudy: "即使多云，UV 仍是主要判断依据。",
  clear: "晴",
  mainlyClear: "大部晴朗",
  partlyCloudy: "局部多云",
  cloudy: "阴",
  fog: "雾",
  drizzle: "毛毛雨",
  rain: "雨",
  snow: "雪",
  thunderstorm: "雷暴",
  unknownWeather: "天气不可用"
};

const dictionaries: Record<Language, TranslationMap> = { en, zh };

export function detectLanguage(): Language {
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function t(language: Language, key: string, values: Record<string, Primitive> = {}): string {
  const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}

export function conclusionText(language: Language, recommendation: Recommendation): string {
  const key = {
    apply: "conclusionApply",
    reapplySoon: "conclusionReapplySoon",
    reapplyNow: "conclusionReapplyNow",
    probablyNot: "conclusionProbablyNot",
    protected: "conclusionProtected"
  }[recommendation.conclusion];
  return t(language, key);
}

export function riskText(language: Language, risk: RiskLevel): string {
  const key = {
    low: "riskLow",
    recommended: "riskRecommended",
    strong: "riskStrong",
    high: "riskHigh"
  }[risk];
  return t(language, key);
}

export function actionText(language: Language, action: Recommendation["nextAction"]): string {
  const key = {
    applyNow: "actionApplyNow",
    reapplyNow: "actionReapplyNow",
    reapplySoon: "actionReapplySoon",
    checkAgain: "actionCheckAgain",
    stayAware: "actionStayAware"
  }[action];
  return t(language, key);
}

export function reasonText(language: Language, reason: Recommendation["reason"]): string {
  const key = {
    lowUv: "reasonLowUv",
    moderateUvOutdoor: "reasonModerateUvOutdoor",
    highUv: "reasonHighUv",
    indoorProtected: "reasonIndoorProtected",
    nearWindow: "reasonNearWindow",
    sensitive: "reasonSensitive",
    missingUv: "reasonMissingUv"
  }[reason];
  return t(language, key);
}

export function sensitivityText(language: Language, value: Sensitivity): string {
  return t(language, value);
}

export function sunscreenTypeText(language: Language, value: SunscreenType): string {
  return t(language, value);
}

export function errorText(language: Language, error: AppError): string {
  return t(language, error);
}

export function weatherText(language: Language, code: number | null): string {
  if (code === null) return t(language, "unknownWeather");
  if (code === 0) return t(language, "clear");
  if (code === 1) return t(language, "mainlyClear");
  if (code === 2) return t(language, "partlyCloudy");
  if (code === 3) return t(language, "cloudy");
  if ([45, 48].includes(code)) return t(language, "fog");
  if ([51, 53, 55, 56, 57].includes(code)) return t(language, "drizzle");
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return t(language, "rain");
  if ([71, 73, 75, 77, 85, 86].includes(code)) return t(language, "snow");
  if ([95, 96, 99].includes(code)) return t(language, "thunderstorm");
  return t(language, "unknownWeather");
}
