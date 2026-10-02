# Phone signup and temporary local testing

The welcome screen now has Email, Google, Apple and Phone. Phone authentication uses Supabase Auth's SMS OTP flow for both signup and returning users. Existing UUID-based profiles, onboarding, RLS and sign-out cleanup are shared by every provider. No database migration is needed. Phone numbers remain in Supabase Auth; they are not added to discoverable social profiles or logs.

Hosted settings checked on October 1, 2026: email enabled; phone, Google and Apple disabled. This change does not claim successful real SMS delivery.

## Hosted activation

1. Configure an SMS provider in the hosted Zuno project's Authentication → Providers → Phone settings. Provider credentials stay in Supabase, never in the app or GitHub.
2. Enable phone sign-in and phone signup with six-digit OTPs. Keep verification enabled; do not configure a shared test code for arbitrary real users.
3. Set appropriate SMS rate limits, permitted countries and abuse controls before making signup public. If CAPTCHA is enabled later, add its supported client challenge to the flow before rollout.
4. Test delivery to an owner-controlled iPhone, invalid/expired codes, resend, interrupted onboarding, returning accounts, logout and session restoration. Real delivery and provider billing are not simulated by localhost testing.
5. Update published privacy text and App Store privacy answers to include phone numbers used for authentication. The app's configured iOS privacy manifest now includes linked Phone Number data for app functionality, without tracking.

The app normalizes international numbers, requires a country code, accepts six digits, prevents concurrent requests, and applies a 60-second resend cooldown. Offline, unavailable-provider and invalid-code errors keep the user signed out. No contacts or SMS-reading permission is requested. iOS one-time-code autofill is supported.

Email-only and phone-only sign-ins can represent separate accounts. This change does not merge identities or accounts automatically. Use the same sign-in method to return to the same account.

Reference: [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login).

## Local preview only

Set `EXPO_PUBLIC_LOCAL_PHONE_PREVIEW=1` in ignored `.env.local` and run Expo on localhost. Choose Phone, enter any syntactically valid international number and use **000000**. No SMS, hosted user or backend session is created. The preview displays a sample-data banner, uses a separate sample storage namespace and stores only a signed-in marker in sessionStorage. Phone numbers/codes are not persisted. Sign-out removes the marker; closing the tab ends that preview session.

The previous email/PIN login and its screenshot were removed. Its old session marker and sample data are retired when the new preview mounts.

Guard conditions: `__DEV__`, web platform, exact loopback hostname, explicit opt-in flag. Native and Release authentication always verifies codes with Supabase, including a submitted all-zero code. The preview module is removed from production bundles and checked by CI and the iOS archive validator.

## Remove before the next TestFlight upload

- Remove `EXPO_PUBLIC_LOCAL_PHONE_PREVIEW` from local configuration and restart Expo.
- Delete `LocalPhonePreview.tsx`, its guarded `AuthGate` branch, the preview configuration helper and sample-repository override. Keep real phone authentication and its tests.
- Clear `zuno.local-phone.session.v1` and `zuno.local-phone.data.v1` from the testing browser.
- Retain production-exclusion checks and the test proving the server rejects an invalid all-zero code.
- Verify real SMS delivery and update phone-number privacy disclosures before inviting phone-auth testers.

No SMS provider purchase, hosted Auth weakening, TestFlight upload, or new secret is part of this change.

## Validation for this change

- 171 unit tests across 21 files passed, including phone-only account onboarding, concurrent-send protection, unavailable SMS, invalid/expired OTP and server verification of the local fixture code.
- All 11 existing social/map browser journeys passed in one run. Both phone browser journeys passed: four visible methods, invalid number/code, resend cooldown, number correction, a second country, refresh restoration and logout. No Supabase requests were emitted by local preview.
- TypeScript, ESLint, Prettier and workflow YAML validation passed.
- Production web and iOS Hermes exports passed with the local flag deliberately enabled. Both bundles passed fixture-exclusion checks.
- Connected iOS configuration includes Phone Number in its privacy manifest; no new system permission or capability was added.
- Real SMS delivery and a fresh native signed archive were not tested. Hosted phone/Apple/Google providers remain disabled. Existing native archive evidence predates this change.
- A one-time removal reminder is scheduled for October 2, 2026 at 10 AM America/New_York; the next-upload removal checklist above remains the release handoff.
