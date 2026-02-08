import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {RootNavigator} from './navigation/RootNavigator';
import {ConnectionProvider} from './providers/ConnectionProvider';
import {linking} from './utils/linking';

export default function App(): React.JSX.Element {
  return (
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
            fonts: {
              regular: {fontFamily: 'System', fontWeight: '400'},
              medium: {fontFamily: 'System', fontWeight: '500'},
              bold: {fontFamily: 'System', fontWeight: '700'},
              heavy: {fontFamily: 'System', fontWeight: '900'},
            },
          }}>
          <RootNavigator />
        </NavigationContainer>
      </ConnectionProvider>
    </SafeAreaProvider>
  );
}
