/** Synchronous revocation boundary shared by the account, transport and GPS services. */
const cleanups = new Set<() => void>();
export function onSessionEnd(cleanup: () => void) {
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
  };
}
export function endSessionServices() {
  for (const cleanup of [...cleanups]) {
    try {
      cleanup();
    } catch {
      /* Continue stopping every service. */
    }
  }
}
