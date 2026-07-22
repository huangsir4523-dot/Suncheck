import { useEffect, useMemo, useState } from "react";
import {
  actionText,
  conclusionText,
  errorText,
  reasonText,
  riskText,
  sensitivityText,
  sunscreenTypeText,
  t,
  weatherText
} from "./i18n";
import { getSunscreenRecommendation } from "./domain/recommendation";
import { getUvBand, getUvForecastSummary } from "./domain/uvForecast";
import {
  fetchWeather,
  locationFromGeolocation,
  reverseGeocodeLocation,
  savedLocationFromSearch,
  searchCities
} from "./services/openMeteoProvider";
import { INJECTION_TEST_STRINGS, isSafeDisplayText, safeCityInput, safeDisplayText } from "./security/sanitize";
import { sanitizeLocation } from "./security/validation";
import {
  addSunscreenEvent,
  clearTodayLog,
  loadExposure,
  loadFavorites,
  loadLastLocation,
  loadSettings,
  loadTodayLog,
  saveExposure,
  saveFavorites,
  saveLastLocation,
  saveSettings
} from "./services/storage";
import type {
  AppError,
  DailySunscreenLog,
  ExposureContext,
  Language,
  SavedLocation,
  SearchResult,
  SunscreenType,
  UserSettings,
  WeatherSnapshot
} from "./types";

type Page = "home" | "location" | "settings";

function formatLocation(location: SavedLocation | null, language: Language): string {
  if (!location) return t(language, "changeLocation");
  if (location.source === "gps" && location.name === "GPS") return t(language, "currentLocation");
  return [location.name, location.admin1, location.country].map(safeDisplayText).filter(Boolean).join(", ");
}

function formatTime(date: Date, language: Language, timeZone?: string, includeWeekday = false): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    ...(includeWeekday ? { weekday: "short" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {})
  }).format(date);
}

function formatTemp(value: number | null): string {
  return value === null ? "--" : `${Math.round(value)}°C`;
}

function riskClass(risk: string): string {
  return `risk-${risk}`;
}

function App() {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [exposure, setExposure] = useState<ExposureContext>(() => loadExposure());
  const [favorites, setFavorites] = useState<SavedLocation[]>(() => loadFavorites());
  const [location, setLocation] = useState<SavedLocation | null>(() => loadLastLocation());
  const [log, setLog] = useState<DailySunscreenLog>(() => loadTodayLog());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [page, setPage] = useState<Page>(() => (location ? "home" : "location"));
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  const language = settings.language;
  const lastApplicationAt = log.events.at(-1)?.timestamp;
  const recommendation = useMemo(
    () =>
      getSunscreenRecommendation({
        uvIndex: weather?.uvIndex ?? null,
        context: exposure,
        settings,
        lastApplicationAt,
        now
      }),
    [weather?.uvIndex, exposure, settings, lastApplicationAt, now]
  );

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.language === "zh" ? "zh-CN" : "en";
    const themeColor = settings.theme === "dark" ? "#101010" : "#f7f7f4";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }, [settings]);

  useEffect(() => {
    saveExposure(exposure);
  }, [exposure]);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (location) {
      void refreshWeather(location);
    }
  }, []);

  async function refreshWeather(nextLocation = location) {
    if (!nextLocation) return;
    if (!navigator.onLine) {
      console.warn("[Suncheck] Weather refresh skipped: browser is offline");
      setError("offline");
      return;
    }
    setIsWeatherLoading(true);
    setError(null);
    try {
      console.info("[Suncheck] Fetching UV/weather", {
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        label: nextLocation.name
      });
      const nextWeather = await fetchWeather(nextLocation);
      setWeather(nextWeather);
      if (nextWeather.uvIndex === null) setError("missingUv");
      console.info("[Suncheck] UV/weather loaded", {
        uvIndex: nextWeather.uvIndex,
        weatherCode: nextWeather.weatherCode
      });
    } catch (weatherError) {
      console.error("[Suncheck] UV/weather request failed", weatherError);
      const isInvalidLocation = weatherError instanceof Error && weatherError.message.includes("Invalid location");
      setError(isInvalidLocation ? "invalidLocationData" : navigator.onLine ? "apiUnavailable" : "offline");
    } finally {
      setIsWeatherLoading(false);
    }
  }

  function geolocationErrorToAppError(geoError: GeolocationPositionError): AppError {
    if (geoError.code === geoError.PERMISSION_DENIED) return "geolocationDenied";
    if (geoError.code === geoError.POSITION_UNAVAILABLE) return "geolocationUnavailable";
    if (geoError.code === geoError.TIMEOUT) return "geolocationTimeout";
    return "geolocationUnavailable";
  }

  async function handleGeolocationSuccess(position: GeolocationPosition) {
    let gps: SavedLocation;
    try {
      gps = locationFromGeolocation(position);
    } catch (locationError) {
      console.error("[Suncheck] Browser returned invalid geolocation coordinates", locationError);
      setError("invalidLocationData");
      setPage("location");
      setIsLocating(false);
      return;
    }
    console.info("[Suncheck] Geolocation succeeded", {
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: position.coords.accuracy
    });

    setLocation(gps);
    saveLastLocation(gps);
    setPage("home");
    setError(null);
    setIsWeatherLoading(true);

    const [weatherResult, reverseResult] = await Promise.allSettled([
      fetchWeather(gps),
      reverseGeocodeLocation(gps, language)
    ]);

    if (reverseResult.status === "fulfilled" && reverseResult.value) {
      console.info("[Suncheck] Reverse geocoding succeeded", {
        label: reverseResult.value.name,
        admin1: reverseResult.value.admin1,
        country: reverseResult.value.country
      });
      setLocation(reverseResult.value);
      saveLastLocation(reverseResult.value);
    } else if (reverseResult.status === "rejected") {
      console.warn("[Suncheck] Reverse geocoding failed; keeping coordinate-based current location", reverseResult.reason);
    } else {
      console.info("[Suncheck] Reverse geocoding returned no nearby city; keeping coordinate-based current location");
    }

    if (weatherResult.status === "fulfilled") {
      setWeather(weatherResult.value);
      if (weatherResult.value.uvIndex === null) setError("missingUv");
      console.info("[Suncheck] UV/weather loaded after geolocation", {
        uvIndex: weatherResult.value.uvIndex,
        weatherCode: weatherResult.value.weatherCode
      });
    } else {
      console.error("[Suncheck] UV/weather request failed after geolocation", weatherResult.reason);
      const isInvalidLocation =
        weatherResult.reason instanceof Error && weatherResult.reason.message.includes("Invalid location");
      setError(isInvalidLocation ? "invalidLocationData" : navigator.onLine ? "apiUnavailable" : "offline");
    }

    setIsWeatherLoading(false);
    setIsLocating(false);
  }

  function useCurrentLocation() {
    console.info("[Suncheck] Use current location clicked");
    if (!("geolocation" in navigator)) {
      console.warn("[Suncheck] Geolocation is not supported by this browser");
      setError("geolocationUnsupported");
      setPage("location");
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void handleGeolocationSuccess(position);
      },
      (geoError) => {
        const appError = geolocationErrorToAppError(geoError);
        console.warn("[Suncheck] Geolocation failed", {
          code: geoError.code,
          message: geoError.message,
          mappedError: appError
        });
        setError(appError);
        setPage("location");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  function chooseLocation(next: SavedLocation) {
    try {
      const safeLocation = sanitizeLocation(next);
      if (!safeLocation) throw new Error("Invalid location data");
      setLocation(safeLocation);
      saveLastLocation(safeLocation);
      setPage("home");
      void refreshWeather(safeLocation);
    } catch (locationError) {
      console.error("[Suncheck] Rejected invalid selected location", locationError);
      setError("invalidLocationData");
    }
  }

  function addFavorite() {
    if (!location) return;
    if (favorites.some((favorite) => favorite.id === location.id)) return;
    const favoriteLocation: SavedLocation = { ...location, source: "favorite" };
    setFavorites([favoriteLocation, ...favorites].slice(0, 3));
  }

  function removeFavorite(id: string) {
    setFavorites(favorites.filter((favorite) => favorite.id !== id));
  }

  function recordSunscreen() {
    setLog(addSunscreenEvent(new Date()));
    setNow(new Date());
  }

  function updateSettings(patch: Partial<UserSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function updateExposure(patch: Partial<ExposureContext>) {
    setExposure((current) => ({ ...current, ...patch }));
  }

  const activeButtonLabel = log.events.length > 0 ? t(language, "reappliedButton") : t(language, "appliedButton");

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage("home")} aria-label={t(language, "home")}>
          <span className="brand-mark" aria-hidden="true" />
          <span>{t(language, "appName")}</span>
        </button>
        <div className="top-actions">
          <button className="chip" type="button" onClick={() => updateSettings({ language: language === "en" ? "zh" : "en" })}>
            {language === "en" ? "中文" : "EN"}
          </button>
          <button className="icon-button" type="button" onClick={() => setPage("settings")} aria-label={t(language, "settings")}>
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>

      <main>
        {error ? <div className="banner">{errorText(language, error)}</div> : null}
        {notice ? <div className="banner subtle">{notice}</div> : null}

        {page === "home" ? (
          <HomePage
            activeButtonLabel={activeButtonLabel}
            exposure={exposure}
            isLocating={isLocating}
            isWeatherLoading={isWeatherLoading}
            language={language}
            locationName={formatLocation(location, language)}
            log={log}
            recommendation={recommendation}
            settings={settings}
            weather={weather}
            onAddFavorite={addFavorite}
            onChangeLocation={() => setPage("location")}
            onRecord={recordSunscreen}
            onRefresh={() => void refreshWeather()}
            onUpdateExposure={updateExposure}
          />
        ) : null}

        {page === "location" ? (
          <LocationPage
            favorites={favorites}
            language={language}
            location={location}
            isLocating={isLocating}
            onChooseLocation={chooseLocation}
            onRemoveFavorite={removeFavorite}
            onUseCurrentLocation={useCurrentLocation}
          />
        ) : null}

        {page === "settings" ? (
          <SettingsPage
            language={language}
            log={log}
            settings={settings}
            onClearHistory={() => {
              setLog(clearTodayLog());
              setNotice(t(language, "dataCleared"));
              window.setTimeout(() => setNotice(null), 2200);
            }}
            onUpdateSettings={updateSettings}
            showSecurityLab={import.meta.env.DEV}
          />
        ) : null}
      </main>

      <nav className="tabbar" aria-label="Primary">
        <button className={page === "home" ? "active" : ""} type="button" onClick={() => setPage("home")}>
          {t(language, "home")}
        </button>
        <button className={page === "location" ? "active" : ""} type="button" onClick={() => setPage("location")}>
          {t(language, "location")}
        </button>
        <button className={page === "settings" ? "active" : ""} type="button" onClick={() => setPage("settings")}>
          {t(language, "settings")}
        </button>
      </nav>
    </div>
  );
}

interface HomePageProps {
  activeButtonLabel: string;
  exposure: ExposureContext;
  isLocating: boolean;
  isWeatherLoading: boolean;
  language: Language;
  locationName: string;
  log: DailySunscreenLog;
  recommendation: ReturnType<typeof getSunscreenRecommendation>;
  settings: UserSettings;
  weather: WeatherSnapshot | null;
  onAddFavorite: () => void;
  onChangeLocation: () => void;
  onRecord: () => void;
  onRefresh: () => void;
  onUpdateExposure: (patch: Partial<ExposureContext>) => void;
}

function HomePage({
  activeButtonLabel,
  exposure,
  isLocating,
  isWeatherLoading,
  language,
  locationName,
  log,
  recommendation,
  settings,
  weather,
  onAddFavorite,
  onChangeLocation,
  onRecord,
  onRefresh,
  onUpdateExposure
}: HomePageProps) {
  return (
    <div className="page home-page">
      <section className={`result-panel ${riskClass(recommendation.risk)}`}>
        <div className="result-meta">
          <button className="location-pill" type="button" onClick={onChangeLocation}>
            {isLocating ? t(language, "loadingLocation") : locationName}
          </button>
          <span>{isWeatherLoading ? t(language, "loadingWeather") : weatherText(language, weather?.weatherCode ?? null)}</span>
        </div>
        <h1>{conclusionText(language, recommendation)}</h1>
        <div className="risk-line">
          <span className="risk-dot" aria-hidden="true" />
          <span>{riskText(language, recommendation.risk)}</span>
        </div>
        <div className="metric-grid">
          <div>
            <span>{t(language, "uvIndex")}</span>
            <strong>{weather?.uvIndex === null || weather?.uvIndex === undefined ? "--" : weather.uvIndex.toFixed(1)}</strong>
          </div>
          <div>
            <span>{t(language, "weather")}</span>
            <strong>{formatTemp(weather?.temperatureC ?? null)}</strong>
          </div>
        </div>
        <p>{reasonText(language, recommendation.reason)}</p>
        <div className="next-action">
          <span>{t(language, "next")}</span>
          <strong>{actionText(language, recommendation.nextAction)}</strong>
        </div>
        {recommendation.reapplyAt ? (
          <div className="countdown">
            {recommendation.minutesUntilReapply !== undefined && recommendation.minutesUntilReapply > 0
              ? t(language, "reapplyIn", { minutes: recommendation.minutesUntilReapply })
              : t(language, "alreadyDue")}
            <span>{t(language, "reapplyAt", { time: formatTime(recommendation.reapplyAt, language) })}</span>
          </div>
        ) : null}
      </section>

      <div className="action-row">
        <button className="primary-action" type="button" onClick={onRecord}>
          {activeButtonLabel}
        </button>
        <button className="secondary-action" type="button" onClick={onRefresh}>
          {t(language, "refresh")}
        </button>
      </div>

      <section className="control-panel">
        <Segmented
          label=""
          value={exposure.place}
          options={[
            { value: "outdoor", label: t(language, "outdoor") },
            { value: "indoor", label: t(language, "indoor") }
          ]}
          onChange={(value) => onUpdateExposure({ place: value as ExposureContext["place"] })}
        />
        {exposure.place === "indoor" ? (
          <Segmented
            label=""
            value={exposure.nearWindow ? "yes" : "no"}
            options={[
              { value: "yes", label: t(language, "nearWindow") },
              { value: "no", label: t(language, "awayFromWindow") }
            ]}
            onChange={(value) => onUpdateExposure({ nearWindow: value === "yes" })}
          />
        ) : null}
        <Segmented
          label={t(language, "expectedTime")}
          value={String(exposure.expectedOutdoorMinutes)}
          options={[
            { value: "15", label: t(language, "min15") },
            { value: "30", label: t(language, "min30") },
            { value: "60", label: t(language, "min60") },
            { value: "120", label: t(language, "min120") }
          ]}
          onChange={(value) => onUpdateExposure({ expectedOutdoorMinutes: Number(value) })}
        />
        <button
          className={`toggle-line ${exposure.sweatingOrSwimming ? "selected" : ""}`}
          type="button"
          onClick={() => onUpdateExposure({ sweatingOrSwimming: !exposure.sweatingOrSwimming })}
        >
          {exposure.sweatingOrSwimming ? t(language, "sweat") : t(language, "noSweat")}
        </button>
      </section>

      <DailyUvPlan exposure={exposure} language={language} settings={settings} weather={weather} />

      <UvTrend language={language} weather={weather} />

      <section className="history-panel">
        <div className="section-heading">
          <h2>{t(language, "history")}</h2>
          <button type="button" onClick={onAddFavorite}>
            {t(language, "saveFavorite")}
          </button>
        </div>
        <Timeline language={language} log={log} />
      </section>

      <footer className="tiny-footer">{t(language, "attribution")}</footer>
    </div>
  );
}

interface SegmentedProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function Segmented({ label, value, options, onChange }: SegmentedProps) {
  return (
    <label className="segmented-wrap">
      {label ? <span>{label}</span> : null}
      <div className="segmented">
        {options.map((option) => (
          <button
            className={option.value === value ? "selected" : ""}
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </label>
  );
}

function protectionTips(
  weather: WeatherSnapshot | null,
  exposure: ExposureContext,
  settings: UserSettings
): string[] {
  const summary = getUvForecastSummary(weather?.hourlyUv ?? []);
  const values = [weather?.uvIndex, summary.peakUv].filter((value): value is number => typeof value === "number");
  if (values.length === 0) return ["protectionCheckLater"];

  const highestUv = Math.max(...values);
  if (highestUv < 3) return ["protectionLow"];

  const tips = ["protectionSunscreen", "protectionShade", "protectionEyes"];
  if (highestUv >= 6) tips.push("protectionClothing");
  if (highestUv >= 8) tips.push("protectionAvoidPeak");
  if (exposure.sweatingOrSwimming) tips.push("protectionWater");
  if (settings.sensitivity === "burns") tips.push("protectionSensitive");
  return tips;
}

function DailyUvPlan({
  exposure,
  language,
  settings,
  weather
}: {
  exposure: ExposureContext;
  language: Language;
  settings: UserSettings;
  weather: WeatherSnapshot | null;
}) {
  const summary = useMemo(() => getUvForecastSummary(weather?.hourlyUv ?? []), [weather]);
  const tips = protectionTips(weather, exposure, settings);
  const timezone = weather?.timezone;
  const window =
    summary.protectionStartAt && summary.protectionEndAt
      ? `${formatTime(summary.protectionStartAt, language, timezone, true)} - ${formatTime(summary.protectionEndAt, language, timezone, true)}`
      : summary.peakUv === null
        ? "--"
        : t(language, "allDayLow");

  return (
    <section className="daily-plan-panel">
      <h2>{t(language, "dailyUvPlan")}</h2>
      <div className="plan-metrics">
        <div>
          <span>{t(language, "peakUv")}</span>
          <strong>{summary.peakUv === null ? "--" : summary.peakUv.toFixed(1)}</strong>
        </div>
        <div>
          <span>{t(language, "peakTime")}</span>
          <strong>{summary.peakAt ? formatTime(summary.peakAt, language, timezone, true) : "--"}</strong>
        </div>
        <div>
          <span>{t(language, "protectionWindow")}</span>
          <strong>{window}</strong>
        </div>
      </div>
      <div className="protection-plan">
        <h2>{t(language, "protectionPlan")}</h2>
        <ul>
          {tips.map((tip) => (
            <li key={tip}>{t(language, tip)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UvTrend({ language, weather }: { language: Language; weather: WeatherSnapshot | null }) {
  const points = (() => {
    const start = Date.now() - 60 * 60 * 1000;
    const end = Date.now() + 12 * 60 * 60 * 1000;
    return (weather?.hourlyUv ?? [])
      .filter((point) => {
        const time = new Date(point.time).getTime();
        return time >= start && time <= end;
      })
      .slice(0, 13);
  })();

  const maxUv = Math.max(8, ...points.map((point) => point.uvIndex ?? 0));

  return (
    <section className="trend-panel">
      <h2>{t(language, "uvTrend")}</h2>
      {points.length === 0 ? (
        <p className="empty">{t(language, "missingUv")}</p>
      ) : (
        <div className="uv-bars" role="img" aria-label={t(language, "uvTrend")}>
          {points.map((point) => {
            const uv = point.uvIndex ?? 0;
            const hour = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
              hour: "2-digit",
              timeZone: weather?.timezone
            }).format(new Date(point.time));
            return (
              <div className="uv-bar" key={point.time}>
                <small className="uv-value">{uv.toFixed(1)}</small>
                <div className="uv-bar-track">
                  <span className={`uv-fill uv-${getUvBand(uv)}`} style={{ height: `${Math.max(8, (uv / maxUv) * 100)}%` }} />
                </div>
                <small className="uv-hour">{hour}</small>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Timeline({ language, log }: { language: Language; log: DailySunscreenLog }) {
  if (log.events.length === 0) return <p className="empty">{t(language, "noHistory")}</p>;
  return (
    <ol className="timeline">
      {log.events.map((event) => (
        <li key={event.id}>
          <time>{formatTime(new Date(event.timestamp), language)}</time>
          <span>{t(language, event.type)}</span>
        </li>
      ))}
    </ol>
  );
}

interface LocationPageProps {
  favorites: SavedLocation[];
  language: Language;
  location: SavedLocation | null;
  isLocating: boolean;
  onChooseLocation: (location: SavedLocation) => void;
  onRemoveFavorite: (id: string) => void;
  onUseCurrentLocation: () => void;
}

function LocationPage({
  favorites,
  language,
  location,
  isLocating,
  onChooseLocation,
  onRemoveFavorite,
  onUseCurrentLocation
}: LocationPageProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<AppError | null>(null);

  async function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const safeQuery = safeCityInput(query);
    setQuery(safeQuery);
    if (!safeQuery) {
      setResults([]);
      setSearchError("cityNotFound");
      return;
    }
    setSearchError(null);
    setIsSearching(true);
    try {
      const nextResults = await searchCities(safeQuery, language);
      setResults(nextResults);
      if (nextResults.length === 0) setSearchError("cityNotFound");
    } catch (searchError) {
      console.error("[Suncheck] City search failed", searchError);
      const isInvalidLocation = searchError instanceof Error && searchError.message.includes("Invalid location");
      setSearchError(isInvalidLocation ? "invalidLocationData" : navigator.onLine ? "apiUnavailable" : "offline");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="page">
      <section className="plain-section">
        <h1>{t(language, "location")}</h1>
        <button className="wide-button" type="button" onClick={onUseCurrentLocation} disabled={isLocating} aria-busy={isLocating}>
          {isLocating ? t(language, "loadingLocation") : t(language, "useCurrentLocation")}
        </button>
        {isLocating ? <p className="muted">{t(language, "loadingLocation")}</p> : null}
        <p className="muted">{formatLocation(location, language)}</p>
      </section>

      <section className="plain-section">
        <h2>{t(language, "searchCity")}</h2>
        <form className="search-form" onSubmit={submitSearch}>
          <input
            aria-label={t(language, "cityPlaceholder")}
            placeholder={t(language, "cityPlaceholder")}
            maxLength={80}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit">{isSearching ? "..." : t(language, "searchCity")}</button>
        </form>
        {searchError ? <p className="error-text">{errorText(language, searchError)}</p> : null}
        <div className="list">
          {results.map((result) => (
            <button key={result.id} type="button" onClick={() => onChooseLocation(savedLocationFromSearch(result))}>
              <strong>{safeDisplayText(result.name)}</strong>
              <span>{[result.admin1, result.country].map(safeDisplayText).filter(Boolean).join(", ")}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="plain-section">
        <h2>{t(language, "favorites")}</h2>
        {favorites.length === 0 ? <p className="empty">{t(language, "noFavorites")}</p> : null}
        <div className="list">
          {favorites.map((favorite) => (
            <div className="list-row" key={favorite.id}>
              <button type="button" onClick={() => onChooseLocation(favorite)}>
                <strong>{formatLocation(favorite, language)}</strong>
              </button>
              <button className="small-danger" type="button" onClick={() => onRemoveFavorite(favorite.id)}>
                {t(language, "remove")}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface SettingsPageProps {
  language: Language;
  log: DailySunscreenLog;
  settings: UserSettings;
  onClearHistory: () => void;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  showSecurityLab: boolean;
}

function SettingsPage({ language, log, settings, onClearHistory, onUpdateSettings, showSecurityLab }: SettingsPageProps) {
  return (
    <div className="page">
      <section className="plain-section">
        <h1>{t(language, "settings")}</h1>
        <SettingGroup title={t(language, "language")}>
          <Segmented
            label=""
            value={settings.language}
            options={[
              { value: "en", label: t(language, "english") },
              { value: "zh", label: t(language, "chinese") }
            ]}
            onChange={(value) => onUpdateSettings({ language: value as Language })}
          />
        </SettingGroup>
        <SettingGroup title={t(language, "theme")}>
          <Segmented
            label=""
            value={settings.theme}
            options={[
              { value: "light", label: t(language, "light") },
              { value: "dark", label: t(language, "dark") }
            ]}
            onChange={(value) => onUpdateSettings({ theme: value as UserSettings["theme"] })}
          />
        </SettingGroup>
        <SettingGroup title={t(language, "sensitivity")}>
          <div className="option-stack">
            {(["normal", "tans", "burns"] as const).map((value) => (
              <button
                className={settings.sensitivity === value ? "selected option-button" : "option-button"}
                key={value}
                type="button"
                onClick={() => onUpdateSettings({ sensitivity: value })}
              >
                {sensitivityText(language, value)}
              </button>
            ))}
          </div>
        </SettingGroup>
        <SettingGroup title={t(language, "sunscreenType")}>
          <div className="option-stack">
            {(["regular", "waterResistant", "unsure"] as SunscreenType[]).map((value) => (
              <button
                className={settings.sunscreenType === value ? "selected option-button" : "option-button"}
                key={value}
                type="button"
                onClick={() => onUpdateSettings({ sunscreenType: value })}
              >
                {sunscreenTypeText(language, value)}
              </button>
            ))}
          </div>
        </SettingGroup>
      </section>

      <section className="plain-section">
        <h2>{t(language, "history")}</h2>
        <Timeline language={language} log={log} />
        <button className="danger-button" type="button" onClick={onClearHistory}>
          {t(language, "clearData")}
        </button>
      </section>

      <section className="plain-section about">
        <h2>{t(language, "privacyTitle")}</h2>
        <p>{t(language, "privacyBody")}</p>
        <h2>{t(language, "aboutTitle")}</h2>
        <p>{t(language, "aboutBody")}</p>
        <p>{t(language, "installHint")}</p>
        <p className="muted">{t(language, "attribution")}</p>
      </section>

      {showSecurityLab ? <SecurityLab /> : null}
    </div>
  );
}

function SecurityLab() {
  const [customInput, setCustomInput] = useState("");
  const samples = customInput ? [customInput, ...INJECTION_TEST_STRINGS] : [...INJECTION_TEST_STRINGS];

  return (
    <section className="plain-section security-lab">
      <h2>Security Lab</h2>
      <p className="muted">
        Development-only text checks. Inputs are rendered as plain React text and are never executed.
      </p>
      <input
        aria-label="Security Lab custom input"
        placeholder="Try a city-like injection string"
        value={customInput}
        onChange={(event) => setCustomInput(event.target.value)}
      />
      <div className="security-list">
        {samples.map((rawInput, index) => {
          const cityInput = safeCityInput(rawInput);
          const displayText = safeDisplayText(rawInput);
          return (
            <div className="security-item" key={`${rawInput}-${index}`}>
              <span>Raw</span>
              <code>{rawInput}</code>
              <span>City input</span>
              <code>{cityInput}</code>
              <span>Display</span>
              <code>{displayText}</code>
              <strong>{isSafeDisplayText(displayText) ? "Safe for plain-text display" : "Rejected / empty"}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="setting-group">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export default App;
