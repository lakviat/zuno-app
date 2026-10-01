import type { Coordinate } from '../../types/domain';
import { distanceMeters, validCoordinate } from '../../utils/geo';
export interface LocationSample {
  coordinate: Coordinate;
  timestamp: number;
  accuracy: number;
  speed: number | null; // Native meters/second, not inferred from animation.
  heading: number | null;
}
export function filterSample(
  raw: LocationSample,
  previous?: LocationSample,
  now = Date.now(),
): LocationSample | undefined {
  if (
    !validCoordinate(raw.coordinate) ||
    !Number.isFinite(raw.timestamp) ||
    now - raw.timestamp > 90000 ||
    raw.timestamp > now + 10000 ||
    !Number.isFinite(raw.accuracy) ||
    raw.accuracy < 0 ||
    raw.accuracy > 65
  )
    return;
  if (previous && raw.timestamp <= previous.timestamp) return;
  const distance = previous ? distanceMeters(previous.coordinate, raw.coordinate) : 0;
  const seconds = previous ? (raw.timestamp - previous.timestamp) / 1000 : 1;
  if (previous && seconds < 90 && distance > 80 * seconds + previous.accuracy + raw.accuracy)
    return;
  const validSpeed =
    raw.speed !== null && Number.isFinite(raw.speed) && raw.speed >= 0 && raw.speed <= 70;
  const speed = validSpeed
    ? raw.speed! < 1
      ? 0
      : previous?.speed && seconds < 20
        ? previous.speed * 0.25 + raw.speed! * 0.75
        : raw.speed
    : null;
  const bearing =
    raw.heading !== null &&
    Number.isFinite(raw.heading) &&
    raw.heading >= 0 &&
    raw.heading < 360 &&
    speed !== null &&
    speed >= 1;
  const heading = bearing
    ? previous?.heading != null && seconds < 20
      ? (previous.heading + (((raw.heading! - previous.heading + 540) % 360) - 180) * 0.65 + 360) %
        360
      : raw.heading
    : null;
  return {
    ...raw,
    speed,
    heading,
    coordinate:
      previous && distance < Math.max(4, raw.accuracy * 0.5) ? previous.coordinate : raw.coordinate,
  };
}
export function motionLabel(
  sample?: LocationSample,
  units: 'mph' | 'kmh' = 'mph',
  now = Date.now(),
) {
  if (!sample || now - sample.timestamp > 90000) return 'Location not live';
  if (sample.speed === null) return 'Speed unavailable';
  if (sample.speed < 1) return 'Stationary';
  const speed = Math.round(sample.speed * (units === 'mph' ? 2.23694 : 3.6));
  const dirs = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ];
  return `Moving · ${speed} ${units === 'mph' ? 'mph' : 'km/h'}${sample.heading === null ? '' : ` · Heading ${dirs[Math.round(sample.heading / 45) % 8]}`}`;
}
export function updatePolicy(speed: number | null) {
  return speed !== null && speed >= 5
    ? { interval: 5000, distance: 15 }
    : speed !== null && speed >= 1
      ? { interval: 10000, distance: 10 }
      : { interval: 60000, distance: 35 };
}

/** First fixes and long gaps snap to their valid position rather than flying across the world. */
export function canInterpolate(
  previous: LocationSample | undefined,
  next: LocationSample | undefined,
) {
  return (
    !!previous &&
    !!next &&
    next.accuracy <= 65 &&
    next.timestamp > previous.timestamp &&
    next.timestamp - previous.timestamp <= 30000 &&
    distanceMeters(previous.coordinate, next.coordinate) < 1000
  );
}
