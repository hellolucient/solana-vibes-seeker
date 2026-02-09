/**
 * Solana Vibes Seeker - Entry Point
 * Must import polyfills before anything else
 */

// Polyfills for Solana/crypto - ORDER MATTERS!
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Buffer polyfill for Solana
import {Buffer} from 'buffer';
global.Buffer = Buffer;

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
