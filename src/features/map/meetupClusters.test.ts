import { clusterMeetups } from './meetupClusters';
import { expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
it('groups overlapping meetups into a single reachable target', () => {
  const [first, second] = createSeed().meetups;
  const groups = clusterMeetups([
    { meetup: first, x: 100, y: 100 },
    { meetup: second, x: 104, y: 102 },
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].meetups.map((m) => m.id)).toEqual([first.id, second.id].sort());
});

it('anchors each group to a real meetup, independent of discovery order or panning', () => {
  const [first, second] = createSeed().meetups;
  const points = [
    { meetup: { ...first, id: 'a' }, x: 100, y: 100 },
    { meetup: { ...second, id: 'b' }, x: 120, y: 130 },
  ];
  const original = clusterMeetups(points);
  expect(original[0]).toMatchObject({ x: 100, y: 100 });
  const moved = clusterMeetups(
    points.toReversed().map((p) => ({ ...p, x: p.x - 328, y: p.y + 79 })),
  );
  expect(moved.map((g) => g.meetups)).toEqual(original.map((g) => g.meetups));
  expect(moved[0]).toMatchObject({ x: -228, y: 179 });
});

it('keeps 1,000 dense meetups reachable through a bounded set of separated targets', () => {
  const meetup = createSeed().meetups[0];
  const points = Array.from({ length: 1000 }, (_, i) => ({
    meetup: { ...meetup, id: `load-${String(i).padStart(4, '0')}` },
    x: (i % 25) * 15,
    y: Math.floor(i / 25) * 18,
  }));
  const groups = clusterMeetups(points, 48);
  expect(groups.length).toBeLessThan(120);
  expect(new Set(groups.flatMap((g) => g.meetups.map((m) => m.id))).size).toBe(1000);
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++)
      expect(
        Math.hypot(groups[i].x - groups[j].x, groups[i].y - groups[j].y),
      ).toBeGreaterThanOrEqual(48);
  }
  const separated = clusterMeetups(
    points.map((p) => ({ ...p, x: p.x * 10, y: p.y * 10 })),
    140,
  );
  expect(separated).toHaveLength(1000);
});

it('keeps equal-distance memberships stable when panning across spatial-index cells', () => {
  const meetup = createSeed().meetups[0];
  const points = [
    { meetup: { ...meetup, id: 'a' }, x: 0, y: 59 },
    { meetup: { ...meetup, id: 'b' }, x: 59, y: 0 },
    { meetup: { ...meetup, id: 'c' }, x: 30, y: 30 },
  ];
  const members = (entries: typeof points) =>
    clusterMeetups(entries, 60).map((g) => g.meetups.map((m) => m.id));
  expect(members(points)).toEqual([['a', 'c'], ['b']]);
  expect(members(points.map((p) => ({ ...p, y: p.y + 10 })))).toEqual(members(points));
});
