import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { tokens } from '../theme/tokens';
import { IconButton, Txt, ui } from './ui';

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  back,
  scroll = true,
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  back?: () => void;
  scroll?: boolean;
}>) {
  const { colors, toast } = useApp();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 720;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          justifyContent: wide ? 'center' : 'flex-end',
          alignItems: 'center',
          backgroundColor: colors.overlay,
          paddingTop: insets.top + 12,
        }}
      >
        <Pressable
          accessibilityLabel="Close panel"
          onPress={onClose}
          style={{ position: 'absolute', inset: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: wide ? 480 : '100%',
            height: Math.min(height * (wide ? 0.84 : 0.88), 760),
            backgroundColor: colors.surface,
            borderRadius: 28,
            borderBottomLeftRadius: wide ? 28 : 0,
            borderBottomRightRadius: wide ? 28 : 0,
            paddingBottom: Math.max(insets.bottom, 16),
            overflow: 'hidden',
            ...tokens.shadow,
          }}
        >
          {!wide && (
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 4,
                backgroundColor: colors.line,
                alignSelf: 'center',
                marginTop: 10,
              }}
            />
          )}
          <View
            style={[
              ui.between,
              {
                paddingHorizontal: 24,
                paddingVertical: 22,
                borderBottomWidth: 1,
                borderColor: colors.line,
              },
            ]}
          >
            <View style={[ui.row, { gap: 10, flex: 1 }]}>
              {back && <IconButton name="arrow-left" label="Go back" onPress={back} />}
              <View style={{ flex: 1 }}>
                <Txt weight="display" style={{ fontSize: 27 }}>
                  {title}
                </Txt>
                {subtitle && (
                  <Txt muted style={{ fontSize: 12, marginTop: 4 }}>
                    {subtitle}
                  </Txt>
                )}
              </View>
            </View>
            <IconButton
              name="x"
              label="Close"
              onPress={onClose}
              style={{ backgroundColor: colors.raised }}
            />
          </View>
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 24, gap: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>{children}</View>
          )}
          {footer && (
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 14,
                borderTopWidth: 1,
                borderColor: colors.line,
              }}
            >
              {footer}
            </View>
          )}
        </View>
        {toast !== '' && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: insets.top + 20,
              alignSelf: 'center',
              maxWidth: '90%',
              padding: 15,
              borderRadius: 16,
              backgroundColor: colors.ink,
            }}
          >
            <Txt style={{ color: colors.surface, fontSize: 12 }}>{toast}</Txt>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
