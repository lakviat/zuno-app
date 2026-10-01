import { describe, expect, it } from 'vitest';
import { createCameraSnapshot } from './cameraSnapshot';
import { createZoomCamera, createZoomGesture } from './zoom';

describe('native camera snapshot', () => {
  it('lets a move and release in the same turn use the current center immediately', async () => {
    const initial = { center: 'Miami', zoom: 12 };
    const snapshot = createCameraSnapshot(async () => initial);
    await snapshot.read();
    const applied: (typeof initial)[] = [];
    const camera = createZoomCamera(
      snapshot.read,
      (start, zoom) => applied.push({ ...start, zoom }),
      () => 1,
      () => {},
    );
    const gesture = createZoomGesture(camera);
    gesture.start();
    gesture.move(-126);
    gesture.end(true);
    expect(applied).toEqual([{ center: 'Miami', zoom: 13 }]);
  });
  it('discards a camera read from before a pan and coalesces fresh reads', async () => {
    const resolves: ((value: number) => void)[] = [];
    const snapshot = createCameraSnapshot(
      () => new Promise<number>((resolve) => resolves.push(resolve)),
    );
    const old = snapshot.read();
    const rejected = expect(old).rejects.toThrow('Camera moved');
    snapshot.invalidate();
    const current = snapshot.read();
    expect(snapshot.read()).toBe(current);
    resolves[0](1);
    await rejected;
    resolves[1](2);
    await current;
    expect(snapshot.read()).toBe(2);
  });
  it('never replaces an applied zoom with an older idle read', async () => {
    let resolve!: (value: number) => void;
    const snapshot = createCameraSnapshot(
      () =>
        new Promise<number>((r) => {
          resolve = r;
        }),
    );
    snapshot.refresh();
    snapshot.write(14);
    resolve(12);
    await Promise.resolve();
    expect(snapshot.read()).toBe(14);
  });
});
