export type ID = string;
export type Coordinate = { latitude: number; longitude: number };
export type PresenceKind =
  'online' | 'recent' | 'home' | 'work' | 'traveling' | 'hanging-out' | 'busy' | 'invisible';
export interface User {
  id: ID;
  createdAt: string;
}
export interface Profile {
  userId: ID;
  displayName: string;
  username: string;
  bio: string;
  city?: string;
  avatar: string;
  color: string;
}
export interface Presence {
  userId: ID;
  kind: PresenceKind;
  status: string;
  emoji: string;
  updatedAt: string;
  freeNow: boolean;
}
export type LocationPrecision = 'precise' | 'approximate' | 'hidden';
export interface TemporarySharing {
  friendIds: ID[];
  expiresAt: string;
}
export interface LocationPrivacy {
  mode: LocationPrecision;
  ghostMode: boolean;
  temporary?: TemporarySharing;
}
export interface Location {
  userId: ID;
  coordinate: Coordinate;
  accuracyMeters: number;
  updatedAt: string;
  place: string;
  precision: Exclude<LocationPrecision, 'hidden'>;
}
export interface Friendship {
  id: ID;
  requesterId: ID;
  addresseeId: ID;
  status: 'accepted' | 'pending';
  createdAt: string;
}
export interface Person {
  user: User;
  profile: Profile;
  presence: Presence;
  location?: Location;
}
export interface Conversation {
  id: ID;
  participantIds: ID[];
  unreadCount: number;
}
export interface Message {
  id: ID;
  conversationId: ID;
  senderId: ID;
  text: string;
  createdAt: string;
  state: 'sent' | 'read';
}
export interface Place {
  id: ID;
  name: string;
  area: string;
  coordinate: Coordinate;
  precision: 'precise' | 'approximate';
}
export interface PlanParticipant {
  userId: ID;
  status: 'interested' | 'joined';
}
export interface Plan {
  id: ID;
  creatorId: ID;
  title: string;
  description?: string;
  emoji: string;
  place: Place;
  startsAt: string;
  expiresAt: string;
  invitedFriendIds: ID[];
  participants: PlanParticipant[];
}
export interface Block {
  blockerId: ID;
  blockedId: ID;
  createdAt: string;
}
export interface Report {
  id: ID;
  reporterId: ID;
  subjectId: ID;
  reason: string;
  createdAt: string;
}
export interface Notification {
  id: ID;
  userId: ID;
  kind: 'message' | 'friend-request' | 'plan';
  title: string;
  read: boolean;
  createdAt: string;
}
export interface DiscoveryPreferences {
  optedIn: boolean;
  area?: string;
  interests: string[];
}
export interface AppSnapshot {
  version: 1;
  currentUserId: ID;
  people: Person[];
  friendships: Friendship[];
  conversations: Conversation[];
  messages: Message[];
  plans: Plan[];
  blocks: Block[];
  reports: Report[];
  notifications: Notification[];
  privacy: LocationPrivacy;
  theme: 'light' | 'dark' | 'system';
  discovery: DiscoveryPreferences;
}
