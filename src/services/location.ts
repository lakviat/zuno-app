import * as ExpoLocation from 'expo-location';
import type { Coordinate } from '../types/domain';

export interface LocationService {
  requestCurrentPosition(): Promise<Coordinate>;
}
/** Foreground only. No watcher, background task, or network broadcast exists in Phase 1. */
export const deviceLocation: LocationService = {
  async requestCurrentPosition() {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted')
      throw new Error('Location is off. You can still explore your demo world.');
    const result = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });
    return { latitude: result.coords.latitude, longitude: result.coords.longitude };
  },
};
