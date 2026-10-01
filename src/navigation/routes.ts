import type { Coordinate, MeetupPlace } from '../types/domain';
export type Route =
  | { name: 'map'; coordinate?: Coordinate }
  | { name: 'availability' }
  | { name: 'meetup-chat'; meetupId: string }
  | { name: 'friends' }
  | { name: 'profile'; userId?: string }
  | { name: 'privacy' }
  | { name: 'inbox'; friendId?: string }
  | { name: 'meetups'; meetupId?: string; clusterIds?: string[] }
  | { name: 'create-meetup'; friendId?: string; place?: MeetupPlace }
  | { name: 'edit-meetup'; meetupId: string };
export type Navigate = (route: Route) => void;
