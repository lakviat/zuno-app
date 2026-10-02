import { OlderMessages } from './OlderMessages';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar, Button, EmptyState, Field, IconButton, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import type { Navigate } from '../../navigation/routes';
import { getAuthorizedMeetup, meetupLifecycle } from '../meetups/domain';
import { canReadMeetupChat, meetupMessages } from '../meetups/chatDomain';
import { timeLabel, uid } from '../../utils/time';
export function MeetupChat({ meetupId, navigate }: { meetupId: string; navigate: Navigate }) {
  const { state, now, meetupViewerId, colors, dispatch } = useApp();
  const [text, setText] = useState('');
  const sending = useRef(false);
  const lastScrolledMessage = useRef<string | undefined>(undefined);
  const scroll = useRef<ScrollView>(null);
  const m = getAuthorizedMeetup(state, meetupViewerId, meetupId);
  const allowed = canReadMeetupChat(state, meetupViewerId, meetupId);
  const writable = allowed && m && ['scheduled', 'active'].includes(meetupLifecycle(m, now));
  const send = async () => {
    if (sending.current || !writable || !text.trim()) return;
    sending.current = true;
    const draft = text;
    try {
      const saved = await dispatch({
        type: 'meetup-message',
        actorId: meetupViewerId,
        meetupId,
        text,
        id: uid(),
        now: Date.now(),
      });
      if (saved) setText((current) => (current === draft ? '' : current));
    } finally {
      sending.current = false;
    }
  };
  return (
    <Sheet
      title={m ? `${m.emoji} ${m.title}` : 'Meetup chat'}
      subtitle={m?.place.name}
      back={() => navigate({ name: 'meetups', meetupId })}
      onClose={() => navigate({ name: 'map' })}
      scroll={false}
      footer={
        allowed ? (
          <View style={[ui.row, { gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Field
                accessibilityLabel="Meetup message"
                placeholder={writable ? 'Say hello to everyone…' : 'This meetup is archived'}
                value={text}
                onChangeText={setText}
                editable={!!writable}
                onSubmitEditing={send}
                returnKeyType="send"
                maxLength={2000}
              />
            </View>
            <IconButton name="arrow-up" label="Send meetup message" onPress={send} active />
          </View>
        ) : undefined
      }
    >
      {!allowed || !m ? (
        <EmptyState
          icon="lock"
          title="Join to chat"
          body="Only current meetup members can read this conversation."
        />
      ) : (
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 22, gap: 16 }}
          onContentSizeChange={() => {
            const lastId = meetupMessages(state, meetupViewerId, meetupId).at(-1)?.id;
            if (lastId !== lastScrolledMessage.current) {
              lastScrolledMessage.current = lastId;
              scroll.current?.scrollToEnd({ animated: false });
            }
          }}
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        >
          <Button
            kind="secondary"
            icon="map-pin"
            onPress={() => navigate({ name: 'map', coordinate: m.place.coordinate })}
          >
            Open meeting spot on map
          </Button>
          <Txt muted style={{ fontSize: 11 }}>
            {m.participantIds.length} going ·{' '}
            {state.dataMode === 'cloud'
              ? 'Messages are shared with current members.'
              : 'Messages stay in this local demo.'}
          </Txt>
          <OlderMessages
            conversationId={state.conversations.find((c) => c.meetupId === meetupId)?.id}
          />
          {meetupMessages(state, meetupViewerId, meetupId).map((message) => {
            const own = message.senderId === meetupViewerId;
            const person = state.people.find((p) => p.user.id === message.senderId);
            if (message.kind === 'system')
              return (
                <Txt key={message.id} muted style={{ fontSize: 11, textAlign: 'center' }}>
                  {message.text} · {timeLabel(message.createdAt)}
                </Txt>
              );
            return (
              <View
                key={message.id}
                style={{ alignItems: own ? 'flex-end' : 'flex-start', gap: 6 }}
              >
                <View style={[ui.row, { gap: 8 }]}>
                  {person && <Avatar person={person} size={25} />}
                  <Txt muted style={{ fontSize: 11 }}>
                    {person?.profile.displayName.split(' ')[0]}
                  </Txt>
                </View>
                <View
                  style={{
                    maxWidth: '90%',
                    borderRadius: 18,
                    backgroundColor: own ? colors.accentSoft : colors.raised,
                    padding: 14,
                  }}
                >
                  <Txt>{message.text}</Txt>
                </View>
                <Txt muted style={{ fontSize: 10 }}>
                  {timeLabel(message.createdAt)}
                </Txt>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Sheet>
  );
}
