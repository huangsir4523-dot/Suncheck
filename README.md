# Suncheck

Suncheck is a mobile-first Web App / PWA that answers one daily question: do I need sunscreen now?

## Tech Stack

- React + TypeScript + Vite: small, stable, fast to develop, and easy to deploy as static files.
- Browser APIs only: Geolocation, localStorage, fetch, service worker, and Web App Manifest.
- Open-Meteo: free public weather, UV, and geocoding data with no custom backend or paid key.
- BigDataCloud free client-side reverse geocoding: used only after the user taps **Use current location**, so GPS coordinates can be displayed as a nearby city name when possible.

## Open-source Research Notes

The July 2026 feature update reviewed several related GitHub projects before extending Suncheck:

- [jondcallahan/sunburntimer](https://github.com/jondcallahan/sunburntimer) is the closest functional match. It combines React, TypeScript, Open-Meteo, skin sensitivity, sunscreen, activity context, and hourly UV charts. Its README says MIT, but the repository does not currently expose a verifiable license file, so Suncheck uses only the high-level product ideas and does not copy its code.
- [t1gr0u/uv-index-card](https://github.com/t1gr0u/uv-index-card) is an MIT-licensed Home Assistant card with clear UV risk bands and multilingual presentation.
- [filipnet/haos-uv-index](https://github.com/filipnet/haos-uv-index) is BSD-3-Clause licensed and pairs UV categories with concise protection actions based on WHO guidance.

The resulting Suncheck implementation is original to this repository. It adds a tested 24-hour UV summary, peak time, protection window, context-aware protection checklist, timezone-safe remote-city forecasts, and a five-band hourly UV chart. The category thresholds follow the [WHO UV Index guidance](https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-(uv)-index); Suncheck remains a daily guidance tool, not a medical or burn-time calculator.

Version 1 intentionally has no login, backend, payment, AI chat, native iOS app, Xcode, TestFlight, or Apple Developer dependency.

## Project Structure

```text
Suncheck/
  .github/
    workflows/
      deploy.yml
  .gitignore
  netlify.toml
  public/
    404.html
    icons/
      suncheck-icon.svg
    _headers
    _redirects
    manifest.webmanifest
    sw.js
  scripts/
    generate-icons.mjs
  src/
    domain/
      recommendation.ts
    services/
      openMeteoProvider.ts
      openMeteoProvider.test.ts
      storage.ts
      storage.test.ts
    security/
      sanitize.ts
      sanitize.test.tsx
      validation.ts
    App.tsx
    i18n.ts
    main.tsx
    styles.css
    types.ts
  index.html
  package.json
  README.md
  tsconfig.json
  tsconfig.node.json
  vercel.json
  vite.config.ts
```

## Commands

Install:

```bash
npm install
```

On Windows PowerShell with script execution disabled, use:

```bash
npm.cmd install
```

Run locally:

```bash
npm run dev
```

Windows PowerShell alternative:

```bash
npm.cmd run dev
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Run automated tests:

```bash
npm run test
```

Run the defensive injection/security test suite:

```bash
npm run security:test
```

## GitHub Pages Deployment

Suncheck is a static PWA. The production build outputs plain files to `dist/`, so no backend server is required.

This project is configured for a GitHub Pages project site at:

```text
https://YOUR-GITHUB-USERNAME.github.io/Suncheck/
```

Do not use `http://127.0.0.1:5173` on a phone. `127.0.0.1` always means "this device," so on an iPhone it points to the iPhone itself. To open Suncheck on iPhone or Android, deploy it and use the public HTTPS GitHub Pages URL above.

The important GitHub Pages settings are already in the project:

- `vite.config.ts` uses `base: "/Suncheck/"`.
- `public/manifest.webmanifest` uses `/Suncheck/` for `start_url`, `scope`, and icon paths.
- `src/main.tsx` registers the service worker under the Vite base path.
- `public/sw.js` caches the app shell under the service-worker scope.
- `public/404.html` redirects unknown GitHub Pages paths back to `/Suncheck/`.
- `.github/workflows/deploy.yml` builds and deploys `dist/` automatically.

Before deploying, verify locally if you can:

```bash
npm run build
```

Windows PowerShell alternative:

```bash
npm.cmd run build
```

The build also runs `scripts/generate-icons.mjs`, which creates the PNG PWA icons used by the manifest.

### Deploy with GitHub Desktop

1. Open GitHub Desktop.
2. Open or add the local repository at `C:\Users\hxz\Documents\Suncheck`.
3. Check that `node_modules/` and `dist/` are not listed as files to commit.
4. Commit all project source changes with a message such as `Configure GitHub Pages deployment`.
5. Click **Publish repository** if the repo is not on GitHub yet, or **Push origin** if it already exists.

### Enable GitHub Pages

1. Open the `Suncheck` repository on GitHub in your browser.
2. Go to **Settings**.
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Go to the **Actions** tab.
6. Wait for the workflow named **Deploy to GitHub Pages** to finish.
7. Open:

```text
https://YOUR-GITHUB-USERNAME.github.io/Suncheck/
```

Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username.

### What to Commit

Commit these folders and files:

```text
.github/
public/
scripts/
src/
.gitignore
index.html
netlify.toml
package.json
package-lock.json
README.md
tsconfig.json
tsconfig.node.json
vercel.json
vite.config.ts
```

Do not commit these generated or local folders:

```text
node_modules/
dist/
.vite/
.vercel/
.netlify/
```

The existing Vercel and Netlify files are kept for future use, but GitHub Pages is now the recommended deployment path for this project.

### PWA Checks After Deployment

Use the deployed HTTPS URL, not localhost:

- iPhone Safari: open the URL, tap Share, then **Add to Home Screen**.
- Android Chrome: open the URL and use the install prompt or browser menu > **Add to Home screen**.
- Confirm the installed icon uses the Suncheck icon.
- Confirm the app opens full-screen/standalone after installing.
- Confirm location permission works. Browser geolocation generally requires HTTPS, which GitHub Pages provides automatically.
- Confirm the app still opens after toggling airplane mode once it has been loaded at least once.

### Production Notes

- Required Node version: `^20.19.0 || >=22.12.0`, declared in `package.json`.
- No environment variables are required.
- No paid API keys are required.
- Weather, UV, and manual city search requests go directly from the browser to Open-Meteo.
- Current-location city lookup goes directly from the browser to BigDataCloud after geolocation succeeds.
- User settings, favorites, location choices, and sunscreen records stay in browser localStorage.

## Defensive Injection Test Experiment

This repository includes a small defensive test suite for Suncheck only. It is meant to verify that this app handles malicious-looking text safely. Do not use it to target third-party sites or services.

Run:

```bash
npm run security:test
```

The experiment checks:

- Manual city input is trimmed, control characters are removed, and input is capped at 80 characters.
- City search uses `URLSearchParams`, so user input is encoded before being sent to the geocoding API.
- API-returned city, region, and country names are normalized for plain-text display.
- HTML-like markers such as `<script>`, `<img>`, and `<svg>` are neutralized for display text.
- Event-handler-looking fragments such as `onerror=` and `onload=` are neutralized in display text.
- `javascript:` text is neutralized for display.
- Latitude and longitude values are rejected if missing, `NaN`, `Infinity`, or outside valid ranges.
- Malformed UV/weather values fall back to `null` instead of crashing the app.
- Corrupted localStorage settings, favorites, last location, and sunscreen history recover to safe defaults or filtered data.
- Source files are checked to ensure `dangerouslySetInnerHTML` is not used.

In development mode, Settings includes a small **Security Lab** panel. It runs the same harmless injection strings through Suncheck's city input and display sanitizers and shows raw input, sanitized output, and whether the text is considered safe for plain-text display. The lab is hidden from production builds.

These checks do not replace a professional security review. They cover basic client-side text injection, malformed location data, malformed weather data, and localStorage poisoning. They do not cover server-side vulnerabilities, dependency supply-chain risk, browser zero-days, CSP enforcement, or third-party API compromise.

## Recommendation Algorithm

The recommendation logic lives in `src/domain/recommendation.ts`.

Base UV rules:

- UV < 3: generally low risk.
- UV 3-5: sunscreen recommended, especially for outdoor exposure.
- UV 6-7: strong sunscreen recommendation.
- UV >= 8: high UV risk.

Conservative adjustments:

- Outdoor exposure increases the score.
- Indoor and away from windows reduces the score.
- Indoor near a window still considers UV and expected exposure time.
- Outdoor time of 15 minutes or more near UV 3 lowers the practical threshold.
- Easily tanned or easily sunburned settings increase the score.
- Sweating or swimming increases the score and shortens the reapplication interval.

Reapplication:

- Regular or unknown sunscreen: about 120 minutes in normal conditions.
- Water-resistant sunscreen: about 150 minutes in normal conditions.
- Heavy sweating or swimming: earlier reminder, about 70-90 minutes depending on type.

Weather is displayed and may appear in explanatory text, but it does not override UV Index.

## Privacy

No account is required. Suncheck has no custom server in version 1. Location choices, favorites, language, theme, sensitivity, sunscreen type, and sunscreen records are stored locally in the browser. If the user taps **Use current location**, the browser asks for permission and the resulting coordinates are sent directly to Open-Meteo for UV/weather and to BigDataCloud for nearby-city lookup.

## Testing Checklist

iPhone Safari:

- Open the deployed HTTPS URL.
- Allow location and confirm UV/weather loads.
- Deny location and confirm city search works.
- Add to Home Screen and launch from the icon.
- Switch language and theme, close, reopen, and confirm persistence.
- Record sunscreen application and confirm countdown plus today timeline.
- Test airplane mode or offline mode and confirm the app shell still opens.

Android Chrome:

- Open the deployed HTTPS URL.
- Confirm install prompt or use Add to Home screen.
- Test geolocation, manual city search, and favorite city switching.
- Confirm tappable controls are comfortable and text does not overflow.
- Toggle indoor/outdoor, near window, exposure time, and sweating/swimming.
- Build up multiple application records and verify reapplication text.

General:

- Test a high-UV city and a low-UV city.
- Test Chinese and English UI.
- Test light and dark theme.
- Test city-not-found and network-failure states.

## Future Improvements

- Login and cloud sync for settings, favorites, and sunscreen history.
- Browser push notifications for reapplication reminders.
- More precise sunscreen product settings such as SPF, PA rating, and water-resistance label duration.
- Alternative UV/weather provider adapters behind the existing provider boundary.
- AI personalized suggestions after enough user data exists, without adding AI to version 1.
