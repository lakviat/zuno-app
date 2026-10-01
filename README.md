# Zuno

**Your people. Your places. A little closer.**

Zuno is a map-first social app prototype for iOS, Android, tablets, and the web. Open a little world around Miami Beach, tap a friend, say hello, or turn a spontaneous idea into a meetup. The coral identity, typography, graphics, and interactions are original; no Zenly assets or source code are used.

This is **the second frontend milestone**: a working frontend with fictional people and local persistence. There is no Supabase project, backend, real authentication, message delivery, moderation service, or location broadcast.

## Get started

Use Node **22.13 or newer** (the project includes `.nvmrc`) and a current npm.

```sh
nvm use
npm ci
npm start
```

Open the QR code in the matching Expo Go version on a phone on the same Wi-Fi network. Press `i` or `a` for an available simulator/emulator. No environment file, sign-in, or credential is needed for the demo. The optional device-location prompt appears only after an explicit action in privacy settings.

```sh
npm run web          # browser preview
npm run ios          # launch in iOS Simulator
npm run android      # launch in Android emulator / attached device
```

If your shell finds an old Node installation, activate Node 22 first. If a parent directory contains an obsolete `node_modules/.bin/npm`, it can shadow npm inside nested scripts; the direct CLI equivalent is `node node_modules/expo/bin/cli start`.

## Try these flows

- Tap an avatar → compact friend card → message, profile, or a meetup.
- Pan, pinch, double-tap, use zoom buttons, or drag the **slide** grip at the right edge. Recenter returns to the fictional Miami world. The 44×84-point grip has direction arrows and active feedback. It starts from the current camera, ignores the first 6 points of movement, and changes one zoom level per 120 points after that. Up zooms in; down zooms out. It preserves the center, clamps to levels 3–18, and stops on release, interruption, backgrounding, or a sheet opening. Buttons and browser arrow keys provide alternatives. First-use guidance stays until you use the control or dismiss it; reset restores it.
- Open **People** to search friends, accept Noah’s incoming request, find Mia, send/cancel a request, or open safety controls on a profile.
- Open **Meetups** to discover, create, join, or leave. Creation supports an activity, title, description, editable local start/end date-times, a chosen public venue or approximate area, optional capacity, and friend invitations. The host counts toward capacity; invitations never join anyone automatically.
- iOS uses native calendar and time pickers, with quick 30-minute/one-hour starts. Moving the start preserves the chosen duration. A new meetup starts with a venue in the area being browsed. The keyboard has a Done action, sheets resize above it, and leaving a changed form asks whether to keep editing or discard. List → detail → edit uses one native modal to avoid flashing the map between screens. Hosts have an Edit meetup action in the fixed footer.
- Choose **Friends** (default), **Invite-only**, or explicitly **Public nearby**. Browse Sunset Harbour or South Beach without granting device-location access. All/Friends/Public nearby/Today/Joined filters keep discovery small. Full meetups remain visible with joining disabled; ended/cancelled meetups leave discovery and stay in Joined for authorized members.
- Hosts can edit or cancel upcoming meetups. Hosts cannot leave their own meetup. Edits cannot shrink capacity below membership or silently remove existing participants from the audience.
- Tap the **Viewing as Maya · Local demo** row inside Meetups, then **View as Noah**, to simulate a non-friend viewer. Create a public meetup as Maya, switch to Noah in the same area, then join. This switch affects only meetups, hides personal map pins/cards, and resets to Maya on reload; it is not authentication. If you accepted Noah’s friend request earlier, reset the demo to exercise the initial non-friend case.
- Open your avatar to edit your name, bio, or status and select light, dark, or system appearance.
- Open the shield for hidden/approximate/precise preferences, selected-friend one-hour sharing, ghost mode, and blocked people.

Changes persist on this device. Privacy returns to **hidden on app startup**; ghost mode remains enabled if you set it. Your own demo marker remains visible to you even when hidden. Deleting local demo data requires confirmation and restores the sample world.

## Stack and structure

Expo SDK 57, React Native 0.86, React 19, strict TypeScript, React Native Web, AsyncStorage, Expo Location, and bundled DM Sans / Outfit fonts. React Context and a pure reducer keep this milestone small. Navigation is a typed overlay state machine with native modals, keyboard avoidance, safe areas, and Android back handling; the map stays mounted underneath.

```text
App.tsx                    Fonts, error boundary, safe-area and app providers
src/
  components/              Shared primitives, branding, sheets, error boundary
  features/
    map/                   Map contract, native/web adapters, clustering, edge zoom
    friends/               Directory, requests, compact friend card
    chat/                  Conversation list and local messaging
    meetups/               Authorization, transactions, catalog, discovery, details and form
    profile/               Profile editing, theme, block/report/remove controls
    privacy/               Location preferences, temporary sharing, ghost mode
  screens/                 Map-first shell and responsive floating controls
  navigation/              Typed routes
  repositories/            SocialRepository, mock adapter and v1 → v2 migration
  services/                Authentication and foreground location seams
  state/                   Application provider and domain reducer
  types/                   Domain models
  theme/                   Semantic colors, fonts, spacing, radii, shadows, motion
  mocks/                   Relative-time seed data and bundled avatar registry
  utils/                   Privacy policy and time formatting
tests/                     Playwright user journeys
scripts/                   Local web-worker preparation
```

`AppProvider` accepts a `SocialRepository`, so screens do not import AsyncStorage or a database client. Writes are serialized to avoid stale snapshots overwriting newer edits. The snapshot adapter is intentionally small for the prototype; replace it with scoped backend operations and subscriptions when moving to multi-user data.

`features/meetups/domain.ts` owns visible-list and authorized-ID reads, create/edit/cancel/join/leave transactions, accepted-friend audiences, explicit invitations, bidirectional host/viewer blocks, capacity, and lifecycle. The UI consumes these operations and action descriptions. Join/leave are separate, idempotent operations. `AppProvider` applies them synchronously against the latest snapshot so rapid taps cannot race stale renders. Joining never changes friendship, messaging, or location-sharing state.

Snapshots now use schema version 2 while retaining the existing `zuno.demo.v1` storage key for compatibility. Migration converts saved plans to Friends meetups, retains joined members and the host, keeps interested users in invitations (not attendance), and preserves unrelated profiles, chats, relationships, and settings. Migration itself preserves privacy exactly; the existing startup policy separately resets location sharing to hidden and ends temporary sharing, while retaining ghost mode. Unknown legacy places become approximate meeting areas. This is a local prototype, not a secure multi-user storage system.

Domain models cover User, Profile, Friendship, Location, LocationPrivacy, Presence, Conversation, Message, Meetup, MeetupDraft, Block, Report, Notification, and opt-in discovery preferences. Presence is independent of precise location.

## Map provider decision

Native uses **react-native-maps**: Apple Maps on iOS and Google Maps on Android. Web uses **MapLibre GL** with CARTO / OpenStreetMap basemaps and visible attribution. Both implement `SocialMapProps` / `MapHandle`; provider logic is isolated from social UI. Avatar and meetup clustering use shared screen-space algorithms (native uses a region-based projection approximation). Compact meetup clusters open an authorized list of the grouped meetups. Mobile friend cards hide the zoom control to protect their actions; compact filter chips fit 360-point screens. Gesture recognition lives in `ZoomGrip`/`zoom.ts`, independently of provider commands. Native uses PanResponder; web uses pointer capture so drags continue beyond the grip, plus arrow-key controls. Each gesture freezes an initial camera snapshot. Native warms the snapshot while idle, invalidates it when the viewport changes, and rejects stale reads; this lets very short drags use a synchronous camera read. Updates coalesce to one immediate camera write per animation frame, with any final pending movement applied on release. Cancellation discards queued frames and late reads. Android uses camera zoom; Apple uses altitude with the same exponential delta. Reduced motion disables sheet/friend-card transitions and browser recenter animation. Native recenter moves are immediate. Web is a useful preview, not a substitute for real-device gesture/performance QA.

This keeps the initial experience accessible through Expo Go. Expo Maps is currently an alpha requiring development builds; Mapbox would add a token and native setup. Either can replace the native adapter later. See the [Expo map documentation](https://docs.expo.dev/versions/latest/sdk/map-view/) and [react-native-maps installation guide](https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md).

Map tiles require internet. App data, avatars, and fonts are local. On web, `postinstall` copies the installed MapLibre worker and its matching module into `public/maplibre`; Metro serves these locally and Expo includes them in exports. Do not edit or commit those generated vendor files. Evaluate tile licensing, quotas, and hosting before production traffic.

## iOS and Android

For iOS Simulator, install and finish Xcode setup, accept its license, and install a simulator runtime. Apple Maps needs no map API key. Expo Go on a physical iPhone may require signing into the same Expo account as the CLI.

For Android, install Android Studio, an emulator system image, or connect a USB-debugging-enabled phone. The Expo Go host provides its map configuration. A **standalone Android build** requires a Google Maps SDK for Android key restricted to the app’s package and signing certificate:

```sh
cp .env.example .env
# Set GOOGLE_MAPS_ANDROID_API_KEY for a standalone Android build.
```

The config plugin reads that variable at build time. Map client keys are embedded in apps by design and must be restricted; they are not backend secrets. Real `.env` files are ignored. `app.zuno.mobile` is a provisional bundle/package ID: choose final owned identifiers before release.

`eas.json` includes an internal Android APK / iOS simulator preview profile and a production profile. No EAS account, project, signing, store listing, or distribution has been configured. Those are later steps. Store submission also needs real auth, server-side privacy enforcement, policies, deletion workflows, signing, and device QA.

## Privacy and backend boundary

- No background location task or realtime broadcaster exists. Opening the app never asks for location permission.
- `locationForViewer` is the future sharing-policy seam: strangers are denied; hidden removes coordinates; approximate snaps to a stable broad grid and replaces the place label; temporary access expires; ghost mode overrides everything.
- Removing/blocking a friend revokes temporary access, removes map visibility, and prevents sending local messages. Reports are explicitly saved only locally.
- No stranger live locations are seeded or exposed. Public discovery is limited to meetups explicitly published in the selected named area. Exact meeting coordinates come only from the public venue catalog; other selectable places are approximate areas. Meetup attendance remains independent of ghost mode and personal location preferences.
- AsyncStorage stores fictional demo data, not credentials. Do not use it for future auth secrets or sensitive real-world location history.
- Reserved `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` variables are unused. Never ship a service-role key or other privileged credential in the client.
- The next backend phase must enforce relationships, consent, expiry, blocks, capacity, and meetup audiences on the server with PostgreSQL RLS. Client checks alone are not a security boundary.

## Quality checks

```sh
npm run typecheck
npm run lint
npm test                  # privacy, friendships, meetup policy, migration, zoom and clustering
npm run format:check
npm run check             # types + lint + domain tests
npx playwright install chromium
npm run test:e2e          # starts/reuses the web development server
npm run build:web
npm run build:native      # iOS + Android JS/Hermes exports, not signed binaries
```

Playwright covers map interaction, local chat persistence, incoming/outgoing requests, blocking, public meetup creation with edited date-times, non-friend joining, area filters, capacity validation, host editing/cancellation, profile editing, themes, ghost mode, repeated/reversed drags, and phone/tablet/desktop layouts. It writes screenshots and failure traces to ignored `test-results/`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an existing Chromium binary.

Validation for this milestone (October 1, 2026):

- Strict TypeScript, ESLint, formatting, 39 domain tests, and nine Playwright journeys. Screenshot checks cover 360×740 and 430×932 phones, 768×1024 tablet, and 1440×960 desktop, in light and dark themes, including selected friend cards and meetup details. Regression coverage includes quick drags, stale camera reads, preserved meetup duration, area-based venue defaults, and keeping/discarding unfinished forms.
- Web and iOS/Android JS/Hermes exports are checked separately from signed native builds.
- Android API 36 emulator: Expo Go launches and renders Zuno’s interface, but the installed Expo Go host’s Google Maps authorization fails (`Google Android Maps SDK: Authorization failure` for `host.exp.exponent`), producing a blank basemap. The retry after installation reproduced that error and also encountered emulator system responsiveness dialogs. A loading/unavailable message keeps the map failure explicit. Android map rendering and gesture/performance acceptance remain **unverified** until a working Expo Go map configuration or a development build with a correctly restricted Android Maps key is available.
- iOS is the current refinement target; Android device work is deferred. A fresh iOS JS/Hermes export passed after this refinement.
- iPhone 17 / iOS 27 simulator: visible Apple Maps, repeated short upward/downward thumb drags, zoom buttons, panning, recentering, avatar selection, and light/dark layouts. Created a public meetup with the native calendar/time wheel, verified end-time adjustment, software keyboard layout, draft protection, non-friend discovery/joining, full state, host capacity validation/editing, and cancellation retained in Joined. Membership persistence after reload and leaving were also checked in the preceding pass. Apple's ready callback avoids the earlier false loading warning.
- iPhone SE (3rd generation) / iOS 18.2 simulator: checked the 375×667 layout, both edge-drag directions, friend-card actions, friend-to-meetup creation with the invitation preselected, form scrolling, and native calendar sizing. These are simulator checks, not full physical-device or performance acceptance.

Saved visual checks: [phone meetup](docs/screenshots/meetup-phone.png), [dark phone friend card](docs/screenshots/friend-phone-dark.png), [iOS friend card](docs/screenshots/ios-friend-card.png), [iOS meetup](docs/screenshots/ios-meetup.png), [iOS dark discovery](docs/screenshots/ios-meetups-dark.png), [iOS dark creation](docs/screenshots/ios-create-dark.png), and [iPhone SE friend card](docs/screenshots/ios-se-friend-card.png).

No native frame-rate claim is made. Physical-device gesture sensitivity, VoiceOver/TalkBack actions, real pinch interactions and provider projection accuracy still require device QA. iOS uses the Expo Go-compatible community date/time picker; Android retains explicit local `YYYY-MM-DDTHH:mm` fields pending its refinement pass, and web uses browser date/time inputs.

The baseline dependency audit reported 10 moderate transitive findings through Expo’s Xcode/UUID tooling, with no high or critical findings. Its suggested forced fix would downgrade Expo to SDK 46; it has not been applied. Recheck on SDK updates.

## Asset notes

The Zuno spark and app icons are original vector-derived assets. Demo portraits are bundled from Unsplash; they represent fictional personas, not the pictured people. See [asset sources](assets/SOURCES.md). Fonts and icons retain their upstream licenses. No proprietary reference-product artwork is included.
