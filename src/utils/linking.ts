import {LinkingOptions} from '@react-navigation/native';
import {Linking} from 'react-native';
import type {RootStackParamList} from '../navigation/RootNavigator';

/**
 * Deep linking configuration for the app
 * Handles both custom scheme (solanavibes://) and universal links
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'solanavibes://',
    'https://solana-vibes.vercel.app',
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Send: 'send',
          Profile: 'profile',
        },
      },
      ClaimVibe: {
        path: 'v/:vibeId',
        parse: {
          vibeId: (vibeId: string) => vibeId,
        },
      },
    },
  },
  async getInitialURL() {
    // Check if app was opened from a deep link
    const url = await Linking.getInitialURL();
    if (url != null) {
      return url;
    }
    return null;
  },
  subscribe(listener) {
    // Listen to incoming links from deep linking
    const subscription = Linking.addEventListener('url', ({url}) => {
      listener(url);
    });

    return () => {
      subscription.remove();
    };
  },
};

/**
 * Parse a claim URL to extract the vibe ID
 */
export function parseClaimUrl(url: string): string | null {
  // Handle custom scheme: solanavibes://claim/{vibeId}
  const customMatch = url.match(/solanavibes:\/\/claim\/([^/?]+)/);
  if (customMatch) {
    return customMatch[1];
  }

  // Handle web URL: https://solana-vibes.vercel.app/v/{vibeId}
  const webMatch = url.match(/\/v\/([^/?]+)/);
  if (webMatch) {
    return webMatch[1];
  }

  return null;
}
