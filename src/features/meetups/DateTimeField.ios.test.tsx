import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { DateTimeField } from './DateTimeField.ios';
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
vi.mock('@react-native-community/datetimepicker', () => ({ default: 'DateTimePicker' }));
vi.mock('../../components/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Txt: 'Txt',
  ui: { row: {} },
}));
vi.mock('../../state/AppContext', () => ({ useApp: () => ({ colors: {}, dark: false }) }));
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('opens native time wheels, preserves date/time parts, and collapses on Done', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const onChange = vi.fn();
  await act(async () => {
    tree = create(<DateTimeField label="Starts" value="2026-10-27T14:50" onChange={onChange} />);
  });
  const picker = () => tree.root.findAllByType('DateTimePicker' as React.ElementType);
  expect(picker()).toHaveLength(1);
  await act(async () => {
    picker()[0].props.onValueChange({}, new Date(2026, 11, 5, 0, 0));
  });
  expect(onChange).toHaveBeenLastCalledWith('2026-12-05T14:50');
  await act(async () => {
    tree.root.findByType('Pressable' as React.ElementType).props.onPress();
  });
  expect(picker()[1].props).toMatchObject({ mode: 'time', display: 'spinner' });
  await act(async () => {
    picker()[1].props.onValueChange({}, new Date(2020, 0, 1, 10, 30));
  });
  expect(onChange).toHaveBeenLastCalledWith('2026-10-27T10:30');
  await act(async () => {
    tree.root.findByType('Button' as React.ElementType).props.onPress();
  });
  expect(picker()).toHaveLength(1);
});
