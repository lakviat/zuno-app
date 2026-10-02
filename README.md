# Zuno

Zuno is an iOS social map with two-sided thumb zoom, an Apple Maps globe, friends, foreground location sharing, conversations and map-native meetups.

The app connects to the hosted Supabase social backend. The six existing social migrations and owner-only onboarding migration are deployed and validated: 67 hosted SQL/RLS checks passed, with zero differences across 282 audited objects. Welcome, minimal profile/location onboarding and sign-out cleanup now gate the existing map. Apple/Google provider setup, hosted email delivery and physical iPhone acceptance remain before a fully tested TestFlight beta. See [auth architecture](AUTH_ONBOARDING_ARCHITECTURE.md) and [hosted validation](docs/HOSTED_BACKEND_VALIDATION.md).

## Run

Use Node 22.13+ (tested with 22.23.1), Xcode and CocoaPods. Copy the variable names from `.env.example` into ignored `.env.local` and provide the existing project's public URL/publishable key. Never use a secret/service-role key.

```sh
npm ci
npm run ios:preview
```

`ios:preview` builds a standalone Release simulator app and launches it. It does not require an Apple Developer Team. Normal development uses `npm run ios`; browser preview uses `npm run web`. iOS is the current validation scope; Android is deferred.

With valid Supabase configuration, sign in from the welcome screen on iOS, complete onboarding, then open the map. No demo world is uploaded or used as a fallback. With no configuration, an explicitly labeled local sample world remains available for development and browser regression tests; see [local-preview guide](docs/LOCAL_PREVIEW.md).

### Temporary localhost phone preview

For browser-only sample testing, put `EXPO_PUBLIC_LOCAL_PHONE_PREVIEW=1` in ignored `.env.local`, run `npm start`, and open `http://localhost:8081`:

1. Choose **Continue with Phone** from the four-method welcome screen.
2. Enter any international-format number, such as `+1 202 555 0123`.
3. Enter **000000** (six zeros). No SMS is sent.

This opens the **Local Explorer** sample profile. **Sign out of local preview** clears the tab session. Sample edits use a separate browser storage key; no phone number/code is stored and no Supabase account/session is created. Email/PIN test login has been removed. Other providers continue to use real authentication in the iOS app.

The bypass requires **all four**: development build, web platform, an exact loopback hostname, and the explicit flag. It cannot run on native iOS, a LAN hostname, TestFlight, or a production website. The entire fixture module is excluded from production bundles. Remove the flag and restart Expo to disable it. Remove the fixture before the next TestFlight upload; see [phone-auth setup and removal checklist](docs/PHONE_AUTH.md).

## Continuous integration

`.github/workflows/build.yml` runs typechecking, lint, unit tests, formatting, browser journeys, web export, and iOS JavaScript/Hermes export on pushes to `main` and pull requests. Export validation checks that local test authentication is absent even when its flag is deliberately set. Export artifacts contain no live environment configuration. Native signing/archive/upload remains a separate owner-controlled step. This Expo project has no Docker image/container to build.

Browser regression tests use isolated port **8082**, leaving your interactive Expo server on **8081** running.

## Connected behavior

- Email magic links with PKCE, Apple, Google and phone/SMS signup; native Keychain sessions and account deletion. Hosted providers require their own configuration.
- Profile/username/bio/availability and private avatar uploads.
- Exact-username discovery, requests, accepted friends, removal and bilateral blocking.
- Private by default; choose Friends or Public, exact/neighborhood precision and optional speed/heading, then explicitly enable foreground device location. Backgrounding stops publication.
- Durable private/group chat with realtime refresh and older-message pagination.
- Geographic meetup discovery, selected map spots, audiences/invitations, capacity-safe join/leave, host edits/cancellation and membership-gated chat.
- Server authorization, PostGIS, expiry and private recipient inboxes. Realtime carries invalidations; fresh reads recheck permissions and do not replay old GPS.

## Architecture and verification

`src/backend/` owns Supabase configuration, Auth session support, social commands/subscriptions and avatar access. `AppContext` connects the existing domain/UI to those commands; cloud state is account-scoped and never saved as a client-controlled database snapshot. Existing native map/edge zoom and motion interpolation are preserved. `supabase/migrations/` is the schema source of truth.

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
# Start the isolated local stack as documented before running:
npm run test:backend
npm run ios:archive:unsigned
```

Browser journeys intentionally use an isolated configuration-free source copy. Real multiuser Auth/PostgREST/Realtime/Storage tests run separately against the disposable local Supabase stack. They never reset or create test accounts in the hosted project.

- [Backend architecture, security and validation](SUPABASE_ARCHITECTURE.md)
- [Hosted deployment and first multiuser test](SUPABASE_SETUP.md)
- [Current TestFlight readiness and Apple steps](TESTFLIGHT_READINESS.md)
- [Historical native/dependency audit](docs/TESTFLIGHT_AUDIT_2026-10-01.md)
- [Asset attribution](assets/SOURCES.md)

The owner has reauthenticated Xcode; paid membership and real signing remain pending. No signed upload, public app release or paid service has been performed. See [distribution checkpoint](docs/TESTFLIGHT_DISTRIBUTION.md). Local credentials, signing material, build outputs and private account/dashboard screenshots are excluded from source control.
