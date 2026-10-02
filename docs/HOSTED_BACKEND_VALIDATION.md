# Hosted backend validation — 2026-10-01

Project: **Zuno app** (`incrduydvwsimzeojqdu`). The six existing social migrations were applied unchanged, after the account foundation, in one atomic transaction. No redesign, paid service, Apple upload, or real user data modification.

Deployment body SHA256: `9c4ab304caccfdd59c0a9b00072debb29aa9677b70b0a9dd2832104a081886e6`.

- **PASS:** 260 hosted schema objects compared with the actual local Supabase PostgreSQL stack; **zero discrepancies**. Comparison includes function source/security/search paths, table/column/constraint/index definitions, grants, every Zuno RLS policy, triggers, private avatar bucket and cleanup cron.
- **PASS:** 49 hosted multi-user database assertions under three authenticated roles/JWT identities. Profiles/privacy, friendship roles, location audiences/expiry, blocking, private inbox access, chats, event capacity/membership, reports, avatar ownership, account deletion and anonymous denial were exercised.
- **PASS:** all test identities/data rolled back; verified none remained.
- **PASS:** Realtime enabled, public channels disabled; saved configuration verified in dashboard. No limits or billing changed.

Reproducible SQL: `supabase/verification/catalog.sql` and `supabase/verification/multi-user.sql`. Detailed machine results are in ignored `release-artifacts/hosted-catalog.json`, `catalog-differences.json`, and `hosted-test-results.json`; screenshots are in `docs/screenshots/`.

## Scope and discrepancies

No migration/policy discrepancies found. These hosted tests exercise PostgreSQL with authenticated roles and claims, **not** real GoTrue email sessions or hosted WebSocket delivery. Actual Auth/PostgREST/Storage/WebSocket tests passed against local Supabase (11 checks). Hosted email delivery, real multi-device WebSocket behavior and Storage API upload remain to verify with owner-controlled tester identities. Do not describe those as hosted end-to-end passes.

No Apple/Google provider setup has been performed. Email provider is configured, but delivery to arbitrary testers requires an appropriate SMTP service; the built-in sender is restricted. No provider secrets are stored in the app or this report.

## Authentication follow-on

After completing the unchanged social deployment, applied `202610030001_onboarding.sql`. Its owner-only progress table and five RPCs passed 18 additional hosted assertions. Test identities rolled back, verified clean. The expanded catalog matches **282 objects with zero discrepancies**. Results: `release-artifacts/hosted-onboarding-tests.json`, `hosted-onboarding-catalog.json`; screenshots `supabase-onboarding-deployed.png` and `supabase-onboarding-tests.png`.

Public Auth settings read verified email=true, Apple=false, Google=false. Anonymous social snapshot RPC returns HTTP 401. No emails were sent and no hosted Auth sessions were manufactured. The outstanding provider/delivery checks remain explicit in AUTH_ONBOARDING_ARCHITECTURE.md.

## Migration history reconciliation — October 1, 2026

The hosted CLI history table was absent (`to_regclass` returned NULL). Recorded all eight existing versions using the same ledger structure as [Supabase CLI](https://github.com/supabase/cli/blob/main/apps/cli-go/pkg/migration/history.go). Each row stores the exact original migration source as inert text, not executable SQL. No application migration was reapplied, and no application data was changed. Public/anon/authenticated access to the bookkeeping schema/table was explicitly revoked.

The transaction asserted the reviewed application-catalog fingerprint both before and after the ledger inserts, and refused to run if a history table had appeared concurrently. A local PostgreSQL-compatible execution verified all eight source blocks byte-for-byte and verified a repeat attempt refuses. A fresh hosted catalog after commit matched the before snapshot: **282 objects, zero changes**. Catalog MD5: `9fc21ed04c30ccbbe4c20be267c85335`. This is a structural equality fingerprint, not a credential or security signature.

Evidence: ignored `release-artifacts/supabase-history-reconcile.sql`, `history-migration-checksums.json`, `history-before-catalog.json`, `history-after-catalog.json`; screenshot `docs/screenshots/supabase-history-reconciled.png`. The only added schema objects are Supabase's migration bookkeeping schema/table. No schema/policy drift. Future CLI use still requires the owner's normal CLI/database authentication; credentials were not extracted from the browser.

## Hosted email attempt

One real magic-link request was made from the existing Release iOS simulator to the owner-provided tester address. The app received success and showed “Check your email.” Delivery, callback, verified session and physical-device acceptance remain pending; an accepted request alone is not an end-to-end pass.
