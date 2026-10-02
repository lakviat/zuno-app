/** Development-only event names. Never pass tokens, user data, coordinates or raw errors. */
export function backendDiagnostic(
  event:
    | 'auth-changed'
    | 'auth-restore-failed'
    | 'realtime-connecting'
    | 'realtime-connected'
    | 'realtime-disconnected'
    | 'realtime-closed'
    | 'location-published'
    | 'location-publish-failed'
    | 'location-cleared'
    | 'location-clear-failed',
) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[Zuno backend]', event);
}
