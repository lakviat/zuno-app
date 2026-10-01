import type { Meetup } from '../../types/domain';
export interface MeetupCluster {
  meetups: Meetup[];
  x: number;
  y: number;
}
/** Nearby meetup pins collapse to one target; titles stay in the readable list/detail. */
export function clusterMeetups(
  points: { meetup: Meetup; x: number; y: number }[],
  radius = 70,
): MeetupCluster[] {
  const groups: MeetupCluster[] = [];
  for (const { meetup, x, y } of points) {
    const near = groups.find((g) => Math.hypot(g.x - x, g.y - y) < radius);
    if (near) {
      const n = near.meetups.length;
      near.x = (near.x * n + x) / (n + 1);
      near.y = (near.y * n + y) / (n + 1);
      near.meetups.push(meetup);
    } else groups.push({ meetups: [meetup], x, y });
  }
  return groups;
}
