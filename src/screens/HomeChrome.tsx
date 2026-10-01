import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Icon, IconButton, Txt, ui, type IconName } from '../components/ui';
import { Brand } from '../components/Brand';
import { useApp } from '../state/AppContext';
import { tokens } from '../theme/tokens';
import type { Navigate } from '../navigation/routes';

export function Header({
  wide,
  top,
  navigate,
}: {
  wide: boolean;
  top: number;
  navigate: Navigate;
}) {
  const { colors, me, state } = useApp();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: top,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.line,
      }}
    >
      <View style={[ui.between, { height: wide ? 86 : 70, paddingHorizontal: wide ? 34 : 20 }]}>
        <View style={[ui.row, { gap: 24 }]}>
          <Brand small={!wide} />
          {wide && (
            <>
              <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
              <Txt muted style={{ fontSize: 12 }}>
                Life happens together.
              </Txt>
            </>
          )}
        </View>
        {wide && (
          <View
            style={[
              ui.row,
              {
                gap: 8,
                backgroundColor: colors.raised,
                paddingVertical: 10,
                paddingHorizontal: 17,
                borderRadius: 99,
              },
            ]}
          >
            <Icon name="map-pin" size={14} color={colors.green} />
            <Txt weight="medium" style={{ fontSize: 12 }}>
              Miami Beach, FL
            </Txt>
            <View
              style={{ width: 1, height: 13, backgroundColor: colors.line, marginHorizontal: 3 }}
            />
            <Txt style={{ fontSize: 14 }}>☀️</Txt>
            <Txt muted style={{ fontSize: 11 }}>
              a good day to get out
            </Txt>
          </View>
        )}
        <View style={[ui.row, { gap: wide ? 18 : 10 }]}>
          {wide && (
            <View style={[ui.row, { gap: 5 }]}>
              <View
                style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent }}
              />
              <Txt muted style={{ fontSize: 9, letterSpacing: 1.4 }}>
                DEMO WORLD
              </Txt>
            </View>
          )}
          <IconButton
            name={state.privacy.ghostMode ? 'eye-off' : 'shield'}
            label="Location privacy"
            onPress={() => navigate({ name: 'privacy' })}
            style={{ backgroundColor: colors.raised, width: 38, height: 38, borderRadius: 20 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            onPress={() => navigate({ name: 'profile' })}
          >
            <Avatar person={me} size={wide ? 42 : 36} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
export function WorldPanel({
  top,
  navigate,
  selectPerson,
}: {
  top: number;
  navigate: Navigate;
  selectPerson: (id: string) => void;
}) {
  const { friends, me, colors } = useApp();
  return (
    <View style={{ position: 'absolute', left: 28, top, bottom: 97, width: 296 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
      >
        <View
          style={{
            padding: 24,
            borderRadius: 27,
            backgroundColor: colors.surface,
            ...tokens.shadow,
          }}
        >
          <View style={[ui.between, { marginBottom: 19 }]}>
            <Txt weight="medium" style={{ fontSize: 12 }}>
              Hey, {me.profile.displayName.split(' ')[0]} <Txt>✌️</Txt>
            </Txt>
            <Txt
              style={{
                fontSize: 9,
                color: colors.green,
                backgroundColor: colors.greenSoft,
                paddingVertical: 6,
                paddingHorizontal: 9,
                borderRadius: 20,
              }}
            >
              LET’S GET OUT
            </Txt>
          </View>
          <Txt weight="display" style={{ fontSize: 39, lineHeight: 43, letterSpacing: -1.4 }}>
            A little closer.{'\n'}A lot more{' '}
            <Txt weight="display" style={{ fontSize: 39, color: colors.accent }}>
              fun.
            </Txt>
          </Txt>
          <Txt muted style={{ marginTop: 14, fontSize: 12, lineHeight: 19 }}>
            Your favorite people.{'\n'}Somewhere around the corner.
          </Txt>
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 23 }} />
          <View style={ui.between}>
            <Txt weight="bold" style={{ fontSize: 13 }}>
              Around you
            </Txt>
            <Pressable accessibilityRole="button" onPress={() => navigate({ name: 'friends' })}>
              <Txt style={{ color: colors.accent, fontSize: 11 }} weight="bold">
                See all ↗
              </Txt>
            </Pressable>
          </View>
          <View style={{ marginTop: 15, gap: 18 }}>
            {friends.slice(0, 4).map((p) => (
              <Pressable
                key={p.user.id}
                accessibilityRole="button"
                accessibilityLabel={'Find ' + p.profile.displayName + ' on map'}
                onPress={() => selectPerson(p.user.id)}
                style={[ui.row, { gap: 11 }]}
              >
                <Avatar person={p} size={42} online={p.presence.freeNow} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt weight="bold" style={{ fontSize: 12 }}>
                    {p.profile.displayName.split(' ')[0]}
                  </Txt>
                  <Txt muted style={{ fontSize: 10 }}>
                    {p.presence.emoji} {p.presence.status}
                  </Txt>
                </View>
                <Icon name="arrow-up-right" size={15} color={colors.muted} />
              </Pressable>
            ))}
          </View>
          <View style={[ui.row, { gap: 6, marginTop: 22 }]}>
            <View style={{ width: 6, height: 6, borderRadius: 5, backgroundColor: colors.green }} />
            <Txt muted style={{ fontSize: 10 }}>
              {friends.filter((f) => f.presence.freeNow).length} friends are free for a little
              adventure
            </Txt>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a spontaneous plan"
          onPress={() => navigate({ name: 'create-plan' })}
          style={{
            backgroundColor: colors.accentSoft,
            borderRadius: 24,
            padding: 21,
            borderWidth: 1,
            borderColor: colors.surface,
          }}
        >
          <View style={ui.between}>
            <View>
              <Txt weight="bold" style={{ fontSize: 9, color: colors.accent, letterSpacing: 1.4 }}>
                GOOD COMPANY &gt; GROUP CHATS
              </Txt>
              <Txt weight="display" style={{ fontSize: 22, lineHeight: 27, marginTop: 9 }}>
                Less “we should.”{'\n'}More “see you there.”
              </Txt>
            </View>
            <View
              style={{
                alignSelf: 'flex-end',
                backgroundColor: colors.accent,
                width: 37,
                height: 37,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="arrow-up-right" color="white" size={18} />
            </View>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}
export function BottomNav({
  wide,
  bottom,
  navigate,
}: {
  wide: boolean;
  bottom: number;
  navigate: Navigate;
}) {
  const { state, colors } = useApp();
  const unread = state.conversations.reduce((n, c) => n + c.unreadCount, 0);
  const items: { name: 'map' | 'friends' | 'plans' | 'inbox'; title: string; icon: IconName }[] = [
    { name: 'map', title: 'Your world', icon: 'map' },
    { name: 'friends', title: 'People', icon: 'users' },
    { name: 'plans', title: 'Plans', icon: 'sun' },
    { name: 'inbox', title: 'Messages', icon: 'message-circle' },
  ];
  return (
    <View
      style={{
        position: 'absolute',
        bottom,
        alignSelf: 'center',
        width: wide ? 490 : '92%',
        maxWidth: 490,
        padding: 8,
        borderRadius: 25,
        backgroundColor: colors.surface,
        ...tokens.shadow,
      }}
    >
      <View style={[ui.row, { gap: 3 }]}>
        {items.map((item) => (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityState={{ selected: item.name === 'map' }}
            onPress={() => navigate({ name: item.name })}
            style={{
              flex: 1,
              minHeight: 57,
              borderRadius: 18,
              backgroundColor: item.name === 'map' ? colors.accentSoft : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <View>
              <Icon
                name={item.icon}
                color={item.name === 'map' ? colors.accent : colors.muted}
                size={21}
              />
              {item.name === 'inbox' && unread > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -8,
                    backgroundColor: colors.accent,
                    width: 14,
                    height: 14,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                >
                  <Txt style={{ color: 'white', fontSize: 7 }}>{unread}</Txt>
                </View>
              )}
            </View>
            <Txt
              weight={item.name === 'map' ? 'bold' : 'medium'}
              style={{ color: item.name === 'map' ? colors.accent : colors.muted, fontSize: 10 }}
            >
              {item.title}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function MobilePeoplePill({ bottom, navigate }: { bottom: number; navigate: Navigate }) {
  const { friends, colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="See friends nearby"
      onPress={() => navigate({ name: 'friends' })}
      style={[
        ui.row,
        {
          position: 'absolute',
          bottom,
          alignSelf: 'center',
          backgroundColor: colors.surface,
          borderRadius: 99,
          padding: 9,
          paddingRight: 18,
          gap: 9,
          ...tokens.shadow,
        },
      ]}
    >
      <View style={ui.row}>
        {friends.slice(0, 3).map((f, i) => (
          <View
            key={f.user.id}
            style={{
              marginLeft: i ? -10 : 0,
              borderWidth: 2,
              borderColor: colors.surface,
              borderRadius: 30,
            }}
          >
            <Avatar person={f} size={27} />
          </View>
        ))}
      </View>
      <Txt weight="bold" style={{ fontSize: 11 }}>
        {friends.filter((f) => f.presence.freeNow).length} friends free now
      </Txt>
      <Icon name="arrow-up-right" size={15} color={colors.accent} />
    </Pressable>
  );
}
