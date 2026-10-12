import { describe, expect, it, vi } from 'vitest';
import type { Camera } from 'react-native-maps';
import { createNativeCamera } from './nativeCamera';
import { APPLE_MAX_ALTITUDE, appleAltitude, appleZoom } from './appleCamera';

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
  const camera = createNativeCamera({
    apple: true,
    read,
    apply,
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
    tick: () => {
      const callback = frame;
      frame = undefined;
      callback?.();
    },
  };
}

describe('Apple map camera', () => {
  it('uses altitude consistently from street to world scale', () => {
    for (const altitude of [100, 10_000, 600_000, APPLE_MAX_ALTITUDE]) {
      expect(appleAltitude(appleZoom(altitude))).toBeCloseTo(altitude);
    }
    expect(appleZoom(APPLE_MAX_ALTITUDE)).toBe(0);
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

  it('applies world zoom without switching renderers and reverses immediately at the outer limit', async () => {
    const { camera, apply, tick } = setup();
    camera.begin();
    await settle();
    camera.update(-30);
    tick();
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls.at(-1)?.[0].altitude).toBe(APPLE_MAX_ALTITUDE);
    camera.update(-29);
    tick();
    expect(apply.mock.calls.at(-1)?.[0].altitude).toBe(APPLE_MAX_ALTITUDE / 2);
    camera.end(true);
  });

  it('does not apply a queued camera frame after a sheet cancels the gesture', async () => {
    const { camera, apply, tick } = setup();
    camera.begin();
    await settle();
    camera.update(-30);
    camera.end();
    tick();
    expect(apply).not.toHaveBeenCalled();
  });

  it('ignores native reads that resolve after unmount', async () => {
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
    camera.update(-30);
    camera.end(true);
    camera.dispose();
    resolve(initial);
    await settle();
    expect(apply).not.toHaveBeenCalled();
  });
});
