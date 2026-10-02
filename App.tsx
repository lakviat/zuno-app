import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { AuthGate } from './src/features/account/AuthFlow';
import { AccountProvider } from './src/features/account/AccountProvider';
import { AppProvider } from './src/state/AppContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LiveLocationProvider } from './src/features/location/LiveLocation';
import { WorldScreen } from './src/screens/WorldScreen';
export default function App() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F7F6F2',
        }}
      >
        <ActivityIndicator color="#F26B50" />
      </View>
    );
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AccountProvider>
          <AuthGate>
            <AppProvider>
              <LiveLocationProvider>
                <WorldScreen />
              </LiveLocationProvider>
            </AppProvider>
          </AuthGate>
        </AccountProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
