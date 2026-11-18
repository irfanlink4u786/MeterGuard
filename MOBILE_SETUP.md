# MeterGuard Android & iOS (Capacitor)

This branch prepares native packaging **without changing the production Vercel application**. It is not yet an APK or an iOS build.

## Prerequisites
- Node.js LTS, Android Studio and Android SDK for Android.
- macOS with Xcode for iOS, and an Apple Developer account for TestFlight.
- Confirm the final reverse-DNS application ID before first signed release (currently `com.cmpak.meterguard`).

## Install Capacitor
Run from the repository root, on a development machine with npm registry access:

```bash
npm install @capacitor/core@^7 @capacitor/android@^7 @capacitor/ios@^7 @capacitor/camera@^7 @capacitor/app@^7 @capacitor/status-bar@^7 @capacitor/splash-screen@^7
npm install -D @capacitor/cli@^7
npm run build
npx cap add android
npx cap add ios # macOS only
npx cap sync
```

Commit the generated `package.json`, `package-lock.json`, `android/` and `ios/` changes together. Never manually edit the lockfile.

## Local development
```bash
npm run build
npx cap sync
npx cap open android
# On macOS: npx cap open ios
```

Use a **bundled** web build (the `dist/` folder), not a production web URL in Capacitor's `server.url`, so APK/TestFlight binaries include the app shell.

## Required mobile readiness work
1. Review responsive layouts, keyboard/safe areas, bottom navigation and wide verification tables on actual devices.
2. Test existing HTML camera capture on Android and iOS WebViews. If unreliable, implement `@capacitor/camera` with a browser fallback and preserve the current Supabase `meter-evidence` paths.
3. Test Supabase authentication and persistent sessions. Replace shared credentials with individually attributable CO/GTL accounts before wider release.
4. Validate camera/photo-library permissions and iOS Info.plist purpose strings, and configure Android permissions only as needed.
5. Confirm uploads, retries, duplicate prevention, and intermittent-connectivity behavior; do not claim offline support until local queue/sync is built and tested.
6. Configure app icon/splash assets, signing, privacy notices, versioning and release notes.
7. Test login, site search, meter reading, evidence, site investigation, billing views and logout on both platforms.

## Internal distribution
- **Android:** Generate a release-signed APK using Android Studio; test on field-team devices. Store signing keys securely outside Git.
- **iOS:** Archive with Xcode, upload to App Store Connect, and invite authorized testers through TestFlight. TestFlight builds expire; it is not a permanent internal production distribution solution.

## Security and deployment
- Continue to deploy the web app from `main` to Vercel.
- Do not place Supabase service-role keys, Apple signing certificates, Android keystores, or passwords in Git.
- Keep native app builds and mobile-specific changes in this branch until both platforms pass smoke tests.
