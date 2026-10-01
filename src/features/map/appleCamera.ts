// Apple camera altitude is stable at globe scale; longitude spans are not.
export const APPLE_MIN_ALTITUDE = 100;
export const APPLE_MAX_ALTITUDE = 32_000_000;
export const APPLE_MAX_ZOOM = Math.log2(APPLE_MAX_ALTITUDE / APPLE_MIN_ALTITUDE);
export const appleZoom = (altitude: number) => Math.log2(APPLE_MAX_ALTITUDE / altitude);
export const appleAltitude = (zoom: number) => APPLE_MAX_ALTITUDE / 2 ** zoom;

/** Hysteresis keeps the map style from flickering at the regional transition. */
export function usesGlobe(altitude: number, wasGlobe: boolean) {
  return altitude >= (wasGlobe ? 350_000 : 600_000);
}

/** MapKit caps globe distance. Fit its viewport to a square as Earth pulls away,
 * so a portrait display can show the entire sphere instead of clipping its sides.
 */
export function globeViewportHeight(altitude: number, width: number, height: number) {
  const progress = Math.max(0, Math.min(1, Math.log2(altitude / 4_000_000) / 3));
  return Math.round(height + (Math.min(width, height) - height) * progress);
}
