import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { locationForViewer } from './privacy';
const location = createSeed().people[0].location!;
describe('location consent boundary', () => {
  it('never reveals a stranger location, even with precise or temporary sharing', () => {
    expect(
      locationForViewer(
        location,
        {
          mode: 'precise',
          ghostMode: false,
          temporary: { friendIds: ['stranger'], expiresAt: '2099-01-01' },
        },
        false,
        'stranger',
      ),
    ).toBeUndefined();
  });
  it('hides locations by default and gives ghost mode precedence over temporary sharing', () => {
    expect(
      locationForViewer(location, { mode: 'hidden', ghostMode: false }, true, 'alex'),
    ).toBeUndefined();
    expect(
      locationForViewer(
        location,
        {
          mode: 'precise',
          ghostMode: true,
          temporary: { friendIds: ['alex'], expiresAt: '2099-01-01' },
        },
        true,
        'alex',
      ),
    ).toBeUndefined();
  });
  it('returns an approximate grid center and removes identifying place data', () => {
    const result = locationForViewer(
      location,
      { mode: 'approximate', ghostMode: false },
      true,
      'alex',
    )!;
    expect(result.coordinate).not.toEqual(location.coordinate);
    expect(result.accuracyMeters).toBe(2500);
    expect(result.place).not.toBe(location.place);
    expect(result.precision).toBe('approximate');
  });
  it('expires temporary access and scopes it to selected friends', () => {
    const settings = {
      mode: 'hidden' as const,
      ghostMode: false,
      temporary: { friendIds: ['alex'], expiresAt: '2026-10-01T15:00:00Z' },
    };
    expect(
      locationForViewer(location, settings, true, 'alex', Date.parse('2026-10-01T14:59:00Z')),
    ).toEqual(location);
    expect(
      locationForViewer(location, settings, true, 'emma', Date.parse('2026-10-01T14:59:00Z')),
    ).toBeUndefined();
    expect(
      locationForViewer(location, settings, true, 'alex', Date.parse('2026-10-01T15:00:00Z')),
    ).toBeUndefined();
  });
});
