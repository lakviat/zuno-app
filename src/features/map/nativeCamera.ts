import type { Camera } from 'react-native-maps';
import { createCameraSnapshot } from './cameraSnapshot';
import { createZoomCamera } from './zoom';
import { APPLE_MAX_ZOOM, appleAltitude, appleZoom, usesGlobe } from './appleCamera';

/** Own commands are authoritative until an actual native map touch takes over.
 * MapKit emits region callbacks for our setCamera calls too; they must not erase
 * the snapshot used by the next thumb drag or derive globe zoom from map spans.
 */
export function createNativeCamera({
  apple,
  read,
  apply,
  onGlobeChange,
  onAltitudeChange = () => {},
  schedule,
  cancel,
}: {
  apple: boolean;
  read(): Promise<Camera>;
  apply(camera: Camera): void;
  onGlobeChange(globe: boolean): void;
  onAltitudeChange?(altitude: number): void;
  schedule?: (callback: () => void) => number;
  cancel?: (id: number) => void;
}) {
  let owner: 'native' | 'command' = 'native';
  let active = false;
  let globe = false;
  let renderedGlobe = false;
  let desired: Camera | undefined;
  let disposed = false;
  const presentation = (camera: Camera) => {
    if (!apple || camera.altitude === undefined) return;
    onAltitudeChange(camera.altitude);
    const next = usesGlobe(camera.altitude, globe);
    if (next !== globe) {
      globe = next;
      onGlobeChange(next);
    }
  };
  const snapshot = createCameraSnapshot(async () => {
    const camera = await read();
    const level = apple && camera.altitude !== undefined ? appleZoom(camera.altitude) : camera.zoom;
    if (level === undefined || !Number.isFinite(level)) throw new Error('Map camera not ready');
    return { ...camera, zoom: level };
  });
  const refresh = () => {
    void Promise.resolve(snapshot.read())
      .then((camera) => {
        if (disposed || owner !== 'native') return;
        desired = camera;
        presentation(camera);
      })
      .catch(() => {});
  };
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
      desired = next;
      snapshot.write(next);
      presentation(next);
      // Apply after the globe-capable renderer is committed, not to the old flat map.
      if (renderedGlobe === globe) apply(next);
    },
    schedule,
    cancel,
    apple ? { min: 0, max: APPLE_MAX_ZOOM, finishPendingRead: true, rebaseAtLimits: true } : {},
  );

  const takeControl = () => {
    if (owner === 'native') snapshot.invalidate();
    owner = 'command';
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
        // A renderer change may still be waiting for React's layout commit.
        // Cancellation must discard that command as well as the animation frame.
        desired = undefined;
        owner = 'native';
        snapshot.invalidate();
      }
    },
    step(delta: number) {
      takeControl();
      return zoom.step(delta);
    },
    nativeGesture() {
      active = false;
      owner = 'native';
      desired = undefined;
      zoom.end();
      snapshot.invalidate();
    },
    settled() {
      if (owner === 'native') {
        snapshot.invalidate();
        refresh();
      }
    },
    ready: refresh,
    isActive: () => active,
    presentationReady(next: boolean) {
      renderedGlobe = next;
      if (next === globe && desired) apply(desired);
    },
    dispose() {
      disposed = true;
      zoom.end();
      snapshot.invalidate();
    },
  };
}
