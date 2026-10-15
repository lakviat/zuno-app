import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSeed } from '../../mocks/seed';
import type { AppSnapshot, Meetup } from '../../types/domain';
import { MeetupForm } from './MeetupForm';
import { localDateTime, toInstant } from './localTime';

const m = vi.hoisted(() => ({
  state: null as AppSnapshot | null,
  runMeetup: vi.fn(),
  notify: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('react-native', () => ({
  Keyboard: { dismiss: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
}));
vi.mock('../../components/ui', () => ({
  Button: 'Button',
  Chip: 'Chip',
  EmptyState: 'EmptyState',
  Field: 'Field',
  Icon: 'Icon',
  Txt: 'Txt',
  ui: { row: {} },
}));
vi.mock('../../components/Sheet', () => ({
  Sheet: (props: { children: React.ReactNode; footer: React.ReactNode }) =>
    React.createElement('Sheet', props, props.children, props.footer),
}));
vi.mock('./DateTimeField', () => ({ DateTimeField: 'DateTimeField' }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'new-meetup' }));
vi.mock('../../state/AppContext', () => ({
  useApp: () => ({
    state: m.state,
    now: Date.parse('2026-10-01T12:00:00Z'),
    meetupViewerId: 'me',
    meetupAreaId: 'sunset-harbour',
    setMeetupAreaId: vi.fn(),
    runMeetup: m.runMeetup,
    colors: {},
    notify: m.notify,
  }),
}));
let tree: ReactTestRenderer | undefined;
let meetup: Meetup;
const buttons = () => tree!.root.findAllByType('Button' as React.ElementType);
const save = () => buttons().find((button) => button.props.children === 'Save changes')!;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  vi.stubEnv('TZ', 'America/New_York');
  m.state = createSeed();
  meetup = {
    ...m.state.meetups[0],
    id: 'editing',
    hostId: 'me',
    status: 'scheduled',
    visibility: 'public',
    startsAt: '2026-11-01T06:30:45.000Z',
    endsAt: '2026-11-01T07:30:45.000Z',
    place: { ...m.state.meetups[0].place, kind: 'map-pin' },
  };
  m.state.meetups = [meetup];
  m.runMeetup.mockResolvedValue({ ok: true, meetup });
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  vi.unstubAllEnvs();
});
const render = async (editing = true) => {
  await act(async () => {
    tree = create(
      <MeetupForm
        meetupId={editing ? meetup.id : undefined}
        place={editing ? undefined : meetup.place}
        navigate={m.navigate}
      />,
    );
  });
};

it('preserves the exact schedule when editing only the title during the repeated DST hour', async () => {
  expect(localDateTime(meetup.startsAt)).toBe('2026-11-01T01:30');
  expect(toInstant(localDateTime(meetup.startsAt))).not.toBe(meetup.startsAt);
  await render();
  await act(async () => {
    tree!.root.findByProps({ label: 'Meetup title (optional)' }).props.onChangeText('New title');
  });
  await act(async () => save().props.onPress());
  expect(m.runMeetup).toHaveBeenCalledExactlyOnceWith({
    operation: 'edit',
    id: meetup.id,
    draft: expect.objectContaining({
      title: 'New title',
      startsAt: meetup.startsAt,
      endsAt: meetup.endsAt,
      place: meetup.place,
    }),
  });
});

it('saves an explicitly changed end time without changing the original start', async () => {
  await render();
  await act(async () => {
    tree!.root.findByProps({ label: 'Ends' }).props.onChange('2026-11-01T03:00');
  });
  await act(async () => save().props.onPress());
  expect(m.runMeetup).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: 'edit',
      draft: expect.objectContaining({
        startsAt: meetup.startsAt,
        endsAt: toInstant('2026-11-01T03:00'),
      }),
    }),
  );
});

it('does not offer a create-only map-spot flow while editing an existing meetup', async () => {
  await render();
  expect(buttons().some((button) => button.props.children === 'Choose another map spot')).toBe(
    false,
  );
  expect(m.navigate).not.toHaveBeenCalled();
});

it('still allows choosing another map spot for a new meetup', async () => {
  await render(false);
  await act(async () => {
    buttons()
      .find((button) => button.props.children === 'Choose another map spot')!
      .props.onPress();
  });
  expect(m.navigate).toHaveBeenCalledExactlyOnceWith({
    name: 'create-meetup',
    friendId: undefined,
  });
});
