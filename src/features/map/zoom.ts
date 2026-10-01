/** Shared gesture semantics: zoom levels per 120 points, with a 6-point dead zone. */
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 18;
export const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
export const dragZoom = (dy: number) =>
  Math.abs(dy) <= 6 ? 0 : (-Math.sign(dy) * (Math.abs(dy) - 6)) / 120;

export function createZoomGesture(camera: {
  begin(): void;
  update(delta: number): void;
  end(): void;
}) {
  let active = false;
  return {
    start() {
      active = true;
      camera.begin();
    },
    move(dy: number) {
      if (active) camera.update(dragZoom(dy));
    },
    end() {
      if (active) {
        active = false;
        camera.end();
      }
    },
  };
}

/** One camera read per gesture, one immediate camera write per frame, no animation queue.
 * Generation tokens discard native getCamera results that resolve after cancellation.
 */
export function createZoomCamera<T extends { zoom: number }>(
  read: () => T | Promise<T>,
  apply: (start: T, zoom: number) => void,
  schedule: (callback: () => void) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
) {
  let generation = 0;
  let start: T | undefined;
  let pending = 0;
  let frame: number | undefined;
  const end = () => {
    generation++;
    start = undefined;
    pending = 0;
    if (frame !== undefined) cancel(frame);
    frame = undefined;
  };
  const flush = () => {
    frame = undefined;
    if (start && pending !== 0) apply(start, clampZoom(start.zoom + pending));
    // A reversal to the starting position must restore the original zoom.
    else if (start) apply(start, clampZoom(start.zoom));
  };
  const update = (delta: number) => {
    pending = delta;
    if (start && frame === undefined) frame = schedule(flush);
  };
  return {
    begin() {
      end();
      const token = generation;
      let reading: T | Promise<T>;
      try {
        reading = read();
      } catch {
        end();
        return;
      }
      Promise.resolve(reading)
        .then((camera) => {
          if (token !== generation) return;
          start = camera;
          if (pending !== 0) update(pending);
        })
        .catch(() => {
          if (token === generation) end();
        });
    },
    update,
    end,
    async step(delta: number) {
      end();
      const token = generation;
      try {
        const camera = await read();
        if (token === generation) apply(camera, clampZoom(camera.zoom + delta));
      } catch {
        /* A provider that is not ready can safely ignore a button press. */
      }
    },
  };
}
