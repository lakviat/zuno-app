import type { AppSnapshot, Meetup, MeetupDraft } from '../../types/domain';
import { activities, demoAreas, meetupPlaces } from './places';

export type MeetupFilter = 'all' | 'friends' | 'public' | 'today' | 'joined';
export const areFriends = (state: AppSnapshot, a: string, b: string) =>
  state.friendships.some(
    (f) =>
      f.status === 'accepted' &&
      ((f.requesterId === a && f.addresseeId === b) ||
        (f.requesterId === b && f.addresseeId === a)),
  );
export const blockedBetween = (state: AppSnapshot, a: string, b: string) =>
  state.blocks.some(
    (v) => (v.blockerId === a && v.blockedId === b) || (v.blockerId === b && v.blockedId === a),
  );
export const meetupStatus = (meetup: Meetup, now: number) =>
  meetup.status === 'cancelled'
    ? 'Cancelled'
    : Date.parse(meetup.endsAt) <= now
      ? 'Ended'
      : meetup.capacity !== undefined && meetup.participantIds.length >= meetup.capacity
        ? 'Full'
        : 'Open';

function authorized(state: AppSnapshot, meetup: Meetup, viewerId: string) {
  if (
    !state.people.some((p) => p.user.id === viewerId) ||
    blockedBetween(state, viewerId, meetup.hostId)
  )
    return false;
  return (
    viewerId === meetup.hostId ||
    meetup.visibility === 'public' ||
    (meetup.visibility === 'friends' && areFriends(state, viewerId, meetup.hostId)) ||
    (meetup.visibility === 'invite-only' && meetup.invitedUserIds.includes(viewerId))
  );
}
/** The same authorization boundary protects ID reads and list discovery. */
export function getAuthorizedMeetup(
  state: AppSnapshot,
  viewerId: string,
  id: string,
): Meetup | undefined {
  const meetup = state.meetups.find((m) => m.id === id);
  return meetup && authorized(state, meetup, viewerId) ? meetup : undefined;
}
export function listVisibleMeetups(
  state: AppSnapshot,
  viewerId: string,
  options: { areaId: string; filter?: MeetupFilter; now: number },
): Meetup[] {
  const { filter = 'all', now, areaId } = options;
  return state.meetups
    .filter((m) => {
      if (!authorized(state, m, viewerId)) return false;
      if (filter === 'joined') return m.participantIds.includes(viewerId);
      if (m.status === 'cancelled' || Date.parse(m.endsAt) <= now) return false;
      if (m.visibility === 'public' && m.place.areaId !== areaId) return false;
      if (filter === 'public') return m.visibility === 'public';
      if (filter === 'friends')
        return m.hostId === viewerId || areFriends(state, viewerId, m.hostId);
      if (filter === 'today')
        return new Date(m.startsAt).toDateString() === new Date(now).toDateString();
      return true;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export type MeetupCommand =
  | { operation: 'create'; id: string; draft: MeetupDraft }
  | { operation: 'edit'; id: string; draft: MeetupDraft }
  | { operation: 'join'; id: string }
  | { operation: 'leave'; id: string }
  | { operation: 'cancel'; id: string };
export type MeetupResult =
  { ok: true; snapshot: AppSnapshot; meetup: Meetup } | { ok: false; error: string };

function validateDraft(
  state: AppSnapshot,
  actorId: string,
  draft: MeetupDraft,
  now: number,
  count: number,
): string | undefined {
  if (!draft.title.trim() || draft.title.trim().length > 60)
    return 'Add a title between 1 and 60 characters.';
  if (draft.description.length > 240) return 'Keep the description under 240 characters.';
  if (!activities.some((a) => a.emoji === draft.emoji)) return 'Choose an activity.';
  if (!['friends', 'invite-only', 'public'].includes(draft.visibility))
    return 'Choose who can see this meetup.';
  if (!meetupPlaces.some((p) => p.id === draft.placeId && demoAreas.some((a) => a.id === p.areaId)))
    return 'Choose a public venue or approximate area.';
  const start = Date.parse(draft.startsAt),
    end = Date.parse(draft.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end))
    return 'Enter a valid start and end date/time.';
  if (start <= now) return 'Choose a start time in the future.';
  if (end <= start) return 'The end time must be after the start.';
  if (
    draft.capacity !== undefined &&
    (!Number.isSafeInteger(draft.capacity) || draft.capacity < Math.max(1, count))
  )
    return `Capacity must be a whole number of at least ${Math.max(1, count)} (including the host).`;
  if (
    draft.invitedUserIds.some(
      (id) =>
        id === actorId || !areFriends(state, actorId, id) || blockedBetween(state, actorId, id),
    )
  )
    return 'Invitations can only include your current, unblocked friends.';
}

export function participationAction(
  state: AppSnapshot,
  viewerId: string,
  m: Meetup,
  now: number,
): { operation?: 'join' | 'leave'; label: string } {
  if (!authorized(state, m, viewerId)) return { label: 'Meetup unavailable' };
  const status = meetupStatus(m, now);
  if (status === 'Cancelled' || status === 'Ended')
    return { label: status === 'Cancelled' ? 'Meetup cancelled' : 'Meetup ended' };
  if (m.hostId === viewerId) return { label: 'You’re hosting · you’re in' };
  if (m.participantIds.includes(viewerId)) return { operation: 'leave', label: 'Leave meetup' };
  if (status === 'Full') return { label: 'Meetup full' };
  return { operation: 'join', label: 'Join meetup' };
}
export const canManageMeetup = (m: Meetup, viewerId: string, now: number) =>
  m.hostId === viewerId && m.status !== 'cancelled' && Date.parse(m.startsAt) > now;

/** Pure local transaction. A future service must enforce these rules server-side. */
export function executeMeetup(
  state: AppSnapshot,
  actorId: string,
  command: MeetupCommand,
  now = Date.now(),
): MeetupResult {
  const fail = (error: string): MeetupResult => ({ ok: false, error });
  if (!state.people.some((p) => p.user.id === actorId)) return fail('Unknown demo viewer.');
  const stamp = new Date(now).toISOString();
  if (command.operation === 'create') {
    if (state.meetups.some((m) => m.id === command.id))
      return fail('This meetup has already been created.');
    const error = validateDraft(state, actorId, command.draft, now, 1);
    if (error) return fail(error);
    const { draft } = command;
    const meetup: Meetup = {
      id: command.id,
      hostId: actorId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      emoji: draft.emoji,
      place: meetupPlaces.find((p) => p.id === draft.placeId)!,
      startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: new Date(draft.endsAt).toISOString(),
      visibility: draft.visibility,
      invitedUserIds: [...new Set(draft.invitedUserIds)],
      participantIds: [actorId],
      capacity: draft.capacity,
      status: 'scheduled',
      createdAt: stamp,
      updatedAt: stamp,
    };
    return { ok: true, meetup, snapshot: { ...state, meetups: [...state.meetups, meetup] } };
  }
  const m = getAuthorizedMeetup(state, actorId, command.id);
  if (!m) return fail('This meetup is unavailable to this viewer.');
  let next = m;
  if (command.operation === 'edit' || command.operation === 'cancel') {
    if (!canManageMeetup(m, actorId, now))
      return fail('Only the host can edit or cancel an upcoming meetup.');
    if (command.operation === 'cancel') next = { ...m, status: 'cancelled', updatedAt: stamp };
    else {
      const error = validateDraft(state, actorId, command.draft, now, m.participantIds.length);
      if (error) return fail(error);
      const { draft } = command;
      // Audience changes must not silently eject people who have already joined.
      const candidate = {
        ...m,
        visibility: draft.visibility,
        invitedUserIds: draft.invitedUserIds,
      };
      if (
        m.participantIds.some((id) => authorized(state, m, id) && !authorized(state, candidate, id))
      )
        return fail('Keep the current participants in the audience, or cancel this meetup.');
      next = {
        ...m,
        title: draft.title.trim(),
        description: draft.description.trim(),
        emoji: draft.emoji,
        place: meetupPlaces.find((p) => p.id === draft.placeId)!,
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
        visibility: draft.visibility,
        invitedUserIds: [...new Set(draft.invitedUserIds)],
        capacity: draft.capacity,
        updatedAt: stamp,
      };
    }
  } else if (command.operation === 'join') {
    if (m.participantIds.includes(actorId)) return { ok: true, snapshot: state, meetup: m };
    const action = participationAction(state, actorId, m, now);
    if (action.operation !== 'join') return fail(action.label);
    next = { ...m, participantIds: [...m.participantIds, actorId], updatedAt: stamp };
  } else {
    if (actorId === m.hostId) return fail('Hosts cancel their meetup instead of leaving.');
    if (!m.participantIds.includes(actorId)) return { ok: true, snapshot: state, meetup: m };
    if (m.status === 'cancelled' || Date.parse(m.endsAt) <= now)
      return fail('This meetup is kept in your Joined history.');
    next = {
      ...m,
      participantIds: m.participantIds.filter((id) => id !== actorId),
      updatedAt: stamp,
    };
  }
  return {
    ok: true,
    meetup: next,
    snapshot: {
      ...state,
      meetups: state.meetups.map((item) => (item.id === next.id ? next : item)),
    },
  };
}
