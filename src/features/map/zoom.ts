/** Shared gesture semantics: zoom levels per 120 points, with a 6-point dead zone. */
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 18;
export const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
export const dragZoom = (dy: number) =>
  Math.abs(dy) <= 6 ? 0 : (-Math.sign(dy) * (Math.abs(dy) - 6)) / 120;

export function createZoomGesture(camera: {
  begin(): void;
  update(delta: number): void;
  end(commitPending?: boolean): void;
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
    end(commitPending = false) {
      if (active) {
        active = false;
        camera.end(commitPending);
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
  options: {
    min?: number;
    max?: number;
    finishPendingRead?: boolean;
    rebaseAtLimits?: boolean;
  } = {},
) {
  let generation = 0;
  let start: T | undefined;
  let pending = 0;
  let frame: number | undefined;
  let released = false;
  let currentZoom = 0;
  let appliedDelta = 0;
  const clamp = (level: number) =>
    Math.max(options.min ?? MIN_ZOOM, Math.min(options.max ?? MAX_ZOOM, level));
  const applyPending = () => {
    if (!start) return;
    currentZoom = clamp(
      options.rebaseAtLimits ? currentZoom + pending - appliedDelta : start.zoom + pending,
    );
    appliedDelta = pending;
    apply(start, currentZoom);
  };
  const end = (commitPending = false) => {
    // Native move and release events can arrive within the same animation frame.
    // Commit the last movement on release when the starting camera is ready.
    if (commitPending && start && frame !== undefined) {
      applyPending();
    }
    // A short iOS drag may release before getCamera crosses the native bridge.
    // Commit its endpoint once ready; a new gesture/pan/cancel still invalidates it.
    if (commitPending && !start && pending !== 0 && options.finishPendingRead) {
      released = true;
      return;
    }
    generation++;
    start = undefined;
    pending = 0;
    released = false;
    appliedDelta = 0;
    if (frame !== undefined) cancel(frame);
    frame = undefined;
  };
  const flush = () => {
    frame = undefined;
    applyPending();
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
      const accept = (camera: T) => {
        if (token !== generation) return;
        start = camera;
        currentZoom = clamp(camera.zoom);
        if (released) {
          applyPending();
          end();
          return;
        }
        if (pending !== 0) update(pending);
      };
      if (!(reading instanceof Promise)) {
        accept(reading);
        return;
      }
      reading.then(accept).catch(() => {
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
        if (token === generation) apply(camera, clamp(camera.zoom + delta));
      } catch {
        /* A provider that is not ready can safely ignore a button press. */
      }
    },
  };
}
