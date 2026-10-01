import { View } from 'react-native';
import { Button, Icon, Txt } from '../../components/ui';
import { useTheme } from '../../state/AppContext';
import type { MapViewport } from '../../utils/geo';
import { mapPlace } from './mapPlace';
export function LocationPicker({
  viewport,
  moving,
  bottom,
  onCancel,
  onConfirm,
}: {
  viewport: MapViewport;
  moving: boolean;
  bottom: number;
  onCancel(): void;
  onConfirm(): void;
}) {
  const { colors } = useTheme();
  const place = mapPlace(viewport);
  const tooFar = viewport.latitudeDelta > 0.2;
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -26,
          marginTop: -64,
          width: 52,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: colors.accent,
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: 'white',
          }}
        >
          <Icon name="plus" color="white" size={24} />
        </View>
        <View style={{ width: 3, height: 8, backgroundColor: colors.accent }} />
        <View style={{ width: 9, height: 4, backgroundColor: colors.ink, borderRadius: 8 }} />
      </View>
      <View
        style={{
          position: 'absolute',
          bottom,
          left: 20,
          right: 20,
          maxWidth: 430,
          alignSelf: 'center',
          padding: 18,
          borderRadius: 24,
          backgroundColor: colors.surface,
          gap: 10,
        }}
      >
        <Txt weight="display" style={{ fontSize: 23 }}>
          Bring people here
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          {moving
            ? 'Move the map under the pin…'
            : tooFar
              ? 'Zoom in to choose a meeting spot.'
              : `${place.name} · ${place.area}`}
        </Txt>
        <Txt muted style={{ fontSize: 11 }}>
          Choose a public meeting place. The pin is the shared spot, not your live location.
        </Txt>
        <Button icon="map-pin" disabled={moving || tooFar} onPress={onConfirm}>
          Set meetup here
        </Button>
        <Button kind="quiet" onPress={onCancel}>
          Cancel location
        </Button>
      </View>
    </>
  );
}
