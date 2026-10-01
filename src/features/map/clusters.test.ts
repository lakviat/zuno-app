import { expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { clusterPeople } from './clusters';
it('clusters adjacent avatars and retains every person', () => {
  const p = createSeed().people;
  const result = clusterPeople([
    { person: p[1], x: 20, y: 20 },
    { person: p[2], x: 30, y: 40 },
    { person: p[3], x: 200, y: 250 },
  ]);
  expect(result).toHaveLength(2);
  expect(result[0].people).toHaveLength(2);
  expect(result[0].x).toBe(25);
  expect(result.flatMap((c) => c.people)).toHaveLength(3);
});
