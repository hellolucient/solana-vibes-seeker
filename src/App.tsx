import React, {useEffect, useState} from 'react';
import {StatusBar, View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {RootNavigator} from './navigation/RootNavigator';
import {ConnectionProvider} from './providers/ConnectionProvider';
import {linking} from './utils/linking';
import {useWalletStore} from './stores/walletStore';

// Error boundary component — recoverable so users aren't stuck
class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {hasError: boolean; error: Error | null}
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error: Error) {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({hasError: false, error: null});
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
          <TouchableOpacity
            style={errorStyles.retryBtn}
            onPress={this.handleRetry}
            activeOpacity={0.8}>
            <Text style={errorStyles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff6b6b',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});

export default function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Hydrate persisted wallet state, then mark ready
    async function init() {
      await useWalletStore.getState().hydrate();
      // Small extra delay to ensure all native modules are loaded
      setTimeout(() => setIsReady(true), 50);
    }
    init();
  }, []);

  if (!isReady) {
    return (
      <View style={{flex: 1, backgroundColor: '#0a0a0a'}}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <ConnectionProvider>
          <NavigationContainer
            linking={linking}
            theme={{
              dark: true,
              colors: {
                primary: '#14F195',
                background: '#0a0a0a',
                card: '#1a1a1a',
                text: '#ffffff',
                border: '#333333',
                notification: '#14F195',
              },
            }}>
            <RootNavigator />
          </NavigationContainer>
        </ConnectionProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
