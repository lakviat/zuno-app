import type { ExpoConfig } from 'expo/config';
import { version } from './package.json';

const backendUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const backendKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const cloudAccounts = !!backendUrl && !!backendKey;
if (
  (backendUrl || backendKey) &&
  (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(backendUrl ?? '') ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(backendKey ?? ''))
) {
  throw new Error(
    'Invalid public Supabase configuration. Supply the HTTPS Project URL and a publishable key; never a secret or service-role key.',
  );
}

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
    usesAppleSignIn: true,
    bundleIdentifier: 'app.zuno.mobile',
    buildNumber: '3',
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
      NSPrivacyCollectedDataTypes: cloudAccounts
        ? [
            'NSPrivacyCollectedDataTypeEmailAddress',
            'NSPrivacyCollectedDataTypePhoneNumber',
            'NSPrivacyCollectedDataTypeName',
            'NSPrivacyCollectedDataTypeUserID',
            'NSPrivacyCollectedDataTypeOtherUserContent',
            'NSPrivacyCollectedDataTypePreciseLocation',
            'NSPrivacyCollectedDataTypeCoarseLocation',
            'NSPrivacyCollectedDataTypePhotosorVideos',
          ].map((NSPrivacyCollectedDataType) => ({
            NSPrivacyCollectedDataType,
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            ],
          }))
        : [],
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
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-image-picker',
      { photosPermission: false, cameraPermission: false, microphonePermission: false },
    ],
    ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Zuno uses your location while open to show nearby people and meetups. If you enable sharing, your chosen audience can see your location and optional speed and heading.',
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
  extra: { zunoDataMode: cloudAccounts ? 'supabase' : 'local-preview' },
};
export default config;
