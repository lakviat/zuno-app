# Zuno Supabase architecture

Hosted deployment and verification completed October 1, 2026 in **Zuno app** (`incrduydvwsimzeojqdu`). Six existing social migrations were deployed unchanged, then the owner-only onboarding migration. Public Realtime channels are disabled. 67 hosted role/JWT assertions passed and all test data rolled back; 282 catalog objects match local Supabase with zero discrepancies. Hosted email/provider/device acceptance remains separate. No TestFlight upload occurred.

## Audit and migration strategy

The original Expo/React Native UI used a persisted local `AppSnapshot`, sample users, local chat and meetup transactions, and an intentionally inert location publisher. Supabase Auth (PKCE email magic links), Keychain-backed sessions, owner-only profiles, and self-deletion were already connected. They are retained.

`zuno_profile_create`, `zuno_profile_read`, `zuno_profile_update`, and `zuno_profile_delete` are **RLS policies**, not four tables. The one existing `zuno_profiles` table is extended. Existing UUID identity remains the Auth user ID. No seed snapshot is uploaded. The signed-in cloud repository issues specific authenticated commands; it never saves a client-controlled world snapshot.

With public configuration present, the app starts with real account state and an empty world. Missing network/schema never falls back to sample people. Without configuration, the explicitly labeled Development preview remains available for UI tests; Release never bypasses authentication. See AUTH_ONBOARDING_ARCHITECTURE.md for startup and sign-out. Private environment files stay ignored. TestFlight preparation must include the configured public values.

## Schema and relationships

All account-owned rows reference `auth.users` with cascading deletion. No email addresses are copied into social profiles.

| Table                                       | Purpose / ownership                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `zuno_profiles`                             | One profile per Auth UUID; name, unique username, bio, avatar path, availability/status              |
| `zuno_user_privacy`                         | Owner-only private/friends/public, exact/neighborhood, optional speed/heading, units                 |
| `zuno_friendships`                          | Requester/addressee; pending/accepted/rejected; unique unordered user pair                           |
| `zuno_blocks`                               | Directed block; checks apply in both directions                                                      |
| `zuno_live_locations`                       | One latest durable PostGIS geography Point(4326), m/s, heading, accuracy, sample/update/expiry times |
| `zuno_events`                               | Meetup host, audience, selected place + geography, times, capacity, cancellation                     |
| `zuno_event_invites` / `zuno_event_members` | Separate invitations and current attendees                                                           |
| `zuno_conversations`                        | Unique direct pair or one conversation per meetup                                                    |
| `zuno_conversation_members`                 | Membership and read cursor                                                                           |
| `zuno_messages`                             | Persisted text and server creation time; client UUID supports retry deduplication                    |
| `zuno_reports`                              | Private moderation reports, readable by submitter and database administrators                        |
| `zuno_private.map_watches`                  | One expiring viewport interest per account                                                           |
| `zuno_private.location_frames`              | UNLOGGED one-row-per-user fast fix cache, 90-second expiry, no direct client access                  |
| `zuno_private.location_leases`              | Publication timestamps for throttling; no GPS coordinates                                            |

No likes, push-token table, background tracking, or location-history stream is introduced. GraphQL is unnecessary for these bounded reads and transactional commands; normal Supabase APIs/RPCs are sufficient. No Edge Function is needed for this MVP. Foreign keys, query timestamps, unique friendship/direct-chat pairs and GiST geography indexes support the actual access patterns.

## Authorization

RLS is enabled on application tables and private transport metadata. Anonymous users have no social access. Client table writes are revoked; bounded security-definer RPCs derive the actor from `auth.uid()`, validate ownership/membership, and use an empty search path with qualified names. Internal helpers live in an unexposed schema. Supabase must keep `zuno_private` out of Data API exposed schemas.

Profiles are visible through relationships and bounded queries; an exact username permits finding someone new without downloading a user directory. Location visibility defaults private. Friends means accepted friendship, never merely a request. Blocks override discovery, GPS, friendship actions, direct chat and meetup-host access. Group reads filter blocked senders. Raw GPS tables have **no authenticated SELECT grant** and are not added to a Postgres Changes publication. Public geography uses bounded RPCs, not a global client download.

The account can mutate only itself. Meetup creation/edit/cancellation checks the host. Joining locks the event row, checks capacity and inserts membership/chat membership atomically. Leaving removes both. Existing attendees cannot be silently excluded by an audience edit. Requests have a unique unordered pair; accepting requires being the addressee.

## Location and realtime flow

1. Signed-in client loads a durable snapshot, registers one viewport (100 m–50 km radius, 75-second lease), and joins **its own** private `zuno:user:<auth UUID>` inbox.
2. Explicit foreground location permission and in-app consent gate publishing. No startup or background publishing. Reduced accuracy pauses precise movement sharing.
3. Native fixes are validated for age, accuracy, impossible movement, speed and heading. Configurable policy targets 3-second moving broadcasts and 60-second stationary broadcasts; GPS callback availability controls the actual rate. Unknown speed remains null, not fabricated.
4. Server publication validates again, serializes each publisher, enforces a minimum 2-second interval and ignores older samples. Durable latest-location coordinates update at most every 30 seconds. A separate UNLOGGED latest-fix cache supports faster updates and expires in 90 seconds; it may disappear on a database restart. There is no accumulating GPS history.
5. For every publication, the server selects current, geographically relevant watchers and rechecks private/friends/public plus bilateral blocks. It sends content-free location invalidations to at most 200 private recipient inboxes. Recipients coalesce notices for 500 ms and call `zuno_live_updates`, which rechecks current authorization and geography before returning the current UNLOGGED cache projection. No GPS coordinates are placed in retained broadcast messages. Clients cannot send directly to inbox channels.
6. Exact/neighborhood coordinates and speed/heading consent are projected server-side. Approximate spatial membership uses the same coarse grid so radius probing cannot recover exact coordinates.
7. Incoming positions feed the existing ephemeral motion store and marker interpolation. Native m/s is converted to mph using 2.23694 (or km/h using 3.6). Stale fixes are not presented as live.
8. Channel reconnect, foreground return, map movement and a 15-second recovery poll resynchronize authoritative PostgreSQL state. The transport interface is replaceable; durable messages/memberships/events never rely on receiving a broadcast.

Realtime channel authorization is cached by Supabase, so a shared location channel with join-time friendship checks is insufficient for revocation. Per-recipient server fan-out rechecks permissions on every send. A private inbox is readable only by its matching UUID; no client INSERT policy is provided. Location/chat/event broadcasts carry invalidations, not private content; recipients refetch under current authorization.

Private/precision changes clear the durable fix and issue removals. Blocking sends removals to the two affected accounts. Stop, permission failure, background and logout stop publication and request deletion. Requests queued before stop are drained before the clear. Offline revocation cannot contact the server: the last fix expires after 90 seconds. Previously delivered data cannot be retroactively erased from another person's memory or screenshots. Expired GPS rows are physically removed every five minutes by a database Cron job; expired interests and rate rows are also cleaned up. This is foreground sharing only.

## RPC inventory

- `zuno_bootstrap`, `zuno_save_profile`, `zuno_search_people`, `zuno_social_snapshot`
- `zuno_friend_action` (request, accept, remove/decline, block, unblock)
- `zuno_set_privacy`, `zuno_watch_map`, `zuno_nearby_locations`, `zuno_live_updates`, `zuno_publish_location`, `zuno_stop_location`
- `zuno_event_action` (create/edit/join/leave/cancel)
- `zuno_send_message`, `zuno_mark_read`, `zuno_message_history`
- `zuno_report`, `zuno_delete_my_account`

Snapshot limits: 100 spatial people, 100 relevant/owned/joined meetups, 50 member conversations, latest 100 messages per conversation. The chat screens load older messages using an authorized cursor-based RPC. These are explicit early-TestFlight limits, not a claim of unlimited scale.

## Auth and storage

Auth uses email magic links with PKCE and `zuno://auth/callback` as Site URL and exact allowed redirect. SecureStore retains native sessions; no privileged key is present in app configuration. Supabase's built-in email service restricts recipients and throughput; custom SMTP or eligible organization emails are needed for testers. Native Apple and browser Google authentication are implemented; their real providers remain unconfigured. Push delivery is not implemented.

`zuno-avatars` is private, 5 MB, JPEG/PNG/WebP only. The native system photo picker is user-initiated; no camera or microphone permission is requested. Files use `<auth UUID>/<random UUID>.<extension>`. Write policies require ownership. Signed avatar reads expire after 60 seconds and new reads honor blocks. Social avatars are not location or private documents. Replacement removes the former file where possible; account deletion lists/removes owned objects through Storage first. SQL refuses deletion if files remain, avoiding orphaned stored objects. No event-image feature exists in the present UI, so no speculative event-media bucket is enabled.

## Migrations and deployment

The existing `202610010001_account_foundation.sql` was run through Dashboard. New migrations `202610020001`–`202610020006` cover social graph, live location, commands, queries, media and retention. `node scripts/prepare-supabase-migration.mjs` generates one atomic deployment transaction and checksum under ignored `release-artifacts/`. It extends the existing foundation; do not rerun the foundation or reset the project. A private deployment marker records the applied checksum. Current generated SQL SHA-256: `9c4ab304caccfdd59c0a9b00072debb29aa9677b70b0a9dd2832104a081886e6` (checksum of the migration body).

The eight dashboard-applied migration versions are now reconciled in the CLI history table. The before/after catalog remained identical (282 objects). Before future `supabase db push`, check `supabase migration list` and `supabase db push --dry-run`; do not reapply the current baseline. Keep public Realtime channels disabled for this app. Verify the Cron job after deployment; PGlite can exercise the cleanup function but does not execute pg_cron.

## Environment names

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Only publishable configuration is bundled. SMTP and any future operational/admin credentials belong to Supabase server settings, never the client. No service-role key is requested or embedded.

## Validation / remaining work

Local real PostgreSQL + PostGIS tests exercise three synthetic Auth identities, RLS, private/friends/public discovery, geography, 25 mph conversion from 11.176 m/s, blocks, membership/capacity, durable reconnect reads, stop, ownership and cascade deletion. Realtime and Storage infrastructure are contract stubs in that test; hosted WebSocket delivery, email sign-in and physical iPhone GPS still require separate validation. Docker subsequently became available. The actual local Supabase stack passed 11 integration checks through Auth, PostgREST, Realtime and Storage, with three disposable accounts and a concurrent final-seat join. Local test accounts were deleted. Cron is installed and active. The final invalidation-only transport also passed all 11 checks; the broker adds only its message ID to the empty notice. The cleanup check found zero remaining disposable Auth users.

Automated validation and final artifacts are recorded in TESTFLIGHT_READINESS.md. Actual local Auth/PostgREST/Realtime/Storage tests pass with three disposable users. Hosted SQL/RLS tests pass; actual hosted email sessions, provider OAuth and physical iPhone end-to-end acceptance remain owner-dependent. See docs/HOSTED_BACKEND_VALIDATION.md and AUTH_ONBOARDING_ARCHITECTURE.md.
