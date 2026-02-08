import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {WalletButton} from '../components/WalletButton';
import type {RootStackParamList} from '../navigation/RootNavigator';

const {width} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {connected, publicKey} = useMobileWallet();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>✨ Solana Vibes</Text>
          <WalletButton />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Send Good Vibes</Text>
          <Text style={styles.heroSubtitle}>
            Each vibe is a unique NFT on Solana that lives in their wallet
            forever.
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>∞</Text>
            <Text style={styles.statLabel}>Vibes Sent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0.006</Text>
            <Text style={styles.statLabel}>SOL to Send</Text>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Connect & Choose</Text>
              <Text style={styles.stepDescription}>
                Connect your wallet and enter the X handle of who you want to
                vibe
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Mint & Share</Text>
              <Text style={styles.stepDescription}>
                A unique NFT is minted and you get a claim link to share
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>They Claim</Text>
              <Text style={styles.stepDescription}>
                They verify their X identity and the NFT transfers to their
                wallet
              </Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        {connected && (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('MainTabs', {screen: 'Send'} as any)}>
            <Text style={styles.ctaButtonText}>Send a Vibe ✨</Text>
          </TouchableOpacity>
        )}

        {/* Recent Activity Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Vibes</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {connected
                ? 'No vibes sent yet. Be the first!'
                : 'Connect wallet to see your vibes'}
            </Text>
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  logo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#14F195',
  },
  heroSection: {
    marginTop: 32,
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#888888',
    lineHeight: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#14F195',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#888888',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#14F195',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#888888',
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#14F195',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  emptyState: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
