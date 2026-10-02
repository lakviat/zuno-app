import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceLocation } from './location';
const native = vi.hoisted(() => ({ request: vi.fn(), check: vi.fn(), watch: vi.fn() }));
vi.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  requestForegroundPermissionsAsync: native.request,
  getForegroundPermissionsAsync: native.check,
  watchPositionAsync: native.watch,
}));

beforeEach(() => {
  vi.resetAllMocks();
  native.check.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
});
describe('foreground device location for distribution', () => {
  it('denial rejects without starting a watch or requiring a backend', async () => {
    native.request.mockResolvedValue({ status: 'denied' });
    await expect(deviceLocation.requestPermission()).rejects.toThrow('You can still explore');
    expect(native.watch).not.toHaveBeenCalled();
  });
  it('does not ask again after permanent denial', async () => {
    native.check.mockResolvedValue({ status: 'denied', canAskAgain: false });
    await expect(deviceLocation.requestPermission()).rejects.toThrow('Location is off');
    expect(native.request).not.toHaveBeenCalled();
  });
  it('reports reduced precision and avoids a watcher that cannot satisfy the GPS filter', async () => {
    native.request.mockResolvedValue({ status: 'granted', ios: { accuracy: 'reduced' } });
    expect(await deviceLocation.requestPermission()).toBe('reduced');
    native.check.mockResolvedValue({ status: 'granted', ios: { accuracy: 'reduced' } });
    const accuracy = vi.fn();
    const subscription = await deviceLocation.watch(35, vi.fn(), vi.fn(), accuracy);
    expect(accuracy).toHaveBeenCalledWith('reduced');
    expect(native.watch).not.toHaveBeenCalled();
    expect(() => subscription.remove()).not.toThrow();
  });
  it('rechecks permission without prompting after a Settings/background transition', async () => {
    native.check.mockResolvedValue({ status: 'denied' });
    await expect(deviceLocation.watch(10, vi.fn(), vi.fn())).rejects.toThrow('Location is off');
    expect(native.request).not.toHaveBeenCalled();
    expect(native.watch).not.toHaveBeenCalled();
  });
  it('uses accuracy compatible with the filter and preserves native speed/course/timestamp', async () => {
    native.check.mockResolvedValue({ status: 'granted', ios: { accuracy: 'full' } });
    const remove = vi.fn();
    native.watch.mockResolvedValue({ remove });
    const sample = vi.fn();
    const error = vi.fn();
    expect(await deviceLocation.watch(10, sample, error)).toEqual({ remove });
    const [options, callback, onError] = native.watch.mock.calls[0];
    expect(options).toEqual({ accuracy: 4, distanceInterval: 10, timeInterval: 5000 });
    callback({
      timestamp: 1234,
      coords: { latitude: 25, longitude: -80, accuracy: null, speed: -1, heading: -1 },
    });
    expect(sample).toHaveBeenCalledWith({
      timestamp: 1234,
      coordinate: { latitude: 25, longitude: -80 },
      accuracy: Infinity,
      speed: -1,
      heading: -1,
    });
    onError('Unavailable');
    expect(error).toHaveBeenCalledWith('Unavailable');
  });
});
