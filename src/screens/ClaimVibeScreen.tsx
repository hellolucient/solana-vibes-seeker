import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {useVibeApi} from '../hooks/useVibeApi';
import type {RootStackParamList} from '../navigation/RootNavigator';

type ClaimVibeRouteProp = RouteProp<RootStackParamList, 'ClaimVibe'>;

type ClaimState =
  | 'loading'
  | 'ready'
  | 'preparing'
  | 'signing'
  | 'confirming'
  | 'success'
  | 'error';

interface VibeDetails {
  id: string;
  targetUsername: string;
  senderWallet: string;
  maskedWallet: string;
  vibeNumber: number;
  imageUrl: string;
  claimStatus: 'pending' | 'claimed';
  mintAddress?: string;
}

export function ClaimVibeScreen() {
  const route = useRoute<ClaimVibeRouteProp>();
  const navigation = useNavigation();
  const {connected, publicKey, connect, disconnect, signTransaction} =
    useMobileWallet();
  const {getVibeDetails, prepareClaim, confirmClaim} = useVibeApi();

  const [claimState, setClaimState] = useState<ClaimState>('loading');
  const [vibeDetails, setVibeDetails] = useState<VibeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepRef = useRef<string>('idle');
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

  const shortenedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  const handleConnect = useCallback(async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  }, [connect]);

  const handleClaim = useCallback(async () => {
    if (!connected || !publicKey || !vibeDetails) {
      Alert.alert('Connect Wallet', 'Please connect your wallet to claim');
      return;
    }

    setClaimState('preparing');
    stepRef.current = 'preparing';
    setError(null);

    try {
      // Step 1: Prepare claim transaction
      const prepareResult = await prepareClaim({
        vibeId: vibeDetails.id,
        claimerWallet: publicKey.toBase58(),
      });

      setClaimState('signing');
      stepRef.current = 'signing';

      // Step 2: Sign with wallet
      const signedTx = await signTransaction(prepareResult.transaction);

      setClaimState('confirming');
      stepRef.current = 'confirming';

      // Step 3: Confirm claim
      await confirmClaim({
        vibeId: vibeDetails.id,
        signedTransaction: signedTx,
        blockhash: prepareResult.blockhash,
        lastValidBlockHeight: prepareResult.lastValidBlockHeight,
      });

      setClaimState('success');
    } catch (err) {
      console.error('Claim error:', err);
      const message =
        err instanceof Error ? err.message : 'Something went wrong';
      setError(`Error while ${stepRef.current}: ${message}`);
      setClaimState('ready');
    }
  }, [connected, publicKey, vibeDetails, prepareClaim, confirmClaim, signTransaction]);

  const handleClose = () => {
    navigation.goBack();
  };

  const isProcessing =
    claimState === 'preparing' ||
    claimState === 'signing' ||
    claimState === 'confirming';

  const processingMessage =
    claimState === 'preparing'
      ? 'Preparing claim...'
      : claimState === 'signing'
      ? 'Waiting for signature...'
      : claimState === 'confirming'
      ? 'Confirming on Solana...'
      : '';

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
  if (claimState === 'error' && !vibeDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>solana_vibes</Text>
          <Text style={styles.errorTitle}>Couldn't load vibe</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.btnOutline} onPress={handleClose}>
            <Text style={styles.btnOutlineText}>Go Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text style={styles.title}>solana_vibes</Text>

        {/* NFT Image */}
        {vibeDetails?.imageUrl && (
          <Image
            source={{uri: vibeDetails.imageUrl}}
            style={styles.nftImage}
            resizeMode="cover"
          />
        )}

        {/* Terminal-style info */}
        <View style={styles.terminalInfo}>
          <Text style={styles.terminalLine}>
            {'> '}
            <Text style={styles.terminalGreen}>received solana_vibes</Text>
          </Text>
          <Text style={styles.terminalLine}>
            {'> '}
            <Text style={styles.terminalGreen}>
              verified by wallet {vibeDetails?.maskedWallet}
            </Text>
          </Text>
          {vibeDetails?.mintAddress && (
            <Text style={styles.terminalLine}>
              {'> '}
              <Text style={styles.terminalGreen}>
                mint {vibeDetails.mintAddress.slice(0, 4)}...
                {vibeDetails.mintAddress.slice(-4)}
              </Text>
            </Text>
          )}
          <Text style={styles.terminalLine}>
            {'> '}
            <Text style={styles.terminalGreen}>
              for @{vibeDetails?.targetUsername}
            </Text>
          </Text>
        </View>

        {/* Claimed state */}
        {claimState === 'success' ? (
          <View style={styles.claimedSection}>
            <View style={styles.claimedBadge}>
              <Text style={styles.claimedBadgeTitle}>✓ Claimed</Text>
              <Text style={styles.claimedBadgeSub}>by {shortenedAddress}</Text>
            </View>

            <View style={styles.spreadSection}>
              <Text style={styles.spreadTitle}>Spread the vibes! 🌊</Text>
              <TouchableOpacity style={styles.btnOutline}>
                <Text style={styles.btnOutlineIcon}>𝕏</Text>
                <Text style={styles.btnOutlineText}>Thank the sender</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSendOwn}
                onPress={handleClose}>
                <Text style={styles.btnSendOwnText}>Send your own vibe</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.claimSection}>
            {/* Who this vibe is for */}
            <Text style={styles.vibeForText}>
              This vibe is for{' '}
              <Text style={styles.vibeForUsername}>
                @{vibeDetails?.targetUsername}
              </Text>
            </Text>

            {/* Connect wallet if needed */}
            {!connected ? (
              <TouchableOpacity
                style={styles.btnClaim}
                onPress={handleConnect}
                activeOpacity={0.8}>
                <Text style={styles.btnClaimText}>Connect wallet to claim</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btnClaim, isProcessing && styles.btnClaimProcessing]}
                onPress={handleClaim}
                disabled={isProcessing}
                activeOpacity={0.8}>
                {isProcessing ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.btnClaimText}>{processingMessage}</Text>
                  </View>
                ) : (
                  <Text style={styles.btnClaimText}>confirm claim</Text>
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.feeText}>Claim fee: ~0.001 SOL</Text>

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{error}</Text>
              </View>
            )}

            {/* Disconnect / Cancel */}
            {connected && (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={disconnect}>
                <Text style={styles.linkBtnText}>Disconnect wallet</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.linkBtn} onPress={handleClose}>
              <Text style={styles.linkBtnText}>cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Title
  title: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },

  // NFT Image
  nftImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
    marginBottom: 20,
  },

  // Terminal info
  terminalInfo: {
    width: '100%',
    marginBottom: 20,
  },
  terminalLine: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 24,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  terminalGreen: {
    color: '#14F195',
  },

  // Claim section
  claimSection: {
    width: '100%',
    alignItems: 'center',
  },
  vibeForText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  vibeForUsername: {
    color: '#14F195',
    fontWeight: '600',
  },

  // Claim button
  btnClaim: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnClaimProcessing: {
    opacity: 0.7,
  },
  btnClaimText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feeText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 12,
  },

  // Links
  linkBtn: {
    paddingVertical: 10,
    marginTop: 4,
  },
  linkBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },

  // Error
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorBoxText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Claimed / Success
  claimedSection: {
    width: '100%',
    alignItems: 'center',
  },
  claimedBadge: {
    width: '100%',
    backgroundColor: 'rgba(20,241,149,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.25)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  claimedBadgeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#14F195',
  },
  claimedBadgeSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  spreadSection: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    alignItems: 'center',
  },
  spreadTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },
  btnOutline: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  btnOutlineIcon: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  btnSendOwn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(20,241,149,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.2)',
  },
  btnSendOwnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#14F195',
  },
});
