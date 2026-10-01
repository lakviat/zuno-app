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
      accessibilityActions={[
        { name: 'increment', label: 'Zoom in' },
        { name: 'decrement', label: 'Zoom out' },
      ]}
      onAccessibilityAction={(event) =>
        onStep(event.nativeEvent.actionName === 'increment' ? 0.5 : -0.5)
      }
      style={{
        width: 44,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
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
