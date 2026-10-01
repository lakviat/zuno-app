import type { Coordinate, MeetupPlace } from '../../types/domain';
import { distanceMeters } from '../../utils/geo';
import { demoAreas, meetupPlaces } from './places';

/** Offline label, deliberately never pretending that reverse geocoding found an address. */
export function mapPlace(coordinate: Coordinate): MeetupPlace {
  const area = [...demoAreas].sort(
    (a, b) => distanceMeters(a.coordinate, coordinate) - distanceMeters(b.coordinate, coordinate),
  )[0];
  const nearby = distanceMeters(area.coordinate, coordinate) < 7000;
  const venue = meetupPlaces.find(
    (p) => p.kind === 'public-venue' && distanceMeters(p.coordinate, coordinate) < 90,
  );
  return {
    id: `pin-${coordinate.latitude.toFixed(5)}-${coordinate.longitude.toFixed(5)}`,
    name: venue ? `Near ${venue.name}` : 'Pinned meeting spot',
    area: nearby
      ? area.name
      : `${coordinate.latitude.toFixed(3)}, ${coordinate.longitude.toFixed(3)}`,
    areaId: nearby ? area.id : 'map-area',
    coordinate: { ...coordinate },
    precision: 'precise',
    kind: 'map-pin',
  };
}
