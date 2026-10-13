import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AvatarUpload } from './AvatarUpload';
const m = vi.hoisted(() => ({
  pick: vi.fn(),
  dispatch: vi.fn(),
  notify: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  View: 'View',
}));
vi.mock('../../components/ui', () => ({ Button: 'Button' }));
vi.mock('../../backend/avatarUpload', () => ({ pickAvatar: m.pick }));
vi.mock('../../backend/client', () => ({
  supabase: { storage: { from: () => ({ remove: m.remove }) } },
}));
vi.mock('../../state/AppContext', () => ({
  useApp: () => ({
    state: { currentUserId: 'owner' },
    me: { profile: { avatar: 'owner/old.jpg' }, presence: { status: 'Hello' } },
    dispatch: m.dispatch,
    notify: m.notify,
  }),
}));
let tree: ReactTestRenderer;
const photo = () => tree.root.findByType('Pressable' as React.ElementType);
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  m.pick.mockResolvedValue('owner/new.jpg');
  m.dispatch.mockResolvedValue(true);
  m.remove.mockResolvedValue({ error: null });
  await act(async () => {
    tree = create(
      <AvatarUpload>
        <React.Fragment>Avatar</React.Fragment>
      </AvatarUpload>,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
it('opens the picker from the avatar and saves before removing the previous photo', async () => {
  expect(photo().props.accessibilityLabel).toBe('Change profile photo');
  await act(async () => {
    photo().props.onPress();
    photo().props.onPress();
  });
  expect(m.pick).toHaveBeenCalledExactlyOnceWith('owner');
  expect(m.dispatch).toHaveBeenCalledExactlyOnceWith({
    type: 'profile',
    value: { avatar: 'owner/new.jpg' },
    status: 'Hello',
  });
  expect(m.remove).toHaveBeenCalledExactlyOnceWith(['owner/old.jpg']);
  expect(m.dispatch.mock.invocationCallOrder[0]).toBeLessThan(m.remove.mock.invocationCallOrder[0]);
  expect(m.notify).toHaveBeenCalledExactlyOnceWith('Profile photo saved.');
});
it('keeps the old photo on cancelled selection', async () => {
  m.pick.mockResolvedValue(null);
  await act(async () => photo().props.onPress());
  expect(m.dispatch).not.toHaveBeenCalled();
  expect(m.remove).not.toHaveBeenCalled();
  expect(photo().props.disabled).toBe(false);
});
it('cleans up only the new upload if saving fails', async () => {
  m.dispatch.mockResolvedValue(false);
  await act(async () => photo().props.onPress());
  expect(m.remove).toHaveBeenCalledExactlyOnceWith(['owner/new.jpg']);
  expect(m.notify).not.toHaveBeenCalledWith('Profile photo saved.');
  expect(photo().props.disabled).toBe(false);
});
