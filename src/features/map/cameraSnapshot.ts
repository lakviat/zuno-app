/** Warm native camera reads while idle so short gestures can start synchronously. */
export function createCameraSnapshot<T>(readNative: () => Promise<T>) {
  let value: T | undefined;
  let pending: Promise<T> | undefined;
  let generation = 0;
  const invalidate = () => {
    generation++;
    value = undefined;
    pending = undefined;
  };
  const read = (): T | Promise<T> => {
    if (value !== undefined) return value;
    if (pending) return pending;
    const token = generation;
    pending = readNative().then(
      (camera) => {
        if (token !== generation) throw new Error('Camera moved during read');
        value = camera;
        pending = undefined;
        return camera;
      },
      (error: unknown) => {
        if (token === generation) pending = undefined;
        throw error;
      },
    );
    return pending;
  };
  return {
    read,
    invalidate,
    refresh() {
      void Promise.resolve(read()).catch(() => {});
    },
    write(camera: T) {
      invalidate();
      value = camera;
    },
  };
}
