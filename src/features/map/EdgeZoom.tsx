import { useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { Icon, IconButton, Txt } from '../../components/ui';
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
  onEnd(commitPending?: boolean): void;
}) {
  const { colors, state, dispatch } = useApp();
  const [active, setActive] = useState(false);
  const [direction, setDirection] = useState(0);
  const hint = !state.edgeZoomHintSeen;
  const gesture = useMemo(
    () =>
      createZoomGesture({
        begin: () => {
          setActive(true);
          dispatch({ type: 'zoom-hint-seen' });
          onBegin();
        },
        update: (delta) => {
          setDirection(Math.sign(delta));
          onUpdate(delta);
        },
        end: (commitPending) => {
          setActive(false);
          setDirection(0);
          onEnd(commitPending);
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
  return (
    <View style={{ borderRadius: 24, backgroundColor: colors.surface, ...tokens.shadow }}>
      {(hint || active) && (
        <View
          style={{
            position: 'absolute',
            right: 54,
            top: 38,
            width: 150,
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.surface,
          }}
        >
          <Txt weight="medium" style={{ fontSize: 12, lineHeight: 17 }}>
            {active
              ? direction > 0
                ? 'Zooming in'
                : direction < 0
                  ? 'Zooming out'
                  : 'Slide to zoom'
              : 'Slide up to get closer. Down to see more.'}
          </Txt>
          {!active && (
            <IconButton
              name="check"
              label="Dismiss zoom tip"
              onPress={() => dispatch({ type: 'zoom-hint-seen' })}
              style={{ alignSelf: 'flex-end', backgroundColor: colors.accentSoft, marginTop: 4 }}
            />
          )}
        </View>
      )}
      <IconButton
        name="plus"
        label="Zoom in"
        onPress={() => {
          dispatch({ type: 'zoom-hint-seen' });
          onZoom(0.6);
        }}
        style={{ borderRadius: 24 }}
      />
      <ZoomGrip gesture={gesture} active={active} onStep={onZoom}>
        <Icon name="chevron-up" size={13} color={active ? colors.accent : colors.muted} />
        <View
          style={{
            width: 4,
            height: 18,
            borderRadius: 3,
            backgroundColor: active ? colors.accent : colors.line,
          }}
        />
        <Txt style={{ fontSize: 9, color: active ? colors.accent : colors.muted }}>
          {active ? 'zoom' : 'slide'}
        </Txt>
        <Icon name="chevron-down" size={13} color={active ? colors.accent : colors.muted} />
      </ZoomGrip>
      <IconButton
        name="minus"
        label="Zoom out"
        onPress={() => {
          dispatch({ type: 'zoom-hint-seen' });
          onZoom(-0.6);
        }}
        style={{ borderRadius: 24 }}
      />
    </View>
  );
}
