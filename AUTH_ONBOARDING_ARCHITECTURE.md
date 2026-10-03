# Zuno authentication and onboarding

Implemented against the existing Supabase social backend on October 1, 2026. No map redesign, provider credentials embedded, Apple-account login, TestFlight upload or paid service creation.

## Status and provider boundaries

- **Apple: PARTIAL.** Native Apple sheet, cryptographic nonce/state, Supabase ID-token exchange, cancellation and first-name capture implemented. `usesAppleSignIn` and Expo's Apple plugin prepare the entitlement. Hosted Apple provider is currently disabled; owner Team/App ID configuration and a physical iPhone sign-in remain required.
- **Google: PARTIAL.** Supabase PKCE browser authentication, exact app callback, cancellation and returning-account handling implemented. Hosted Google provider is disabled pending OAuth client setup. Provider name initializes an unfinished profile once; customized names are never overwritten. Provider email stays in Auth. Photos are optional; Zuno uses its own private Storage photo rather than repeatedly replacing it with an external provider image.
- **Email: PARTIAL.** One magic-link flow creates or restores an account, validates email, offers a 60-second resend delay and gives neutral delivery/error copy. Hosted email provider is enabled. Owner-controlled tester email/SMTP configuration is still needed to verify hosted delivery. No real email was sent during this task.
- **Phone: PARTIAL.** Ten-digit US entry (optional `+1`), international phone entry, Supabase SMS OTP signup/sign-in, six-digit verification, resend cooldown and the existing profile/location onboarding are implemented. Hosted phone provider is disabled pending SMS provider setup and real delivery testing. The temporary `000000` fixture requires development mode and explicit opt-in for either iOS Expo Go or a loopback browser. It is excluded from Release and creates no hosted identity. Expo Go shows other providers as unavailable rather than launching unsupported callback flows. See [phone setup and validation](docs/PHONE_AUTH.md).
- **Notifications: PARTIAL.** Optional permission/status/Settings and contextual explanation component implemented, with a persistent Not Now preference. `pushDeliveryReady=false` deliberately gates the native prompt because there is no sender or private multi-device token registry. Account settings accurately explain that push is unavailable. No APNs entitlement, background mode or token upload was added. Wire this gate and the contextual component after a successful friendship/conversation/meetup action only when delivery exists.

## Startup and current-user state

`AccountProvider → AuthGate → account-keyed AppProvider → LiveLocationProvider → existing WorldScreen`.

1. Supabase restores the Keychain session behind the bootstrap view.
2. No session → welcome with Apple / Google / Email / Phone.
3. Session + missing/unavailable profile → retry view. A temporary network failure does not erase credentials.
4. Session + `step=profile` → minimal profile.
5. Session + `step=location` → combined location explanation/privacy choice.
6. `step=complete` with dedicated completion timestamp → map.

The map does not mount while authentication/onboarding is unresolved. Supabase Auth UUID remains the sole account identity. Account changes invalidate in-flight profile loads, close transport and discard the account-keyed social state. Auth state listeners stay synchronous to avoid Supabase lock reentry.

## Profile and persistence

Migration `202610030001_onboarding.sql` adds owner-only `zuno_onboarding`: stage, small profile draft, completion and update timestamps. It references `auth.users.id` and cascades on deletion. Existing profile/privacy tables and commands are reused.

RPCs:

- `zuno_onboarding_state`: bootstrap existing profile/privacy, create progress once, initialize provider name only if no customized profile exists.
- `zuno_save_onboarding_draft`: save debounced name/username/bio without marking completion.
- `zuno_username_available`: authenticated availability check; lowercase 3–40 letters, numbers or underscores. Existing database unique index remains authoritative.
- `zuno_onboarding_profile`: atomically validate/save profile and advance to location.
- `zuno_complete_onboarding`: reject skipped profile, atomically persist visibility and completion; retries cannot broaden a completed user's sharing choice.

Name/username required; photo/bio optional. Saved drafts survive relaunch. A brief unsaved keystroke window exists during the 600 ms debounce or network failure; the UI reports unsaved drafts and Continue waits for queued saves. Final profile/step writes are atomic. Apple first-authorization names are captured in device-only SecureStore until their owner draft is saved, then removed. Apple credentials are never saved as profile data.

The system photo picker grants access to one selected image. Images are resized to at most 512 px on the longest edge, converted to JPEG at 0.8 quality, stripped of metadata and checked against the 5 MB bucket limit. Upload failure does not destroy progress; photo can be skipped. Profiles store an owner-prefixed object path. Signed avatar URLs have a 60-second lifetime and their cache is cleared at session end.

## Location and privacy

One explanation screen precedes any native request. Private is the default. Friends/Public require an explicit selection; values are the existing `private`, `friends`, `public` model. Continue without location is always available. Denial leaves exploration/meetups usable, with an explanation of limitations. Once `canAskAgain=false`, offer Settings instead of prompting repeatedly. Reduced precision pauses movement sharing; Settings is available later.

The onboarding opt-in activates foreground location only after completion and a fresh permission check. Returning sessions do not silently restart a previous launch's location sharing: enable it through Privacy. The central publisher also requires authenticated identity, current privacy/audience, explicit enabled state and foreground lifecycle. Private mode never sends a cloud GPS update. No Always permission, background location or geofencing is requested.

Speed/heading, filtering, throttling, per-recipient authorization and 90-second expiry retain the existing backend architecture. Changing audience invalidates queued updates. Location publishing derives ownership from `auth.uid()`.

## Session persistence, deep links and sign-out

Supabase PKCE session/flow material uses device-only Keychain, encoded in atomic size-bounded chunks. Browser preview uses memory only. Foreground/background transitions start/stop automatic refresh. Callback parsing accepts only `zuno://auth/callback` with a code (and optional flow ID); implicit token URLs and foreign hosts are rejected. Warm Linking events, initial cold URLs and browser results share deduplication for the app launch. New links must open on the same initiating iPhone.

Sign-out is separate from deletion. Account settings show a confirmation. Cleanup order:

1. Synchronously revoke GPS generation, remove the native watcher and clear own motion.
2. Abort user RPCs, invalidate queued location work, close private Realtime and clear user caches.
3. Attempt server location removal with a bounded deadline; failures expire through the existing 90-second rule and five-minute cleanup cron.
4. Call supported `auth.signOut({scope:'local'})`, bounded by network deadlines.
5. Revoke the custom session storage, remove session/PKCE/user items, and persist a signed-out tombstone. Call the supported sign-out API again with empty storage to invalidate late refresh work. The tombstone rejects credential writes/restoration until an explicit new sign-in.
6. Clear onboarding/profile state and show welcome. Next account gets a new social provider and empty sensitive state.

The tombstone covers the SDK edge case where an already-expired session cannot refresh during offline sign-out. No private Supabase SDK methods are used. In-flight requests may already have reached the server before cancellation; no new GPS requests can be queued after local revocation. A failed remote logout cannot revoke server refresh tokens while offline; local credentials are removed and markers expire rather than remaining LIVE indefinitely.

Harmless theme and zoom explanation preferences persist separately in `zuno.device.preferences.v1`. Social/profile/message/location state is not persisted in that preference record. No push token exists to detach.

Existing account deletion removes owned Storage files before calling the established self-delete RPC. The new progress row cascades with Auth deletion. Sign-out never deletes account content.

## Authorization and hosted validation

UI routing is not authorization. New progress rows have SELECT-only owner RLS; direct client writes and all anonymous access are revoked. RPCs derive the actor from Auth, use an empty search path, and cannot target an arbitrary owner. No social policy was broadened by this migration.

The prior six social migrations were deployed unchanged first. 49 hosted role/JWT multi-user assertions passed. Then onboarding migration and 18 additional hosted assertions passed. Every test transaction rolled back, verified clean. Final local/hosted catalog comparison: **282 objects, zero differences**, including policies/grants/functions/constraints/bucket/cron. Public Realtime channels are disabled.

See `docs/HOSTED_BACKEND_VALIDATION.md`, `supabase/verification/` and screenshot evidence. Hosted SQL tests are not a substitute for actual hosted GoTrue email sessions, WebSocket delivery or iPhone GPS.

## Tests and limitations

Automated provider/device mocks cover AUTH-01–12, 16–19 and callback deduplication, concurrent taps and invalid email. Database/transport tests cover AUTH-13–15, 17, 18 and 20: audience changes, revocation, queue invalidation, identity pinning, expiry and reconnect. Local Supabase integration exercises actual Auth/PostgREST/Realtime/Storage with three disposable users. Native provider credentials, actual iPhone permissions/GPS, email delivery and cold/warm external-provider handoff still require manual hosted/device acceptance. Mocked Apple/Google passes are not real provider certification.

## Configuration names (no values)

App/build: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `ZUNO_APPLE_TEAM_ID`.

Server/provider settings only: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_EMAIL`, `SMTP_SENDER_NAME`. These labels describe dashboard fields; they are not mobile environment variables. No service-role credential is needed in Zuno.

## Owner configuration and acceptance

1. Enroll/select the Apple Developer Team; confirm ownership of `app.zuno.mobile`. Enable Sign in with Apple for that App ID and regenerate provisioning. No Apple password belongs in this repository/chat.
2. In Supabase Authentication → Providers → Apple, enable native Apple ID-token sign-in with the exact application bundle ID as an allowed client ID. Native iOS ID-token flow is implemented; web Apple OAuth/services-ID/rotating signing secret setup is outside this flow. Use real iPhone testing, including first-time name, returning user and cancellation.
3. Create/configure the Google OAuth consent screen and web OAuth client. In Google, allow the exact callback displayed by the Supabase Google provider (`/auth/v1/callback` on this project's domain); store the client ID/secret in the Supabase provider settings. Keep the mobile allowlist exact `zuno://auth/callback`. Add controlled test users while consent is in testing mode.
4. Configure verified email delivery for external TestFlight testers, or identify eligible organization team tester emails for initial checks. Preserve verification; do not disable it to work around SMTP.
5. Provide real HTTPS Terms and Privacy pages. Review App Store privacy labels, support contact and export-compliance answer before distribution.
6. Test three owner-controlled hosted accounts on signed iPhones: new/returning/cancel flows; terminate during each onboarding stage; offline startup; denied/reduced location; Private→Friends→Public; driving sign-out; A→B account switch; blocked connected viewer; chat/meetup persistence; lost-network recovery; deletion on disposable accounts only.
7. Archive signed Release, create/connect App Store Connect record, upload and begin internal TestFlight testing when the above boundaries are satisfied. No upload has been performed.

Official implementation references: [Supabase Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [native redirects](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Expo Apple](https://docs.expo.dev/versions/latest/sdk/apple-authentication/), [Expo notifications](https://docs.expo.dev/versions/latest/sdk/notifications/). Installed SDK source was checked for nonce forwarding, sign-out failure behavior and notification entitlements.

## Files changed for this authentication/deployment request

Existing earlier backend work was preserved. These are the meaningful changes made for this request (not a claim that all other pre-existing uncommitted files were created here):

- Entry/UI: `App.tsx`, `src/components/Brand.tsx`, `src/features/account/AccountProvider.tsx`, `AuthFlow.tsx`, `AccountScreen.tsx`, `NotificationSettings.tsx`.
- State/privacy: `src/state/AppContext.tsx`, `src/features/location/LiveLocation.tsx`, `src/features/privacy/CloudPrivacyScreen.tsx`, `src/services/location.ts`.
- Backend client: `src/backend/client.ts`, `sessionStorage.ts`, `sessionLifecycle.ts`, `onboarding.ts`, `social.ts`, `useAvatarUrl.ts`, `avatarUpload.ts`; `src/features/profile/AvatarUpload.tsx`.
- Database: `supabase/migrations/202610030001_onboarding.sql`; `supabase/verification/catalog.sql`, `multi-user.sql`, `onboarding.sql`. The six prior social migrations were deployed unchanged.
- Tests: `src/features/account/AccountProvider.test.tsx`, `src/backend/sessionStorage.test.ts`, `social.test.ts`, `socialDatabase.test.ts`, `src/services/location.test.ts`, `vitest.config.mts`.
- Native/configuration: `app.config.ts`, `plugins/with-ios-distribution.js`, `native/ios/Podfile.lock`, `package.json`, `package-lock.json`, `.env.example`, `scripts/backend-env.mjs`, `scripts/verify-ios-release.mjs`.
- Documentation/evidence: this file, `SUPABASE_SETUP.md`, `SUPABASE_ARCHITECTURE.md`, `TESTFLIGHT_READINESS.md`, `README.md`, `docs/HOSTED_BACKEND_VALIDATION.md`, and hosted/native screenshots in `docs/screenshots/`.

No Git push or commit was made. Private environment values remain ignored. Unrelated `.idea/` work was not modified.

## Final validation results

- 136 tests / 20 files PASS (including actual PostgreSQL/PostGIS policies and mocked provider/device boundaries).
- 11 actual local Supabase Auth/PostgREST/Realtime/Storage checks PASS; disposable accounts cleaned; local stack stopped with backup preserved.
- 67 hosted SQL/RLS checks PASS; 282 audited objects match; zero schema/policy discrepancies. Hosted API also denies anonymous social/onboarding calls with HTTP 401.
- 11 existing browser journeys PASS across full run plus unchanged isolated gesture rerun. The gesture case initially exceeded its 45-second deadline during concurrent native builds; isolated run passed in 34.2 seconds.
- TypeScript, ESLint, Prettier, Expo dependency compatibility and Git whitespace checks PASS.
- Final unsigned device Release archive PASS: `/Users/nurlanmirovich/Library/Developer/Zuno/TestFlight-60d5288d0b/Zuno-unsigned-20261002T020730264Z.xcarchive`.
- Final Release simulator build/install/launch PASS on iPhone 17 / iOS 27. Welcome, email field, keyboard, invalid-address disabled state and Back verified visually; no email or provider login initiated.
- Overall real-provider/hosted-device acceptance remains **PARTIAL** for the owner configuration and device steps above. The app is technically prepared for signing; nothing has been uploaded.

Operational discrepancy to retain: migrations were executed through the dashboard, so CLI migration history has not been synchronized. Before any future `supabase db push`, verify the hosted schema and repair history for the already-applied versions; do not rerun them or use the local test configuration to push hosted Auth settings.
