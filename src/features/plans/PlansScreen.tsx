import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Chip, EmptyState, Field, Icon, Txt, ui } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { places } from '../../mocks/seed';
import { useApp } from '../../state/AppContext';
import { isBlocked } from '../../utils/privacy';
import { planTime, uid } from '../../utils/time';
import type { Navigate } from '../../navigation/routes';
import type { Plan } from '../../types/domain';

export function PlanCard({ plan, onPress }: { plan: Plan; onPress: () => void }) {
  const { state, colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${plan.title}`}
      onPress={onPress}
      style={{ padding: 20, backgroundColor: colors.raised, borderRadius: 23, gap: 12 }}
    >
      <View style={ui.between}>
        <View
          style={{
            width: 48,
            height: 48,
            backgroundColor: colors.surface,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={{ fontSize: 27 }}>{plan.emoji}</Txt>
        </View>
        <Txt
          style={{
            fontSize: 10,
            color: colors.green,
            backgroundColor: colors.greenSoft,
            padding: 8,
            borderRadius: 12,
          }}
        >
          OPEN TO FRIENDS
        </Txt>
      </View>
      <Txt weight="display" style={{ fontSize: 24 }}>
        {plan.title}
      </Txt>
      <View style={[ui.row, { gap: 6 }]}>
        <Icon name="clock" size={13} color={colors.muted} />
        <Txt muted style={{ fontSize: 12 }}>
          {planTime(plan.startsAt)}
        </Txt>
      </View>
      <View style={[ui.row, { gap: 6 }]}>
        <Icon name="map-pin" size={13} color={colors.muted} />
        <Txt muted style={{ fontSize: 12 }}>
          {plan.place.name} · {plan.place.area}
        </Txt>
      </View>
      <View style={[ui.row, { marginTop: 5 }]}>
        {plan.participants.slice(0, 4).map((p, i) => {
          const person = state.people.find((f) => f.user.id === p.userId);
          return person ? (
            <View
              key={p.userId}
              style={{
                marginLeft: i ? -7 : 0,
                borderWidth: 2,
                borderColor: colors.raised,
                borderRadius: 20,
              }}
            >
              <Avatar person={person} size={26} />
            </View>
          ) : null;
        })}
        <Txt muted style={{ marginLeft: 8, fontSize: 11 }}>
          {plan.participants.length} in the mix
        </Txt>
        <View style={{ flex: 1 }} />
        <Icon name="arrow-up-right" size={19} />
      </View>
    </Pressable>
  );
}
export function PlansScreen({ planId, navigate }: { planId?: string; navigate: Navigate }) {
  const { now, state, dispatch, colors } = useApp();
  const plans = state.plans.filter(
    (p) => Date.parse(p.expiresAt) > now && !isBlocked(state, p.creatorId),
  );
  const plan = plans.find((p) => p.id === planId);
  const joined = plan?.participants.some(
    (p) => p.userId === state.currentUserId && p.status === 'joined',
  );
  return (
    <Sheet
      title={plan ? 'A little get-together' : 'Good plans, good people'}
      subtitle={
        plan
          ? 'The best plans don’t need much planning.'
          : 'Turn a “we should” into a “see you there”.'
      }
      onClose={() => navigate({ name: 'map' })}
      back={plan ? () => navigate({ name: 'plans' }) : undefined}
      footer={
        <Button
          icon={plan ? (joined ? 'check' : 'plus') : 'plus'}
          onPress={() =>
            plan ? dispatch({ type: 'join', planId: plan.id }) : navigate({ name: 'create-plan' })
          }
        >
          {plan ? (joined ? 'You’re in · tap to leave' : 'Count me in') : 'Make a plan'}
        </Button>
      }
    >
      {plan ? (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 18, gap: 14 }}>
            <Txt style={{ fontSize: 60 }}>{plan.emoji}</Txt>
            <Txt weight="display" style={{ fontSize: 30, textAlign: 'center' }}>
              {plan.title}
            </Txt>
            <Txt muted style={{ lineHeight: 22, textAlign: 'center' }}>
              {plan.description}
            </Txt>
          </View>
          <View style={{ padding: 20, backgroundColor: colors.raised, borderRadius: 20, gap: 15 }}>
            <View style={[ui.row, { gap: 12 }]}>
              <Icon name="clock" />
              <Txt>{planTime(plan.startsAt)}</Txt>
            </View>
            <View style={[ui.row, { gap: 12 }]}>
              <Icon name="map-pin" />
              <View>
                <Txt weight="bold">{plan.place.name}</Txt>
                <Txt muted style={{ fontSize: 12, marginTop: 4 }}>
                  {plan.place.area} ·{' '}
                  {plan.place.precision === 'approximate'
                    ? 'approximate area'
                    : 'public meeting place'}
                </Txt>
              </View>
            </View>
          </View>
          <Txt weight="bold">The good company</Txt>
          {plan.participants.map((part) => {
            const person = state.people.find((p) => p.user.id === part.userId);
            return person ? (
              <View key={part.userId} style={[ui.row, { gap: 12 }]}>
                <Avatar person={person} size={40} />
                <Txt style={{ flex: 1 }}>{person.profile.displayName}</Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {part.status === 'joined' ? 'Going' : 'Interested'}
                </Txt>
              </View>
            ) : null;
          })}
          <Txt muted style={{ fontSize: 11 }}>
            Disappears {planTime(plan.expiresAt).toLowerCase()}. Invites are saved only in this
            demo.
          </Txt>
        </>
      ) : (
        <>
          {plans.length === 0 && (
            <EmptyState
              icon="sun"
              title="An open afternoon"
              body="Be the one who gets everyone together."
            />
          )}
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              onPress={() => navigate({ name: 'plans', planId: p.id })}
            />
          ))}
        </>
      )}
    </Sheet>
  );
}
export function CreatePlanScreen({
  friendId,
  navigate,
}: {
  friendId?: string;
  navigate: Navigate;
}) {
  const { state, friends, dispatch, colors, notify } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [placeId, setPlaceId] = useState(places[0].id);
  const [when, setWhen] = useState(60);
  const [emoji, setEmoji] = useState('☕');
  const [invites, setInvites] = useState<string[]>(friendId ? [friendId] : []);
  const create = () => {
    if (!title.trim()) return;
    const start = new Date(Date.now() + when * 60000);
    const id = uid();
    dispatch({
      type: 'plan',
      plan: {
        id,
        title: title.trim(),
        description: description.trim(),
        emoji,
        creatorId: state.currentUserId,
        place: places.find((p) => p.id === placeId)!,
        startsAt: start.toISOString(),
        expiresAt: new Date(start.getTime() + 4 * 3600000).toISOString(),
        invitedFriendIds: invites,
        participants: [{ userId: state.currentUserId, status: 'joined' }],
      },
    });
    notify('A good idea is now a plan. Saved to your demo world.');
    navigate({ name: 'plans', planId: id });
  };
  return (
    <Sheet
      title="Make a little plan"
      subtitle="Something spontaneous. Someone you like."
      onClose={() => navigate({ name: 'map' })}
      back={() => navigate({ name: 'plans' })}
      footer={
        <Button disabled={!title.trim()} icon="arrow-right" onPress={create}>
          Let’s make it happen
        </Button>
      }
    >
      <View style={[ui.row, { gap: 10 }]}>
        {['☕', '🌅', '🌊', '🏀', '🌿'].map((e) => (
          <Pressable
            key={e}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${e} plan icon`}
            onPress={() => setEmoji(e)}
            style={{
              flex: 1,
              height: 55,
              borderRadius: 17,
              backgroundColor: emoji === e ? colors.accentSoft : colors.raised,
              borderWidth: 1,
              borderColor: emoji === e ? colors.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: 25 }}>{e}</Txt>
          </Pressable>
        ))}
      </View>
      <Field
        label="What’s the plan?"
        placeholder="Coffee & a catch-up"
        value={title}
        onChangeText={setTitle}
        maxLength={60}
      />
      <Field
        label="A little more (optional)"
        placeholder="I’ll grab us a table…"
        value={description}
        onChangeText={setDescription}
        maxLength={240}
        multiline
      />
      <Txt weight="bold" style={{ fontSize: 12 }}>
        Pick a spot
      </Txt>
      <View style={{ gap: 8 }}>
        {places.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPlaceId(p.id)}
            style={[
              ui.between,
              {
                padding: 15,
                backgroundColor: colors.raised,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: p.id === placeId ? colors.accent : colors.line,
              },
            ]}
          >
            <View>
              <Txt weight="medium">{p.name}</Txt>
              <Txt muted style={{ fontSize: 11, marginTop: 3 }}>
                {p.area} · {p.precision === 'approximate' ? 'area only' : 'public place'}
              </Txt>
            </View>
            <Icon
              name={p.id === placeId ? 'check-circle' : 'circle'}
              size={19}
              color={p.id === placeId ? colors.accent : colors.muted}
            />
          </Pressable>
        ))}
      </View>
      <Txt weight="bold" style={{ fontSize: 12 }}>
        When?
      </Txt>
      <View style={[ui.row, { flexWrap: 'wrap', gap: 7 }]}>
        {[
          [30, 'In 30 min'],
          [60, 'In an hour'],
          [180, 'In 3 hours'],
          [1440, 'Tomorrow'],
        ].map(([n, l]) => (
          <Chip key={n} label={String(l)} active={when === n} onPress={() => setWhen(Number(n))} />
        ))}
      </View>
      <Txt weight="bold" style={{ fontSize: 12 }}>
        Bring your people · {invites.length} invited
      </Txt>
      <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
        {friends.map((f) => (
          <Chip
            key={f.user.id}
            label={f.profile.displayName.split(' ')[0]}
            active={invites.includes(f.user.id)}
            onPress={() =>
              setInvites((prev) =>
                prev.includes(f.user.id)
                  ? prev.filter((id) => id !== f.user.id)
                  : [...prev, f.user.id],
              )
            }
          />
        ))}
      </View>
      <Txt muted style={{ fontSize: 11 }}>
        Plans expire four hours after they start. Only your friends can join.
      </Txt>
    </Sheet>
  );
}
