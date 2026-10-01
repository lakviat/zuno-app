import { describe, expect, it } from 'vitest';
import { endAfterStartChange, toInstant } from './localTime';

describe('meetup scheduling', () => {
  it('preserves duration when moving the start across midnight or to a new day', () => {
    expect(endAfterStartChange('2026-10-01T18:00', '2026-10-01T19:30', '2026-10-02T23:30')).toBe(
      '2026-10-03T01:00',
    );
  });
  it('keeps an explicitly invalid end available for validation instead of silently fixing it', () => {
    expect(endAfterStartChange('2026-10-01T18:00', '2026-10-01T17:00', '2026-10-02T18:00')).toBe(
      '2026-10-01T17:00',
    );
    expect(endAfterStartChange('2026-10-01T18:00', '2026-10-01T19:00', '')).toBe(
      '2026-10-01T19:00',
    );
  });
  it('rejects a normalized calendar date', () => {
    expect(toInstant('2026-02-30T12:00')).toBe('');
  });
});
