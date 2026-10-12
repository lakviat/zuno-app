import type { Person } from '../../types/domain';

interface ProjectedPerson {
  person: Person;
  x: number;
  y: number;
}

/** Every person keeps an avatar and their real coordinate. Small screen offsets
 * separate overlapping hit targets instead of replacing people with a count.
 * Stable ID order prevents a refresh from shuffling people around a shared spot.
 */
export function layoutPeople(points: ProjectedPerson[], compact: boolean) {
  const width = compact ? 76 : 148;
  const height = compact ? 88 : 144;
  const occupied = new Map<string, { x: number; y: number }[]>();
  const cell = (x: number, y: number) => [Math.floor(x / width), Math.floor(y / height)];
  const fits = (x: number, y: number) => {
    const [cx, cy] = cell(x, y);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (
          occupied
            .get(`${cx + dx}:${cy + dy}`)
            ?.some((p) => Math.abs(p.x - x) < width && Math.abs(p.y - y) < height)
        )
          return false;
    return true;
  };
  return [...points]
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.person.user.id.localeCompare(b.person.user.id))
    .map((p) => {
      let x = p.x,
        y = p.y;
      search: for (let ring = 1; !fits(x, y); ring++) {
        // Try the nearest perimeter before expanding, keeping each person reachable.
        for (let dx = -ring; dx <= ring; dx++)
          for (let dy = -ring; dy <= ring; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const nx = p.x + dx * width,
              ny = p.y + dy * height;
            if (fits(nx, ny)) {
              x = nx;
              y = ny;
              break search;
            }
          }
      }
      const key = cell(x, y).join(':');
      occupied.set(key, [...(occupied.get(key) ?? []), { x, y }]);
      return { ...p, offset: { x: x - p.x, y: y - p.y } };
    });
}
