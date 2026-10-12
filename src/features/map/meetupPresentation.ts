export type MeetupDetail = 'detail' | 'badge' | 'overview';

export const MEETUP_ANCHOR = { x: 0.5, y: 1 };
const sizes = {
  detail: { width: 135, height: 84 },
  badge: { width: 58, height: 48 },
  overview: { width: 44, height: 44 },
  cluster: { width: 48, height: 44 },
} as const;
// Explicit, fixed dimensions within each presentation also bound native touch targets.
export const meetupMarkerSize = (detail: MeetupDetail | 'cluster') => sizes[detail];
export const meetupCenterOffset = (detail: MeetupDetail | 'cluster') => ({
  x: 0,
  y: -sizes[detail].height / 2,
});

/** Three readable sizes, with hysteresis so a resting camera doesn't flicker. */
export function meetupDetail(zoom: number, previous?: MeetupDetail): MeetupDetail {
  const detailBoundary = previous === 'detail' ? 11.8 : 12.2;
  const badgeBoundary = previous === 'overview' ? 9.2 : 8.8;
  if (zoom >= detailBoundary) return 'detail';
  if (zoom >= badgeBoundary) return 'badge';
  return 'overview';
}

export const meetupClusterRadius = (detail: MeetupDetail) =>
  detail === 'detail' ? 140 : detail === 'badge' ? 64 : 48;

export const viewportZoom = (longitudeDelta: number, width: number) =>
  Math.log2((360 * width) / (256 * Math.max(longitudeDelta, 0.000001)));
