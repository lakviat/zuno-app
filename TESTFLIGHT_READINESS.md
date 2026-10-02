# Zuno — TestFlight readiness

Updated October 1, 2026, for the requested **real multiuser backend** beta. Earlier local-preview findings are preserved in [the historical audit](docs/TESTFLIGHT_AUDIT_2026-10-01.md).

## Current Status

**READY FOR SIGNING** for engineering preparation. The unsigned Release archive passes and the hosted social/onboarding schema is deployed and verified. This is not certification of a fully accepted hosted beta: Apple/Google provider configuration, hosted email delivery, legal URLs and physical iPhone acceptance remain before distribution.

For the current authorized distribution attempt, the owner refreshed Xcode sign-in. Xcode exposes only Personal Team, Developer enrollment is Pending, and App Store Connect says the account is not enabled. No signing certificates, upload, publication, external Git push or paid service was performed. See [current distribution status](docs/TESTFLIGHT_DISTRIBUTION.md). See [authentication architecture](AUTH_ONBOARDING_ARCHITECTURE.md) and [hosted validation](docs/HOSTED_BACKEND_VALIDATION.md).

## Project

| Item                                         | Value                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Application target / shared scheme / product | Zuno / Zuno / Zuno.app                                                                           |
| Display name                                 | Zuno                                                                                             |
| Workspace                                    | Generated CocoaPods `Zuno.xcworkspace`; not the stale ignored repository `ios/` copy             |
| Prepared workspace                           | `/Users/nurlanmirovich/Library/Developer/Zuno/TestFlight-60d5288d0b/source/ios/Zuno.xcworkspace` |
| Configurations                               | Debug and Release; Archive uses Release                                                          |
| Deployment target / devices                  | iOS 16.4; iPhone and iPad; arm64 device                                                          |
| Bundle ID                                    | `app.zuno.mobile`, preserved; ownership/availability still requires the user's Team              |
| Marketing version                            | 0.1.0 from package.json                                                                          |
| Build number                                 | 2 from app.config.ts `ios.buildNumber`                                                           |
| Native/runtime                               | Xcode 27 / iOS 27 SDK; Swift 5 language mode; Expo 57.0.26 / RN 0.86.3 / Hermes                  |
| Dependency managers / CI                     | npm and CocoaPods; no application SPM, Fastlane or CI workflow; EAS profiles unused              |
| Signing                                      | Automatic signing prepared; no Team or certificate/profile hard-coded                            |

Before each new TestFlight upload increment `ios.buildNumber` in `app.config.ts`, then prepare and archive again. For a new marketing version use `npm version <version> --no-git-tag-version`. If the bundle ID must change, update `ios.bundleIdentifier`, regenerate, and use the identical ID in Developer/App Store Connect. Recheck app container/Keychain and deep-link behavior; `zuno://auth/callback` remains the configured scheme callback.

## Build Results

| Check                                     | Result                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Debug simulator                           | Prior baseline PASS; not repeated for this backend milestone                   |
| Release generic iPhone / unsigned archive | PASS; verified final arm64 device archive                                      |
| Release simulator                         | PASS; final build installed/launched on iPhone 17 / iOS 27                     |
| Signed archive / Apple validation         | BLOCKED by absent Developer Team, signing and App Store Connect; not attempted |

Final verified artifact:

`/Users/nurlanmirovich/Library/Developer/Zuno/TestFlight-60d5288d0b/Zuno-unsigned-build2-xcode-environment.xcarchive`

Final simulator product:

`/var/folders/j3/p_5qjxb96nd193wxm0fwb2th0000gn/T/zuno-ios-60d5288d0b/DerivedData/Build/Products/Release-iphonesimulator/Zuno.app`

Final Release simulator installed and launched on iPhone 17 / iOS 27: native welcome renders with the existing logo and Apple/Google/Email actions; email form and keyboard remain usable, invalid email leaves Send disabled, and Back returns to welcome. No map flashes while signed out. That earlier visual smoke did not send email or grant location. The current distribution attempt sent one real owner email request, with delivery/callback still pending. Screenshot evidence: docs/screenshots/ios-auth-welcome.png and ios-auth-email-keyboard.png. Generated entitlements contain Sign in with Apple only; no APNs or background mode.

Commands (Node 22.13+, Xcode, CocoaPods): `npm run ios:prepare`, `npm run ios:archive:unsigned`, `npm run ios:preview`. Signed device/archive commands and exact account blockers are in [distribution status](docs/TESTFLIGHT_DISTRIBUTION.md). Staging outside Desktop avoids File Provider framework signing metadata. Native scripts exclude environment/signing files, pass only validated public backend configuration and install locked pods. Unsigned signing overrides are command-line-only. Do not reuse an unsigned archive for upload: create a normal signed archive after Team selection.

Release verification checks arm64, minimum OS, identity/version, strict ATS, scene/URL callback, bundled JS/public configuration, usage descriptions, icons/launch resources, absent developer UI and privacy manifests. Release uses Swift -O, dSYMs, ENABLE_TESTABILITY=NO, ONLY_ACTIVE_ARCH=NO and SKIP_INSTALL=NO. No device compiler/linker errors or broken embedded framework slices were found.

Upstream RN Maps/SVG deprecations, SDK script output warnings and skipped App Intents extraction remain. Prebuilt React/ReactNativeDependencies/Hermes lack some vendor dSYMs; app symbols exist. Apple may warn on upload and vendor-frame symbolication may be limited. No fake dSYMs or warning suppression was added.

## Tests

- **136 tests across 20 files PASS:** existing domain/zoom/location behavior, Auth config/callback/Keychain, account SQL/RLS, social PostgreSQL/PostGIS policies/commands and cloud transport lifecycle/account isolation.
- **11 real local Supabase integration checks PASS:** three authenticated accounts; actual Realtime inbox denial/delivery; private/friends/public; 25 mph from m/s; block while connected; coarse projection; stop/reconnect; persistent/idempotent private chat; concurrent final meetup seat and leave revocation; private Storage ownership; anonymous/raw-GPS denial. Final invalidation-only transport was retested. Zero disposable accounts remain. Cron is active.
- **11 browser journeys PASS across the full run and isolated rerun:** 10 passed together; drag-reversal timed out during concurrent native builds, then passed unchanged in 34.2 seconds after builds finished. No assertions or timeouts were weakened. These use Development-only local preview, not hosted authentication.
- **67 hosted SQL/RLS assertions PASS:** 49 social + 18 onboarding, synthetic identities fully rolled back. Final schema comparison: 282 audited objects with zero differences. Real hosted email/OAuth/WebSocket/device acceptance remains separate.

- TypeScript, ESLint and Expo dependency compatibility PASS. Prettier and `git diff --check` PASS. Final source and generated archive include the modern photo-picker fix.
- Not executed: hosted authenticated multiuser round trip, real magic-link delivery/cold callback, physical iPhone GPS/heading/speed/power, real selected-photo upload on device, Apple server validation. These remain acceptance checks and must not be represented as automated passes.

## Changes Made

1. Extended the existing Auth/profile foundation with six reproducible migrations for the social graph, privacy, PostGIS latest location, bounded private realtime inboxes, atomic social commands, chat/meetup reads, private avatars and expiry cleanup.
2. Connected existing map/people/profile/privacy/chat/meetup screens to authenticated commands and authoritative snapshots; configured builds use real UUIDs and no sample-world fallback. Kept native map/edge zoom/globe behavior.
3. Added consent-gated foreground location publishing, separate durable/ephemeral cadence, permission/lifecycle/session guards, authorized motion projection and stale expiry. Broker notices contain no GPS or chat body.
4. Added private avatar selection/upload, owner cleanup on account deletion, and relevant iOS privacy declarations. Modern iOS photo selection uses PHPicker without broad library/camera/microphone access.
5. Added older-chat pagination, truthful async save errors, duplicate-send guards, cloud discovery and inaccessible-profile handling. Initial connection retries recover after transient startup failure.
6. Added event-only development diagnostics without coordinates, tokens, user identifiers or raw server error logging; production diagnostics remain off. Added disposable local-stack tests and isolated browser-test environment.
7. Updated deployment, architecture and readiness documentation and preserved older audit/preview evidence. `.idea/` and unrelated user work remain untouched.

## Dependencies

Supabase JS 2.117.2, Expo SecureStore 57.0.4, Expo Crypto 57.0.3 and URL polyfill 4 provide the account foundation. Added Expo ImagePicker 57.0.20 (native ImageLoader 57.0.1) for implemented avatar selection. PGlite 0.5.8 and PGlite PostGIS 0.2.8 are development-only database tests. No broad dependency upgrade was performed. npm lock and reviewed CocoaPods lock resolve; Expo compatibility passes. Existing native dependency floors are compatible with iOS 16.4. Web-only/test/compiler packages do not belong in the native app module graph.

| Direct runtime dependency                   | Installed | Use / deployment compatibility                                                               |
| ------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `@expo-google-fonts/dm-sans`                | 0.4.2     | Bundled font files; no remote Google Fonts request/native deployment floor                   |
| `@expo-google-fonts/outfit`                 | 0.4.3     | Bundled font files                                                                           |
| `@expo/vector-icons`                        | 15.1.1    | Existing icon/font rendering                                                                 |
| `@react-native-async-storage/async-storage` | 2.2.0     | Local snapshots; native minimum iOS 13.4 with this architecture; SDK privacy bundle included |
| `@react-native-community/datetimepicker`    | 9.1.0     | Meetup date/time controls; minimum iOS 11                                                    |
| `expo`                                      | 57.0.26   | App lifecycle/native modules; minimum iOS 16.4                                               |
| `expo-font`                                 | 57.0.4    | Bundled font loading; minimum iOS 16.4                                                       |
| `expo-location`                             | 57.0.20   | Foreground permission and location watch; minimum iOS 16.4                                   |
| `expo-status-bar`                           | 57.0.1    | Status-bar appearance                                                                        |
| `expo-apple-authentication`                 | 57.0.2    | Native Apple sign-in; iOS deployment supported                                               |
| `expo-web-browser`                          | 57.0.3    | Google authentication session; native redirect                                               |
| `expo-image-manipulator`                    | 57.0.20   | Avatar resize/compression; selected image only                                               |
| `expo-notifications`                        | 57.0.21   | Optional permission/status implementation; push gated, no APNs capability                    |
| `maplibre-gl`                               | 6.11.2    | Web map only; excluded from iOS bundle                                                       |
| `react`                                     | 19.2.3    | UI runtime, matching installed Expo/RN compatibility                                         |
| `react-dom`                                 | 19.2.3    | Web only; excluded from iOS bundle                                                           |
| `react-native`                              | 0.86.3    | Native framework; minimum iOS 15.1 in podspec; app floor remains 16.4                        |
| `react-native-maps`                         | 1.27.2    | Apple Maps; minimum iOS 15.1; no Google Maps iOS SDK/key included                            |
| `react-native-safe-area-context`            | 5.7.0     | Insets; minimum iOS 12.4                                                                     |
| `react-native-svg`                          | 15.15.4   | Existing brand/artwork; minimum iOS 12.4                                                     |
| `react-native-web`                          | 0.21.3    | Web only; excluded from iOS bundle                                                           |

The latest npm audit reports **13 findings: 8 moderate, 5 high**, propagated through Expo/Xcode build-tool dependencies including node-forge and old UUID. No forced downgrade to an obsolete Expo SDK was applied. These are tooling-graph findings, not a claim of a demonstrated native runtime exploit; track upstream fixes and re-audit on the next compatible SDK update. The earlier audit's lower counts are historical.

## Permissions

| Resource                                                       | Current request and reason                                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foreground location                                            | Explicit When Using request to show position/nearby activity and share only with the chosen audience; denied/reduced accuracy remains usable for manual map/meetups |
| Selected photo                                                 | User-initiated system PHPicker for an avatar; access only to the selected image; no broad photo-library usage string needed by this path                            |
| Camera / microphone / Contacts / Bluetooth / Motion / Calendar | Not used or requested                                                                                                                                               |
| Notifications                                                  | Permission/status UI prepared, native prompt gated until push delivery exists; no token registration or APNs entitlement                                            |
| Background location / Always location                          | Not requested or enabled                                                                                                                                            |
| Local Network                                                  | Development Metro only; no production usage string/exception                                                                                                        |
| Tracking                                                       | No tracking/advertising SDK or ATT request                                                                                                                          |

Location usage text: “Zuno uses your location while open to show nearby people and meetups. If you enable sharing, your chosen audience can see your location and optional speed and heading.” Permission is not requested at launch. GPS course over ground is used when valid; no magnetic compass/geofence/significant-change service. Invalid speed/course is not fabricated. Reduced Accuracy pauses precise movement sharing. Backgrounding stops the watcher/publication; foreground rechecks permission. In-flight/queued location work is invalidated before stopping; offline last fixes expire in 90 seconds.

## Capabilities

Foreground Core Location and MapKit display need no extra portal capability. SecureStore uses the app's standard Keychain access; no Keychain Sharing group. Custom URL scheme `zuno` is configured. Sign in with Apple is now implemented and its entitlement is prepared; enable the capability for the owner App ID and regenerate provisioning. No Background Modes, APNs, Associated Domains, App Groups, iCloud or Maps routing-provider entitlement is enabled. Notification permission code is gated while push delivery is absent.

## Privacy

Generated `PrivacyInfo.xcprivacy` is valid and reproducible from app.config.ts. Required reasons remain SDK-derived: User Defaults CA92.1; File Timestamp C617.1 / 0A2A.1 / 3B52.1; Boot Time 35F9.1; Disk Space E174.1 / 85F4.1. Native SDK manifests, including the supplied RN Maps manifest, are bundled and checked.

Connected builds now declare linked email, name, user ID, other user content, precise/coarse location and photos/videos for app functionality, with tracking false. This reflects actual Auth/social/GPS/avatar features and supersedes the previous local-only declaration. Owner must still review App Store privacy labels, provide a privacy policy/support contact, explain location expiry/backup limitations and moderation, and answer export compliance. `ITSAppUsesNonExemptEncryption` is intentionally unset pending that answer. No legal assertion is invented.

No accumulating GPS-history table. The latest durable row is overwritten at most every 30 seconds; the faster cache is UNLOGGED, overwritten and expires after 90 seconds. Cron physically removes expired rows every five minutes. Broker messages contain only invalidations/removed IDs. Previously delivered data and still-valid avatar URLs cannot be retroactively erased; avatars expire after 60 seconds. Hosted retention/backups must be reflected in the owner's policy.

## Environment Variables / Secrets Needed Later

Names only:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ZUNO_APPLE_TEAM_ID
ZUNO_BUILD_CHANNEL
```

The two public Supabase values are already present in ignored local configuration and bundled intentionally. Never insert a service-role key, database password or SMTP secret into EXPO_PUBLIC values. SMTP belongs in Supabase's server settings. No analytics/APNs/private service credential is currently needed. Android's future key is out of this iOS scope. Release has no localhost/LAN API, broad ATS exception, Metro or dummy production endpoint.

Additional optional public page configuration: `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`. Provider/server-only field names and owner setup steps are in AUTH_ONBOARDING_ARCHITECTURE.md.

## Assets

Existing icon generates an opaque 1024px AppIcon and compiles; launch image is wired to existing Zuno artwork. Fonts are bundled. No fabricated final branding. Connected users start with a neutral avatar, not fictional demo portraits. Asset attribution and previous native validation are preserved. Final TestFlight/App Store screenshots and owner's rights/branding review remain product work; no known asset blocks compilation/signing.

## Apple Developer Steps Remaining

1. Complete provider/SMTP configuration and hosted three-account acceptance in SUPABASE_SETUP.md; the database deployment is already verified.
2. Enroll/sign in to Apple Developer yourself; complete agreements and select your Team. Never share an Apple ID password here.
3. Confirm `app.zuno.mobile` belongs to/is available for that Team; register the explicit App ID if necessary. Enable only the capabilities listed above.
4. Prepare final source/version, open the generated workspace, select target Zuno and automatic signing/Team. Allow Xcode to manage certificates/profiles in Keychain.
5. Create/connect the App Store Connect iOS app record with that bundle ID, display name, primary language and a SKU you choose; verify upload/testing roles.
6. Supply beta description, feedback/support/contact and privacy information, accurate App Store privacy and export-compliance answers, and reviewer sign-in instructions. Configure a working tester/reviewer email path; public email delivery is not assumed.
7. Validate on signed physical iPhones with multiple accounts using the checklist below.
8. Increment build number if previously uploaded, regenerate if needed, select generic iOS device and Archive with Release and normal signing (no CODE_SIGNING_ALLOWED=NO).
9. Validate in Organizer, review symbols/privacy warnings, then Distribute → App Store Connect → Upload. The owner has now authorized TestFlight upload; public App Store submission remains prohibited.
10. After processing/compliance, select the TestFlight build, add eligible internal testers and test the actual installed build. External testers require Beta App Review and working email onboarding.

## Physical iPhone Test Checklist

- [ ] Cold launch/relaunch, no Metro/developer overlay; safe areas, keyboard, dynamic type, portrait/landscape, light/dark. Include iPad if retaining its support.
- [ ] Map tiles, pan/pinch, both side zoom gestures, fast reversals, full globe and recenter on cellular/Wi-Fi.
- [ ] Magic-link email and warm/cold callback on the initiating phone; session restoration, expiry, sign-out, account switch and no prior account's content.
- [ ] Location denied/Allow Once/While Using, Location Services off, Precise Location off/on, permission revoked; manual map/meetups remain usable.
- [ ] Safe outdoor movement with two phones: Public/Friends/Private, speed units, valid heading, stationary/poor GPS, stale/offline expiry, blocking an already-connected viewer.
- [ ] Background/lock/unlock and logout stop sharing; reconnect reconstructs saved state. Verify energy use; no Always permission or background tracking.
- [ ] Create/edit/cancel map meetups, invitations/audiences, concurrent capacity, join/leave and chat access; attendance never turns on GPS sharing.
- [ ] Direct/group send, receipt, unread state, earlier history, reconnect/relaunch; unauthorized account denied.
- [ ] Profile/name/username/avatar upload/replacement; camera/microphone not requested; cancel picker; oversized image/error handling.
- [ ] Network/backend unavailable: no launch crash or false successful write; recovery works. Push permission is not expected.
- [ ] Delete only a disposable test account after explicit confirmation; verify photos/profile/location/relations disappear.
- [ ] Retain version/build/device/steps in TestFlight crash feedback; physical frame rate/GPS/power and Apple acceptance remain unverified.

## Remaining Blockers

| Category         | Remaining work                                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CODE             | No known compiler, unit-test or archive blocker. Physical-device and hosted acceptance remain unverified; do not equate local tests with a production-scale certification.                                                                                             |
| APPLE ACCOUNT    | Enrollment/agreements, Team/App ID, signing/provisioning, App Store Connect record/metadata, signed archive/upload/processing/TestFlight groups.                                                                                                                       |
| PRODUCT DECISION | Tester email delivery/audience; privacy/support/contact and moderation process; confirm foreground-only early beta limits, bundle ID ownership and iPad scope; export-compliance answers.                                                                              |
| BACKEND          | Deployment complete; public channels disabled; 67 hosted assertions and 282-object catalog comparison passed. Remaining: Apple/Google provider configuration, SMTP for non-team addresses, real hosted email/WebSocket/Storage sessions with owner-controlled testers. |
| ASSET            | No native-build blocker; final marketing screenshots and owner review remain.                                                                                                                                                                                          |

Engineering preparation and hosted database deployment are complete. Remaining acceptance covers owner provider/SMTP configuration and real signed-iPhone testing, followed by TestFlight distribution. See SUPABASE_ARCHITECTURE.md for complete tables/RPCs/security and SUPABASE_SETUP.md for exact dashboard steps.

## Authentication milestone changes

- Added welcome/bootstrap routing; native Apple, Google PKCE and simple email entry; owner-only profile/location onboarding and resume state.
- Deployed the unchanged six social migrations first, then `202610030001_onboarding.sql`; enabled private-only Realtime and verified all policies/grants against local Supabase.
- Added explicit session-end cleanup, abortable RPCs, secure-storage logout revocation and avatar cache clearing. Harmless device preferences are separate.
- Added bounded photo resize/compression, permission denial/Settings handling, optional notification strategy gated until actual push exists, and Development-only sample routing.
- Added compatible Expo Apple/WebBrowser/ImageManipulator/Notifications dependencies and refreshed the CocoaPods lock. Added development-only React renderer tests. No major dependency upgrades or private credentials.
- New audit SQL, screenshots, hosted validation report and AUTH_ONBOARDING_ARCHITECTURE.md describe the exact remaining owner steps.

The complete authentication test matrix and provider configuration instructions are in AUTH_ONBOARDING_ARCHITECTURE.md. Apple provider tests use mocked native responses until a signed iPhone and configured provider are available. Google provider tests use mocked browser callbacks until owner OAuth setup. Do not label either as a real provider login pass.

Native dependency note: Expo automatically adds a push entitlement when the Notifications package is present. The distribution plugin explicitly removes it while push delivery is unimplemented. Both final generated projects were checked: only `com.apple.developer.applesignin` remains. Expo dependency compatibility, TypeScript, ESLint, Prettier and Git whitespace checks pass. The local test stack was stopped with its data volumes preserved.
