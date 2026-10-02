# Zuno — signed TestFlight distribution

Updated October 1, 2026 (New York). This records the real distribution attempt and supersedes older statements that Apple login/upload were not authorized. TestFlight upload is authorized; public App Store submission/release and public beta links are not.

## Current checkpoint

| Item                                                    | Verified state                                                                                                                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Developer Team                                    | BLOCKED — owner reauthenticated Xcode; only Personal Team is listed. Refreshed Developer account shows Pending / Purchase your membership.                                                                        |
| Bundle ID                                               | `app.zuno.mobile`, preserved; paid-team ownership/availability not verified.                                                                                                                                      |
| App Store Connect                                       | BLOCKED — “Your Apple Account isn't enabled for App Store Connect.” No app record created.                                                                                                                        |
| Apple Sign In                                           | PARTIAL — native flow/entitlement implemented; paid App ID/provider and real login tests pending.                                                                                                                 |
| Google Sign In                                          | PARTIAL — dedicated Google project `zuno-ios-20261001` (display name Zuno) created; OAuth consent/client/provider setup unfinished after Chrome disconnected. No billing was connected or paid resource deployed. |
| Email Auth                                              | PARTIAL — one hosted request accepted in Release simulator. Owner receipt and callback/session still unverified.                                                                                                  |
| Signed iPhone Release / signed archive                  | BLOCKED, not attempted. No valid signing identities were present. Unsigned archive validation is separate below.                                                                                                  |
| Upload / processing / internal testing                  | BLOCKED; no upload or testing group created.                                                                                                                                                                      |
| Installed on physical iPhone                            | NO. Connected iPhone 15 Pro Max detected; Developer Mode was disabled when inspected.                                                                                                                             |
| Physical smoke / live location / speed-heading / logout | NOT RUN on physical device. Prior local/SQL/simulator checks do not substitute.                                                                                                                                   |
| External testing                                        | BLOCKED — internal install/physical smoke, provider acceptance, legal URLs and Beta App Review remain. No invitations/public link.                                                                                |

Version **0.1.0**, next build **2**. Build 1 was only validated locally. Recheck App Store Connect for existing build numbers once account access becomes available; do not reuse an uploaded number.

## Work completed in this attempt

- Refreshed Apple membership and App Store Connect status; handed Xcode password prompt to owner, who completed sign-in. No password was read or saved.
- Detected the connected physical iPhone; documented Developer Mode requirement for direct Xcode deployment (not required for TestFlight).
- Reconciled all eight hosted migration versions using metadata-only, fingerprint-guarded bookkeeping inserts. Exact 282-object before/after application catalog match; see [hosted evidence](HOSTED_BACKEND_VALIDATION.md).
- Created a dedicated Google Cloud project for Zuno OAuth without touching unrelated projects or enabling billing. Chrome disconnected before consent/client setup.
- Sent one requested email login from the Release simulator to the owner-provided address; no delivered/verified-session claim.
- Added explicit signed device/archive modes, preserving unsigned default. Added signature, Team, profile expiry, Apple entitlement and absent-APNs checks. Artifacts must match the current bundle ID/version/build.
- Fixed Xcode UI archive configuration: managed `.xcode.env.local` now contains only the allowlisted public app settings and Node path, so Organizer builds retain the same hosted backend without inheriting a terminal environment. No private environment file is copied.
- Prepared build 2. Added owner Team loading from ignored local environment; no Team was invented or set.

## Signing commands

Use Node 22.13+, Xcode and CocoaPods. Put the **paid** Team ID in ignored `.env.local` as `ZUNO_APPLE_TEAM_ID`, or provide it in the environment. This is native build metadata, not an app credential. The app's existing public Supabase URL/publishable key remain in ignored local configuration; never substitute a service-role key.

```sh
# Fresh workspace only; safe before paid Team activation.
npm run ios:prepare

# Direct Release build for the connected physical iPhone. No install/upload.
npm run ios:archive:signed -- --device=<DEVICE_UDID>

# Signed generic iPhone Release archive. No export/upload.
npm run ios:archive:signed
```

The signed modes explicitly allow Xcode automatic provisioning using the already signed-in owner account. They require a ten-character Team ID and hosted backend configuration before invoking native tools. `latest-signed-archive.txt` is separate from the unsigned artifact pointer. Signed verification checks nested code signatures, expected Team/app identifier, profile expiry, Sign in with Apple and no APNs entitlement. A development-signed archive is normal before App Store distribution re-signing; this script does not claim Apple server validation or TestFlight eligibility.

Managed workspace: `/Users/nurlanmirovich/Library/Developer/Zuno/TestFlight-60d5288d0b/source/ios/Zuno.xcworkspace`. Open this workspace, scheme Zuno. Do not use the stale generated repository `ios/` copy. Regeneration reads `app.config.ts`; do not make the only permanent configuration change in generated Xcode files.

Keep Sign in with Apple enabled. Push delivery, Background Modes, Associated Domains and Keychain Sharing remain disabled. Foreground location and normal app Keychain access do not need those capabilities.

## Encryption review awaiting owner declaration

Observed HTTPS/WSS transport, system Keychain for session storage, native random values and SHA-256 for Apple nonce/PKCE through Expo Crypto (Apple CommonCrypto/Security). Expo Crypto also includes AES wrappers that delegate to Apple's CryptoKit; Zuno does not call those APIs. No custom cryptographic implementation, OpenSSL or third-party encryption SDK was found in the installed native dependency graph. No end-to-end chat encryption is claimed.

Apple states that encryption built into the operating system is typically exempt from encryption-document upload requirements. Proposed `ITSAppUsesNonExemptEncryption = NO` remains **unset until owner confirmation**. This is an engineering inventory, not a legal certification; regional declarations and any reporting remain the owner's responsibility. Sources: [Apple encryption guidance](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations), [Info.plist declaration](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption).

## Beta metadata prepared for App Store Connect

**App name:** Zuno. **Primary language:** English (U.S.). **Proposed SKU:** `zuno-ios` (internal only; use only if a new record is needed). Preserve the bundle ID above and inspect existing apps before creating a record.

**Beta description:** Zuno is a social map for connecting with friends, choosing who can see your foreground location, planning meetups, and chatting. This early beta uses the hosted Zuno backend. Location sharing is optional and stops when the app is backgrounded or the user signs out. Push delivery is not available in this beta.

**What to Test:** Test account creation, profile onboarding, map/location behavior, privacy modes, friendships, realtime location updates, messaging and meetups. Please report crashes, incorrect map/location behavior, authentication problems and privacy/visibility issues. Specifically test Public/Friends/Private changes and signing out while sharing location.

Feedback/tester email supplied by owner in chat; enter directly in App Store Connect. Do not invent reviewer telephone, legal entity/contact, Terms or Privacy URLs. Owner confirmed no public legal pages exist. Current app URL variables are intentionally empty.

## Owner-dependent continuation

1. Resolve paid membership activation for the intended Apple account. The currently authenticated account shows Pending; do not purchase twice if payment is processing. Confirm the paid Team appears in Xcode and App Store Connect permits access.
2. Enable Developer Mode on the connected iPhone for direct Xcode deployment; restart and confirm on the phone. Preserve the same device for subsequent TestFlight installation.
3. Reconnect Chrome's Codex extension. Resume the already-created Zuno Google project; do not create a duplicate.
4. Complete Google consent/client and Supabase provider settings. Use the hosted Supabase callback for the web OAuth client and `zuno://auth/callback` for the app redirect; the existing flow is browser OAuth/PKCE, not a native Google SDK. Request owner confirmation at the actual access/credential/terms step. Keep client secrets only in server provider settings.
5. Register/select explicit Apple App ID with Sign in with Apple and automatic signing. Align Supabase Apple audiences with the native bundle ID; do not introduce a browser Apple flow or unnecessary private keys.
6. Verify receipt and the same-device email callback, then new/returning/cancelled provider flows, onboarding, restore and logout. An accepted email request is insufficient. Configure external SMTP if required for non-team testers; do not purchase a service automatically.
7. Provide real public Privacy/Terms pages and reviewer contact information. Confirm encryption declaration and accurate privacy labels.
8. Inspect/create the ASC iOS record, then build/install signed Release and perform device acceptance. Archive and validate using Organizer; upload via App Store Connect distribution, **not TestFlight Internal Only**.
9. Wait for processing/compliance; create/select **Zuno Internal Beta**, add build and eligible owner tester. Install using TestFlight on the iPhone.
10. Record actual on-device results: real CLLocation fix, moving GPS speed/course, hosted durable location updates, private Realtime connection, Public/Friends/Private, immediate logout observer/subscription/session shutdown. Test two accounts/devices for visibility and delivery; distinguish unavailable GPS course from a fabricated value.
11. Only after internal installation and smoke pass, prepare **Zuno External Beta** for review. No public link, external invitations or public App Store submission without separate authorization.

## Validation

Prior baseline: 136 tests, 11 local Supabase integration checks, 67 hosted SQL/RLS assertions and 282-object catalog comparison passed; Release simulator and unsigned device archive passed. Current migration-ledger execution test and before/after catalog comparison passed. **Current build 2: unsigned arm64 iPhone archive PASS** (`/Users/nurlanmirovich/Library/Developer/Zuno/TestFlight-60d5288d0b/Zuno-unsigned-build2-xcode-environment.xcarchive`). **Current checks: TypeScript PASS, ESLint PASS, 136/136 tests PASS**. Signed-mode preflight checks correctly refuse absent Team/invalid device arguments before native tooling. Provisioning-profile Date/Data extraction was checked with the real macOS plist tool. Logs: `release-artifacts/testflight-build-2.log` and `testflight-setup-checks.log`. The signed path itself cannot be validated until a paid Team/profile is available.

A second unsigned build-2 archive also **passed with all terminal backend variables removed**. Artifact inspection confirmed the correct hosted URL/publishable key and callback remained bundled through the generated Xcode environment. Evidence: `release-artifacts/xcode-environment-archive.log` and `xcode-environment-verification.json`.

Physical-device acceptance, real provider/email callback, Apple server archive validation and TestFlight processing remain unverified.

## Files changed in this distribution attempt

Existing earlier application/backend changes were preserved. This attempt changed:

- `app.config.ts` — build 2.
- `package.json` — explicit signed archive command.
- `scripts/ios-distribution.mjs` — signed/device options and persistent public Xcode build environment.
- `scripts/verify-ios-release.mjs` — exact artifact identity/build and optional signing/profile checks.
- `scripts/backend-env.mjs` — nonsecret native Team metadata allowlist.
- `TESTFLIGHT_READINESS.md`, `SUPABASE_SETUP.md`, `SUPABASE_ARCHITECTURE.md`, `docs/HOSTED_BACKEND_VALIDATION.md` — updated current facts/history status.
- `docs/TESTFLIGHT_DISTRIBUTION.md` — this status, handoff, beta metadata and signing instructions.
- `docs/screenshots/apple-membership-pending.png`, `app-store-connect-unavailable.png`, `xcode-personal-team-only.png`, `supabase-history-reconciled.png` — evidence.

Build logs, catalog snapshots and the applied metadata-only SQL remain in ignored `release-artifacts/`. No commit or external Git push.
