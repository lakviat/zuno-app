import { motionStore } from './store';
/** Fictional paths only. Import and start exclusively inside a __DEV__ branch. */
export function startMockMovement() {
  if (!__DEV__) return () => {};
  let tick = 0;
  const update = () => {
    tick++;
    const phase = tick % 24;
    const stopped = phase >= 16;
    const position = Math.min(phase, 16);
    motionStore.set('marcus', {
      coordinate: { latitude: 25.7811 + position * 0.00016, longitude: -80.1523 },
      timestamp: Date.now(),
      accuracy: 8,
      speed: stopped ? 0 : 3.5,
      heading: stopped ? null : 0,
    });
    motionStore.set('alex', {
      coordinate: { latitude: 25.7968, longitude: -80.1472 + Math.sin(tick / 8) * 0.0015 },
      timestamp: Date.now(),
      accuracy: 8,
      speed: stopped ? 0 : 2,
      heading: stopped ? null : Math.cos(tick / 8) >= 0 ? 90 : 270,
    });
  };
  update();
  const timer = setInterval(update, 5000);
  return () => {
    clearInterval(timer);
    motionStore.set('marcus');
    motionStore.set('alex');
  };
}
