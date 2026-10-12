import { expect, it } from 'vitest';
import { meetupDetail, meetupClusterRadius, viewportZoom } from './meetupPresentation';

it('reduces artwork from neighborhood cards to city badges to overview pins and restores it', () => {
  expect(meetupDetail(viewportZoom(0.05, 393))).toBe('detail');
  expect(meetupDetail(viewportZoom(0.4, 393), 'detail')).toBe('badge');
  expect(meetupDetail(viewportZoom(8, 393), 'badge')).toBe('overview');
  expect(meetupDetail(viewportZoom(0.05, 393), 'overview')).toBe('detail');
  expect(meetupClusterRadius('detail')).toBeGreaterThan(meetupClusterRadius('badge'));
  expect(meetupClusterRadius('badge')).toBeGreaterThan(meetupClusterRadius('overview'));
});

it('does not flicker at either presentation boundary', () => {
  expect(meetupDetail(11.95, 'detail')).toBe('detail');
  expect(meetupDetail(12.05, 'badge')).toBe('badge');
  expect(meetupDetail(8.95, 'badge')).toBe('badge');
  expect(meetupDetail(9.05, 'overview')).toBe('overview');
});
