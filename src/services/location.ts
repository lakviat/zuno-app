import * as ExpoLocation from 'expo-location';
import type { Coordinate } from '../types/domain';
import type { LocationSample } from '../features/location/motion';
export interface LocationService {
  requestCurrentPosition(): Promise<Coordinate>;
  requestPermission(): Promise<void>;
  watch(
    distance: number,
    onSample: (sample: LocationSample) => void,
    onError: (error: string) => void,
  ): Promise<{ remove(): void }>;
}
export const deviceLocation: LocationService = {
  async requestPermission() {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted')
      throw new Error('Location is off. You can still explore and choose meetup spots.');
  },
  async requestCurrentPosition() {
    await this.requestPermission();
    const result = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });
    return { latitude: result.coords.latitude, longitude: result.coords.longitude };
  },
  async watch(distance, onSample, onError) {
    return ExpoLocation.watchPositionAsync(
      { accuracy: ExpoLocation.Accuracy.Balanced, distanceInterval: distance, timeInterval: 5000 },
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
