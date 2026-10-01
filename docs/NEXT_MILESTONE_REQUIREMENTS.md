# Zuno — Next milestone: one-handed zoom and social meetups

Status: implementation brief for review. Continue the existing application; do not restart or redesign it from scratch.

## Product outcome

Zuno should make it easy to open a map, see your people, discover a small get-together, and join it. The next milestone has two priorities:

1. Make sliding a thumb up and down near the screen edge a polished, reliable way to zoom the map.
2. Evolve the existing Plans feature into lightweight, discoverable, joinable **meetups**.

The reference to “Noma table” describes the meetup behavior discussed by the user: people create a get-together, others can discover it and join. No additional functionality, branding, artwork, or exact interface from that reference is assumed.

## Existing project and scope

- Repository: the existing `zuno-app` project. Baseline commit: `42d2cd1` on `codex/phase-one-social-map`; inspect the current checkout before editing.
- Stack: React Native, Expo, TypeScript. Native maps and the browser map have separate provider adapters.
- Already present: avatar markers, friend cards, friends and requests, local chat, profiles, privacy preferences, themes, local storage, an experimental edge-zoom grip, and basic plan creation/join/leave.
- Preserve the original coral identity, map-first experience, light/dark themes, existing functionality, and provider/repository boundaries.
- Continue using realistic mock data and local persistence. **Do not configure Supabase, real authentication, real location broadcasting, or real messaging in this milestone.** Public visibility is simulated between fictional users until the backend phase.
- The user’s request is for a requirements handoff; this document does not itself claim the new behavior is implemented.

## 1. One-handed map zoom

### Required interaction

- A small, discoverable thumb control sits near the right edge, reachable with one hand. Sliding upward zooms in; sliding downward zooms out.
- Zoom is proportional to movement from the gesture’s starting point. Touching the control does not jump the zoom to an absolute value.
- Reversing direction reverses the zoom smoothly. Lifting the finger or cancelling the gesture stops it immediately.
- Add a small activation threshold so a tap or minor hand movement does not cause an accidental zoom.
- Keep the camera centered on the same geographic point while zooming. Do not silently recenter on a friend or on the device location.
- Respect minimum and maximum zoom and avoid queued camera animations, snapping, oscillation, or stale camera state during rapid movement.
- Keep pinch zoom, map panning, double-tap zoom, marker taps, and recenter working normally outside the control.
- Respect safe areas and platform edge/navigation gestures. A finger starting elsewhere on the map must not be captured by the zoom control.

### Presentation and accessibility

- The control should feel like part of Zuno, with a clear active state and brief first-use guidance. Avoid a large permanent slider panel.
- Fix crowding in narrow views: selected friend cards, meetup labels, and primary actions must remain readable and tappable. Consolidate redundant zoom buttons where appropriate while preserving an accessible alternative.
- Use at least a 44-point touch target, a descriptive accessibility label, and increment/decrement accessibility actions. Keep a keyboard or button alternative in the browser.
- Support reduced motion. Target smooth interaction and measure on available native devices; do not claim a frame rate based on browser behavior alone.
- Both map adapters must implement the same direction and sensitivity semantics. Keep gesture recognition separate from provider camera commands.

### Acceptance criteria

- A continuous upward drag increases zoom without panning; a downward drag decreases it. Both directions work during one gesture.
- A stationary touch does not zoom. Release, interruption, or opening a sheet leaves no stuck gesture or continuing animation.
- Pinch, pan, double-tap, recenter, and avatar selection still work after repeated edge drags.
- The visible compact phone layout has no unreadable selected card, obscured primary action, or clipped meetup title caused by fixed controls.

## 2. Lightweight meetups

Use **Meetups** consistently in the product UI. Evolve the existing Plans implementation rather than adding a second competing feature.

Examples: “Coffee in 30 minutes,” “Sunset at South Beach,” or “Basketball after work.” Keep creation short and informal; this is not a ticketed events platform.

### Create a meetup

Required fields:

- Title and activity icon/category.
- Host, taken from the current user.
- Start date/time and end time or duration, with sensible defaults and validation.
- A public meeting place or an approximate area.
- Visibility: Friends, Invite-only, or Public nearby.

Optional fields:

- Short description.
- Selected friend invitations.
- Maximum participant count. No value means no limit; the host counts toward the limit.

The form must support editing the actual date/time, not only fixed relative presets. Store unambiguous timestamps and display them in the viewer’s local timezone. Validate missing titles, invalid dates, end-before-start, and capacity values. Cancelling the form must not create a meetup.

### Discover and view

- Show eligible active meetups naturally on the map, with compact icons and clustering or label management when crowded.
- Provide a Meetups list/sheet reachable from the floating navigation. The map remains the primary experience.
- Support simple filters such as Friends, Public nearby, Today, and Joined. Keep the first implementation small.
- Tapping a meetup opens a detail sheet with title, host, description, time, meeting place/area, audience, participant count, remaining capacity where applicable, and the current user’s participation state.
- Public nearby means a meetup explicitly published for discovery in an area. It does not mean exposing every user’s live location or showing all meetups worldwide.
- Use named demo areas or the map’s selected area for discovery. Browsing must not require device-location permission.

### Join, leave, and host controls

- An eligible user can join an open meetup and leave it. A repeated tap cannot create duplicate membership or an incorrect count.
- Update the detail sheet, list, and map consistently; persist the result locally.
- A full, expired, or cancelled meetup cannot accept new participants. The UI clearly communicates why joining is unavailable.
- The host is initially joined. The host cancels their meetup rather than leaving it without a host.
- Hosts can edit or cancel their own upcoming meetups. Capacity cannot be reduced below the existing participant count.
- Cancellation removes a meetup from active discovery while preserving a clear cancelled state for people viewing their joined meetups. Ended meetups leave active discovery as time advances.
- Invitations do not automatically join a person. Joining does not create a friendship, start location sharing, or grant direct-message access.

### Audience and privacy rules

- **Friends:** accepted friends of the host can discover and join.
- **Invite-only:** only the host and explicitly invited users can view and join.
- **Public nearby:** other demo users can discover and join after the host deliberately chooses public visibility.
- Default to Friends for this implementation. Existing saved plans migrate to Friends; they must never become public silently.
- Publishing an exact meetup location is limited to a deliberately selected public venue. Private/home meeting locations remain approximate in public discovery.
- Ghost mode and personal location preferences remain independent of meetup participation. A venue pin is not a participant’s live position.
- Apply block restrictions in both directions to discovery and joining. Reports must remain accessible and explicitly local-only in this prototype.
- A later backend must enforce audience, capacity, blocks, and authorization on the server. Client-only filtering must not be represented as production security.

### Acceptance criteria

- Create a public meetup as one fictional user; another non-friend demo viewer can discover and join it without seeing the host’s live coordinates.
- A non-friend cannot discover a Friends meetup. An uninvited viewer cannot access an Invite-only meetup, including through a direct ID lookup.
- Join/leave changes counts once and survives reopening the app. Capacity limits and duplicate actions are covered by domain tests.
- A host can edit and cancel their own meetup; another user cannot. Expiry and cancellation update all relevant views.
- Joining does not change friendship, message permissions, or personal location privacy.
- Include useful empty, loading, validation, full, expired, and cancelled states.

## 3. Architecture and implementation boundaries

- Inspect the existing models, reducer, repository, map contract, and tests before making changes.
- Extend or migrate the existing Plan model into a coherent Meetup model. Include visibility, lifecycle state, invitations, participants, capacity, place precision, and timestamps. Derive fullness from membership and capacity instead of storing conflicting counts.
- Provide explicit repository/domain operations for listing visible meetups, reading an authorized meetup, creating/editing/cancelling, and joining/leaving. UI components should not implement access policy themselves.
- Preserve saved local data through a versioned migration. Do not wipe profiles, chats, friendships, or privacy settings to rename Plans.
- Use existing design tokens and reusable sheets/cards. Avoid giant components and unnecessary new dependencies.
- Keep discovery limited to meetups. Stranger tracking, recommendation algorithms, ticketing, payments, waitlists, group chat, push notifications, and live attendance tracking are outside this milestone.

## 4. Verification and delivery

- Work incrementally: edge interaction and narrow-layout fixes first; meetup models/policies and migration next; creation/discovery/participation UI after that.
- Run strict TypeScript, ESLint, formatting checks, focused domain tests, and browser interaction tests. Add coverage for audience checks, capacity, lifecycle, migration, and gesture cancellation.
- Check representative small/large phones, tablet layouts, and desktop web in both themes. Inspect real screenshots, including an open friend card and an open meetup detail sheet.
- Validate native map rendering and edge gestures on an available Android emulator/device and iOS simulator/device. The previous browser tests and native bundle exports do not substitute for native runtime checks.
- Current validation gap: Android Expo Go was launched, but its map-rendering/gesture smoke test was not completed. iOS runtime testing was blocked by unaccepted Xcode licensing. Report any remaining native limitation accurately.
- Update the README with behavior, scope, setup, remaining limitations, and what was actually tested. Save coherent commits and summarize the completed behavior.

## Proposed defaults for review

Public visibility is opt-in, Friends is the default, joining is immediate when eligible and capacity is available, and discovery is area-based. These are practical starting assumptions, not previously confirmed product decisions. Host approval, a public default, or broader discovery can be specified in a subsequent iteration.
