import type { MeetupPlace } from '../../types/domain';
export const demoAreas = [
  {
    id: 'sunset-harbour',
    name: 'Sunset Harbour',
    coordinate: { latitude: 25.793, longitude: -80.145 },
  },
  { id: 'south-beach', name: 'South Beach', coordinate: { latitude: 25.781, longitude: -80.135 } },
] as const;
/** Exact pins come only from this deliberately selected public venue catalog. Never from Person.location. */
export const meetupPlaces: MeetupPlace[] = [
  {
    id: 'panther',
    name: 'Panther Coffee',
    area: 'Sunset Harbour',
    areaId: 'sunset-harbour',
    coordinate: { latitude: 25.7931, longitude: -80.1449 },
    precision: 'precise',
    kind: 'public-venue',
  },
  {
    id: 'park',
    name: 'Flamingo Park',
    area: 'South Beach',
    areaId: 'south-beach',
    coordinate: { latitude: 25.7811, longitude: -80.1394 },
    precision: 'precise',
    kind: 'public-venue',
  },
  {
    id: 'beach',
    name: 'South Beach area',
    area: 'South Beach',
    areaId: 'south-beach',
    coordinate: { latitude: 25.775, longitude: -80.13 },
    precision: 'approximate',
    kind: 'area',
  },
  {
    id: 'harbour-area',
    name: 'Sunset Harbour area',
    area: 'Sunset Harbour',
    areaId: 'sunset-harbour',
    coordinate: { latitude: 25.793, longitude: -80.145 },
    precision: 'approximate',
    kind: 'area',
  },
];
export const activities = [
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🌅', label: 'Sunset' },
  { emoji: '🌊', label: 'Beach' },
  { emoji: '🏀', label: 'Sport' },
  { emoji: '🌿', label: 'Outdoors' },
];
export const audienceLabels = {
  friends: 'Friends',
  'invite-only': 'Invite-only',
  public: 'Public nearby',
};
