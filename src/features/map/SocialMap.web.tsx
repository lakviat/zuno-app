import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Map as LibreMap, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Txt } from '../../components/ui';
import { useTheme } from '../../state/AppContext';
import { FriendMarker, MeetupMarker, MeetupClusterMarker } from './MapMarker';
import { createZoomCamera } from './zoom';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { clusterMeetups } from './meetupClusters';
import { MIAMI, type MapHandle, type SocialMapProps } from './types';

export const SocialMap = forwardRef<MapHandle, SocialMapProps>(function SocialMap(props, ref) {
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { colors } = useTheme();
  const callbacks = useRef(props);
  callbacks.current = props;
  const reduced = useReducedMotion();
  const zoom = useMemo(
    () =>
      createZoomCamera(
        () => {
          const m = map.current;
          if (!m) throw new Error('Map not ready');
          m.stop();
          return { zoom: m.getZoom(), center: m.getCenter() };
        },
        (start, level) => map.current?.jumpTo({ center: start.center, zoom: level }),
      ),
    [],
  );
  useEffect(() => () => zoom.end(), [zoom]);
  useEffect(() => {
    if (!container.current) return;
    let instance: LibreMap;
    let animation = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    try {
      instance = new LibreMap({
        container: container.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [window.innerWidth < 720 ? -80.138 : MIAMI.longitude, MIAMI.latitude],
        zoom: window.innerWidth < 720 ? 12.65 : 13.25,
        minZoom: 3,
        maxZoom: 18,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    map.current = instance;
    instance.touchZoomRotate.disableRotation();
    const repaint = () => {
      cancelAnimationFrame(animation);
      animation = requestAnimationFrame(() => setFrame((n) => n + 1));
    };
    instance.on('move', repaint);
    const publishViewport = () => {
      clearTimeout(settleTimer);
      // jumpTo emits moveend for every edge-zoom frame. Discovery must wait for rest.
      settleTimer = setTimeout(() => {
        const c = instance.getCenter(),
          b = instance.getBounds();
        callbacks.current.onViewportChange?.({
          latitude: c.lat,
          longitude: c.lng,
          latitudeDelta: b.getNorth() - b.getSouth(),
          longitudeDelta: b.getEast() - b.getWest(),
        });
      }, 180);
    };
    instance.on('movestart', () => callbacks.current.onMoving?.());
    instance.on('moveend', publishViewport);
    instance.on('contextmenu', (event) =>
      callbacks.current.onLongPress?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }),
    );
    instance.on('load', () => {
      for (const layer of instance.getStyle().layers) {
        if (layer.type === 'fill' && /water/.test(layer.id))
          instance.setPaintProperty(layer.id, 'fill-color', '#BDDCD8');
        if (layer.type === 'background')
          instance.setPaintProperty(layer.id, 'background-color', '#F3F1E9');
      }
      publishViewport();
      setLoaded(true);
      setFailed(false);
      repaint();
    });
    instance.on('error', () => {
      if (!instance.isStyleLoaded()) setFailed(true);
    });
    const resize = new ResizeObserver(() => {
      instance.resize();
      repaint();
    });
    resize.observe(container.current);
    return () => {
      cancelAnimationFrame(animation);
      clearTimeout(settleTimer);
      resize.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      recenter(coordinate = MIAMI) {
        zoom.end();
        map.current?.easeTo({
          center: [
            coordinate === MIAMI && window.innerWidth < 720 ? -80.138 : coordinate.longitude,
            coordinate.latitude,
          ],
          zoom: coordinate === MIAMI ? (window.innerWidth < 720 ? 12.65 : 13.25) : 14,
          duration: reduced ? 0 : 550,
        });
      },
      zoomBy: (delta) => {
        void zoom.step(delta);
      },
      beginZoom: zoom.begin,
      updateZoom: zoom.update,
      endZoom: zoom.end,
    }),
    [zoom, reduced],
  );
  const project = (latitude: number, longitude: number) =>
    map.current?.project([longitude, latitude]);
  // frame is an intentional camera invalidation counter for geographic overlays.
  const compactPeople = compact || (map.current?.getZoom() ?? 13) < 12;
  const people =
    frame >= 0
      ? [...props.people.filter((p) => p.user.id !== props.me.user.id), props.me].flatMap(
          (person) => {
            const c = person.location?.coordinate;
            const point = c && project(c.latitude, c.longitude);
            return point && Number.isFinite(point.x) && Number.isFinite(point.y)
              ? [{ person, x: point.x, y: point.y }]
              : [];
          },
        )
      : [];
  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: '#C4DFDD' }}>
      <div
        ref={container}
        style={{ position: 'absolute', inset: 0 }}
        aria-label="Interactive map of Miami Beach"
      />
      {loaded && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
        >
          {clusterMeetups(
            props.meetups.flatMap((meetup) => {
              const point = project(
                meetup.place.coordinate.latitude,
                meetup.place.coordinate.longitude,
              );
              return point ? [{ meetup, x: point.x, y: point.y }] : [];
            }),
            compact ? 70 : 170,
          ).map((group) => (
            <View
              key={group.meetups.map((m) => m.id).join(':')}
              style={{
                position: 'absolute',
                left: group.x - (compact || group.meetups.length > 1 ? 28 : 75),
                top: group.y + 16,
              }}
            >
              {group.meetups.length > 1 ? (
                <MeetupClusterMarker
                  count={group.meetups.length}
                  onPress={() => props.onMeetupClusterPress(group.meetups.map((m) => m.id))}
                />
              ) : (
                <MeetupMarker
                  compact={compact}
                  meetup={group.meetups[0]}
                  host={props.meetupHosts[group.meetups[0].hostId]}
                  onPress={() => props.onMeetupPress(group.meetups[0].id)}
                />
              )}
            </View>
          ))}
          {people.map(({ person, x, y }) => (
            <View
              key={person.user.id}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
                zIndex:
                  person.user.id === props.me.user.id || props.selectedId === person.user.id
                    ? 2
                    : 1,
              }}
            >
              <FriendMarker
                now={props.now}
                compact={compactPeople}
                person={person}
                selected={
                  person.user.id === props.me.user.id || props.selectedId === person.user.id
                }
                onPress={() => props.onPersonPress(person.user.id)}
              />
            </View>
          ))}
        </View>
      )}
      {(!loaded || failed) && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '46%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 18,
          }}
        >
          <Txt>
            {failed
              ? 'Map unavailable. Your friends and meetups are still here.'
              : 'Finding your little corner of the world…'}
          </Txt>
        </View>
      )}
    </View>
  );
});
