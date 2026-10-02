import { describe, expect, it } from 'vitest';
import { parseAuthCallback } from './authCallback';
describe('mobile sign-in callback boundary', () => {
  it('accepts the exact PKCE redirect and supported flow ID', () => {
    expect(
      parseAuthCallback('zuno://auth/callback?code=valid-code-123&sb_flow_id=flow12345'),
    ).toEqual({ code: 'valid-code-123', flowId: 'flow12345' });
  });
  it.each([
    'https://attacker.example/?code=valid-code-123',
    'zuno://other/callback?code=valid-code-123',
    'zuno://auth/other?code=valid-code-123',
    'zuno://user:pass@auth/callback?code=valid-code-123',
    'zuno://auth/callback#access_token=token&refresh_token=token',
    'zuno://auth/callback?code=valid-code-123&sb_flow_id=../../secret',
  ])('rejects untrusted or implicit callback %s', (url) => {
    expect(parseAuthCallback(url)).toBeNull();
  });
  it('reports errors without echoing untrusted error text or tokens', () => {
    expect(
      parseAuthCallback('zuno://auth/callback?error=expired&error_description=secret'),
    ).toEqual({ error: true });
  });
});
