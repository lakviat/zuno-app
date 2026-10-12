import type { Camera } from 'react-native-maps';
import { createCameraSnapshot } from './cameraSnapshot';
import { createZoomCamera } from './zoom';
import { APPLE_MAX_ZOOM, appleAltitude, appleZoom } from './appleCamera';

/** Own commands are authoritative until an actual native map touch takes over.
 * MapKit emits region callbacks for our setCamera calls too; they must not erase
 * the snapshot used by the next thumb drag or derive globe zoom from map spans.
 */
export function createNativeCamera({
  apple,
  read,
  apply,
  schedule,
  cancel,
}: {
  apple: boolean;
  read(): Promise<Camera>;
  apply(camera: Camera): void;
  schedule?: (callback: () => void) => number;
  cancel?: (id: number) => void;
}) {
  let active = false;
  const snapshot = createCameraSnapshot(async () => {
    const camera = await read();
    const level = apple && camera.altitude !== undefined ? appleZoom(camera.altitude) : camera.zoom;
    if (level === undefined || !Number.isFinite(level)) throw new Error('Map camera not ready');
    return { ...camera, zoom: level };
  });
  const zoom = createZoomCamera(
    snapshot.read,
    (start, level) => {
      const next = {
        ...start,
        zoom: level,
        heading: 0,
        pitch: 0,
        ...(apple ? { altitude: appleAltitude(level) } : {}),
      };
      snapshot.write(next);
      apply(next);
    },
    schedule,
    cancel,
    apple ? { min: 0, max: APPLE_MAX_ZOOM, finishPendingRead: true, rebaseAtLimits: true } : {},
  );

  let commanded = false;
  const takeControl = () => {
    if (!commanded) snapshot.invalidate();
    commanded = true;
  };
  return {
    begin() {
      takeControl();
      active = true;
      zoom.begin();
    },
    update: zoom.update,
    end(commit = false) {
      active = false;
      zoom.end(commit);
      if (!commit) {
        commanded = false;
        snapshot.invalidate();
      }
    },
    step(delta: number) {
      takeControl();
      return zoom.step(delta);
    },
    nativeGesture() {
      active = false;
      commanded = false;
      zoom.end();
      snapshot.invalidate();
    },
    settled() {
      if (!commanded) snapshot.invalidate();
    },
    isActive: () => active,
    dispose() {
      zoom.end();
      snapshot.invalidate();
    },
  };
}
