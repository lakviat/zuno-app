import { randomUUID } from 'expo-crypto';
export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function planTime(iso: string) {
  const d = new Date(iso);
  const day =
    d.toDateString() === new Date().toDateString()
      ? 'Today'
      : d.toLocaleDateString([], { weekday: 'short' });
  return `${day} · ${timeLabel(iso)}`;
}
export const uid = () => randomUUID();
