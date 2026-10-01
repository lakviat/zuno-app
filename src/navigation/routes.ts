export type Route =
  | { name: 'map' }
  | { name: 'friends' }
  | { name: 'profile'; userId?: string }
  | { name: 'privacy' }
  | { name: 'inbox'; friendId?: string }
  | { name: 'plans'; planId?: string }
  | { name: 'create-plan'; friendId?: string };
export type Navigate = (route: Route) => void;
