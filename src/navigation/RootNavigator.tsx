import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

// Screens
import {MainScreen} from '../screens/MainScreen';
import {ClaimVibeScreen} from '../screens/ClaimVibeScreen';

// Types
export type RootStackParamList = {
  Main: undefined;
  ClaimVibe: {vibeId: string};
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: '#050505'},
      }}>
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen
        name="ClaimVibe"
        component={ClaimVibeScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}
