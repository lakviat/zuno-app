import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthGate } from './AuthFlow';

const m = vi.hoisted(() => ({
  finish: vi.fn(),
  readPermission: vi.fn(),
  requestPermission: vi.fn(),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  Platform: { OS: 'ios' },
  StyleSheet: { create: (v: unknown) => v },
  Linking: {},
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-apple-authentication', () => ({}));
vi.mock('expo-location', () => ({
  getForegroundPermissionsAsync: m.readPermission,
  requestForegroundPermissionsAsync: m.requestPermission,
}));
vi.mock('../../components/Brand', () => ({ Brand: 'Brand' }));
vi.mock('../../backend/avatarUpload', () => ({ pickAvatar: vi.fn() }));
vi.mock('../../backend/useAvatarUrl', () => ({ useAvatarUrl: () => null }));
vi.mock('../../backend/client', () => ({ phonePreviewEnabled: false, expoGo: false }));
vi.mock('./AccountProvider', () => ({
  backendConfig: { status: 'configured' },
  supabase: null,
  useAccount: () => ({
    ready: true,
    busy: false,
    session: { user: { id: 'owner' } },
    loadingProfile: false,
    onboarding: {
      step: 'location',
      name: 'New person',
      username: 'new_person',
      bio: '',
      avatar: null,
      visibility: 'private',
    },
    finish: m.finish,
  }),
}));
let tree: ReactTestRenderer;
const buttons = () => tree.root.findAllByType('Pressable' as React.ElementType);
const button = (label: string) =>
  buttons().find((node) =>
    node.findAllByType('Text' as React.ElementType).some((text) => text.props.children === label),
  )!;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, __DEV__: false });
  vi.resetAllMocks();
  m.readPermission.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  m.requestPermission.mockResolvedValue({ status: 'granted', canAskAgain: true });
  m.finish.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(
      <AuthGate>
        <React.Fragment />
      </AuthGate>,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('lists Public first and preselects it without requesting or publishing location on mount', () => {
  const choices = buttons().filter((node) => node.props.accessibilityRole === 'radio');
  expect(choices.map((node) => node.props.accessibilityLabel)).toEqual([
    'public',
    'friends',
    'private',
  ]);
  expect(choices.map((node) => node.props.accessibilityState.checked)).toEqual([
    true,
    false,
    false,
  ]);
  expect(button('Back to profile')).toBeUndefined();
  expect(m.requestPermission).not.toHaveBeenCalled();
  expect(m.finish).not.toHaveBeenCalled();
});
it('requests location after Continue and saves the explicitly confirmed Public choice', async () => {
  await act(async () => button('Enable location & continue').props.onPress());
  expect(m.requestPermission).toHaveBeenCalledOnce();
  expect(m.finish).toHaveBeenCalledExactlyOnceWith('public', true);
});
it('honors Friends and lets a user skip location without prompting', async () => {
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'friends' }).props.onPress());
  await act(async () => button('Continue without location').props.onPress());
  expect(m.requestPermission).not.toHaveBeenCalled();
  expect(m.finish).toHaveBeenCalledExactlyOnceWith('friends', false);
});
it('continues after permission denial without starting location sharing', async () => {
  m.requestPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });
  await act(async () => button('Enable location & continue').props.onPress());
  expect(m.finish).toHaveBeenCalledExactlyOnceWith('public', false);
});
