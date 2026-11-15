# Publishing Astha Changa — step by step

Everything inside the app is ready. These are the steps on GitHub, App Store Connect and Google Play Console. Text to paste is in [STORE_LISTING.md](STORE_LISTING.md), and images are in `store/`.

| | |
|---|---|
| App ID (both stores) | `com.rk.asthachanga.game` |
| Apple team | Rakesh Prajapat · `3Y49D883CG` |
| Version | 1.0.0 (build 1 / versionCode 1) |

---

## 1. Put the website live (GitHub Pages), needed for the privacy policy URL

1. On github.com, create a **public** repository, e.g. `astha-changa`. Leave it empty: no README.
2. Push this project to it (I can do this once you give me the repo URL):
   ```bash
   git remote add origin https://github.com/<you>/astha-changa.git
   git push -u origin main
   ```
3. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The **Deploy web version** workflow runs tests, builds and publishes the site. After about 2 minutes it's live at:
   - Game: `https://<you>.github.io/astha-changa/`
   - Privacy policy: `https://<you>.github.io/astha-changa/privacy.html`
   - Help: `https://<you>.github.io/astha-changa/support.html`

---

## 2. Apple App Store

### a. Create the app record
1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **Apps → + → New App**.
2. Fill in:
   - Platform: **iOS**
   - Name: **Astha Changa – Indian Ludo**
   - Primary language: **English (U.S.)** or **English (India)**
   - Bundle ID: **com.rk.asthachanga.game**. If it's not in the list, register it first at developer.apple.com → Identifiers → +, or let step b register it.
   - SKU: `astha-changa-001`
   - User access: Full

### b. Build and upload
In Xcode, run:
```bash
npm run ios
```
Then:
1. Choose **Any iOS Device (arm64)** as the destination.
2. **Product → Archive**.
3. When the Organizer opens: **Distribute App → App Store Connect → Upload**. Keep "Automatically manage signing" on.

(Or ask me to run the archive and upload from the terminal. It uses your Xcode sign-in and may create an Apple Distribution certificate on your team.)

### c. Fill in the listing (App Store Connect → your app)
- **App Information:**
  - Subtitle and category (Games → Board, secondary Family)
  - Privacy Policy URL from step 1
  - Content Rights: does not use third-party content
- **Pricing and Availability:** Free, all countries (or just India first).
- **App Privacy:** Get Started → "No, we do not collect data".
- **iOS App → 1.0 Prepare for Submission:**
  - Screenshots: iPhone 6.9" → upload `store/ios-iphone-6.9/*.png`. iPad 13" → upload `store/ios-ipad-13/*.png`.
  - Promotional text, description and keywords from STORE_LISTING.md
  - Support URL: `…/support.html`
  - Build: select the uploaded build. It appears 5–30 minutes after upload.
  - Age Rating: answer None/No to everything, which gives **4+**
  - App Review Information: sign-in not required; paste the review notes from STORE_LISTING.md, plus your contact details
  - Version release: "Automatically release after approval" (or manual)
- Optionally add **Hindi** under App Information → Localizable Information, using the Hindi description.
- Click **Add for Review → Submit**. Review usually takes 1–3 days.

---

## 3. Google Play

### a. Create your upload key (once; keep it safe forever)
```bash
mkdir -p ~/keys && keytool -genkeypair -v -keystore ~/keys/astha-changa-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
(`keytool` comes with Android Studio: `"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"`.) Choose a strong password and **back up the .jks file and password**.

Then copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the path and passwords. That file is git-ignored.

### b. Build the signed bundle
```bash
npm run sync
```
```bash
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease
```
Upload file: `android/app/build/outputs/bundle/release/app-release.aab`

### c. Play Console
1. Go to [Play Console](https://play.google.com/console) → **Create app**:
   - Name: Astha Changa – Indian Ludo
   - Default language: English
   - **Game**, **Free**
   - Accept the declarations.
2. **Dashboard → Set up your app.** Complete each item using STORE_LISTING.md:
   - Privacy policy (URL from step 1)
   - App access: all functionality available
   - Ads: No
   - Content rating questionnaire, which should give Everyone / PEGI 3
   - Target audience: 13+ recommended
   - Data safety: no data collected or shared
   - Government app: No · Financial features: None · Health: No
3. **Grow → Store presence → Main store listing:**
   - Short and full description
   - App icon: `store/play-icon-512.png`
   - Feature graphic: `store/play-feature-graphic.png`
   - Phone screenshots: `store/android-phone/*.png`
   - 10" tablet screenshots: `store/android-tablet/*.png`
   - Add the Hindi translation under **Translations**.
4. **Release:**
   - **New personal developer accounts:** Google requires a **closed test with at least 12 testers for 14 days** before production. Go to Testing → Closed testing → create a track, add testers' emails, upload the .aab, and roll out. After 14 days, apply for production access.
   - **Organisation accounts or older personal accounts:** Production → Create new release → upload the .aab. Accept **Play App Signing** when asked.
   - Release name: `1.0.0`, with release notes like "First release".
   - Review and roll out. Review takes from a few hours to about 7 days.

---

## 4. Releasing an update later
1. Change the code, then run `npm test`.
2. Bump the version:
   - iOS: Xcode → App target → General → Version (e.g. 1.0.1) and Build (2, 3, …)
   - Android: `versionCode` (+1) and `versionName` in `android/app/build.gradle`
   - Web: bump `CACHE` in `public/sw.js`
3. Rebuild and upload: steps 2b and 3b. The website updates on every push to `main`.
