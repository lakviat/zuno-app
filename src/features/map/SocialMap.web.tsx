import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Map as LibreMap, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Avatar, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { FriendMarker, MeetupMarker, MeetupClusterMarker } from './MapMarker';
import { createZoomCamera } from './zoom';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { clusterMeetups } from './meetupClusters';
import { clusterPeople } from './clusters';
import { MIAMI, type MapHandle, type SocialMapProps } from './types';

export const SocialMap = forwardRef<MapHandle, SocialMapProps>(function SocialMap(props, ref) {
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { colors } = useApp();
  const dark = props.dark;
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
    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    try {
      instance = new LibreMap({
        container: container.current,
        style: `https://basemaps.cartocdn.com/gl/${dark ? 'dark-matter' : 'voyager'}-gl-style/style.json`,
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
    instance.on('load', () => {
      if (!dark)
        for (const layer of instance.getStyle().layers) {
          if (layer.type === 'fill' && /water/.test(layer.id))
            instance.setPaintProperty(layer.id, 'fill-color', '#BDDCD8');
          if (layer.type === 'background')
            instance.setPaintProperty(layer.id, 'background-color', '#F3F1E9');
        }
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
      resize.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [dark]);
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
  const clusters =
    frame >= 0
      ? clusterPeople(
          props.people.flatMap((person) => {
            const c = person.location?.coordinate;
            const p = c && project(c.latitude, c.longitude);
            return p ? [{ person, x: p.x, y: p.y }] : [];
          }),
        )
      : [];
  const me = props.me.location?.coordinate;
  const myPoint = me && project(me.latitude, me.longitude);
  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.water }}>
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
                  onPress={() => props.onMeetupPress(group.meetups[0].id)}
                />
              )}
            </View>
          ))}
          {clusters.map((c) => (
            <View key={c.id} style={{ position: 'absolute', left: c.x - 70, top: c.y - 72 }}>
              {c.people.length === 1 ? (
                <FriendMarker
                  compact={compact}
                  person={c.people[0].person}
                  selected={props.selectedId === c.id}
                  onPress={() => props.onPersonPress(c.id)}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Zoom into ${c.people.length} friends`}
                  onPress={() => {
                    const m = map.current;
                    if (m) {
                      zoom.end();
                      m.easeTo({
                        center: m.unproject([c.x, c.y]),
                        zoom: Math.min(18, m.getZoom() + 1.5),
                        duration: reduced ? 0 : 350,
                      });
                    }
                  }}
                  style={{
                    marginLeft: 42,
                    width: 64,
                    height: 64,
                    backgroundColor: colors.surface,
                    borderRadius: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: colors.accent,
                  }}
                >
                  <Txt weight="display" style={{ fontSize: 24 }}>
                    {c.people.length}
                  </Txt>
                  <Txt style={{ fontSize: 9 }}>friends</Txt>
                </Pressable>
              )}
            </View>
          ))}
          {myPoint && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: myPoint.x - 28,
                top: myPoint.y - 28,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  padding: 7,
                  borderWidth: 2,
                  borderColor: '#F26B5060',
                  borderRadius: 45,
                  backgroundColor: '#F26B5030',
                }}
              >
                <View style={{ padding: 3, backgroundColor: colors.accent, borderRadius: 30 }}>
                  <Avatar person={props.me} size={34} />
                </View>
              </View>
              <Txt weight="bold" style={{ fontSize: 10, marginTop: 2, color: colors.accent }}>
                you · demo
              </Txt>
            </View>
          )}
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
