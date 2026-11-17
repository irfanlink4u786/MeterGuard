# MeterGuard mobile field acceptance tests

Build source: GitHub Actions workflow `MeterGuard mobile builds` on `feature/capacitor-mobile`.

## Android installation
1. Open the successful workflow run and download `MeterGuard-Android-debug-APK` from **Artifacts**.
2. Extract the archive and install the APK on a company-approved Android test device. Debug APKs are **testing only**, not production releases.
3. Confirm the app launches with network access and renders the MeterGuard dashboard.

## iOS simulator
1. Download the `MeterGuard-iOS-simulator-unsigned` artifact only after the simulator build passes.
2. Use Xcode Simulator to install the `.app`. This is **not** an iPhone/TestFlight installation package.
3. To install on physical iPhones, obtain Apple signing credentials and build a signed archive through Xcode / App Store Connect.

## Smoke-test matrix
| Test | Android | iOS | Expected result |
|---|---|---|---|
| Launch / resume / back | ☐ | ☐ | No blank screen or unintended exit |
| Supabase login / logout | ☐ | ☐ | Correct user session and access |
| Dashboard and billing tabs | ☐ | ☐ | Same site totals as web |
| Site search and selection | ☐ | ☐ | Correct site and region |
| Meter reading submission | ☐ | ☐ | Exactly one saved reading |
| Camera capture | ☐ | ☐ | Camera opens, photo can be reviewed |
| Photo library selection | ☐ | ☐ | Existing photo can be selected |
| Evidence upload | ☐ | ☐ | Correct Supabase site-wise folder |
| Intermittent connectivity | ☐ | ☐ | Clear error, no silent data loss |
| Duplicate submission | ☐ | ☐ | Duplicate rejected or safely handled |
| Notch/safe-area/keyboard | ☐ | ☐ | Controls remain accessible |

## Production release blockers
- Signed Android release APK and keystore handling.
- Apple Developer team, app identifier confirmation, certificates, provisioning, App Store Connect/TestFlight setup.
- Confirm Supabase session persistence and RLS with individually attributable accounts.
- Verify permissions and privacy statements on physical devices.
- Confirm mobile camera and file input behavior on both platforms.
- Establish offline data policy: **offline sync is not implemented**.

Record test device OS/version, test date, Site ID, and screenshots/logs for each failed case. Do not upload real credentials or sensitive customer data to public GitHub issues.
