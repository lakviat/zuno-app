import type { SupabaseClient } from '@supabase/supabase-js';

export interface PhoneAuth {
  request(phone: string): Promise<void>;
  verify(phone: string, code: string): Promise<void>;
}

/** Bare 10-digit numbers default to the US; explicit international numbers are preserved. */
export function normalizePhone(value: string): string | null {
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (/^\d{10}$/.test(phone)) return `+1${phone}`;
  if (/^1\d{10}$/.test(phone)) return `+${phone}`;
  if (phone.startsWith('+1') && phone.length !== 12) return null;
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
}

function message(issue: unknown, verifying: boolean) {
  const code = issue && typeof issue === 'object' && 'code' in issue ? issue.code : '';
  if (
    code === 'phone_provider_disabled' ||
    code === 'provider_disabled' ||
    code === 'sms_send_failed'
  )
    return 'SMS sign-in isn’t available for this Zuno beta yet. Go back to choose another sign-in method.';
  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit')
    return 'Too many attempts. Please wait a minute before trying again.';
  return verifying
    ? 'That code couldn’t be verified. Check the latest SMS code or request a new one.'
    : 'We couldn’t send a code. Check your number and connection, then try again.';
}

export async function requestPhoneCode(client: SupabaseClient, value: string) {
  const phone = normalizePhone(value);
  if (!phone)
    throw new Error(
      'Enter a 10-digit US phone number, or an international number with its country code.',
    );
  try {
    const { error } = await client.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true, channel: 'sms' },
    });
    if (error) throw error;
  } catch (issue) {
    throw new Error(message(issue, false));
  }
}

export async function verifyPhoneCode(client: SupabaseClient, value: string, token: string) {
  const phone = normalizePhone(value);
  if (!phone || !/^\d{6}$/.test(token)) throw new Error('Enter the six-digit code from your SMS.');
  try {
    // All codes are verified by Supabase. There is no hosted or native test-code override.
    const { data, error } = await client.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error || !data.session) throw error ?? new Error('missing-session');
  } catch (issue) {
    throw new Error(message(issue, true));
  }
}
