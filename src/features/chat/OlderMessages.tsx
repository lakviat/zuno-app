import { useState } from 'react';
import { Button, Txt } from '../../components/ui';
import { useApp } from '../../state/AppContext';
export function OlderMessages({ conversationId }: { conversationId?: string }) {
  const { cloud, loadOlder } = useApp();
  const [busy, setBusy] = useState(false);
  const [end, setEnd] = useState(false);
  if (!cloud || !conversationId) return null;
  if (end)
    return (
      <Txt muted style={{ textAlign: 'center', fontSize: 11 }}>
        Start of conversation
      </Txt>
    );
  return (
    <Button
      kind="quiet"
      disabled={busy}
      onPress={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const count = await loadOlder(conversationId);
          if (count === 0) setEnd(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Loading…' : 'Load earlier messages'}
    </Button>
  );
}
