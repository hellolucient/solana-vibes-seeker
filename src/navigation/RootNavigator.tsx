import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

// Screens
import {MainScreen} from '../screens/MainScreen';
import {ClaimVibeScreen} from '../screens/ClaimVibeScreen';
import {LeaderboardScreen} from '../screens/LeaderboardScreen';
import {YourVibesScreen} from '../screens/YourVibesScreen';
import {VibesToClaimScreen} from '../screens/VibesToClaimScreen';

// Types
export type RootStackParamList = {
  Main: undefined;
  ClaimVibe: {vibeId: string; singleOnly?: boolean; claimAll?: boolean};
  Leaderboard: undefined;
  YourVibes: undefined;
  VibesToClaim: undefined;
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
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="YourVibes" component={YourVibesScreen} />
      <Stack.Screen name="VibesToClaim" component={VibesToClaimScreen} />
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
