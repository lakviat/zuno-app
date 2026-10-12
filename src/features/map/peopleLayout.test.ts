import { expect, it } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { layoutPeople } from './peopleLayout';

it.each([true, false])(
  'keeps every colocated person individually tappable (compact=%s)',
  (compact) => {
    const people = createSeed().people;
    const points = people.map((person) => ({ person, x: 200, y: 300 }));
    const result = layoutPeople(points, compact);
    expect(result.map((p) => p.person.user.id).sort()).toEqual(people.map((p) => p.user.id).sort());
    for (let i = 0; i < result.length; i++) {
      expect(result[i].person).toBe(people.find((p) => p.user.id === result[i].person.user.id));
      for (const other of result.slice(i + 1)) {
        expect(
          Math.abs(result[i].offset.x - other.offset.x) >= (compact ? 76 : 148) ||
            Math.abs(result[i].offset.y - other.offset.y) >= (compact ? 88 : 144),
        ).toBe(true);
      }
    }
    expect(layoutPeople([...points].reverse(), compact)).toEqual(result);
  },
);

it('leaves isolated pins at their actual projected coordinates and ignores unprojectable points', () => {
  const people = createSeed().people;
  const points = people.slice(0, 3).map((person, i) => ({ person, x: i * 300, y: 200 }));
  const result = layoutPeople([...points, { person: people[3], x: NaN, y: Infinity }], true);
  expect(result).toHaveLength(3);
  expect(result.every((p) => p.offset.x === 0 && p.offset.y === 0)).toBe(true);
});
