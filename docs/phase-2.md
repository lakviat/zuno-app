# Phase 2 — living social map

This extends the existing Expo application, Apple Maps adapter, local repository, domain transactions, navigation and sheets. iOS is the native acceptance target. Android authorization work remains deferred.

## Experience

- The **+** on the map, map long press, Meetups creation action, and friend-card action enter location mode. The pin stays in the center while the map moves. Confirmation is disabled during movement and at an imprecise regional scale. Labels use nearby catalog places or coordinates, with no invented street address. No location permission is needed to browse or place a meetup.
- Confirm the spot, choose an activity or write any title, then choose Now / Later today / Tonight / Tomorrow. Custom date/time exposes the existing native iOS controls. Friends remains the default audience; Public and Invite-only are explicit choices. Capacity includes the host. Description and invitations are optional.
- Now starts at the transaction time and defaults to a two-hour duration. Active markers carry **NOW**. Ended and cancelled meetups leave discovery; current participants retain their history and read-only chat. Hosts may cancel active meetups as well as scheduled ones.
- Map discovery queries the settled viewport, including across the date line. It is independent of device GPS and is no longer constrained to two Miami neighborhoods. The Meetups sheet starts with the browsed viewport and also provides named-area shortcuts, including Fort Lauderdale. Everyone combines eligible people and activities; Free now shows available people; Meetups focuses on activities.
- Joining immediately changes membership, counts and conversation access. Leaving immediately revokes chat access. Membership and its join/leave system message commit together. The host gets a conversation at creation. Existing meetups acquire conversation records through the additive migration. Text, sender avatars, timestamps, meeting location and a return-to-map action are implemented. Photos, polls, reactions, voice and live-location attachments are future message types, not placeholder controls.
- Details include the host profile, optional distance from a recent device sample, Share (meeting text and an Apple Maps spot), reporting, joining/leaving and chat. Sharing is an OS action initiated by the user; there is no hosted Zuno invitation link yet.
- Availability offers Free now, Maybe later and Busy plus a short intent. Free now lasts two hours. It never enables location sharing. The clock updates lifecycle/availability every 15 seconds; a successful meetup transaction refreshes it immediately so Now does not initially appear scheduled.

## Map appearance and performance

Apple Maps remains the provider. Nearby iOS maps use `mutedStandard`, with points of interest, traffic, buildings and indoor details disabled. This exposes the softer built-in cartography and brighter water while retaining road orientation and native attribution. Dark appearance remains available. The existing satellite globe transition and both edge zoom gestures remain. Apple's adapter does not offer the same arbitrary road/water color controls as Google styles or MapLibre; changing providers for colors alone would add native setup, cost and globe/gesture regression risk. [Map-view API](https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md).

The largest avoidable JS workload found during inspection was the camera-to-React path: every edge-zoom altitude update set component state, reran both clustering calculations and recreated custom marker trees, even at neighborhood scales where altitude changed no layout. Custom person markers also had continuous view tracking enabled. The changes are:

- Neighborhood camera commands no longer set React state for altitude. Only a changed globe-fit height updates layout.
- The continuous region callback is removed. Region settlement coalesces for 180 ms, and clustering/discovery wait until the edge gesture ends. Native touch and programmatic camera ownership remain distinct.
- People and meetup clusters are memoized by data and settled region. Person marker components and marker artwork are memoized, and continuous custom-marker tracking is disabled.
- A stable theme context keeps text, avatars and marker artwork out of social-state/clock broadcasts. The native map is memoized and receives stable selection callbacks and memoized data projections.
- Individual moving markers subscribe to an ephemeral per-user store. GPS samples do not write the whole application snapshot or AsyncStorage. First fixes and long gaps snap to their valid location; recent neighboring fixes interpolate. Coordinate interpolation uses React Native Animated values, without React state per animation frame. The Apple Maps coordinate prop still uses the JS animation driver; this is not a claim of UI-thread-only animation.

Rotation remains disabled as in the existing app; panning, double-tap/pinch and both edge zoom gestures remain. At low scale the existing people and activity clustering is retained, with separate visual offsets for people/activity aggregates and the redundant self pin suppressed. Native clustering uses a planar regional approximation, so projection-accurate globe clustering and large-data stress testing remain future work. No 60/120 fps or battery-life claim is made without physical-device profiling.

## Location and consent boundaries

`Person.location` is inbound **friend-visible** data, not raw device GPS. A new person without explicit friend-location policy is hidden. Legacy fictional shared pins are migrated to explicit policies that preserve their existing precision. The fictional Mia fixture opts into public discovery with only an approximate neighborhood; it has no precise location.

`discoverablePeople` builds map-facing projections. Accepted friends require an eligible friend policy; public non-friends receive only a stable approximate grid coordinate, a neighborhood label and a coarse timestamp. Stranger speed/heading and friend-visible coordinates are not passed to map components. Hidden people, local hides and either-direction blocks remove map presence. The UI distinguishes public people with a green outline and approximation mark. Their card opens the profile/friend-request path and supports hiding; existing block/report actions remain.

Current-user settings separate Public discovery / Friends only / Hidden from precise / approximate / hidden friend sharing. Public discovery requires explicit opt-in. Ghost overrides all outgoing audiences. Temporary access remains scoped to selected accepted, unblocked friends. The publishing seam builds separate friend-visible envelopes (with speed/course only for precise friend access) and public-discovery data; it never sends the raw sample wholesale. A future server must enforce these rules before serialization and with RLS.

`LocationSample` contains coordinates, timestamp, horizontal accuracy, native speed in m/s and course heading. The filter rejects stale, out-of-order, invalid, inaccurate (>65 m) and implausibly discontinuous samples. It suppresses small jitter, sanitizes invalid speed, and smooths speed/heading (including crossing north). Speed below 1 m/s is stationary; unknown speed remains unavailable. Labels use a conservative **Moving** state, MPH by default with KM/H supported. No transportation mode is inferred with false certainty.

The optional device-location action explains its purpose before requesting When Using the App. Foreground watching uses Expo Location, adapts its distance interval, and gates publishing to roughly 60 s stationary / 10 s walking-speed / 5 s faster movement. iOS primarily uses distance filtering; actual callback cadence is controlled by the OS. Watches stop in the background and on disable, late subscriptions are removed, and raw samples remain in memory. Denial leaves browsing and meetup placement usable. Background tracking and background permission are deliberately not enabled. [Expo Location API](https://docs.expo.dev/versions/latest/sdk/location/).

The `LocationPublisher` interface is isolated from UI. Its current adapter performs **no network transmission**. There is no realtime friend backend, authentication, remote chat delivery or moderation service. Server-side subscriptions can feed the per-user motion store after authorization; they must not inject stranger precise samples.

In development builds, Location & privacy exposes a clearly labeled simulated-movement toggle. Fictional Alex/Marcus follow paths with moving/stopped phases. Import/start are gated by `__DEV__`; Release behavior cannot enable the simulation. Stopping or backgrounding clears the simulated samples. Physical sensor accuracy and multiple-phone movement remain separate validation.

## Persistence and future services

The existing storage key and schema version remain compatible. Additive optional fields preserve profiles, chats, relationships, privacy, meetup attendance and edits. Missing conversation records and availability expiry are added once; repeated migration is idempotent. Availability expiry is derived from the saved timestamp, never renewed merely by reopening. Raw device coordinates are excluded from persisted snapshots. Restart continues to disable friend location sharing and temporary access.

The existing `SocialRepository`, pure meetup transactions and the new location-publisher/motion-store boundary remain independent of Supabase. Future tables can map to profiles, friendships, authorized location projections, presence/discoverability, meetups, participants, conversations and typed messages. Use database transactions for join/capacity/system-message writes, RLS for audiences, and explicit retention/revocation for location publication. Never replace the local demo actor switch with unauthenticated production impersonation.

## Validation

See the final verification entry in the project README. Automated coverage includes geographic discovery, arbitrary pinned places/custom activities, immediate lifecycle, capacity/audiences, join/leave chat access and persistence, archived chat, blocks, malformed GPS, speed/heading filtering, approximate public output, availability expiry and date-line browsing. Existing zoom, meetup, migration, friendship, privacy and browser journeys remain in the suite.
