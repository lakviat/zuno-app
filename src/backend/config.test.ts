import { describe, expect, it } from 'vitest';
import { allowLocalTestLogin, backendConfiguration } from './config';
const url = 'https://zuno-test.supabase.co';
const key = 'sb_publishable_test-only';
describe('local sample login boundary', () => {
  const local = { development: true, platform: 'web', hostname: 'localhost', flag: '1' };
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'permits explicit loopback development at %s',
    (hostname) => {
      expect(allowLocalTestLogin({ ...local, hostname })).toBe(true);
    },
  );
  it.each([
    { development: false },
    { platform: 'ios' },
    { platform: 'android' },
    { flag: undefined },
    { flag: '0' },
    { hostname: '192.168.40.57' },
    { hostname: 'localhost.example.com' },
    { hostname: 'example.com' },
  ])('fails closed outside explicit localhost development: %j', (override) => {
    expect(allowLocalTestLogin({ ...local, ...override })).toBe(false);
  });
});
describe('public Supabase build configuration', () => {
  it('disables networking with no configuration', () =>
    expect(backendConfiguration()).toEqual({ status: 'unconfigured' }));
  it('accepts only a complete HTTPS Supabase endpoint with a publishable key', () => {
    expect(backendConfiguration(url + '/', key)).toEqual({
      status: 'configured',
      url,
      publishableKey: key,
    });
    expect(backendConfiguration(url).status).toBe('invalid');
    expect(backendConfiguration(undefined, key).status).toBe('invalid');
  });
  it.each([
    'sb_secret_do-not-embed',
    'eyJhbGciOiJIUzI1NiJ9.service_role.signature',
    'postgres://admin:password@host/database',
  ])('rejects privileged or legacy credential %s', (value) => {
    const result = backendConfiguration(url, value);
    expect(result.status).toBe('invalid');
    expect(JSON.stringify(result)).not.toContain(value);
  });
  it.each([
    'http://zuno-test.supabase.co',
    'https://supabase.co.evil.example',
    'https://a.supabase.co/path',
    'https://user:secret@a.supabase.co',
    'https://a.supabase.co?token=secret',
    'https://a.supabase.co#secret',
  ])('rejects unsafe endpoint %s', (value) => {
    expect(backendConfiguration(value, key).status).toBe('invalid');
  });
});
