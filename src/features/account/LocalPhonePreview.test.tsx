import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { PhoneAuth } from '../../backend/phoneAuth';
import { LocalPhonePreview } from './LocalPhonePreview';
const m = vi.hoisted(() => ({
  values: new Map<string, string>(),
  get: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  end: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: m.get, setItem: m.put, removeItem: m.remove },
}));
vi.mock('../../backend/sessionLifecycle', () => ({ endSessionServices: m.end }));
let auth: PhoneAuth;
let tree: ReactTestRenderer;
function Welcome({ phoneAuth }: { phoneAuth: PhoneAuth }) {
  React.useLayoutEffect(() => {
    auth = phoneAuth;
  }, [phoneAuth]);
  return React.createElement('Welcome');
}
async function mount() {
  await act(async () => {
    tree = create(
      <LocalPhonePreview Welcome={Welcome}>
        <>{React.createElement('SampleMap')}</>
      </LocalPhonePreview>,
    );
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  m.values.clear();
  m.get.mockImplementation(async (key: string) => m.values.get(key) ?? null);
  m.put.mockImplementation(async (key: string, value: string) => {
    m.values.set(key, value);
  });
  m.remove.mockImplementation(async (key: string) => {
    m.values.delete(key);
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
describe('iOS phone test session (native storage boundary)', () => {
  it('accepts a bare US number, rejects wrong codes, opens sample map and signs out', async () => {
    await mount();
    await act(async () => {
      await auth.request('202-555-0123');
    });
    expect(
      tree.root.findAll((node) => node.type === ('SampleMap' as React.ElementType)),
    ).toHaveLength(0);
    await act(async () => {
      await expect(auth.verify('2025550123', '111111')).rejects.toThrow('six-zero');
    });
    await act(async () => {
      await auth.verify('2025550123', '000000');
    });
    expect(
      tree.root.findAll((node) => node.type === ('SampleMap' as React.ElementType)),
    ).toHaveLength(1);
    expect([...m.values.values()]).toEqual(['signed-in']);
    expect(JSON.stringify([...m.values])).not.toContain('2025550123');
    await act(async () => {
      tree.root.findByType('Pressable' as React.ElementType).props.onPress();
    });
    expect(m.end).toHaveBeenCalledOnce();
    expect(m.values.size).toBe(0);
    expect(
      tree.root.findAll((node) => node.type === ('Welcome' as React.ElementType)),
    ).toHaveLength(1);
    await act(async () => {
      await expect(auth.verify('2025550123', '000000')).rejects.toThrow();
    });
  });
  it('restores the native marker after a full component restart', async () => {
    await mount();
    await act(async () => {
      await auth.request('2025550123');
      await auth.verify('2025550123', '000000');
    });
    await act(async () => tree.unmount());
    await mount();
    expect(
      tree.root.findAll((node) => node.type === ('SampleMap' as React.ElementType)),
    ).toHaveLength(1);
  });
  it('cannot verify a different number than the last requested number', async () => {
    await mount();
    await act(async () => {
      await auth.request('2025550123');
      await expect(auth.verify('2025550124', '000000')).rejects.toThrow();
    });
    expect(m.put).not.toHaveBeenCalled();
  });
  it('still permits sample testing when optional native storage is unavailable', async () => {
    m.get.mockRejectedValue(new Error('storage unavailable'));
    m.put.mockRejectedValue(new Error('storage unavailable'));
    await mount();
    await act(async () => {
      await auth.request('2025550123');
      await auth.verify('2025550123', '000000');
    });
    expect(
      tree.root.findAll((node) => node.type === ('SampleMap' as React.ElementType)),
    ).toHaveLength(1);
  });
});
