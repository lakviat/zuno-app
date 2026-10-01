import { describe, expect, it, vi } from 'vitest';
import type { Camera } from 'react-native-maps';
import { createNativeCamera } from './nativeCamera';
import {
  APPLE_MAX_ALTITUDE,
  appleAltitude,
  appleZoom,
  globeViewportHeight,
  usesGlobe,
} from './appleCamera';

const initial: Camera = {
  center: { latitude: 25.7885, longitude: -80.141 },
  altitude: 10_000,
  heading: 0,
  pitch: 0,
};
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
function setup(read = vi.fn(async () => initial)) {
  let frame: (() => void) | undefined;
  const apply = vi.fn();
  const onGlobeChange = vi.fn();
  const camera = createNativeCamera({
    apple: true,
    read,
    apply,
    onGlobeChange,
    schedule: (callback) => {
      frame = callback;
      return 1;
    },
    cancel: () => {
      frame = undefined;
    },
  });
  return {
    camera,
    read,
    apply,
    onGlobeChange,
    tick: () => {
      const callback = frame;
      frame = undefined;
      callback?.();
    },
  };
}

describe('Apple globe camera', () => {
  it('uses altitude at world scale and fits the whole globe on portrait and landscape screens', () => {
    for (const altitude of [100, 10_000, 600_000, APPLE_MAX_ALTITUDE]) {
      expect(appleAltitude(appleZoom(altitude))).toBeCloseTo(altitude);
    }
    expect(appleZoom(APPLE_MAX_ALTITUDE)).toBe(0);
    expect(globeViewportHeight(4_000_000, 400, 900)).toBe(900);
    expect(globeViewportHeight(APPLE_MAX_ALTITUDE, 400, 900)).toBe(400);
    expect(globeViewportHeight(APPLE_MAX_ALTITUDE, 900, 400)).toBe(400);
    expect(globeViewportHeight(8_000_000, 400, 900)).toBeLessThan(900);
    expect(usesGlobe(500_000, false)).toBe(false);
    expect(usesGlobe(600_000, false)).toBe(true);
    expect(usesGlobe(500_000, true)).toBe(true);
    expect(usesGlobe(300_000, true)).toBe(false);
  });

  it('commits a short drag whose native read arrives after release', async () => {
    let resolve!: (camera: Camera) => void;
    const { camera, apply } = setup(
      vi.fn(
        () =>
          new Promise<Camera>((r) => {
            resolve = r;
          }),
      ),
    );
    camera.begin();
    camera.update(-1);
    camera.end(true);
    expect(apply).not.toHaveBeenCalled();
    resolve(initial);
    await settle();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0].altitude).toBeCloseTo(20_000);
    expect(apply.mock.calls[0][0].center).toEqual(initial.center);
  });

  it('does not invalidate its own camera when MapKit reports programmatic region changes', async () => {
    const { camera, apply, read, tick } = setup();
    camera.begin();
    await settle();
    camera.update(-1);
    tick();
    camera.end(true);
    for (let i = 0; i < 10; i++) {
      camera.settled();
      camera.begin();
      camera.update(i % 2 === 0 ? 1 : -1);
      camera.end(true);
    }
    expect(read).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(11);
    expect(apply.mock.calls.at(-1)?.[0].altitude).toBeCloseTo(20_000);
  });

  it('discards an unfinished read when a real map touch takes over', async () => {
    let resolve!: (camera: Camera) => void;
    const { camera, apply } = setup(
      vi.fn(
        () =>
          new Promise<Camera>((r) => {
            resolve = r;
          }),
      ),
    );
    camera.begin();
    camera.update(-1);
    camera.end(true);
    camera.nativeGesture();
    resolve(initial);
    await settle();
    expect(apply).not.toHaveBeenCalled();
  });

  it('reads the new native center after a pan instead of jumping back to Miami', async () => {
    const read = vi.fn(async () => initial);
    const { camera, apply } = setup(read);
    camera.begin();
    await settle();
    camera.update(-1);
    camera.end(true);
    const panned = { ...initial, center: { latitude: 51.5, longitude: -0.1 }, altitude: 80_000 };
    read.mockResolvedValue(panned);
    camera.nativeGesture();
    camera.settled();
    await settle();
    camera.begin();
    await settle();
    camera.update(1);
    camera.end(true);
    expect(apply.mock.calls.at(-1)?.[0]).toMatchObject({ center: panned.center });
    expect(apply.mock.calls.at(-1)?.[0].altitude).toBeCloseTo(40_000);
  });

  it('waits for the globe renderer, then reverses immediately at the outer limit', async () => {
    const { camera, apply, onGlobeChange, tick } = setup();
    camera.begin();
    await settle();
    camera.update(-30);
    tick();
    expect(onGlobeChange).toHaveBeenCalledWith(true);
    expect(apply).not.toHaveBeenCalled();
    camera.presentationReady(true);
    expect(apply.mock.calls.at(-1)?.[0].altitude).toBe(APPLE_MAX_ALTITUDE);
    camera.update(-29);
    tick();
    expect(apply.mock.calls.at(-1)?.[0].altitude).toBe(APPLE_MAX_ALTITUDE / 2);
    camera.end(true);
  });

  it('does not apply a queued globe transition after a sheet cancels the gesture', async () => {
    const { camera, apply, tick } = setup();
    camera.begin();
    await settle();
    camera.update(-30);
    tick();
    camera.end();
    camera.presentationReady(true);
    expect(apply).not.toHaveBeenCalled();
  });

  it('ignores native reads that resolve after unmount', async () => {
    let resolve!: (camera: Camera) => void;
    const { camera, apply, onGlobeChange } = setup(
      vi.fn(
        () =>
          new Promise<Camera>((r) => {
            resolve = r;
          }),
      ),
    );
    camera.begin();
    camera.update(-30);
    camera.end(true);
    camera.dispose();
    resolve(initial);
    await settle();
    expect(apply).not.toHaveBeenCalled();
    expect(onGlobeChange).not.toHaveBeenCalled();
  });
});
