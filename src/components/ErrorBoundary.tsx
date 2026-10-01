import React from 'react';
import { Pressable, Text, View } from 'react-native';
export class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F7F6F2',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          gap: 18,
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: '700' }}>Let’s find our way back.</Text>
        <Text style={{ textAlign: 'center' }}>
          Something interrupted your world. Your saved demo is still on this device.
        </Text>
        <Pressable
          onPress={() => this.setState({ failed: false })}
          style={{ backgroundColor: '#F26B50', padding: 16, borderRadius: 16 }}
        >
          <Text style={{ color: 'white' }}>Try again</Text>
        </Pressable>
      </View>
    ) : (
      this.props.children
    );
  }
}
