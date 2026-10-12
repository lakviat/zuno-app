import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSeed } from '../../mocks/seed';
import type { AppSnapshot } from '../../types/domain';
import { FriendshipActions } from './FriendshipActions';
const m = vi.hoisted(() => ({
  state: null as unknown as AppSnapshot,
  dispatch: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('../../components/ui', () => ({ Button: 'Button', Txt: 'Txt' }));
vi.mock('../../state/AppContext', () => ({ useApp: () => m }));
let tree: ReactTestRenderer;
const buttons = () => tree.root.findAllByType('Button' as React.ElementType);
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  m.state = createSeed();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('prevents duplicate requests and keeps failure retryable without claiming success', async () => {
  let finish!: (saved: boolean) => void;
  m.dispatch.mockImplementationOnce(
    () =>
      new Promise<boolean>((r) => {
        finish = r;
      }),
  );
  await act(async () => {
    tree = create(<FriendshipActions userId="mia" />);
  });
  await act(async () => {
    buttons()[0].props.onPress();
    buttons()[0].props.onPress();
  });
  expect(m.dispatch).toHaveBeenCalledTimes(1);
  expect(buttons()[0].props.disabled).toBe(true);
  await act(async () => {
    finish(false);
  });
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'wasn’t saved',
  );
  expect(m.notify).not.toHaveBeenCalled();
  expect(buttons()[0].props.disabled).toBe(false);
  m.dispatch.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => {
    buttons()[0].props.onPress();
  });
  expect(m.notify).not.toHaveBeenCalled();
  m.dispatch.mockResolvedValueOnce(true);
  await act(async () => {
    buttons()[0].props.onPress();
  });
  expect(m.notify).toHaveBeenCalledWith('Friend request sent.');
});
it('offers acceptance only for an incoming request and keeps existing friends distinct', async () => {
  m.state.friendships.push({
    id: 'request',
    requesterId: 'mia',
    addresseeId: m.state.currentUserId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  await act(async () => {
    tree = create(<FriendshipActions userId="mia" />);
  });
  expect(buttons()[0].props.children).toBe('Accept friend request');
  expect(buttons()[1].props.children).toBe('Decline request');
  m.dispatch.mockResolvedValueOnce(true);
  await act(async () => {
    buttons()[0].props.onPress();
  });
  expect(m.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'mia', operation: 'accept' }),
  );
  await act(async () => {
    tree.update(<FriendshipActions userId="alex" onManage={() => {}} />);
  });
  expect(buttons()[0].props.children).toBe('Friends');
});
