import type { AppSnapshot, LocationPrivacy, Message, Plan, Profile } from '../types/domain';
import { isBlocked, isFriend } from '../utils/privacy';

export type Action =
  | { type: 'hydrate'; snapshot: AppSnapshot }
  | { type: 'privacy'; value: LocationPrivacy }
  | { type: 'theme'; value: AppSnapshot['theme'] }
  | { type: 'profile'; value: Partial<Profile>; status: string }
  | {
      type: 'friend';
      id: string;
      operation: 'add' | 'accept' | 'remove' | 'block' | 'unblock';
      now: string;
    }
  | { type: 'message'; message: Message; friendId: string }
  | { type: 'read'; conversationId: string }
  | { type: 'plan'; plan: Plan }
  | { type: 'join'; planId: string }
  | { type: 'report'; subjectId: string; reason: string; id: string; now: string };

export function reducer(state: AppSnapshot, action: Action): AppSnapshot {
  switch (action.type) {
    case 'hydrate':
      return action.snapshot;
    case 'privacy':
      return {
        ...state,
        privacy: action.value.ghostMode ? { ...action.value, temporary: undefined } : action.value,
      };
    case 'theme':
      return { ...state, theme: action.value };
    case 'profile':
      return {
        ...state,
        people: state.people.map((p) =>
          p.user.id === state.currentUserId
            ? {
                ...p,
                profile: { ...p.profile, ...action.value },
                presence: { ...p.presence, status: action.status.trim().slice(0, 80) },
              }
            : p,
        ),
      };
    case 'friend': {
      if (action.id === state.currentUserId || !state.people.some((p) => p.user.id === action.id))
        return state;
      const related = (a: string, b: string) =>
        (a === state.currentUserId && b === action.id) ||
        (b === state.currentUserId && a === action.id);
      const existing = state.friendships.find((f) => related(f.requesterId, f.addresseeId));
      if (action.operation === 'unblock')
        return {
          ...state,
          blocks: state.blocks.filter(
            (b) => !(b.blockerId === state.currentUserId && b.blockedId === action.id),
          ),
        };
      if (action.operation === 'add') {
        if (existing || isBlocked(state, action.id)) return state;
        return {
          ...state,
          friendships: [
            ...state.friendships,
            {
              id: `f-${action.id}`,
              requesterId: state.currentUserId,
              addresseeId: action.id,
              status: 'pending',
              createdAt: action.now,
            },
          ],
        };
      }
      if (action.operation === 'accept') {
        if (isBlocked(state, action.id)) return state;
        return {
          ...state,
          friendships: state.friendships.map((f) =>
            f.requesterId === action.id &&
            f.addresseeId === state.currentUserId &&
            f.status === 'pending'
              ? { ...f, status: 'accepted' }
              : f,
          ),
        };
      }
      return {
        ...state,
        friendships: state.friendships.filter((f) => !related(f.requesterId, f.addresseeId)),
        blocks:
          action.operation === 'block' && !isBlocked(state, action.id)
            ? [
                ...state.blocks,
                { blockerId: state.currentUserId, blockedId: action.id, createdAt: action.now },
              ]
            : state.blocks,
        privacy: {
          ...state.privacy,
          temporary: state.privacy.temporary
            ? {
                ...state.privacy.temporary,
                friendIds: state.privacy.temporary.friendIds.filter((id) => id !== action.id),
              }
            : undefined,
        },
      };
    }
    case 'message': {
      if (
        !isFriend(state, action.friendId) ||
        isBlocked(state, action.friendId) ||
        !action.message.text.trim()
      )
        return state;
      return {
        ...state,
        messages: [
          ...state.messages,
          { ...action.message, text: action.message.text.trim().slice(0, 2000) },
        ],
        conversations: state.conversations.some((c) => c.id === action.message.conversationId)
          ? state.conversations
          : [
              ...state.conversations,
              {
                id: action.message.conversationId,
                participantIds: [state.currentUserId, action.friendId],
                unreadCount: 0,
              },
            ],
      };
    }
    case 'read':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      };
    case 'plan':
      return action.plan.title.trim() &&
        Date.parse(action.plan.expiresAt) > Date.parse(action.plan.startsAt)
        ? { ...state, plans: [...state.plans, action.plan] }
        : state;
    case 'join':
      return {
        ...state,
        plans: state.plans.map((p) =>
          p.id !== action.planId ||
          Date.parse(p.expiresAt) < Date.now() ||
          isBlocked(state, p.creatorId)
            ? p
            : {
                ...p,
                participants: p.participants.some(
                  (part) => part.userId === state.currentUserId && part.status === 'joined',
                )
                  ? p.participants.filter((part) => part.userId !== state.currentUserId)
                  : [
                      ...p.participants.filter((part) => part.userId !== state.currentUserId),
                      { userId: state.currentUserId, status: 'joined' },
                    ],
              },
        ),
      };
    case 'report':
      return {
        ...state,
        reports: [
          ...state.reports,
          {
            id: action.id,
            reporterId: state.currentUserId,
            subjectId: action.subjectId,
            reason: action.reason,
            createdAt: action.now,
          },
        ],
      };
  }
}
