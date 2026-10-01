export type ScreenEdge = 'left' | 'right';
export const EDGE_TOUCH_WIDTH = 44;
const DEAD_ZONE = 6;
const POINTS_PER_LEVEL = 72;

type Touch = { x: number; y: number; touches: number };

/** iOS edge gestures have one owner until release, even after a second finger cancels. */
export function createScreenEdgeGesture(camera: {
  begin(): void;
  update(delta: number): void;
  end(commitPending?: boolean): void;
  activate?(): void;
  feedback(edge: ScreenEdge | undefined, y: number): void;
}) {
  let origin: (Touch & { edge: ScreenEdge }) | undefined;
  let cancelled = false;
  let moved = false;
  const cancel = () => {
    if (!origin || cancelled) return;
    cancelled = true;
    camera.end();
    camera.feedback(undefined, 0);
  };
  return {
    start(edge: ScreenEdge, touch: Touch) {
      if (origin) {
        cancel();
        return;
      }
      origin = { ...touch, edge };
      cancelled = false;
      moved = false;
      if (touch.touches !== 1) {
        cancelled = true;
        return;
      }
      camera.begin();
      camera.feedback(edge, touch.y);
    },
    move(touch: Touch) {
      if (!origin || cancelled) return;
      if (touch.touches !== 1) return cancel();
      const dx = touch.x - origin.x;
      const dy = touch.y - origin.y;
      // A horizontal edge swipe is not a request to zoom.
      if (!moved && Math.abs(dx) > DEAD_ZONE && Math.abs(dx) > Math.abs(dy)) return cancel();
      camera.feedback(origin.edge, touch.y);
      if (!moved && Math.abs(dy) <= DEAD_ZONE) return;
      if (!moved) camera.activate?.();
      moved = true;
      const delta =
        Math.abs(dy) <= DEAD_ZONE
          ? 0
          : (-Math.sign(dy) * (Math.abs(dy) - DEAD_ZONE)) / POINTS_PER_LEVEL;
      camera.update(delta);
    },
    cancel,
    finish(commit = false) {
      if (!origin) return;
      if (!cancelled) camera.end(commit && moved);
      camera.feedback(undefined, 0);
      origin = undefined;
      cancelled = false;
      moved = false;
    },
  };
}
