import type { Presence } from '../../types/domain';
import { isAvailable } from './domain';

export const activityOptions = [
  '☕ Coffee',
  '🏖 Beach',
  '🍸 Drinks',
  '🏋️ Gym',
  '💬 Hang out',
] as const;

export const statusOptions = [
  'Hey, I am available',
  'I’m free',
  'I’m open',
  'Let’s hang out',
  'I’m new to the city',
] as const;

/** Both local and server snapshots carry intent/availability. Derive their visible
 * badge here, so the server's legacy default emoji cannot hide a saved activity.
 * Keep the editable profile status intact as the fallback when Free now expires.
 */
export function presencePresentation(p: Presence, now = Date.now()) {
  const fallback = { emoji: p.emoji, status: p.status };
  if (!p.availability && !p.intent?.trim()) return fallback;
  if (p.availability === 'free' && !isAvailable(p, now)) return fallback;
  if (p.availability === 'free' && !p.intent?.trim() && p.status.trim())
    return { emoji: '👋', status: p.status };
  const availability =
    p.availability === 'later'
      ? 'Maybe later'
      : p.availability === 'busy'
        ? 'Busy'
        : isAvailable(p, now)
          ? 'Free now'
          : '';
  const intent = p.intent?.trim() ?? '';
  const prefix = intent.match(
    /^(\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*)\s*/u,
  );
  const activity = prefix ? intent.slice(prefix[0].length).trim() : intent;
  return {
    emoji:
      prefix?.[1] ??
      (intent ? '💬' : p.availability === 'later' ? '🕒' : p.availability === 'busy' ? '⛔' : '⚡'),
    status: [availability, activity].filter(Boolean).join(' · ') || p.status,
  };
}

export function presenceText(p: Presence, now = Date.now()) {
  const display = presencePresentation(p, now);
  return `${display.emoji} ${display.status}`;
}
