import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {useVibeApi} from '../hooks/useVibeApi';
import {WalletButton} from '../components/WalletButton';
import type {RootStackParamList} from '../navigation/RootNavigator';

type ClaimVibeRouteProp = RouteProp<RootStackParamList, 'ClaimVibe'>;

type ClaimState = 'loading' | 'ready' | 'verifying' | 'claiming' | 'success' | 'error';

interface VibeDetails {
  id: string;
  targetUsername: string;
  senderWallet: string;
  maskedWallet: string;
  vibeNumber: number;
  imageUrl: string;
  claimStatus: 'pending' | 'claimed';
}

export function ClaimVibeScreen() {
  const route = useRoute<ClaimVibeRouteProp>();
  const navigation = useNavigation();
  const {connected, publicKey, signTransaction} = useMobileWallet();
  const {getVibeDetails, prepareClaim, confirmClaim} = useVibeApi();

  const [claimState, setClaimState] = useState<ClaimState>('loading');
  const [vibeDetails, setVibeDetails] = useState<VibeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xVerified, setXVerified] = useState(false);

  const {vibeId} = route.params;

  // Fetch vibe details on mount
  useEffect(() => {
    async function fetchDetails() {
      try {
        const details = await getVibeDetails(vibeId);
        setVibeDetails(details);

        if (details.claimStatus === 'claimed') {
          setClaimState('success');
        } else {
          setClaimState('ready');
        }
      } catch (err) {
        console.error('Failed to fetch vibe details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load vibe');
        setClaimState('error');
      }
    }

    fetchDetails();
  }, [vibeId, getVibeDetails]);

  const handleVerifyX = async () => {
    // In a real implementation, this would:
    // 1. Open X OAuth flow
    // 2. Verify the user owns the target username
    // For now, we'll simulate with an alert
    Alert.alert(
      'Verify X Account',
      `To claim this vibe, verify you own @${vibeDetails?.targetUsername}`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Verify',
          onPress: () => setXVerified(true),
        },
      ],
    );
  };

  const handleClaim = async () => {
    if (!connected || !publicKey || !vibeDetails) {
      Alert.alert('Connect Wallet', 'Please connect your wallet to claim');
      return;
    }

    if (!xVerified) {
      handleVerifyX();
      return;
    }

    setClaimState('claiming');
    setError(null);

    try {
      // Step 1: Prepare claim transaction
      const prepareResult = await prepareClaim({
        vibeId: vibeDetails.id,
        claimerWallet: publicKey.toBase58(),
      });

      // Step 2: Sign with wallet
      const signedTx = await signTransaction(prepareResult.transaction);

      // Step 3: Confirm claim
      await confirmClaim({
        vibeId: vibeDetails.id,
        signedTransaction: signedTx,
      });

      setClaimState('success');
    } catch (err) {
      console.error('Claim error:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim vibe');
      setClaimState('ready');
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Loading state
  if (claimState === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator color="#14F195" size="large" />
          <Text style={styles.loadingText}>Loading vibe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (claimState === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorTitle}>Couldn't load vibe</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success state (already claimed)
  if (claimState === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.successContent}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Vibe Claimed!</Text>
          <Text style={styles.successSubtitle}>
            This NFT is now in your wallet
          </Text>

          {vibeDetails?.imageUrl && (
            <Image
              source={{uri: vibeDetails.imageUrl}}
              style={styles.vibeImage}
              resizeMode="contain"
            />
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handleClose}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Ready to claim state
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <WalletButton />
      </View>

      <View style={styles.claimContent}>
        <Text style={styles.claimTitle}>You've Got a Vibe! ✨</Text>
        <Text style={styles.claimSubtitle}>
          Someone sent you a unique NFT on Solana
        </Text>

        {vibeDetails?.imageUrl && (
          <Image
            source={{uri: vibeDetails.imageUrl}}
            style={styles.vibeImage}
            resizeMode="contain"
          />
        )}

        <View style={styles.vibeInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>For</Text>
            <Text style={styles.infoValue}>@{vibeDetails?.targetUsername}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>From</Text>
            <Text style={styles.infoValue}>{vibeDetails?.maskedWallet}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vibe #</Text>
            <Text style={styles.infoValue}>{vibeDetails?.vibeNumber}</Text>
          </View>
        </View>

        {!connected ? (
          <View style={styles.stepBox}>
            <Text style={styles.stepLabel}>Step 1: Connect Wallet</Text>
            <WalletButton variant="large" />
          </View>
        ) : !xVerified ? (
          <View style={styles.stepBox}>
            <Text style={styles.stepLabel}>Step 2: Verify X Account</Text>
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={handleVerifyX}>
              <Text style={styles.verifyButtonText}>
                Verify @{vibeDetails?.targetUsername}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleClaim}
            disabled={claimState === 'claiming'}>
            {claimState === 'claiming' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#0a0a0a" size="small" />
                <Text style={styles.primaryButtonText}>Claiming...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Claim Vibe (~0.001 SOL)</Text>
            )}
          </TouchableOpacity>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    fontSize: 24,
    color: '#888888',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#888888',
    marginTop: 16,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  successContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: 'center',
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 24,
  },
  claimContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  claimTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  claimSubtitle: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 24,
  },
  vibeImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    marginBottom: 24,
  },
  vibeInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888888',
  },
  infoValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  stepBox: {
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: '#1DA1F2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#14F195',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBox: {
    backgroundColor: '#ff4444',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
});
