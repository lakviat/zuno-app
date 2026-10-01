import type { Coordinate } from '../types/domain';
export type MapViewport = Coordinate & { latitudeDelta: number; longitudeDelta: number };
export const validCoordinate = (p: Coordinate) =>
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180;
export const longitudeOffset = (a: number, b: number) => ((a - b + 540) % 360) - 180;
export function distanceMeters(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((a.latitude - b.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin((longitudeOffset(a.longitude, b.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function inViewport(p: Coordinate, view: MapViewport) {
  return (
    Math.abs(p.latitude - view.latitude) <= view.latitudeDelta * 0.6 &&
    Math.abs(longitudeOffset(p.longitude, view.longitude)) <=
      Math.min(180, view.longitudeDelta * 0.6)
  );
}
/** Stable grid prevents repeated random offsets being averaged into an exact location. */
export const approximateCoordinate = (p: Coordinate): Coordinate => ({
  latitude: Math.round(p.latitude / 0.02) * 0.02,
  longitude: Math.round(p.longitude / 0.02) * 0.02,
});
