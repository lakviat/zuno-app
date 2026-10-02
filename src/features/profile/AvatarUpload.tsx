import { useState } from 'react';
import { pickAvatar } from '../../backend/avatarUpload';
import { Button } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { supabase } from '../../backend/client';
export function AvatarUpload() {
  const { state, me, dispatch, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const upload = async () => {
    if (busy || !supabase) return;
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
      setBusy(false);
    }
  };
  return (
    <Button kind="quiet" disabled={busy} onPress={() => void upload()}>
      {busy ? 'Uploading photo…' : 'Choose profile photo'}
    </Button>
  );
}
