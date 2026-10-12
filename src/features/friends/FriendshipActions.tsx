import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { isBlocked, isFriend } from '../../utils/privacy';

/** The same request states are used on map cards and full profiles. */
export function FriendshipActions({ userId, onManage }: { userId: string; onManage?: () => void }) {
  const { state, dispatch, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  if (userId === state.currentUserId) return null;
  const blocked = isBlocked(state, userId);
  const friend = isFriend(state, userId);
  const request = state.friendships.find(
    (f) =>
      f.status === 'pending' &&
      ((f.requesterId === state.currentUserId && f.addresseeId === userId) ||
        (f.addresseeId === state.currentUserId && f.requesterId === userId)),
  );
  const incoming = request?.addresseeId === state.currentUserId;
  const act = async (operation: 'add' | 'accept' | 'remove') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      if (
        await dispatch({ type: 'friend', id: userId, operation, now: new Date().toISOString() })
      ) {
        notify(
          operation === 'add'
            ? 'Friend request sent.'
            : operation === 'accept'
              ? 'You’re now friends.'
              : incoming
                ? 'Request declined.'
                : 'Request cancelled.',
        );
      } else setError('Your request wasn’t saved. Please try again.');
    } catch {
      setError('Your request wasn’t saved. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  if (blocked)
    return (
      <Button disabled onPress={() => {}}>
        Blocked
      </Button>
    );
  if (friend)
    return (
      <Button kind="secondary" icon="check" disabled={!onManage} onPress={() => onManage?.()}>
        Friends
      </Button>
    );
  return (
    <View style={{ gap: 6 }}>
      {!!error && <Txt accessibilityRole="alert">{error}</Txt>}
      <Button
        icon={request ? 'check' : 'user-plus'}
        disabled={busy || (!!request && !incoming)}
        onPress={() => void act(incoming ? 'accept' : 'add')}
      >
        {busy
          ? 'Saving…'
          : incoming
            ? 'Accept friend request'
            : request
              ? 'Request sent'
              : 'Send friend request'}
      </Button>
      {!!request && (
        <Button kind="quiet" disabled={busy} onPress={() => void act('remove')}>
          {incoming ? 'Decline request' : 'Cancel request'}
        </Button>
      )}
    </View>
  );
}
