import type { ExpoConfig } from 'expo/config';
import { version } from './package.json';

const config: ExpoConfig = {
  name: 'Zuno',
  slug: 'zuno',
  version,
  scheme: 'zuno',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.zuno.mobile',
    buildNumber: '1',
    ...(process.env.ZUNO_APPLE_TEAM_ID ? { appleTeamId: process.env.ZUNO_APPLE_TEAM_ID } : {}),
    infoPlist: {
      EXDevMenuShowFloatingActionButton: false,
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: process.env.ZUNO_BUILD_CHANNEL === 'development',
      },
    },
    // Required-reason declarations from the installed React Native/AsyncStorage and
    // Expo FileSystem/Constants SDK manifests. See TESTFLIGHT_READINESS.md.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
      ],
    },
  },
  android: {
    package: 'app.zuno.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#F4694D',
    },
  },
  web: { favicon: './assets/favicon.png', name: 'Zuno — A little closer', bundler: 'metro' },
  plugins: [
    './plugins/with-ios-scenes',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Zuno uses your location while the app is open to show your position, movement and nearby distances. This preview keeps your location on this device.',
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
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
    './plugins/with-ios-distribution',
  ],
  extra: { zunoDataMode: 'local-preview' },
};
export default config;
