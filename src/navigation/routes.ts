export type Route =
  | { name: 'map' }
  | { name: 'friends' }
  | { name: 'profile'; userId?: string }
  | { name: 'privacy' }
  | { name: 'inbox'; friendId?: string }
  | { name: 'meetups'; meetupId?: string; clusterIds?: string[] }
  | { name: 'create-meetup'; friendId?: string }
  | { name: 'edit-meetup'; meetupId: string };
export type Navigate = (route: Route) => void;
