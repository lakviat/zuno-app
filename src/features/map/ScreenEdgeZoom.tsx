import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  AppState,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { IconButton, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { tokens } from '../../theme/tokens';
import { createScreenEdgeGesture, EDGE_TOUCH_WIDTH, type ScreenEdge } from './screenEdgeGesture';

const CURVE_HEIGHT = 144;

/** Full-height edge targets sit behind map chrome; the center never intercepts touches. */
export function ScreenEdgeZoom({
  top,
  bottom,
  height,
  leftInset,
  rightInset,
  onZoom,
  onBegin,
  onUpdate,
  onEnd,
}: {
  top: number;
  bottom: number;
  height: number;
  leftInset: number;
  rightInset: number;
  onZoom(delta: number): void;
  onBegin(): void;
  onUpdate(delta: number): void;
  onEnd(commitPending?: boolean): void;
}) {
  const { colors, state, dispatch } = useApp();
  const [activeEdge, setActiveEdge] = useState<ScreenEdge>();
  const [fingerY] = useState(() => new Animated.Value(0));
  const gesture = useMemo(() => {
    return createScreenEdgeGesture({
      begin: onBegin,
      activate: () => dispatch({ type: 'zoom-hint-seen' }),
      update: onUpdate,
      end: onEnd,
      feedback: (edge, y) => {
        fingerY.setValue(Math.max(top, Math.min(height - bottom, y)) - top - CURVE_HEIGHT / 2);
        setActiveEdge(edge);
      },
    });
  }, [onBegin, onUpdate, onEnd, dispatch, fingerY, top, bottom, height]);
  const responders = useMemo(() => {
    const touch = (event: GestureResponderEvent) => ({
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
      touches: event.nativeEvent.touches.length,
    });
    const responder = (edge: ScreenEdge) =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 1,
        onPanResponderGrant: (event) => gesture.start(edge, touch(event)),
        onPanResponderStart: (event) => {
          if (event.nativeEvent.touches.length > 1) gesture.cancel();
        },
        onPanResponderMove: (event) => gesture.move(touch(event)),
        onPanResponderRelease: () => gesture.finish(true),
        onPanResponderTerminate: () => gesture.finish(),
        onPanResponderTerminationRequest: () => true,
      });
    return { left: responder('left'), right: responder('right') };
  }, [gesture]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      // iOS may never deliver the old touch's release after leaving the app.
      if (next !== 'active') gesture.finish();
    });
    return () => {
      subscription.remove();
      gesture.finish();
    };
  }, [gesture]);
  const hint = !state.edgeZoomHintSeen && !activeEdge;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { top, bottom }]}>
      {(['left', 'right'] as const).map((edge) => (
        <View
          key={edge}
          {...responders[edge].panHandlers}
          testID={`map-${edge}-edge-zoom`}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${edge === 'left' ? 'Left' : 'Right'} edge map zoom`}
          accessibilityHint="Slide up to zoom in, down to zoom out. Swipe up or down with VoiceOver to adjust."
          accessibilityActions={[
            { name: 'increment', label: 'Zoom in' },
            { name: 'decrement', label: 'Zoom out' },
          ]}
          onAccessibilityAction={(event) => {
            gesture.finish();
            if (event.nativeEvent.actionName === 'increment') onZoom(0.6);
            if (event.nativeEvent.actionName === 'decrement') onZoom(-0.6);
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: EDGE_TOUCH_WIDTH,
            [edge]: edge === 'left' ? leftInset : rightInset,
          }}
        >
          {hint && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                [edge]: 3,
                top: '48%',
                width: 3,
                height: 42,
                borderRadius: 3,
                backgroundColor: colors.accent,
              }}
            />
          )}
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            style={{
              position: 'absolute',
              [edge]: 0,
              top: 0,
              width: 22,
              height: CURVE_HEIGHT,
              opacity: activeEdge === edge ? 1 : 0,
              transform: [{ translateY: fingerY }, { scaleX: edge === 'right' ? -1 : 1 }],
            }}
          >
            <Svg width={22} height={CURVE_HEIGHT} viewBox="0 0 22 144">
              <Path d="M0 0 C0 28 20 43 20 72 C20 101 0 116 0 144 Z" fill={colors.accent} />
              <Path
                d="M5 63 L8 60 L11 63 M5 81 L8 84 L11 81"
                fill="none"
                stroke={colors.background}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </View>
      ))}
      {hint && (
        <View
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: 58,
            maxWidth: '78%',
            paddingLeft: 14,
            paddingRight: 4,
            paddingVertical: 4,
            borderRadius: 18,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            ...tokens.shadow,
          }}
        >
          <Txt style={{ flexShrink: 1, fontSize: 12, lineHeight: 17 }}>
            Slide either edge to zoom.{'\n'}Up to get closer · down to see more.
          </Txt>
          <IconButton
            name="check"
            label="Dismiss zoom tip"
            onPress={() => dispatch({ type: 'zoom-hint-seen' })}
          />
        </View>
      )}
    </View>
  );
}
