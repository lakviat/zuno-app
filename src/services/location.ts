import * as ExpoLocation from 'expo-location';
import type { Coordinate } from '../types/domain';
import type { LocationSample } from '../features/location/motion';
export interface LocationService {
  requestCurrentPosition(): Promise<Coordinate>;
  requestPermission(): Promise<'full' | 'reduced' | 'unknown'>;
  watch(
    distance: number,
    onSample: (sample: LocationSample) => void,
    onError: (error: string) => void,
    onAccuracy?: (accuracy: 'full' | 'reduced' | 'unknown') => void,
  ): Promise<{ remove(): void }>;
}
export const deviceLocation: LocationService = {
  async requestPermission() {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted')
      throw new Error('Location is off. You can still explore and choose meetup spots.');
    return permission.ios?.accuracy ?? 'unknown';
  },
  async requestCurrentPosition() {
    await this.requestPermission();
    const result = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });
    return { latitude: result.coords.latitude, longitude: result.coords.longitude };
  },
  async watch(distance, onSample, onError, onAccuracy) {
    // Recheck without prompting when returning from Settings/background.
    const permission = await ExpoLocation.getForegroundPermissionsAsync();
    if (permission.status !== 'granted')
      throw new Error('Location is off. You can still explore and choose meetup spots.');
    onAccuracy?.(permission.ios?.accuracy ?? 'unknown');
    // Reduced accuracy cannot satisfy the movement filter. Avoid a useless watch.
    if (permission.ios?.accuracy === 'reduced') return { remove() {} };
    return ExpoLocation.watchPositionAsync(
      // iOS Balanced requests ~100 m, which conflicts with our <=65 m filter.
      { accuracy: ExpoLocation.Accuracy.High, distanceInterval: distance, timeInterval: 5000 },
      (result) =>
        onSample({
          coordinate: { latitude: result.coords.latitude, longitude: result.coords.longitude },
          timestamp: result.timestamp,
          accuracy: result.coords.accuracy ?? Infinity,
          speed: result.coords.speed,
          heading: result.coords.heading,
        }),
      onError,
    );
  },
};
