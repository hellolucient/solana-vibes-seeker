import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {WalletButton} from '../components/WalletButton';

export function ProfileScreen() {
  const {connected, publicKey, disconnect} = useMobileWallet();

  const handleViewExplorer = () => {
    if (publicKey) {
      Linking.openURL(
        `https://solscan.io/account/${publicKey.toBase58()}`,
      );
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Not connected
  if (!connected || !publicKey) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>Connect your wallet to view profile</Text>
          <View style={styles.connectButtonContainer}>
            <WalletButton variant="large" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const shortenedAddress = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Wallet Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletIcon}>
            <Text style={styles.walletEmoji}>👛</Text>
          </View>
          <Text style={styles.walletAddress}>{shortenedAddress}</Text>
          <Text style={styles.walletLabel}>Connected Wallet</Text>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} onPress={handleViewExplorer}>
            <Text style={styles.menuItemIcon}>🔍</Text>
            <Text style={styles.menuItemText}>View on Solscan</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Linking.openURL('https://solana-vibes.vercel.app/guide')
            }>
            <Text style={styles.menuItemIcon}>📖</Text>
            <Text style={styles.menuItemText}>How It Works</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Linking.openURL('https://twitter.com/hellolucient')
            }>
            <Text style={styles.menuItemIcon}>𝕏</Text>
            <Text style={styles.menuItemText}>Follow on X</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Network Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network</Text>
          <View style={styles.networkCard}>
            <View style={styles.networkIndicator}>
              <View style={styles.networkDot} />
              <Text style={styles.networkText}>Mainnet Beta</Text>
            </View>
          </View>
        </View>

        {/* Disconnect */}
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}>
          <Text style={styles.disconnectButtonText}>Disconnect Wallet</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Solana Vibes Seeker v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  connectButtonContainer: {
    alignItems: 'center',
  },
  walletCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#333333',
  },
  walletIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#14F195',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletEmoji: {
    fontSize: 32,
  },
  walletAddress: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  walletLabel: {
    fontSize: 14,
    color: '#888888',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  menuItemArrow: {
    fontSize: 20,
    color: '#666666',
  },
  networkCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  networkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#14F195',
    marginRight: 8,
  },
  networkText: {
    fontSize: 16,
    color: '#ffffff',
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
    marginBottom: 24,
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4444',
  },
  version: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
});
