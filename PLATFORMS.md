# Astha Changa on every platform

One codebase (TypeScript, in `src/`) runs everywhere:

| Platform | How | Folder |
|---|---|---|
| **Web** (any browser) | Vite build, hosted anywhere | `dist/` |
| **Windows / Mac / Linux** | Install the web version as an app (PWA) from Chrome or Edge | — |
| **iPhone & iPad** | Capacitor iOS app | `ios/` |
| **Android phones & tablets** | Capacitor Android app | `android/` |

The game works fully offline on all of them. Fonts are bundled, and nothing is loaded from the internet.

App ID: `com.asthachanga.game` (in [capacitor.config.ts](capacitor.config.ts)). **Choose your final ID before the first store upload.** Once an app is published, its ID can't be changed.

---

## Everyday commands

```bash
npm run dev        # web version with live reload at http://localhost:5173
npm test           # all game logic tests
npm run build      # production web build into dist/
npm run sync       # build + copy into the iOS and Android projects
npm run ios        # build, sync, open Xcode
npm run android    # build, sync, open Android Studio
npm run icons      # regenerate all app icons/splash screens from assets/
```

After any change in `src/`, run `npm run sync` (or `npm run ios` / `npm run android`) so the apps get the new version.

---

## Web

- `npm run build`, then upload the contents of `dist/` to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, Firebase Hosting…). There's no server code.
- Once it's hosted, put its address in a `.env.local` file so share links point to it:
  ```
  VITE_PUBLIC_URL=https://your-domain.example
  ```
  Without it, the phone apps share a **code** instead of a link. Players paste the code into **Import rules**.
- Each time you release a web update, bump `CACHE` in [public/sw.js](public/sw.js) (`astha-changa-v2` → `v3`). Otherwise players' browsers keep old files around.

## Windows, Mac, Linux (desktop)

To install, open the hosted web version in **Chrome or Edge**, then click the install icon in the address bar (or **⋮ → Install Astha Changa**). It opens in its own window, has a Start-menu / Dock icon, and works offline.
Safari on a Mac: **File → Add to Dock**.

## iPhone & iPad

Needs a Mac with Xcode. Tested with Xcode 27.2, iOS 27.2 simulators, iPhone 18 Pro and iPad Air 11".

1. Run:
   ```bash
   npm run ios
   ```
2. In Xcode: select the **App** target → **Signing & Capabilities** → choose your Team (Apple Developer account).
3. Pick a simulator or your plugged-in iPhone, then press ▶.
4. For the App Store: **Product → Archive**, then **Distribute App**.

- Portrait and landscape both work. On iPad in landscape, the board sits beside the controls.

## Android

Needs Android Studio (which brings its own Java). Tested build: Gradle 9.5.1, Android plugin 8.13, SDK 36.

1. Run:
   ```bash
   npm run android
   ```
   This opens Android Studio. Let it finish syncing Gradle.
2. Pick an emulator or a phone with USB debugging on, then press ▶.
3. For Google Play: **Build → Generate Signed App Bundle** (.aab). Keep your upload key safe; you need the same key for every update.

From the terminal (no Android Studio window):
```bash
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```
The app file lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

Notes for this Mac:
- The Gradle wrapper was moved to **9.5.1**. Android Studio's bundled Java 25 doesn't run on the Gradle 8.14 that Capacitor ships with, and Gradle 9.6 drops an API the 8.x Android plugin needs.
- The Android emulator image here is an empty, unfinished download. To use an emulator, reinstall it in **Android Studio → Device Manager**.

## What's different inside the apps
- Hardware back button (Android): closes a dialog, then returns to the menu (the game is saved), then exits.
- Phones vibrate gently on a cut, a bonus throw and a piece reaching the centre.
- Share uses the phone's share sheet.
- The status bar matches the game's colours, and the splash screen hides as soon as the menu is drawn.
- No service worker inside the apps (they already have every file on the device).

## Icons and splash screens
- Source art lives in `assets-src/` (SVG). The rendered PNGs are in `assets/`:
  - `icon-only.png`: the iOS app icon, with no transparency.
  - `icon-foreground.png` + `icon-background.png`: the Android adaptive icon.
  - `splash.png`: the launch screen.
- After changing them, run `npm run icons`.

## Before publishing — checklist
- [ ] Final app ID and name in `capacitor.config.ts`
- [ ] Version numbers:
  - iOS: Xcode → General → Version/Build
  - Android: `versionCode` / `versionName` in `android/app/build.gradle`
- [ ] Privacy policy URL. Both stores ask for one. The game collects no data and saves only on the device.
- [ ] Store screenshots: phone, 7" and 10" tablet, iPad
- [ ] Host the web version and set `VITE_PUBLIC_URL`
