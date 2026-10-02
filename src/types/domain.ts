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
  availability?: 'free' | 'later' | 'busy';
  availableUntil?: string;
  intent?: string;
}
export type LocationPrecision = 'precise' | 'approximate' | 'hidden';
export interface TemporarySharing {
  friendIds: ID[];
  expiresAt: string;
}
export interface LocationPrivacy {
  showSpeed?: boolean;
  showHeading?: boolean;
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
  /** Inbound friend-visible data, never the device's private GPS sample. */
  friendPrivacy?: LocationPrivacy;
  discoverability?: 'public' | 'friends' | 'hidden';
  publicDiscoveryLocation?: Location;
  mapAudience?: 'friend' | 'public';
}
export interface Conversation {
  id: ID;
  participantIds: ID[];
  unreadCount: number;
  meetupId?: ID;
}
export interface Message {
  id: ID;
  conversationId: ID;
  senderId: ID;
  text: string;
  createdAt: string;
  state: 'sent' | 'read';
  kind?: 'text' | 'system';
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
  mode?: 'public' | 'friends' | 'hidden';
  hiddenUserIds?: ID[];
  units?: 'mph' | 'kmh';
}
export interface AppSnapshot {
  dataMode?: 'cloud';
  version: 2;
  edgeZoomHintSeen?: boolean;
  currentUserId: ID;
  people: Person[];
  friendships: Friendship[];
  conversations: Conversation[];
  messages: Message[];
  meetups: Meetup[];
  blocks: Block[];
  reports: Report[];
  notifications: Notification[];
  privacy: LocationPrivacy;
  theme: 'light' | 'dark' | 'system';
  discovery: DiscoveryPreferences;
}

/** v1 is retained only as the input to the non-destructive migration. */
export type LegacySnapshot = Omit<AppSnapshot, 'version' | 'meetups'> & {
  version: 1;
  plans: Plan[];
};
export type MeetupVisibility = 'friends' | 'invite-only' | 'public';
export interface MeetupPlace extends Place {
  kind: 'public-venue' | 'area' | 'map-pin';
  areaId: string;
}
export interface Meetup {
  id: ID;
  hostId: ID;
  title: string;
  description: string;
  emoji: string;
  place: MeetupPlace;
  startsAt: string;
  endsAt: string;
  visibility: MeetupVisibility;
  invitedUserIds: ID[];
  participantIds: ID[];
  capacity?: number;
  status: 'scheduled' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}
export interface MeetupDraft {
  title: string;
  description: string;
  emoji: string;
  placeId: ID;
  place?: MeetupPlace;
  startNow?: boolean;
  startsAt: string;
  endsAt: string;
  visibility: MeetupVisibility;
  invitedUserIds: ID[];
  capacity?: number;
}
