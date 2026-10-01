import { useMemo } from 'react';
import { PanResponder, View } from 'react-native';
import { Icon, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { tokens } from '../../theme/tokens';
/** Only this visible grip captures vertical drags; the rest of the map keeps its gestures. */
export function EdgeZoom({ onZoom }: { onZoom: (delta: number) => void }) {
  const { colors } = useApp();
  const responder = useMemo(() => createZoomResponder(onZoom), [onZoom]);
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
      onAccessibilityAction={(e) => onZoom(e.nativeEvent.actionName === 'increment' ? 0.5 : -0.5)}
      style={{
        width: 42,
        height: 126,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 13,
        backgroundColor: colors.surface,
        ...tokens.shadow,
        ...{ touchAction: 'none' },
      }}
    >
      <Icon name="plus" size={15} color={colors.muted} />
      <View style={{ width: 4, height: 28, borderRadius: 3, backgroundColor: colors.line }} />
      <Txt muted style={{ fontSize: 9 }}>
        slide
      </Txt>
      <Icon name="minus" size={15} color={colors.muted} />
    </View>
  );
}

function createZoomResponder(onZoom: (delta: number) => void) {
  let previous = 0;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => {
      previous = 0;
    },
    onPanResponderMove: (_, g) => {
      const delta = (previous - g.dy) / 120;
      previous = g.dy;
      onZoom(delta);
    },
    onPanResponderTerminationRequest: () => true,
  });
}
