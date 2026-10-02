import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone, requestPhoneCode, verifyPhoneCode } from './phoneAuth';

function fixture() {
  const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
  const verifyOtp = vi
    .fn()
    .mockResolvedValue({ data: { session: { user: { id: 'phone-user' } } }, error: null });
  return {
    client: { auth: { signInWithOtp, verifyOtp } } as unknown as SupabaseClient,
    signInWithOtp,
    verifyOtp,
  };
}
describe('phone authentication', () => {
  it.each(['+1 (202) 555-0123', '+44 7700 900123', '+996 555 123456'])(
    'accepts international formatting: %s',
    (phone) => {
      expect(normalizePhone(phone)).toMatch(/^\+[1-9]\d{6,14}$/);
    },
  );
  it.each([
    '2025550123',
    '+0123456789',
    '+123',
    '+1234567890123456',
    'testing@example.com',
    '+12025550123 ext 5',
    '+1+2025550123',
  ])('rejects ambiguous or malformed number: %s', async (phone) => {
    const f = fixture();
    await expect(requestPhoneCode(f.client, phone)).rejects.toThrow('country code');
    expect(f.signInWithOtp).not.toHaveBeenCalled();
  });
  it('requests an SMS for signup or returning users without signing in early', async () => {
    const f = fixture();
    await requestPhoneCode(f.client, '+1 (202) 555-0123');
    expect(f.signInWithOtp).toHaveBeenCalledWith({
      phone: '+12025550123',
      options: { shouldCreateUser: true, channel: 'sms' },
    });
    expect(f.verifyOtp).not.toHaveBeenCalled();
  });
  it('submits even the local fixture code to Supabase; it never bypasses the server', async () => {
    const f = fixture();
    f.verifyOtp.mockResolvedValue({ data: { session: null }, error: { code: 'otp_expired' } });
    await expect(verifyPhoneCode(f.client, '+12025550123', '000000')).rejects.toThrow(
      'couldn’t be verified',
    );
    expect(f.verifyOtp).toHaveBeenCalledWith({
      phone: '+12025550123',
      token: '000000',
      type: 'sms',
    });
  });
  it('requires a real session after verification', async () => {
    const f = fixture();
    f.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(verifyPhoneCode(f.client, '+12025550123', '123456')).rejects.toThrow();
  });
  it('accepts the session returned for a valid server code', async () => {
    const f = fixture();
    await expect(verifyPhoneCode(f.client, '+12025550123', '123456')).resolves.toBeUndefined();
  });
  it.each(['0000', 'abcdef', '1234567'])(
    'rejects invalid code before networking: %s',
    async (code) => {
      const f = fixture();
      await expect(verifyPhoneCode(f.client, '+12025550123', code)).rejects.toThrow('six-digit');
      expect(f.verifyOtp).not.toHaveBeenCalled();
    },
  );
  it.each(['phone_provider_disabled', 'sms_send_failed'])(
    'handles unavailable SMS without exposing provider details: %s',
    async (code) => {
      const f = fixture();
      f.signInWithOtp.mockResolvedValue({ error: { code, message: 'private provider details' } });
      await expect(requestPhoneCode(f.client, '+12025550123')).rejects.toThrow(
        'Try email, Apple or Google',
      );
    },
  );
  it('handles throttling', async () => {
    const f = fixture();
    f.signInWithOtp.mockResolvedValue({ error: { code: 'over_sms_send_rate_limit' } });
    await expect(requestPhoneCode(f.client, '+12025550123')).rejects.toThrow('wait a minute');
  });
  it('handles network failure without authenticating', async () => {
    const f = fixture();
    f.signInWithOtp.mockRejectedValue(new Error('offline'));
    await expect(requestPhoneCode(f.client, '+12025550123')).rejects.toThrow('connection');
    expect(f.verifyOtp).not.toHaveBeenCalled();
  });
});
