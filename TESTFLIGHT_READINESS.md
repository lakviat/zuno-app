# Zuno — TestFlight readiness

Audit date: October 1, 2026. Native scope: iOS. No Apple login, signing credential access, upload, paid service, or external publication was performed.

## Current Status

**READY FOR SIGNING** for an explicitly labeled, local-data preview beta. This is engineering readiness, not App Review approval or readiness for a public, live social service.

An **unsigned arm64 iPhone Release archive passed**. Apple enrollment, team selection, signing, App Store Connect configuration and upload remain. Real accounts, remote messages, realtime friend locations and moderation are not implemented. Missing backend configuration does not block this local beta.

## Project

| Item                                        | Audited configuration                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth                             | Expo continuous native generation: `app.config.ts`, `plugins/`, npm lockfile and `native/ios/Podfile.lock`                       |
| Application target / product / display name | `Zuno` / `Zuno.app` / Zuno                                                                                                       |
| Scheme                                      | Shared `Zuno`; Run = Debug, Profile/Archive = Release                                                                            |
| Configurations                              | Debug and Release; one app target, no extensions or native XCTest target                                                         |
| Workspace                                   | Generated `ios/Zuno.xcworkspace`; use the workspace, not the `.xcodeproj`, because CocoaPods supplies native dependencies        |
| Deployment target                           | iOS 16.4                                                                                                                         |
| Devices                                     | iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`), arm64 devices; simulator is a separate build                                   |
| Orientation                                 | Portrait and landscape; iPad full-screen-only is not required; one UIWindowScene                                                 |
| Bundle identifier                           | `app.zuno.mobile` — preserved, syntactically valid; ownership/availability must be confirmed with your Team                      |
| Marketing version                           | `0.1.0`, sourced from `package.json`                                                                                             |
| Build number                                | `1`, explicitly set by `ios.buildNumber` in `app.config.ts`                                                                      |
| Swift                                       | Swift language mode 5.0; installed Xcode 27.0 (27A266a), iOS SDK 27.0                                                            |
| JavaScript/runtime                          | Expo 57.0.26, React Native 0.86.3, Hermes; bundled JS in Release, no Metro dependency                                            |
| Dependency managers                         | npm (`package-lock.json`) and CocoaPods 1.16.2; no application Swift Package dependencies                                        |
| CI                                          | No repository CI workflow or Fastlane setup. EAS profiles are prepared but no EAS account/project/service was created or invoked |

### Prepared workspace and reproducible commands

The working directory on Desktop is subject to iCloud/File Provider metadata. Previous framework signing problems there are avoided by staging native builds under `~/Library/Developer/Zuno/`.

The prepared workspace on this Mac is:

```text
/Users/nurlanmirovich/Library/Developer/Zuno/TestFlight-60d5288d0b/source/ios/Zuno.xcworkspace
```

From the repository, using Node 22.13+ (validated with 22.23.1), installed Xcode and CocoaPods:

```sh
npm ci
npm run ios:prepare
npm run ios:archive:unsigned
```

The first command is for a fresh checkout; dependencies are already installed on this Mac. `ios:prepare` synchronizes source into a marked staging directory, regenerates native configuration and installs pods with `--deployment`. The archive command also builds for `generic/platform=iOS` with signing disabled and verifies the resulting app. It never logs in, signs, exports an IPA, or uploads. It creates a new timestamped archive rather than replacing a previous archive. Logs and `latest-archive.txt` stay alongside the managed workspace.

The repository's ignored `ios/` directory was an older generated project, with the legacy app-delegate template. **Do not archive that stale copy.** Use the prepared workspace above. Changes to generated native files are not durable; change Expo configuration/plugins and prepare again. Select your Team after the final prepare, or supply your Team ID through `ZUNO_APPLE_TEAM_ID` when preparing later.

The script excludes private environment files and signing material from its staging copy and disables implicit dotenv loading. Backend keys are not needed. A future signing Team ID can be supplied as a shell environment variable; alternatively choose it directly in Xcode. `CODE_SIGNING_ALLOWED=NO` is only an unsigned command-line override, never a persistent project setting.

### Versioning and identity

- Before the next upload, change `ios.buildNumber` in `app.config.ts` from `'1'` to `'2'`, then `'3'`, etc. Every uploaded build must have a new build number. Run `npm run ios:prepare` again before archiving.
- Change the marketing version only for a new version milestone. `npm version 0.1.1 --no-git-tag-version` updates `package.json` and `package-lock.json`; Expo and the Xcode build settings read that version.
- EAS uses **local** versioning, without automatic increments. `testflight` is a store-distribution, device Release profile; `production` inherits it. The existing simulator `preview` profile remains separate. Local Xcode is the prepared path and requires no Expo paid service.
- No replacement bundle ID is recommended without knowing your ownership. Keep `app.zuno.mobile` if available for your Team. Otherwise choose an identifier you control and update `ios.bundleIdentifier` in `app.config.ts`, regenerate, and register/select the same ID in Apple Developer and App Store Connect. The preview launcher reads the built identifier rather than hard-coding it. Android's package is separate and deferred.
- A bundle-ID change creates a different installed app/container. There are no APNs, Associated Domains, OAuth callbacks or backend app registrations to migrate today. The custom `zuno` URL scheme exists, but there is no authentication deep-link flow.

## Build Results

| Validation                                        | Result                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Debug simulator build                             | **PASS**, iPhone 17 / iOS 27 simulator target                                                     |
| Release iPhone device build                       | **PASS**, included in the unsigned archive                                                        |
| Release simulator build/startup                   | **PASS**, built/installed and startup checked on iPhone 17 / iOS 27 and iPhone SE / iOS 18.2      |
| Archive validation                                | **PASS**, unsigned generic-iOS arm64 `.xcarchive`                                                 |
| Signed archive / export / Apple server validation | Not attempted: no Team, distribution signing/provisioning or App Store Connect account configured |

Validated unsigned archive:

```text
/Users/nurlanmirovich/Library/Developer/Zuno/TestFlight-60d5288d0b/Zuno-unsigned-20261001T205301837Z.xcarchive
```

The archive identifies `app.zuno.mobile`, version `0.1.0`, build `1`, minimum iOS `16.4`, device platform `iphoneos`, architecture `arm64`. Its Team and SigningIdentity fields are empty, as intended. It cannot be uploaded or installed on a phone until it is signed; re-archive normally after Team selection.

Release uses Swift `-O`, dSYM generation, `ENABLE_TESTABILITY=NO`, `ONLY_ACTIVE_ARCH=NO`, `SKIP_INSTALL=NO`, `VALIDATE_PRODUCT=YES`, and automatic signing. No user Team or specific certificate/profile is hard-coded. Debug keeps its normal unoptimized/testable configuration. No obsolete architecture exclusion, bitcode dependency, simulator-only framework slice, SPM failure or framework embedding error was found. Every embedded device framework contains arm64. The main executable's UUID matches `Zuno.app.dSYM`.

`scripts/verify-ios-release.mjs` checks platform/architecture, identity/version, permission strings, ATS, scene configuration, icons, launch resource, embedded JavaScript, absence of developer-only UI strings, required-reason categories and included privacy manifests. It works on a built `.app` or `.xcarchive`.

### Warnings reviewed

The archive completed without application compiler/linker errors. Remaining warnings are upstream React Native Maps/SVG Objective-C deprecations and C++ diagnostics, Hermes diagnostics about runtime-provided JS globals/Expo compatibility code, SDK script phases without output declarations, and skipped App Intents metadata because the app has no App Intents. These were not hidden with warning-suppression flags.

The prebuilt SDK artifacts do not supply dSYMs for `React.framework`, `ReactNativeDependencies.framework` and `hermesvm.framework`; Zuno and the embedded Expo frameworks do have dSYMs. Apple may warn about missing vendor symbols during upload, limiting symbolication inside those SDKs. No fake/empty dSYMs were generated. This does not prevent local archiving; Apple-side validation remains untested. Retain the archive and logs and review any upload warnings.

## Tests

| Check                           | Final result                                             |
| ------------------------------- | -------------------------------------------------------- |
| Strict TypeScript               | PASS                                                     |
| ESLint                          | PASS, zero warnings after cleanup                        |
| Prettier                        | PASS                                                     |
| Vitest                          | **69 passed across 13 files**; none skipped              |
| Playwright                      | **10 passed** on a complete rerun; none skipped          |
| Expo dependency compatibility   | PASS, `expo install --check`                             |
| Complete npm dependency graph   | PASS, no missing/invalid/conflicting dependency problems |
| Production iOS JS/Hermes export | PASS, including source-map inspection                    |
| CocoaPods locked install        | PASS, `pod install --deployment`                         |
| Native archive checks           | PASS                                                     |

The first browser run passed nine tests; its repeated-drag test exceeded the existing 45-second timeout while native compilation/export was running. The unchanged full suite passed when run without that load (including the drag test in 23.5 seconds). No test expectations or timeouts were weakened.

Native Release smoke checks verified the map and local-preview label, absence of the developer viewer switch, denied-location feedback without a crash, a synthetic simulator GPS fix with honest unavailable-speed output, and background/foreground recovery after permission revocation. Simulated location was cleared and the app’s test permission reset afterward. This validates the flow, not physical GPS quality. Both the current archive and simulator bundles pass the artifact verifier.

New tests exercise denied location permission, reduced accuracy without an unnecessary watcher, permission revocation between foreground sessions, and native sample/error forwarding with compatible requested accuracy. Existing tests cover privacy, blocks, persistence/migration, meetup capacity/audiences, chat access, map discovery and edge zoom.

There is no native XCTest target: the generated scheme's stale `ZunoTests` reference was removed. Native validation uses real native builds plus simulator interaction. No connected physical iPhone was used, and no physical GPS, energy-use or frame-rate claim is made.

## Changes Made

1. Centralized marketing version, explicit iOS build number, local EAS versioning and a device TestFlight profile; preserved the bundle ID and display name.
2. Added a reproducible distribution configuration plugin: matching Xcode versions, automatic signing without a Team/certificate, explicit Release optimization/symbols, removal of the nonexistent XCTest reference and disabled network inspector.
3. Removed unused Always Location and Motion permission strings; clarified the foreground location purpose. No background capability was enabled.
4. Made distribution ATS reject arbitrary/local-network exceptions; native Metro networking requires the explicit development build channel.
5. Added source-controlled required-reason declarations from installed SDKs; included the map SDK's otherwise omitted privacy manifest verbatim.
6. Repaired the launch screen's missing image using Zuno's existing artwork. The generated 1024-pixel app icon is opaque and compiles successfully.
7. Added an isolated, unsigned device archive workflow, locked CocoaPods install, and artifact verification. Preview launching now reads the built bundle ID.
8. Clearly labeled the local sample world, hid the developer actor switch in Release, and verified fake-movement controls are inactive in Release.
9. Corrected foreground GPS requested accuracy to match the existing sample filter, surfaced reduced-accuracy status, avoided watching for unusable reduced-accuracy fixes, rechecked permission on foreground return, and made recenter use a recent available device sample.
10. Added location regression tests, documentation, and ignore rules for archives, IPA, dSYM, results and signing artifacts. Preserved the user's untracked `.idea/` folder.

## Dependencies

No dependency versions were upgraded, replaced or removed. All direct runtime dependencies have a current use; browser-specific packages are required by the existing web preview and are absent from the iOS module graph. The complete npm graph resolves, and the Expo version compatibility check passes.

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
| `maplibre-gl`                               | 6.11.2    | Web map only; excluded from iOS bundle                                                       |
| `react`                                     | 19.2.3    | UI runtime, matching installed Expo/RN compatibility                                         |
| `react-dom`                                 | 19.2.3    | Web only; excluded from iOS bundle                                                           |
| `react-native`                              | 0.86.3    | Native framework; minimum iOS 15.1 in podspec; app floor remains 16.4                        |
| `react-native-maps`                         | 1.27.2    | Apple Maps; minimum iOS 15.1; no Google Maps iOS SDK/key included                            |
| `react-native-safe-area-context`            | 5.7.0     | Insets; minimum iOS 12.4                                                                     |
| `react-native-svg`                          | 15.15.4   | Existing brand/artwork; minimum iOS 12.4                                                     |
| `react-native-web`                          | 0.21.3    | Web only; excluded from iOS bundle                                                           |

Development dependencies resolve and are not shipped as test/build tooling: `@playwright/test` 1.63.0, `@types/react` 19.2.18, `eslint` 9.39.5, `eslint-config-expo` 57.0.2, `prettier` 3.9.9, `typescript` 6.0.3 and `vitest` 5.0.3. Production source-map inspection confirms no Playwright, Vitest, ESLint, TypeScript compiler, MapLibre, React DOM or React Native Web modules. Expo's small Metro module-loader runtime appears under an `@expo/cli` source path; it is required runtime code, not the CLI. The vulnerable build-tool UUID package is absent; Expo's separate UUID utility is unrelated.

The 92 resolved native podspecs include React/Hermes and Expo's transitive modules: Constants 57.0.20, Asset 57.0.18, FileSystem 57.0.7, DomWebView 57.0.1, KeepAwake 57.0.2, LogBox 57.0.4, ModulesCore 57.0.20, ModulesJSI 57.1.1, ModulesWorklets 57.0.20 and Hermes 250829098.0.17. Their iOS floors are compatible. React/Expo framework runtime support is retained; developer UI/keep-awake activation is gated. There is no `expo-dev-client` or Expo Go developer-menu dependency in the standalone app.

The locked install initially detected exactly one checksum change: disabling the network inspector changes ExpoModulesCore's evaluated podspec. The refreshed lock was reviewed, with no package/version changes, and then passed `--deployment`. Keep `native/ios/Podfile.lock` with npm's lockfile; after an intentional native dependency/configuration change, review and copy the regenerated lock back rather than bypassing deployment validation.

`npm audit` reports **11 moderate, zero high/critical** entries, all propagated through Expo's build-time Xcode/old UUID dependency chain. Its suggested broad fix downgrades Expo to SDK 46 and is inappropriate here. No forced upgrade/downgrade was applied. Re-audit when updating Expo; the vulnerable UUID module is not in the inspected iOS production graph.

## Permissions

| Resource                                                                 | Actual behavior                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location, When Using the App                                             | Requested only after the user taps **Use location while here** in Location & privacy, following an explanation. Shows position/movement and nearby distances on this device. Uses `NSLocationWhenInUseUsageDescription` |
| Always/background location                                               | Not requested, not configured; obsolete usage strings removed                                                                                                                                                           |
| Motion/Fitness                                                           | Not requested. Speed and course come from Core Location samples, not Core Motion; obsolete motion string removed                                                                                                        |
| Camera, Photos, Microphone, Contacts, Bluetooth, Local Network, Calendar | No app access/request; no permission descriptions required                                                                                                                                                              |
| Notifications                                                            | No OS notification request, local scheduling or push registration. Existing notification objects are local UI data only                                                                                                 |
| App Tracking Transparency                                                | No advertising/tracking implementation or request                                                                                                                                                                       |

The sole shipped usage-description string is:

> Zuno uses your location while the app is open to show your position, movement and nearby distances. This preview keeps your location on this device.

Browsing, manual meetup placement, profile editing and local messaging work without granting location. No automatic prompt occurs at startup.

## Capabilities

| Capability                                               | Current configuration / later portal work                                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard iOS app                                         | Empty application entitlements before signing; Apple will add application/team signing entitlements through provisioning                           |
| Foreground Core Location                                 | Usage string and progressive request; no special Developer portal capability required                                                              |
| MapKit display                                           | Apple Maps via react-native-maps; no Google key or special Maps routing entitlement needed. This is not an app registered as a directions provider |
| Background Modes / location                              | Not enabled or needed by current behavior                                                                                                          |
| Push Notifications / remote-notification mode            | Not enabled; no APNs setup needed for this beta                                                                                                    |
| Sign in with Apple                                       | Not enabled; no real sign-in exists                                                                                                                |
| Keychain Sharing, Associated Domains, App Groups, iCloud | Not enabled; no current feature needs them                                                                                                         |

Do not add speculative capabilities. The only required account-side preparation today is the correct App ID, Team and normal App Store distribution signing/provisioning.

## Location and runtime audit

- Uses continuous **foreground** `watchPositionAsync` while explicitly enabled and active. No significant-change service, region monitoring, geofencing, background task or background location request exists.
- Native course/heading and speed are read from location samples. This is course over ground, not a continuously running magnetic compass. Unknown/negative values and implausible readings are sanitized; stationary course is not presented as reliable.
- Watch uses High (~10 m requested accuracy), distance filters of 35 m stationary, 10 m walking-speed and 15 m faster movement. Publication is separately gated at approximately 60/10/5 seconds. iOS controls the actual callback cadence; the supplied time interval is not an iOS guarantee. No navigation-grade highest-accuracy mode is enabled.
- Rejects invalid coordinates, >65 m accuracy, stale/future/out-of-order and implausible jumps. Backgrounding and disabling stop watches and clear ephemeral samples; late async subscriptions are removed. Reduced Accuracy shows a useful explanation and avoids starting the precision watcher. Permission is rechecked without prompting after Settings/background transitions.
- Recenter uses a valid recent device sample when present, otherwise returns to the labeled sample world. The app does not pretend sample Miami positions are live GPS. No raw device samples are persisted or transmitted by Zuno's repository/publisher.
- Local publisher has no network adapter; ghost, blocks, explicit friend policy and approximate public policy are prepared but not server authorization. No sensitive sample is silently broadcast.
- Offline map tiles may be unavailable; the UI has a loading/unavailable state and local social sheets remain available. Fonts/portraits/JS are bundled. Persistence read/write failures show local feedback, and the existing error boundary offers retry. Optional location failures do not gate startup. There is no absent backend or notification SDK initialization capable of blocking launch.
- Source scan found no application localhost/LAN server, development REST/GraphQL URL, custom certificate, debug proxy, auth token, excessive app console logging or release-relevant TODO left active. Browser test URLs and native Debug Metro URLs are intentional tooling. Device Release loads its bundled JS.
- Developer actor switching and simulated movement controls are `__DEV__` gated. The mock-movement module can remain in Metro's dependency/source-map graph, but its Release function immediately returns a no-op and cannot start a timer. It is not live tracking. The header labels sample people in every build; meetup/chat/privacy screens explain local-only behavior.

## Privacy

The app's generated **PrivacyInfo.xcprivacy is present and parses successfully**. Its declarations are reproducible through `ios.privacyManifests` in `app.config.ts`, not an untracked manual Xcode edit. The archive verifier checks required-reason categories and SDK manifest presence.

| Required-reason category | Reasons / installed provenance                                             |
| ------------------------ | -------------------------------------------------------------------------- |
| User Defaults            | `CA92.1` — React Native and Expo Constants                                 |
| File Timestamp           | `C617.1` — React Native/AsyncStorage; `0A2A.1`, `3B52.1` — Expo FileSystem |
| System Boot Time         | `35F9.1` — React Native timing/SDK elapsed-time support                    |
| Disk Space               | `E174.1`, `85F4.1` — Expo FileSystem                                       |

These match the installed SDK authors' manifests/native API implementations; no reason was invented for a hypothetical feature. Expo FileSystem's prebuilt integration did not aggregate its reasons into the original root manifest, so they are explicitly retained at app level. The archive also includes Constants, AsyncStorage, React Core/cxxreact/timing, and ReactNativeDependencies boost/folly/glog privacy bundles.

React Native Maps 1.27.2 supplies an Apple-map privacy file but does not reference it in its Apple Maps pod resources. The distribution plugin includes it verbatim as `ReactNativeMapsPrivacy.bundle/PrivacyInfo.xcprivacy`. It declares nontracking, unlinked precise-location use for app functionality. The Google Maps SDK/Google privacy bundle is not included on iOS.

The app itself currently has no analytics, ad tracking, auth or social backend, and its application manifest has no collected-data entries. **This is not a prefilled App Store privacy-label answer.** Review Apple Maps/SDK data handling, the SDK precise-location declaration and the actual beta behavior before answering App Store Connect privacy questions. The owner must provide/approve privacy-policy and contact information. Revisit declarations before adding Supabase, analytics, remote location, uploads or moderation. Client-side local storage/processing must not be misrepresented as server-side collection or security enforcement.

No custom/nonstandard encryption implementation was found; the visible networking uses platform HTTPS/MapKit. `ITSAppUsesNonExemptEncryption` remains unset so the owner answers Apple's export-compliance questionnaire rather than accepting an invented legal declaration. If the owner confirms the applicable exemption, the corresponding plist value can be set in `app.config.ts` later.

References: [Apple required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [Expo privacy manifests](https://docs.expo.dev/guides/apple-privacy/), [Apple app privacy definitions](https://developer.apple.com/app-store/app-privacy-details/), [export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/).

## Environment Variables / Secrets Needed Later

Variable names only; none are required to run the local preview:

```text
ZUNO_APPLE_TEAM_ID
ZUNO_BUILD_CHANNEL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
GOOGLE_MAPS_ANDROID_API_KEY
```

The Team variable is optional configuration, not a password. The build-channel variable selects native development networking; distribution preparation forces the TestFlight channel. Supabase variables are reserved, currently unused public client configuration; never substitute a service-role/secret key. The Google key is Android-only and not required for iOS. No analytics/APNs/private API credential is currently needed. Xcode can manage certificates/profiles after enrollment without putting private key contents in this repository.

`.env.example` contains names/comments only. Real dotenv files, private keys, provisioning profiles, IPA and archive artifacts are ignored; the tracked-file credential-pattern scan found no matches. No credentials were printed, copied into the prepared workspace or committed. Backend integration later belongs behind `SocialRepository`, `AuthService` and `LocationPublisher`, not direct Supabase imports in UI. There is no live endpoint to configure today and no dummy production endpoint was introduced.

Development uses Metro and can explicitly prepare with the development build channel for local-network ATS support. TestFlight/production uses Release JS, no Metro, strict ATS, no inspector/actor switch, and the deliberately labeled **local-preview** data adapter. No environment switch can pretend to enable a backend that has not been built.

## Assets

The existing Zuno app icon generates a **1024 × 1024 opaque** universal iOS icon; asset compilation supplies the device icon representations. The source PNG has an alpha channel, but the generated AppIcon PNG has none. No missing/malformed app-icon entry was found. Existing fonts and fictional-person portraits are bundled; source attribution remains in `assets/SOURCES.md`.

The bare launch storyboard referenced a nonexistent image. It now uses the existing `assets/splash-icon.png` through a generated `SplashScreen.imageset`. No new/fake branding was invented. Current assets are sufficient for the build. Final App Store marketing screenshots, public-store copy and owner's asset/privacy/legal review are later product work; no asset blocks signing this beta.

## Apple Developer Steps Remaining

1. Enroll in the Apple Developer Program and complete Apple's account/organization verification and agreements yourself. No Apple ID password should be pasted into code or chat.
2. Confirm the intended Team and that `app.zuno.mobile` is available to it. Change the source configuration only if necessary. Decide whether the initial beta is the clearly labeled local preview described here.
3. Run `npm run ios:prepare` for the final source/version. Open the prepared **Zuno.xcworkspace** listed above, select target Zuno → Signing & Capabilities → automatically manage signing → your Team. Alternatively provide your Team ID through the optional environment variable before preparation. Register the matching explicit App ID if Xcode does not do so. Do not enable extra capabilities.
4. Allow Xcode to create/select the appropriate Apple signing certificate and provisioning profile. Protect the private key in your local Keychain. The project currently has no certificate/profile/team restriction.
5. Create or connect the **iOS App Store Connect app record** using the exact bundle ID, Zuno display name if available, your primary language and a SKU you choose. Confirm account roles allow upload and testing.
6. Complete required TestFlight beta description, feedback email/contact and testing information; review privacy-policy/contact details and export-compliance questions. For external testing, complete Beta App Review contact/review information and submit the beta for Apple's review. No sign-in credentials are required by this local-preview app.
7. Connect your iPhone and validate the physical-device checklist below with a signed development build. This does not replace testing the eventual TestFlight build.
8. Increment `ios.buildNumber` if this number has previously been uploaded. Prepare again **before** final Team selection if source/configuration changed. Confirm version/build in Xcode and ensure Archive uses Release.
9. Select **Any iOS Device (arm64)** / generic iOS destination and Product → Archive. Do not reuse the unsigned archive for submission; create a normal signed archive. Do not carry over signing-disabled command-line flags.
10. In Organizer, validate and choose Distribute App → App Store Connect → Upload. Keep symbols enabled; review any vendor-symbol or privacy warnings. Let Xcode perform App Store distribution signing/provisioning. Avoid changing version numbers only in Organizer if you want the repository to remain authoritative.
11. Wait for Apple processing, resolve any validation/compliance questions, select the build under TestFlight and add an internal testing group with eligible App Store Connect users.
12. Install through TestFlight and repeat launch/location/map/offline checks. Add external testers only after the required Beta App Review approval.

[Apple distribution workflow](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases), [upload requirements](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [current SDK submission guidance](https://developer.apple.com/app-store/submitting/). Xcode 27/iOS 27 is a supported current SDK family; server-side account/build acceptance has not been attempted.

### Prepared beta copy

**Description:** Zuno is an early social-map preview. Explore a sample world, choose meetup spots directly on the map, create activities, try local conversations and availability, and optionally inspect your device's foreground location. People are fictional and social changes stay on this device. Real accounts and communication between phones are not available yet.

**What to test:** Launch and map rendering; zoom from either screen edge out to the globe and back; meetup placement, times and capacity; keyboard/layout behavior; local chat/profile persistence; location denial and reduced accuracy; foreground GPS movement; background/foreground recovery; offline behavior. Please include your iPhone model, iOS version and steps when reporting a problem.

Feedback email, owner/review contact, privacy URL and tester selection must be supplied by the owner. No contact identity was fabricated.

## Physical iPhone Test Checklist

- [ ] Fresh install and cold launch, then relaunch with saved data; no Metro/Expo Go dependency, developer gear or actor-switch menu.
- [ ] Header clearly identifies the local sample world; fictional users are not mistaken for nearby real people.
- [ ] App icon/launch artwork, light/dark appearance, portrait/landscape, safe areas, keyboard and larger text; also test an iPad if keeping iPad support.
- [ ] Apple Maps loads over cellular/Wi-Fi; pan, pinch, both edge gestures, maximum globe zoom and quick direction reversals; return to nearby view.
- [ ] Opening the app does not request location. Open Location & privacy, read the explanation and request When Using the App only.
- [ ] Test Don't Allow, Allow Once, While Using, system Location Services off, and permission revoked in Settings; manual browsing/meetups continue.
- [ ] Turn Precise Location off: explanation appears, no fabricated speed/course or endless precision watcher. Turn it on again, foreground the app or stop/start location, and recover.
- [ ] Outdoors, enable location and tap recenter: it uses the phone's recent location rather than Miami. Move safely and verify position, speed units and course; stationary/unknown/poor GPS do not create false movement.
- [ ] Background/lock/unlock repeatedly: foreground tracking stops in background and resumes only when enabled; inspect energy/battery behavior. There should be no request for Always Location or background-location indicator caused by Zuno.
- [ ] Ghost/approximate/hidden controls remain independent of meetup attendance; current beta does not transmit samples or messages to another phone.
- [ ] Create a pinned Now and future meetup, edit/cancel, exercise available join/leave flows, type/send a local message, and verify chat access/persistence. Non-friend actor switching is a development-only QA tool and absent from TestFlight.
- [ ] Edit profile and theme; restart; local data persists. Reports explain local-only storage. Local data deletion requires confirmation and restores the sample world.
- [ ] Airplane mode/network loss: app still launches, local sheets work, uncached map tiles may fail gracefully; reconnect and check recovery.
- [ ] No sign-in or push notification permission is expected. If either appears unexpectedly, stop and report the build/version.
- [ ] Use TestFlight feedback/crash reporting for crashes, hangs and layout failures; retain version/build, steps and device model. Physical frame rate, power use and GPS accuracy remain unverified until these tests are performed.

## Remaining Blockers

| Category                      | Remaining work                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CODE blockers**             | **NONE for signing the local-preview beta**. Native smoke checks are recorded above. No account error is being classified as a code failure                                                                                         |
| **APPLE ACCOUNT blockers**    | Program enrollment/agreements; Team/App ID ownership; certificates and provisioning; App Store Connect app/roles; signing, server validation, processing and upload; TestFlight groups and external Beta App Review when applicable |
| **PRODUCT DECISION blockers** | Confirm local-preview beta scope, bundle-ID availability/ownership, iPad scope, contact/privacy-policy information, tester audience, and owner's privacy/export-compliance answers. These are not invented in configuration         |
| **BACKEND blockers**          | None for this local beta. Real multi-user testing requires auth, Supabase repository/subscriptions, server-side consent/RLS/capacity enforcement, remote chat and moderation; deliberately out of scope                             |
| **ASSET blockers**            | None for native build/signing. Public-store marketing materials and final rights/branding review remain owner work                                                                                                                  |

Physical-device testing and Apple server acceptance cannot be certified by an unsigned archive or simulator. The next engineering stage is selecting the Team and completing signing, not rebuilding the app or starting a backend rewrite.
