import { useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { IconButton, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { tokens } from '../../theme/tokens';
import { createZoomGesture } from './zoom';
import { ZoomGrip } from './ZoomGrip';

/** Only the grip owns drag gestures. Buttons remain keyboard/screen-reader accessible. */
export function EdgeZoom({
  onZoom,
  onBegin,
  onUpdate,
  onEnd,
}: {
  onZoom(delta: number): void;
  onBegin(): void;
  onUpdate(delta: number): void;
  onEnd(): void;
}) {
  const { colors, state, dispatch } = useApp();
  const [active, setActive] = useState(false);
  const hint = !state.edgeZoomHintSeen;
  const gesture = useMemo(
    () =>
      createZoomGesture({
        begin: () => {
          setActive(true);
          dispatch({ type: 'zoom-hint-seen' });
          onBegin();
        },
        update: onUpdate,
        end: () => {
          setActive(false);
          onEnd();
        },
      }),
    [onBegin, onUpdate, onEnd, dispatch],
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') gesture.end();
    });
    return () => {
      subscription.remove();
      gesture.end();
    };
  }, [gesture]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => dispatch({ type: 'zoom-hint-seen' }), 6000);
    return () => clearTimeout(timer);
  }, [hint, dispatch]);
  return (
    <View style={{ borderRadius: 24, backgroundColor: colors.surface, ...tokens.shadow }}>
      {hint && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 54,
            top: 38,
            width: 125,
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.surface,
          }}
        >
          <Txt style={{ fontSize: 11 }}>Slide up or down to zoom with one thumb</Txt>
        </View>
      )}
      <IconButton
        name="plus"
        label="Zoom in"
        onPress={() => onZoom(0.6)}
        style={{ borderRadius: 24 }}
      />
      <ZoomGrip gesture={gesture} active={active} onStep={onZoom}>
        <View
          style={{
            width: 4,
            height: 26,
            borderRadius: 3,
            backgroundColor: active ? colors.accent : colors.line,
          }}
        />
        <Txt style={{ fontSize: 9, color: active ? colors.accent : colors.muted }}>
          {active ? 'zoom' : 'slide'}
        </Txt>
      </ZoomGrip>
      <IconButton
        name="minus"
        label="Zoom out"
        onPress={() => onZoom(-0.6)}
        style={{ borderRadius: 24 }}
      />
    </View>
  );
}
