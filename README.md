# Suncheck

Suncheck is a mobile-first Web App / PWA that answers one daily question: do I need sunscreen now?

## Tech Stack

- React + TypeScript + Vite: small, stable, fast to develop, and easy to deploy as static files.
- Browser APIs only: Geolocation, localStorage, fetch, service worker, and Web App Manifest.
- Open-Meteo: free public weather, UV, and geocoding data with no custom backend or paid key.

Version 1 intentionally has no login, backend, payment, AI chat, native iOS app, Xcode, TestFlight, or Apple Developer dependency.

## Project Structure

```text
Suncheck/
  .gitignore
  netlify.toml
  public/
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
      storage.ts
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

## Deployment

Suncheck is a static PWA. The production build outputs plain files to `dist/`, so no backend server is required.

Do not use `http://127.0.0.1:5173` on a phone. `127.0.0.1` always means "this device," so on an iPhone it points to the iPhone itself. To open Suncheck on iPhone or Android, deploy it and use the public HTTPS URL from Vercel or Netlify.

Before deploying, verify locally:

```bash
npm run build
```

Windows PowerShell alternative:

```bash
npm.cmd run build
```

The build also runs `scripts/generate-icons.mjs`, which creates the PNG PWA icons used by the manifest.

### Deploy with Vercel

1. Create a GitHub repository for this project and push the files.
2. Go to Vercel and choose **Add New Project**.
3. Import the GitHub repository.
4. Use these settings:
   - Framework preset: `Vite`
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
5. Deploy.
6. Open the generated `https://...vercel.app` URL on iPhone Safari or Android Chrome.

The included `vercel.json` sets the same build/output values and adds production headers for the manifest, service worker, and icons.

### Deploy with Netlify

1. Create a GitHub repository for this project and push the files.
2. Go to Netlify and choose **Add new site** > **Import an existing project**.
3. Import the GitHub repository.
4. Use these settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Deploy.
6. Open the generated `https://...netlify.app` URL on iPhone Safari or Android Chrome.

The included `netlify.toml`, `public/_headers`, and `public/_redirects` files keep static hosting behavior predictable.

### PWA Checks After Deployment

Use the deployed HTTPS URL, not localhost:

- iPhone Safari: open the URL, tap Share, then **Add to Home Screen**.
- Android Chrome: open the URL and use the install prompt or browser menu > **Add to Home screen**.
- Confirm the installed icon uses the Suncheck icon.
- Confirm the app opens full-screen/standalone after installing.
- Confirm location permission works. Browser geolocation generally requires HTTPS, which Vercel and Netlify provide automatically.
- Confirm the app still opens after toggling airplane mode once it has been loaded at least once.

### Production Notes

- Required Node version: `^20.19.0 || >=22.12.0`, declared in `package.json`.
- No environment variables are required.
- No paid API keys are required.
- Weather, UV, and geocoding requests go directly from the browser to Open-Meteo.
- User settings, favorites, location choices, and sunscreen records stay in browser localStorage.

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

No account is required. Suncheck has no custom server in version 1. Location choices, favorites, language, theme, sensitivity, sunscreen type, and sunscreen records are stored locally in the browser.

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
