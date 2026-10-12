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
  expect(groups[0].meetups.map((m) => m.id)).toEqual([first.id, second.id]);
});
