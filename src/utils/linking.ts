import {LinkingOptions} from '@react-navigation/native';
import {Linking} from 'react-native';
import type {RootStackParamList} from '../navigation/RootNavigator';

/**
 * Check whether a URL is an X auth callback that should NOT be handled by
 * React Navigation. These are handled separately by the Linking listener in
 * MainScreen and should be silently ignored by the navigator.
 */
function isXAuthCallback(url: string): boolean {
  return url.startsWith('solanavibes://auth/');
}

/**
 * Deep linking configuration for the app
 * Handles both custom scheme (solanavibes://) and universal links.
 *
 * NOTE: X auth callback URLs (solanavibes://auth/x?username=...) are
 * explicitly filtered out so they don't trigger navigation side-effects.
 * They are handled by a dedicated Linking listener in MainScreen.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'solanavibes://',
    'https://solana-vibes-seeker.vercel.app',
  ],
  config: {
    screens: {
      Main: 'home',
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
    if (url != null && !isXAuthCallback(url)) {
      return url;
    }
    return null;
  },
  subscribe(listener) {
    // Listen to incoming links from deep linking — filter out X auth callbacks
    const subscription = Linking.addEventListener('url', ({url}) => {
      if (!isXAuthCallback(url)) {
        listener(url);
      }
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

  // Handle web URL: https://solana-vibes-seeker.vercel.app/v/{vibeId}
  const webMatch = url.match(/\/v\/([^/?]+)/);
  if (webMatch) {
    return webMatch[1];
  }

  return null;
}
