import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { tokens } from '../theme/tokens';
import { IconButton, Txt, ui } from './ui';

const CloseContext = createContext<React.RefObject<(() => void) | undefined> | null>(null);

/** Keep one native presentation alive while navigating between sheets. */
export function SheetHost({
  visible,
  onClose,
  children,
}: React.PropsWithChildren<{
  visible: boolean;
  onClose(): void;
}>) {
  const close = useRef<(() => void) | undefined>(undefined);
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={() => (close.current ?? onClose)()}
      statusBarTranslucent
    >
      <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
    </Modal>
  );
}

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
  const closeRef = useContext(CloseContext);
  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = onClose;
    return () => {
      if (closeRef.current === onClose) closeRef.current = undefined;
    };
  }, [closeRef, onClose]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 720;
  return (
    <>
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
            maxHeight: '100%',
            flexShrink: 1,
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
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="zuno-keyboard-done" backgroundColor={colors.surface}>
          <View style={{ alignItems: 'flex-end', borderTopWidth: 1, borderColor: colors.line }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done editing"
              onPress={Keyboard.dismiss}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 24 }}
            >
              <Txt weight="bold" style={{ color: colors.accent }}>
                Done
              </Txt>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}
