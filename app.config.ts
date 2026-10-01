import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Zuno',
  slug: 'zuno',
  version: '0.1.0',
  scheme: 'zuno',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: { supportsTablet: true, bundleIdentifier: 'app.zuno.mobile' },
  android: {
    package: 'app.zuno.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#F4694D',
    },
  },
  web: { favicon: './assets/favicon.png', name: 'Zuno — A little closer', bundler: 'metro' },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Zuno uses your location to center your map, only when you ask. Sharing is always your choice.',
      },
    ],
    ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY
      ? [
          [
            'react-native-maps',
            { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
          ] as [string, Record<string, string>],
        ]
      : []),
  ],
};
export default config;
