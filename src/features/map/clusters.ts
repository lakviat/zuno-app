import type { Person } from '../../types/domain';
export interface ProjectedPerson {
  person: Person;
  x: number;
  y: number;
}
export interface MapCluster {
  id: string;
  people: ProjectedPerson[];
  x: number;
  y: number;
}
/** Screen-space clustering keeps avatar hit targets separate across providers. */
export function clusterPeople(people: ProjectedPerson[], radius = 62): MapCluster[] {
  const clusters: MapCluster[] = [];
  for (const p of people) {
    const near = clusters.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < radius);
    if (near) {
      near.people.push(p);
      const n = near.people.length;
      near.x = (near.x * (n - 1) + p.x) / n;
      near.y = (near.y * (n - 1) + p.y) / n;
    } else clusters.push({ id: p.person.user.id, people: [p], x: p.x, y: p.y });
  }
  return clusters;
}
