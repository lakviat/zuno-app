import type { Coordinate, Person, Meetup } from '../../types/domain';
export const MIAMI = { latitude: 25.7885, longitude: -80.141 };
export interface MapHandle {
  recenter(coordinate?: Coordinate): void;
  zoomBy(delta: number): void;
  beginZoom(): void;
  updateZoom(deltaFromStart: number): void;
  endZoom(): void;
}
export interface SocialMapProps {
  people: Person[];
  me: Person;
  meetups: Meetup[];
  dark: boolean;
  selectedId?: string;
  onPersonPress(id: string): void;
  onMeetupPress(id: string): void;
  onMeetupClusterPress(ids: string[]): void;
}
