import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Txt } from './ui';
import { useApp } from '../state/AppContext';
export function Brand({ small = false }: { small?: boolean }) {
  const { colors } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Svg width={small ? 28 : 34} height={small ? 28 : 34} viewBox="0 0 40 40">
        <Path
          fill={colors.accent}
          d="M20 1c4 0 4 9 7 10 3 1 9-6 12-2s-6 8-6 11 9 7 6 11-9-3-12-2-3 10-7 10-4-9-7-10-9 6-12 2 6-8 6-11S-2 13 1 9s9 3 12 2S16 1 20 1Z"
        />
      </Svg>
      <Txt weight="heavy" style={{ fontSize: small ? 35 : 42, letterSpacing: -2.6 }}>
        zuno
      </Txt>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 4,
          backgroundColor: colors.accent,
          alignSelf: 'flex-end',
          marginBottom: small ? 10 : 12,
        }}
      />
    </View>
  );
}
