import type { Meetup } from '../../types/domain';
export interface MeetupCluster {
  meetups: Meetup[];
  x: number;
  y: number;
}
/** Stable representatives, never a moving centroid. A spatial index keeps dense
 * discovery cheap; every member remains reachable through the cluster's list. */
export function clusterMeetups(
  points: { meetup: Meetup; x: number; y: number }[],
  radius = 70,
): MeetupCluster[] {
  const groups: MeetupCluster[] = [];
  const cells = new Map<string, MeetupCluster[]>();
  for (const { meetup, x, y } of [...points].sort((a, b) =>
    a.meetup.id.localeCompare(b.meetup.id),
  )) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const column = Math.floor(x / radius);
    const row = Math.floor(y / radius);
    let near: MeetupCluster | undefined;
    let distance = radius;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const group of cells.get(`${column + dx}:${row + dy}`) ?? []) {
          const next = Math.hypot(group.x - x, group.y - y);
          const tied = near && Math.abs(next - distance) < 0.000001;
          if (
            next < radius &&
            (!near ||
              (tied ? group.meetups[0].id.localeCompare(near.meetups[0].id) < 0 : next < distance))
          ) {
            near = group;
            distance = next;
          }
        }
      }
    }
    if (near) {
      near.meetups.push(meetup);
    } else {
      const group = { meetups: [meetup], x, y };
      groups.push(group);
      const key = `${column}:${row}`;
      cells.set(key, [...(cells.get(key) ?? []), group]);
    }
  }
  return groups;
}
