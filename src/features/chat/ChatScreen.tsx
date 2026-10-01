import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, EmptyState, Field, IconButton, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useApp } from '../../state/AppContext';
import { isBlocked, isFriend } from '../../utils/privacy';
import { timeLabel, uid } from '../../utils/time';
import type { Navigate } from '../../navigation/routes';

export function ChatScreen({ friendId, navigate }: { friendId?: string; navigate: Navigate }) {
  const { state, dispatch, colors } = useApp();
  const [text, setText] = useState('');
  const scroll = useRef<ScrollView>(null);
  const person = state.people.find((p) => p.user.id === friendId);
  const conversation = state.conversations.find(
    (c) => friendId && c.participantIds.includes(friendId),
  );
  const conversationId = conversation?.id ?? `c-${friendId}`;
  const messages = state.messages.filter((m) => m.conversationId === conversationId);
  const canSend = !!friendId && isFriend(state, friendId) && !isBlocked(state, friendId);
  useEffect(() => {
    if (friendId && conversation?.unreadCount) dispatch({ type: 'read', conversationId });
  }, [friendId, conversation?.unreadCount, conversationId, dispatch]);
  const send = () => {
    if (!text.trim() || !friendId || !canSend) return;
    dispatch({
      type: 'message',
      friendId,
      message: {
        id: uid(),
        conversationId,
        senderId: state.currentUserId,
        text,
        createdAt: new Date().toISOString(),
        state: 'sent',
      },
    });
    setText('');
  };
  if (!person)
    return (
      <Sheet
        title="Little hellos"
        subtitle="Good things start with a conversation."
        onClose={() => navigate({ name: 'map' })}
      >
        {state.conversations
          .filter((c) => c.participantIds.every((id) => !isBlocked(state, id)))
          .map((c) => {
            const friend = state.people.find(
              (p) => c.participantIds.includes(p.user.id) && p.user.id !== state.currentUserId,
            );
            const last = state.messages.filter((m) => m.conversationId === c.id).at(-1);
            return friend ? (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${friend.profile.displayName}`}
                onPress={() => navigate({ name: 'inbox', friendId: friend.user.id })}
                style={[ui.row, { gap: 14, paddingVertical: 9 }]}
              >
                <Avatar person={friend} size={54} online={friend.presence.freeNow} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={ui.between}>
                    <Txt weight="bold">{friend.profile.displayName.split(' ')[0]}</Txt>
                    <Txt muted style={{ fontSize: 10 }}>
                      {last && timeLabel(last.createdAt)}
                    </Txt>
                  </View>
                  <Txt muted numberOfLines={1} style={{ fontSize: 12 }}>
                    {last?.text ?? 'Say a little hello'}
                  </Txt>
                </View>
                {c.unreadCount > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: 20,
                      minWidth: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt style={{ color: 'white', fontSize: 10 }}>{c.unreadCount}</Txt>
                  </View>
                )}
              </Pressable>
            ) : null;
          })}
        <Txt muted style={{ fontSize: 11, lineHeight: 18 }}>
          Demo conversations live on this device. New messages aren’t delivered to another person.
        </Txt>
      </Sheet>
    );
  return (
    <Sheet
      title={person.profile.displayName.split(' ')[0]}
      subtitle={`${person.presence.emoji} ${person.presence.status}`}
      onClose={() => navigate({ name: 'map' })}
      back={() => navigate({ name: 'inbox' })}
      scroll={false}
      footer={
        <View style={[ui.row, { gap: 8 }]}>
          <View style={{ flex: 1 }}>
            <Field
              placeholder={canSend ? 'Say a little hello…' : 'Add this person to chat'}
              accessibilityLabel="Message"
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              maxLength={2000}
              editable={canSend}
              returnKeyType="send"
            />
          </View>
          <IconButton name="arrow-up" label="Send message" onPress={send} active />
        </View>
      }
    >
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 24, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Txt muted style={{ textAlign: 'center', fontSize: 10, letterSpacing: 1.4 }}>
          YOUR LITTLE CONVERSATION
        </Txt>
        {messages.length === 0 && (
          <EmptyState
            icon="message-circle"
            title="Make their day"
            body="A simple hello is a pretty good start."
          />
        )}
        {messages.map((m) => {
          const own = m.senderId === state.currentUserId;
          return (
            <View key={m.id} style={{ alignItems: own ? 'flex-end' : 'flex-start', gap: 6 }}>
              <View
                style={{
                  maxWidth: '85%',
                  padding: 15,
                  borderRadius: 20,
                  borderBottomRightRadius: own ? 5 : 20,
                  borderBottomLeftRadius: own ? 20 : 5,
                  backgroundColor: own ? colors.accent : colors.raised,
                }}
              >
                <Txt style={{ color: own ? '#FFFFFF' : colors.ink, lineHeight: 21 }}>{m.text}</Txt>
              </View>
              <Txt muted style={{ fontSize: 10 }}>
                {timeLabel(m.createdAt)}
                {own ? ' · Saved locally' : ''}
              </Txt>
            </View>
          );
        })}
        <Txt muted style={{ fontSize: 10, textAlign: 'center', marginTop: 8 }}>
          Demo chat · live typing will arrive with realtime messaging
        </Txt>
      </ScrollView>
    </Sheet>
  );
}
