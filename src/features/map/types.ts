import type { Coordinate, Person, Plan } from '../../types/domain';
export const MIAMI = { latitude: 25.7885, longitude: -80.141 };
export interface MapHandle {
  recenter(coordinate?: Coordinate): void;
  zoomBy(delta: number): void;
}
export interface SocialMapProps {
  people: Person[];
  me: Person;
  plans: Plan[];
  dark: boolean;
  selectedId?: string;
  onPersonPress(id: string): void;
  onPlanPress(id: string): void;
}
