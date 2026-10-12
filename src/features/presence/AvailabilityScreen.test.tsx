import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSeed } from '../../mocks/seed';
import { AvailabilityScreen } from './AvailabilityScreen';

const m = vi.hoisted(() => ({ dispatch: vi.fn(), notify: vi.fn(), navigate: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('../../components/ui', () => ({
  Button: 'Button',
  Chip: 'Chip',
  Field: 'Field',
  Txt: 'Txt',
  ui: { row: {} },
}));
vi.mock('../../components/Sheet', () => ({
  Sheet: (props: { children: React.ReactNode; footer: React.ReactNode }) =>
    React.createElement('Sheet', props, props.children, props.footer),
}));
vi.mock('../../state/AppContext', () => ({
  useApp: () => ({
    me: createSeed().people[0],
    now: Date.now(),
    dispatch: m.dispatch,
    notify: m.notify,
  }),
}));
let tree: ReactTestRenderer;
const button = () => tree.root.findByType('Button' as React.ElementType);
const chip = (label: string) =>
  tree.root.findAllByType('Chip' as React.ElementType).find((n) => n.props.label === label)!;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  await act(async () => {
    tree = create(<AvailabilityScreen navigate={m.navigate} />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('waits for persistence, rejects duplicate taps, and retains the draft after failure for retry', async () => {
  let finish!: (saved: boolean) => void;
  m.dispatch.mockImplementationOnce(
    () =>
      new Promise<boolean>((r) => {
        finish = r;
      }),
  );
  await act(async () => {
    chip('Maybe later').props.onPress();
    chip('🏋️ Gym').props.onPress();
  });
  await act(async () => {
    void button().props.onPress();
    void button().props.onPress();
  });
  expect(m.dispatch).toHaveBeenCalledTimes(1);
  expect(m.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ value: 'later', intent: '🏋️ Gym' }),
  );
  expect(button().props.disabled).toBe(true);
  expect(m.navigate).not.toHaveBeenCalled();
  expect(m.notify).not.toHaveBeenCalled();
  await act(async () => {
    finish(false);
  });
  expect(button().props.disabled).toBe(false);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'wasn’t saved',
  );
  expect(chip('🏋️ Gym').props.active).toBe(true);
  expect(m.navigate).not.toHaveBeenCalled();
  m.dispatch.mockResolvedValueOnce(true);
  await act(async () => {
    await button().props.onPress();
  });
  expect(m.dispatch).toHaveBeenCalledTimes(2);
  expect(m.navigate).toHaveBeenCalledExactlyOnceWith({ name: 'map' });
  expect(m.notify).toHaveBeenCalledOnce();
});

it('handles a thrown save error without reporting success', async () => {
  m.dispatch.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => {
    await button().props.onPress();
  });
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  expect(m.navigate).not.toHaveBeenCalled();
  expect(m.notify).not.toHaveBeenCalled();
});

it('does not navigate away from a newer screen when a dismissed save completes', async () => {
  let finish!: (saved: boolean) => void;
  m.dispatch.mockImplementationOnce(
    () =>
      new Promise<boolean>((r) => {
        finish = r;
      }),
  );
  await act(async () => {
    void button().props.onPress();
  });
  await act(async () => {
    tree.unmount();
  });
  await act(async () => {
    finish(true);
  });
  expect(m.navigate).not.toHaveBeenCalled();
  expect(m.notify).not.toHaveBeenCalled();
});
