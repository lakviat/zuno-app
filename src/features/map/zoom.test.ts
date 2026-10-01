import { describe, it, expect } from 'vitest';
import { createZoomCamera, createZoomGesture, dragZoom } from './zoom';
describe('one-handed zoom', () => {
  it('ignores taps/jitter and reverses proportionally from the start', () => {
    expect(dragZoom(0)).toBe(0);
    expect(dragZoom(5)).toBe(0);
    expect(dragZoom(-126)).toBe(1);
    expect(dragZoom(126)).toBe(-1);
    const updates: number[] = [];
    let begins = 0,
      ends = 0;
    const g = createZoomGesture({
      begin: () => begins++,
      update: (d) => updates.push(d),
      end: () => ends++,
    });
    g.move(-100);
    g.start();
    g.move(-126);
    g.move(126);
    g.end();
    g.end();
    g.move(-240);
    expect(updates).toEqual([1, -1]);
    expect(begins).toBe(1);
    expect(ends).toBe(1);
  });
  it('coalesces writes, preserves the initial center, clamps limits and cancels pending frames', async () => {
    let scheduled: (() => void) | undefined;
    const applied: { center: string; zoom: number }[] = [];
    const camera = createZoomCamera(
      () => ({ center: 'unchanged', zoom: 12 }),
      (s, z) => applied.push({ center: s.center, zoom: z }),
      (cb) => {
        scheduled = cb;
        return 1;
      },
      () => {
        scheduled = undefined;
      },
    );
    camera.begin();
    await Promise.resolve();
    camera.update(1);
    camera.update(2);
    scheduled?.();
    expect(applied).toEqual([{ center: 'unchanged', zoom: 14 }]);
    camera.update(-100);
    scheduled?.();
    expect(applied.at(-1)?.zoom).toBe(3);
    camera.update(100);
    scheduled?.();
    expect(applied.at(-1)?.zoom).toBe(18);
    camera.update(0);
    scheduled?.();
    expect(applied.at(-1)?.zoom).toBe(12);
    camera.update(2);
    camera.end();
    expect(scheduled).toBeUndefined();
  });
  it('discards async native camera reads after release, interruption or sheet opening', async () => {
    let resolve!: (value: { zoom: number }) => void;
    const applied: number[] = [];
    const camera = createZoomCamera(
      () =>
        new Promise<{ zoom: number }>((r) => {
          resolve = r;
        }),
      (_, z) => applied.push(z),
      (cb) => {
        cb();
        return 1;
      },
      () => {},
    );
    camera.begin();
    camera.update(1);
    camera.end(true);
    resolve({ zoom: 12 });
    await Promise.resolve();
    expect(applied).toEqual([]);
    const step = camera.step(1);
    camera.end();
    resolve({ zoom: 12 });
    await step;
    expect(applied).toEqual([]);
  });
  it('commits a fast drag on release and cancels its queued animation frame', async () => {
    let scheduled: (() => void) | undefined;
    const applied: number[] = [];
    const camera = createZoomCamera(
      () => ({ zoom: 12 }),
      (_, z) => applied.push(z),
      (cb) => {
        scheduled = cb;
        return 1;
      },
      () => {
        scheduled = undefined;
      },
    );
    const gesture = createZoomGesture(camera);
    gesture.start();
    await Promise.resolve();
    gesture.move(-126);
    gesture.end(true);
    expect(applied).toEqual([13]);
    expect(scheduled).toBeUndefined();
    gesture.end(true);
    expect(applied).toEqual([13]);

    gesture.start();
    await Promise.resolve();
    gesture.move(126);
    gesture.end(true);
    expect(applied).toEqual([13, 11]);

    gesture.start();
    await Promise.resolve();
    gesture.move(-126);
    gesture.end();
    expect(applied).toEqual([13, 11]);
    expect(scheduled).toBeUndefined();
  });
});
