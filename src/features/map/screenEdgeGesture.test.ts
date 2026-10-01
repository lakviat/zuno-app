import { describe, expect, it, vi } from 'vitest';
import { createScreenEdgeGesture, type ScreenEdge } from './screenEdgeGesture';
import { createZoomCamera } from './zoom';

function setup() {
  const camera = {
    begin: vi.fn(),
    activate: vi.fn(),
    update: vi.fn(),
    end: vi.fn(),
    feedback: vi.fn(),
  };
  return { camera, gesture: createScreenEdgeGesture(camera) };
}

describe('iOS two-sided edge zoom', () => {
  it.each<ScreenEdge>(['left', 'right'])(
    'zooms proportionally on the %s edge and reverses within one touch',
    (edge) => {
      const { camera, gesture } = setup();
      const x = edge === 'left' ? 10 : 390;
      gesture.start(edge, { x, y: 500, touches: 1 });
      gesture.move({ x, y: 422, touches: 1 });
      gesture.move({ x, y: 500, touches: 1 });
      gesture.move({ x, y: 650, touches: 1 });
      gesture.finish(true);
      expect(camera.begin).toHaveBeenCalledTimes(1);
      expect(camera.activate).toHaveBeenCalledTimes(1);
      expect(camera.update.mock.calls).toEqual([[1], [0], [-2]]);
      expect(camera.feedback.mock.calls).toEqual([
        [edge, 500],
        [edge, 422],
        [edge, 500],
        [edge, 650],
        [undefined, 0],
      ]);
      expect(camera.end).toHaveBeenCalledExactlyOnceWith(true);
    },
  );

  it('does not zoom for a tap, jitter, or a horizontal edge swipe', () => {
    const { camera, gesture } = setup();
    gesture.start('left', { x: 5, y: 500, touches: 1 });
    gesture.move({ x: 8, y: 494, touches: 1 });
    gesture.finish(true);
    gesture.start('right', { x: 390, y: 500, touches: 1 });
    gesture.move({ x: 320, y: 504, touches: 1 });
    gesture.move({ x: 320, y: 400, touches: 1 });
    gesture.finish(true);
    expect(camera.update).not.toHaveBeenCalled();
    expect(camera.end.mock.calls).toEqual([[false], []]);
  });

  it('cancels on a second finger and cannot resume until a fresh touch', () => {
    const { camera, gesture } = setup();
    gesture.start('left', { x: 10, y: 500, touches: 1 });
    gesture.move({ x: 10, y: 422, touches: 1 });
    gesture.move({ x: 10, y: 422, touches: 2 });
    gesture.move({ x: 10, y: 350, touches: 1 });
    gesture.finish(true);
    expect(camera.update.mock.calls).toEqual([[1]]);
    expect(camera.end).toHaveBeenCalledExactlyOnceWith();
    gesture.start('right', { x: 390, y: 500, touches: 1 });
    gesture.move({ x: 390, y: 578, touches: 1 });
    gesture.finish(true);
    expect(camera.update.mock.calls).toEqual([[1], [-1]]);
  });

  it('does not let an opposite edge take over an ongoing touch', () => {
    const { camera, gesture } = setup();
    gesture.start('left', { x: 10, y: 500, touches: 1 });
    gesture.start('right', { x: 390, y: 500, touches: 1 });
    gesture.move({ x: 390, y: 422, touches: 1 });
    gesture.finish(true);
    expect(camera.begin).toHaveBeenCalledTimes(1);
    expect(camera.update).not.toHaveBeenCalled();
    expect(camera.end).toHaveBeenCalledTimes(1);
  });

  it('rejects multi-touch starts and ignores moves after interruption or release', () => {
    const { camera, gesture } = setup();
    gesture.start('left', { x: 10, y: 500, touches: 2 });
    gesture.move({ x: 10, y: 422, touches: 1 });
    gesture.finish(true);
    expect(camera.begin).not.toHaveBeenCalled();
    gesture.start('left', { x: 10, y: 500, touches: 1 });
    gesture.cancel();
    gesture.move({ x: 10, y: 400, touches: 1 });
    gesture.finish();
    gesture.move({ x: 10, y: 300, touches: 1 });
    gesture.finish(true);
    expect(camera.update).not.toHaveBeenCalled();
    expect(camera.end).toHaveBeenCalledTimes(1);
  });

  it('flushes quick alternating edge drags but discards an interrupted frame', () => {
    let current = { zoom: 12, center: { latitude: 25.78, longitude: -80.14 } };
    const center = current.center;
    const applied: number[] = [];
    const camera = createZoomCamera(
      () => current,
      (start, zoom) => {
        current = { ...start, zoom };
        applied.push(zoom);
      },
      () => 1,
      () => {},
    );
    const gesture = createScreenEdgeGesture({ ...camera, feedback: () => {} });
    gesture.start('left', { x: 10, y: 500, touches: 1 });
    gesture.move({ x: 10, y: 422, touches: 1 });
    gesture.finish(true);
    gesture.start('right', { x: 390, y: 500, touches: 1 });
    gesture.move({ x: 390, y: 578, touches: 1 });
    gesture.finish(true);
    gesture.start('left', { x: 10, y: 500, touches: 1 });
    gesture.move({ x: 10, y: 422, touches: 1 });
    gesture.cancel();
    gesture.finish(true);
    expect(applied).toEqual([13, 12]);
    expect(current.center).toBe(center);
  });

  it('accepts a fresh gesture after backgrounding without an old release event', () => {
    const { camera, gesture } = setup();
    gesture.start('left', { x: 10, y: 500, touches: 1 });
    gesture.move({ x: 10, y: 422, touches: 1 });
    gesture.finish();
    gesture.start('right', { x: 390, y: 500, touches: 1 });
    gesture.move({ x: 390, y: 578, touches: 1 });
    gesture.finish(true);
    expect(camera.begin).toHaveBeenCalledTimes(2);
    expect(camera.end.mock.calls).toEqual([[false], [true]]);
    expect(camera.update.mock.calls).toEqual([[1], [-1]]);
  });
});
