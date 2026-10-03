# Phone signup and temporary testing

Updated October 2, 2026. The welcome screen has Email, Google, Apple and Phone. Real phone authentication uses Supabase Auth SMS OTP for signup and returning users, sharing the existing UUID-based profiles, onboarding, RLS and sign-out cleanup. No database migration is needed. Phone numbers stay in Auth, outside discoverable social profiles and logs.

Read-only hosted settings rechecked: email enabled; phone, Google and Apple disabled. Real SMS and OAuth sign-in are **not yet accepted**. No hosted settings were changed by this fix.

## Expo Go on iPhone and localhost

The previous test fixture worked only in a loopback browser. An iPhone running Expo Go therefore contacted the disabled SMS provider, stayed on phone entry and incorrectly started a resend countdown. The corrected native test path never sends an SMS or requests a hosted session.

1. Set `EXPO_PUBLIC_EXPO_GO_PHONE_PREVIEW=1` in ignored `.env.local` for **iOS Expo Go**. For the localhost browser, separately set `EXPO_PUBLIC_LOCAL_PHONE_PREVIEW=1`.
2. Restart with `npx expo start --go --lan`. Keep the Mac and iPhone on the same Wi-Fi, scan the displayed QR, and reload the Zuno project in Expo Go to receive the updated bundle. This is a development bundle, not a TestFlight upload or new Expo Go binary.
3. Choose **Continue with Phone**. Enter any ten-digit US number, such as `202-555-0123`, and press **Continue**. A leading `+1` is optional; formatting is normalized. Nine-digit US numbers are incomplete. International input still accepts an explicit country code.
4. On **Enter your code**, enter **000000** and press **Verify & continue**. Wrong codes keep the user on verification. Four digits cannot submit. Test-mode resend and changing the number have no cooldown.
5. The map opens with **Phone test mode · sample data** and a **Sign out of phone test** button. Sign out returns to welcome; entering Phone again starts a fresh flow.

This opens the **Local Explorer** sample account. It does not prove ownership of a number, create a Supabase user, exercise real onboarding, or grant access to hosted data. Only a signed-in marker is persisted: iOS AsyncStorage restores after an Expo Go restart; web sessionStorage lasts for the tab. Phone numbers and codes are never persisted. Sample edits remain in `zuno.local-phone.data.v1`; preview sign-out removes `zuno.local-phone.session.v1` and stops session services. The retired browser email/PIN fixture's marker/data are removed when the preview mounts.

The boundary requires `__DEV__` and either:

- iOS, `isRunningInExpoGo()` from Expo, and `EXPO_PUBLIC_EXPO_GO_PHONE_PREVIEW=1`; or
- web, an exact loopback hostname, and `EXPO_PUBLIC_LOCAL_PHONE_PREVIEW=1`.

Zuno's own development client, standalone iOS, TestFlight and production websites cannot use the bypass. Do not substitute `Constants.executionEnvironment` for exact Expo Go detection: a development client can share its StoreClient classification. The fixture is lazy-loaded and eliminated from production bundles. Both CI export validation and the iOS archive validator check for leaked fixture markers. Real authentication always asks Supabase to verify the submitted code, including all zeros.

## Google, Apple and email in Expo Go

These buttons are disabled with an explanation in phone test mode. The account layer also prevents external sign-in handoffs in Expo Go. No fake Google or Apple session is created.

- **Google:** this app uses Supabase browser OAuth with `zuno://auth/callback`. Expo Go cannot own that custom callback. Use an installed Zuno development/standalone build and configure Google OAuth in Supabase first. [Expo authentication guidance](https://docs.expo.dev/guides/authentication/).
- **Apple:** Expo's native Apple API can be exercised in Expo Go, but its identifiers differ from the standalone application. The Zuno Supabase Apple provider is disabled. Finish Zuno's Apple capability/provider configuration and validate its actual signed client. Do not treat an Expo Go Apple sheet as proof of Zuno authentication. [Expo Apple authentication documentation](https://docs.expo.dev/versions/latest/sdk/apple-authentication/).
- **Email:** hosted email is enabled, but the current magic link uses the same Zuno callback. Validate delivery and return-to-app in a Zuno build that owns that scheme.

The normal connected Zuno build retains its existing real provider implementations. Remaining provider/client credentials and Apple enrollment are setup blockers; this fix does not claim they are resolved. The blue floating gear is Expo Go's developer menu, outside Zuno's UI.

## Hosted SMS activation

1. Configure an SMS provider in the hosted project's Authentication → Providers → Phone settings. Provider credentials stay in Supabase, never in the app or GitHub.
2. Enable phone signup/sign-in with six-digit OTPs. Keep verification enabled; do not configure a shared test code for arbitrary real users.
3. Set SMS rate limits, permitted countries and abuse controls before public signup. If CAPTCHA is enabled later, implement its client challenge before rollout.
4. Test delivery to an owner-controlled iPhone, invalid/expired codes, resend, interrupted onboarding, returning users, logout and session restoration. Sample testing does not simulate delivery, billing or a real authenticated database account.
5. Update published privacy text and App Store privacy answers for authentication phone numbers. The existing iOS privacy manifest includes linked Phone Number data for app functionality without tracking.

Real SMS has a 60-second resend cooldown after a successful send or a rate-limit response. A provider-disabled/offline failure does not impose a false cooldown. Concurrency guards prevent overlapping requests. No contacts or SMS-reading permission is requested; iOS one-time-code autofill is supported.

Email-only and phone-only sign-ins can be separate accounts. Identities are not automatically merged. Use the same sign-in method to return to the same account. [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login).

## Remove before the next TestFlight upload

- Remove **both** `EXPO_PUBLIC_LOCAL_PHONE_PREVIEW` and `EXPO_PUBLIC_EXPO_GO_PHONE_PREVIEW` from local configuration and restart Expo.
- Delete `LocalPhonePreview.tsx`, its tests, guarded `AuthGate` branch, preview configuration helper and sample-repository override. Keep real Supabase phone authentication and its verification tests.
- Clear the preview session/data keys from the testing browser and Expo Go's AsyncStorage.
- Retain production-exclusion checks and the test proving the real server verifies an all-zero code.
- Validate real SMS delivery and update privacy disclosures before inviting phone-auth testers.

The October 2 removal reminder was delivered. The owner subsequently requested continued Expo Go testing with the temporary code; the removal checklist still applies before the next upload.

## Validation

- TypeScript and ESLint pass; **191 unit tests in 22 files** pass, including Expo Go/Release boundary guards, US normalization, native marker restoration, sign-out, optional storage failure, provider handoff guards and real server OTP verification.
- **Three phone browser journeys pass**: wrong number/code, bare US input, resend, changing international numbers, back navigation, reload, logout, unavailable providers and no stray text-node errors. No Supabase requests are emitted by phone preview.
- **Expo Go 57.0.9, iPhone 17 simulator / iOS 27:** bare US number reaches verification; wrong code rejected; immediate resend clears it; `000000` opens the native map. A full Expo Go restart restores the test session. Profile opens, sign-out returns to welcome, incomplete numbers show guidance, and number correction can retry immediately.
- Production web and iOS Hermes exports pass with **both preview flags deliberately enabled**. Both bundles pass fixture-exclusion checks. No dependency upgrade was needed.
- Simulator validation does not replace testing on the owner's physical iPhone. No signed archive, real SMS delivery, real Google/Apple session, upload, paid service or hosted-auth change was performed in this fix.
