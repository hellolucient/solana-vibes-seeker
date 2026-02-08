import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import {useMobileWallet} from '../hooks/useMobileWallet';

interface WalletButtonProps {
  variant?: 'default' | 'large';
}

export function WalletButton({variant = 'default'}: WalletButtonProps) {
  const {connected, connecting, publicKey, connect} = useMobileWallet();

  const handlePress = async () => {
    if (!connected && !connecting) {
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    }
  };

  if (connecting) {
    return (
      <View style={[styles.button, variant === 'large' && styles.buttonLarge]}>
        <ActivityIndicator color="#0a0a0a" size="small" />
        <Text style={styles.buttonText}>Connecting...</Text>
      </View>
    );
  }

  if (connected && publicKey) {
    const shortenedAddress = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;

    return (
      <View
        style={[
          styles.connectedButton,
          variant === 'large' && styles.buttonLarge,
        ]}>
        <View style={styles.statusDot} />
        <Text style={styles.connectedText}>{shortenedAddress}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, variant === 'large' && styles.buttonLarge]}
      onPress={handlePress}
      activeOpacity={0.8}>
      <Text style={styles.buttonText}>Connect Wallet</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#14F195',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonLarge: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  connectedButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#14F195',
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
