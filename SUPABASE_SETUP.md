# Zuno Supabase setup

## Deployment status

Project **Zuno app**, reference `incrduydvwsimzeojqdu`, Canada Central, existing Free organization. The app's ignored `.env.local` contains only its public client configuration. No database password, service-role/secret key or browser session is copied into the application.

**Applied previously:** `202610010001_account_foundation.sql`, owner-only `zuno_profiles` and self-account deletion, plus Site URL and exact allowed redirect `zuno://auth/callback`. Email auth/signup remain enabled. The initial hosted audit found only that profile table and zero profile rows.

**Applied and verified:** social migrations `202610020001`–`202610020006`, followed by owner-only onboarding `202610030001`. The existing social implementation was deployed unchanged. Public Realtime channels are disabled; Cron and the private avatar bucket match local configuration. Hosted tests passed 49 social + 18 onboarding checks, all rolled back. Final catalog comparison matched 282 objects with zero discrepancies. See [hosted evidence](docs/HOSTED_BACKEND_VALIDATION.md).

**October 13:** `202610130001_welcome_status.sql` applied and entered in migration history after the previously deployed Instagram migration. New profiles receive “Hey, I am available” with two-hour availability; onboarding no longer resets that to Busy. Existing user rows and all privacy/RLS settings remain untouched. Nine hosted regression checks and the 18 existing onboarding assertions passed with all synthetic data rolled back. Migration history retains the exact repository source (MD5 `2d6da9c91dcbcf07a22af2c5f879d12b`).

## Deployment safety and next configuration

The deployment is complete. **Do not rerun the social bundle or existing migrations.** Future schema changes must use new migration files and be tested before applying.

Preserve the exact mobile auth callback and email verification. As of October 13, 2026, **Google is enabled** after owner approval: the Zuno Google project has an External/Testing consent setup and a web OAuth client restricted to `https://incrduydvwsimzeojqdu.supabase.co/auth/v1/callback`. The client secret was transferred directly to Supabase provider settings; it is not a mobile environment variable or repository file. The owner-approved Google account is on the test-user list. Nonce checks remain enabled and users without an email remain disallowed. The public settings API and Google account-chooser redirect were verified. The owner then confirmed successful Google sign-in and return to Zuno on the installed build 4. Cold-start session restoration, sign-out and multi-account acceptance remain separate checks.

**Apple enabled October 13 after the owner's new approval**, superseding the earlier request to leave it disabled. Allowed native client ID: `app.zuno.mobile`; the OAuth secret is empty because iOS uses Apple's native identity-token flow. This does not configure browser-based Apple OAuth. Native entitlement/signing are present; the owner confirmed successful real Apple sign-in on the installed iPhone build 5. Phone remains disabled: the owner confirmed an SMS provider account still needs to be created. See the exact Twilio Verify setup in [PHONE_AUTH.md](docs/PHONE_AUTH.md). Complete verified SMTP for external testers as described in [auth architecture](AUTH_ONBOARDING_ARCHITECTURE.md). No paid service was created.

Migration history was reconciled on October 1, 2026: all eight existing versions are recorded in `supabase_migrations.schema_migrations`. Only bookkeeping schema/table/records were added; the 282-object application catalog was identical before and after. No migration was rerun. Before any future `supabase db push`, use `supabase migration list` and `supabase db push --dry-run` against the correct linked project; there should be no pending current migrations. Never blindly push, rerun or reset. `supabase/config.toml` is strictly local test configuration; **never run `supabase config push` with it**.

## Public app configuration

Variable names:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Use the Project URL and current publishable key from Supabase Connect. The app validates their format and rejects secret/service-role keys. These public values are intentionally bundled in a mobile app; server authorization protects data. Real environment files are ignored. No EAS or paid service was configured.

Metro must restart after an environment change. Native preparation passes only the allowed public variables to the child build without copying `.env.local` into staging. Configured builds show welcome when signed out, resume incomplete onboarding, and open the real map only after completion. They never silently show synthetic friends as real people. Unconfigured Release builds show a connection setup message; local preview is Development-only.

## Auth and photos

Phone signup is implemented through Supabase SMS OTP and shares the UUID-based onboarding/RLS model. Hosted phone authentication is currently disabled; configure an SMS provider before real-device phone testing. See [phone setup and local preview](docs/PHONE_AUTH.md). No phone column is added to public profiles.

Email magic links use PKCE/S256 and native secure randomness. Open the requested link on the **same iPhone** that initiated it. Exact callback parsing rejects implicit bearer-token URLs. Native sessions and flow verifiers use SecureStore/Keychain with device-only accessibility, not AsyncStorage; large sessions use atomic chunk replacement. Auth refresh pauses in the background. Browser preview does not initiate email sign-in.

The simulator uses a local ad-hoc signature so Keychain works without a Developer Team. Physical iPhones require normal Apple signing.

Avatars use the system photo picker and owner-prefixed paths in the private `zuno-avatars` bucket. Signed reads last 60 seconds; a previously issued URL can remain valid until expiry after a block. Account deletion first removes owned files through Storage, then invokes the authenticated self-delete RPC. No camera, microphone, photo-library-wide access or background location entitlement is requested.

## First hosted multiuser test

Use three disposable accounts controlled by the testers, with working email delivery. The owner email login has now been initiated for delivery verification; do not delete that identity as disposable test data. No authenticated hosted acceptance is claimed yet.

1. Sign in on each iPhone; test warm/cold magic-link callbacks, relaunch and session restoration. Set distinct usernames and profiles; sign out/in and verify persistence.
2. Find exact usernames, send/accept a request and verify the third account cannot read private chat or friends-only GPS. Remove and re-add friendship.
3. Enable location explicitly. Test Private, Friends and Public near the same map area; opt into speed/heading and confirm valid GPS speed/unit display. Test neighborhood precision, stale expiry, reduced accuracy and location denial.
4. Block a connected viewer and verify map/chat/discovery revocation without requiring it to reconnect. Confirm joining a meetup never enables location sharing.
5. Create/map/edit/cancel meetups; test Friends/Public/Invite-only, concurrent final-seat joins, leave and chat revocation. Send direct/group messages, reopen/reconnect, and load older history.
6. Upload/replace an avatar. A second account must not overwrite or delete it. Confirm account deletion on a disposable account only; check its files, profile, current location and related records are removed.
7. Airplane mode and backend errors must not claim successful writes. Reconnect and verify persisted state; background/foreground and logout must stop publishing. Offline GPS expires in 90 seconds.
8. Run the full physical-device checklist in TESTFLIGHT_READINESS.md. No physical-device/sign-in success is claimed until these checks are performed.

External onboarding also needs a real privacy policy, support contact, App Store privacy answers and a moderation process. Reports are stored but there is no staffed moderation dashboard or push notification service.

See [architecture and limits](SUPABASE_ARCHITECTURE.md), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [native deep links](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).
