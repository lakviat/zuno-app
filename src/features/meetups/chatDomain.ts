import type { AppSnapshot, Meetup, Message } from '../../types/domain';
import { blockedBetween, getAuthorizedMeetup, meetupStatus } from './domain';
export const meetupConversationId = (id: string) => `meetup:${id}`;
export function canReadMeetupChat(state: AppSnapshot, actor: string, id: string) {
  const m = getAuthorizedMeetup(state, actor, id);
  return !!m && m.participantIds.includes(actor);
}
/** Called inside the same transaction as membership; repeat joins cannot duplicate events. */
export function withMeetupConversation(
  state: AppSnapshot,
  meetup: Meetup,
  actor: string,
  event: 'created' | 'joined' | 'left' | 'cancelled' | 'updated',
  stamp: string,
) {
  const conversationId = meetupConversationId(meetup.id);
  const name =
    state.people.find((p) => p.user.id === actor)?.profile.displayName.split(' ')[0] ?? 'Someone';
  const message: Message = {
    id: `${conversationId}:${event}:${actor}:${stamp}`,
    conversationId,
    senderId: actor,
    kind: 'system',
    text: `${name} ${event === 'created' ? 'started the meetup' : event === 'updated' ? 'updated the meetup' : event === 'cancelled' ? 'cancelled the meetup' : `${event} the meetup`}.`,
    createdAt: stamp,
    state: 'read',
  };
  return {
    ...state,
    conversations: [
      ...state.conversations.filter((c) => c.id !== conversationId),
      {
        id: conversationId,
        meetupId: meetup.id,
        participantIds: meetup.participantIds,
        unreadCount: 0,
      },
    ],
    messages: [...state.messages, message],
  };
}
export function sendMeetupMessage(
  state: AppSnapshot,
  actor: string,
  id: string,
  text: string,
  messageId: string,
  now: number,
): AppSnapshot {
  const m = getAuthorizedMeetup(state, actor, id);
  if (
    !m ||
    !canReadMeetupChat(state, actor, id) ||
    !text.trim() ||
    state.messages.some((v) => v.id === messageId)
  )
    return state;
  if (['Ended', 'Cancelled'].includes(meetupStatus(m, now))) return state;
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: messageId,
        conversationId: meetupConversationId(id),
        senderId: actor,
        text: text.trim().slice(0, 2000),
        createdAt: new Date(now).toISOString(),
        state: 'sent',
        kind: 'text',
      },
    ],
  };
}
export function meetupMessages(state: AppSnapshot, actor: string, id: string) {
  if (!canReadMeetupChat(state, actor, id)) return [];
  return state.messages.filter(
    (m) =>
      m.conversationId === meetupConversationId(id) && !blockedBetween(state, actor, m.senderId),
  );
}
