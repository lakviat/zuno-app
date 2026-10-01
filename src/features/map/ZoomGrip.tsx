import { useMemo, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';
import { useApp } from '../../state/AppContext';
import type { createZoomGesture } from './zoom';
export interface ZoomGripProps {
  gesture: ReturnType<typeof createZoomGesture>;
  active: boolean;
  onStep(delta: number): void;
  children: ReactNode;
}
export function ZoomGrip({ gesture, active, onStep, children }: ZoomGripProps) {
  const { colors } = useApp();
  const responder = useMemo(() => createResponder(gesture), [gesture]);
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="One-handed map zoom. Slide up to zoom in, down to zoom out."
      accessibilityHint="Swipe up or down to adjust the map zoom."
      accessibilityActions={[
        { name: 'increment', label: 'Zoom in' },
        { name: 'decrement', label: 'Zoom out' },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onStep(0.5);
        if (event.nativeEvent.actionName === 'decrement') onStep(-0.5);
      }}
      style={{
        width: 44,
        height: 84,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 14,
        backgroundColor: active ? colors.accentSoft : colors.surface,
      }}
    >
      {children}
    </View>
  );
}

function createResponder(gesture: ZoomGripProps['gesture']) {
  let originY = 0;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      originY = event.nativeEvent.pageY;
      gesture.start();
    },
    onPanResponderMove: (event, state) => {
      if (state.numberActiveTouches === 1) gesture.move(event.nativeEvent.pageY - originY);
      else gesture.end();
    },
    onPanResponderRelease: () => gesture.end(true),
    onPanResponderTerminate: () => gesture.end(),
    onPanResponderTerminationRequest: () => true,
  });
}
