export const AUTH_REDIRECT = 'zuno://auth/callback';
export type AuthCallback = { code: string; flowId?: string } | { error: true } | null;
/** Accept only our exact callback. Never accept bearer tokens from an arbitrary URL. */
export function parseAuthCallback(input: string): AuthCallback {
  try {
    const url = new URL(input);
    if (
      `${url.protocol}//${url.host}${url.pathname}` !== AUTH_REDIRECT ||
      url.username ||
      url.password
    )
      return null;
    if (url.searchParams.has('error') || new URLSearchParams(url.hash.slice(1)).has('error'))
      return { error: true };
    const code = url.searchParams.get('code');
    const flowId = url.searchParams.get('sb_flow_id') ?? undefined;
    if (
      !code ||
      !/^[A-Za-z0-9_-]{8,512}$/.test(code) ||
      url.hash ||
      (flowId && !/^[A-Za-z0-9_-]{8,64}$/.test(flowId))
    )
      return null;
    return { code, ...(flowId ? { flowId } : {}) };
  } catch {
    return null;
  }
}
