import { useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { pickAvatar } from '../../backend/avatarUpload';
import { Button } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { supabase } from '../../backend/client';
export function AvatarUpload({ children }: PropsWithChildren) {
  const { state, me, dispatch, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const upload = async () => {
    if (pending.current || !supabase) return;
    pending.current = true;
    setBusy(true);
    try {
      const path = await pickAvatar(state.currentUserId);
      if (!path) return;
      const saved = await dispatch({
        type: 'profile',
        value: { avatar: path },
        status: me.presence.status,
      });
      if (!saved) {
        await supabase.storage.from('zuno-avatars').remove([path]);
        return;
      }
      if (me.profile.avatar)
        await supabase.storage.from('zuno-avatars').remove([me.profile.avatar]);
      notify('Profile photo saved.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update your photo.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return children ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change profile photo"
      accessibilityHint="Choose a photo from your library"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={() => void upload()}
    >
      <View style={{ opacity: busy ? 0.4 : 1 }}>{children}</View>
      {busy && <ActivityIndicator style={{ position: 'absolute', inset: 0 }} />}
    </Pressable>
  ) : (
    <Button kind="quiet" disabled={busy} onPress={() => void upload()}>
      {busy ? 'Uploading photo…' : 'Choose profile photo'}
    </Button>
  );
}
