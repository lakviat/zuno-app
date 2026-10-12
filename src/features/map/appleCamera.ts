// Apple camera altitude is stable at world scale; longitude spans are not.
export const APPLE_MIN_ALTITUDE = 100;
export const APPLE_MAX_ALTITUDE = 32_000_000;
export const APPLE_MAX_ZOOM = Math.log2(APPLE_MAX_ALTITUDE / APPLE_MIN_ALTITUDE);
export const appleZoom = (altitude: number) => Math.log2(APPLE_MAX_ALTITUDE / altitude);
export const appleAltitude = (zoom: number) => APPLE_MAX_ALTITUDE / 2 ** zoom;
