import { useSyncExternalStore } from 'react';
import type { LocationSample } from './motion';
/** Ephemeral only: raw device samples never enter the persisted social snapshot. */
const samples = new Map<string, LocationSample>();
const listeners = new Map<string, Set<() => void>>();
export const motionStore = {
  get: (id: string) => samples.get(id),
  set(id: string, value?: LocationSample) {
    if (value) samples.set(id, value);
    else samples.delete(id);
    listeners.get(id)?.forEach((notify) => notify());
  },
  subscribe(id: string, notify: () => void) {
    const group = listeners.get(id) ?? new Set();
    group.add(notify);
    listeners.set(id, group);
    return () => {
      group.delete(notify);
    };
  },
};
export function useMotion(id: string, enabled = true) {
  return useSyncExternalStore(
    (notify) => (enabled ? motionStore.subscribe(id, notify) : () => {}),
    () => (enabled ? motionStore.get(id) : undefined),
  );
}
