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
  FlatList,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {useVibeApi} from '../hooks/useVibeApi';
import {VibeSpinner} from '../components/VibeSpinner';
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

type ClaimVibeNavProp = NativeStackNavigationProp<RootStackParamList, 'ClaimVibe'>;

export function ClaimVibeScreen() {
  const route = useRoute<ClaimVibeRouteProp>();
  const navigation = useNavigation<ClaimVibeNavProp>();
  const {connected, publicKey, connect, disconnect, signTransaction} =
    useMobileWallet();
  const {getVibeDetails, prepareClaim, confirmClaim, lookupVibeForUser} = useVibeApi();

  const [claimState, setClaimState] = useState<ClaimState>('loading');
  const [vibeDetails, setVibeDetails] = useState<VibeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xUsername, setXUsername] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingVibes, setPendingVibes] = useState<
    Array<{ id: string; createdAt?: string; maskedWallet?: string }>
  >([]);
  const [selectedPendingIndex, setSelectedPendingIndex] = useState(0);
  const [claimCount, setClaimCount] = useState(1);
  const [claimFirstOnly, setClaimFirstOnly] = useState(false);
  /** When signing multiple claims: { current: 1, total: 2 } for "Signing 1 of 2" */
  const [signingProgress, setSigningProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const stepRef = useRef<string>('idle');
  const {vibeId} = route.params;
  const {width: winWidth} = useWindowDimensions();
  const carouselCardWidth = Math.min(winWidth * 0.75, 280);
  const carouselSnapInterval = carouselCardWidth + 12;

  // Load X username from storage
  useEffect(() => {
    AsyncStorage.getItem('@solanavibes/x_username').then(val => {
      if (val) setXUsername(val);
    });
  }, []);

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

  // Fetch pending list for this user (for multi-claim)
  useEffect(() => {
    if (!vibeDetails?.targetUsername || claimState !== 'ready') return;
    lookupVibeForUser(vibeDetails.targetUsername).then((data) => {
      if (data?.hasPending && data.pendingCount != null && data.pendingVibes) {
        setPendingCount(data.pendingCount);
        const list = data.pendingVibes.map((v) => ({
          id: v.id,
          createdAt: v.createdAt,
          maskedWallet: v.maskedWallet,
        }));
        setPendingVibes(list);
        setClaimCount((c) => (c > data.pendingCount! ? data.pendingCount! : c));
        const idx = list.findIndex((v) => v.id === vibeId);
        setSelectedPendingIndex(idx >= 0 ? idx : 0);
      }
    });
  }, [vibeDetails?.targetUsername, claimState, lookupVibeForUser, vibeId]);

  // When user swipes to another pending vibe, load that vibe's details so main image + terminal update
  useEffect(() => {
    if (
      pendingVibes.length === 0 ||
      selectedPendingIndex < 0 ||
      selectedPendingIndex >= pendingVibes.length
    )
      return;
    const id = pendingVibes[selectedPendingIndex].id;
    getVibeDetails(id)
      .then(setVibeDetails)
      .catch((err) => console.warn('Failed to load pending vibe details:', err));
  }, [selectedPendingIndex, pendingVibes, getVibeDetails]);

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      const idx = viewableItems[0]?.index;
      if (typeof idx === 'number' && idx >= 0) setSelectedPendingIndex(idx);
    },
  ).current;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 100,
  }).current;

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
    if (!xUsername) {
      Alert.alert('Connect X', 'Please connect your X account first');
      return;
    }

    const count = claimFirstOnly ? 1 : claimCount;
    const vibeIds =
      pendingVibes.length >= count
        ? pendingVibes.slice(0, count).map((v) => v.id)
        : [vibeDetails.id];

    setClaimState('preparing');
    stepRef.current = 'preparing';
    setError(null);
    setSigningProgress(null);

    try {
      const prepareResult = await prepareClaim({
        vibeIds: vibeIds.length > 1 ? vibeIds : undefined,
        vibeId: vibeIds.length === 1 ? vibeIds[0] : undefined,
        claimerWallet: publicKey.toBase58(),
        xUsername,
      });

      if (prepareResult.transactions && prepareResult.transactions.length > 0) {
        const total = prepareResult.transactions.length;
        setClaimState('signing');
        stepRef.current = 'signing';
        const signedItems: Array<{
          vibeId: string;
          signedTransaction: import('@solana/web3.js').Transaction | import('@solana/web3.js').VersionedTransaction;
          blockhash: string;
          lastValidBlockHeight: number;
        }> = [];
        for (let i = 0; i < prepareResult.transactions.length; i++) {
          setSigningProgress({ current: i + 1, total });
          // Brief delay so UI can show "Signing 2 of 2" before wallet popup appears again
          await new Promise((r) => setTimeout(r, 400));
          const t = prepareResult.transactions[i];
          const signed = await signTransaction(t.transaction);
          signedItems.push({
            vibeId: t.vibeId,
            signedTransaction: signed,
            blockhash: t.blockhash,
            lastValidBlockHeight: t.lastValidBlockHeight,
          });
        }
        setSigningProgress(null);
        setClaimState('confirming');
        stepRef.current = 'confirming';
        await confirmClaim({
          claimerWallet: publicKey.toBase58(),
          signedTransactions: signedItems,
        });
      } else if (
        prepareResult.transaction &&
        prepareResult.blockhash != null &&
        prepareResult.lastValidBlockHeight != null
      ) {
        setSigningProgress(null); // single tx, no "1 of 1" needed
        setClaimState('signing');
        stepRef.current = 'signing';
        const signedTx = await signTransaction(prepareResult.transaction);
        setClaimState('confirming');
        stepRef.current = 'confirming';
        await confirmClaim({
          claimerWallet: publicKey.toBase58(),
          vibeId: vibeIds[0],
          signedTransaction: signedTx,
          blockhash: prepareResult.blockhash,
          lastValidBlockHeight: prepareResult.lastValidBlockHeight,
        });
      } else {
        throw new Error('Invalid prepare response');
      }

      setClaimState('success');
    } catch (err) {
      console.error('Claim error:', err);
      setSigningProgress(null);
      const message =
        err instanceof Error ? err.message : 'Something went wrong';
      setError(`Error while ${stepRef.current}: ${message}`);
      setClaimState('ready');
    }
  }, [
    connected,
    publicKey,
    vibeDetails,
    xUsername,
    claimCount,
    claimFirstOnly,
    pendingVibes,
    prepareClaim,
    confirmClaim,
    signTransaction,
  ]);

  const handleClose = () => {
    navigation.goBack();
  };

  /** Navigate to home screen (Main) — full stack reset so MainScreen starts fresh */
  const handleGoHome = () => {
    navigation.reset({index: 0, routes: [{name: 'Main'}]});
  };

  const isProcessing =
    claimState === 'preparing' ||
    claimState === 'signing' ||
    claimState === 'confirming';

  const processingMessage =
    claimState === 'preparing'
      ? 'Preparing claim...'
      : claimState === 'signing'
      ? signingProgress && signingProgress.total > 1
        ? `Signing ${signingProgress.current} of ${signingProgress.total}...`
        : 'Waiting for signature...'
      : claimState === 'confirming'
      ? 'Confirming on Solana...'
      : '';

  // Loading state
  if (claimState === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <VibeSpinner size={56} />
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
          <TouchableOpacity
            onPress={handleGoHome}
            activeOpacity={0.7}
            hitSlop={{top: 12, bottom: 12, left: 24, right: 24}}>
            <Text style={styles.title}>solana_vibes</Text>
          </TouchableOpacity>
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
        {/* Title — tap to go home */}
        <TouchableOpacity
          onPress={handleGoHome}
          activeOpacity={0.7}
          hitSlop={{top: 12, bottom: 12, left: 24, right: 24}}>
          <Text style={styles.title}>solana_vibes</Text>
        </TouchableOpacity>

        {/* Swipe to view all pending vibes (same image, different senders/details) */}
        {pendingCount > 1 && pendingVibes.length > 0 && (
          <View style={styles.carouselWrap}>
            <Text style={styles.carouselHint}>Swipe to view each pending vibe</Text>
            <FlatList
              data={pendingVibes}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={carouselSnapInterval}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({item, index}) => (
                <View style={[styles.carouselCard, {width: carouselCardWidth}]}>
                  {vibeDetails?.imageUrl && (
                    <Image
                      source={{uri: vibeDetails.imageUrl}}
                      style={styles.carouselCardImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.carouselCardOverlay}>
                    <Text style={styles.carouselCardLabel}>
                      Vibe {index + 1} of {pendingVibes.length}
                    </Text>
                    {item.maskedWallet && (
                      <Text style={styles.carouselCardWallet} numberOfLines={1}>
                        From {item.maskedWallet}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            />
          </View>
        )}

        {/* NFT Image */}
        {vibeDetails?.imageUrl && (
          <Image
            source={{uri: vibeDetails.imageUrl}}
            style={styles.nftImage}
            resizeMode="cover"
          />
        )}

        {/* Signing alert: between image and green text, compact so it doesn't cover the vibe */}
        {isProcessing && claimState === 'signing' && (
          <View style={styles.signingBannerInline}>
            <Text style={styles.signingBannerTitleSmall}>
              {signingProgress && signingProgress.total > 1
                ? `Signing ${signingProgress.current} of ${signingProgress.total}`
                : 'Waiting for signature'}
            </Text>
            <Text style={styles.signingBannerSubSmall}>
              Use the same wallet — don&apos;t switch accounts.
            </Text>
          </View>
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
            {pendingCount > 1 && (
              <Text style={styles.pendingCountText}>
                You have {pendingCount} pending vibes to claim.
              </Text>
            )}

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
                    <VibeSpinner size={24} />
                    <Text style={styles.btnClaimText}>{processingMessage}</Text>
                  </View>
                ) : (
                  <Text style={styles.btnClaimText}>confirm claim</Text>
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.feeText}>
              ~0.001 SOL per vibe NFT
              {claimCount > 1 ? ` · Total: ~${(0.001 * claimCount).toFixed(3)} SOL` : ''}
            </Text>

            {/* Multi-claim: how many to claim (oldest first) */}
            {pendingCount > 1 && (
              <View style={styles.claimCountSection}>
                <Text style={styles.claimCountLabel}>
                  How many to claim? (oldest first)
                </Text>
                <View style={styles.checkboxRow}>
                  <TouchableOpacity
                    style={styles.checkboxTouch}
                    onPress={() => {
                      setClaimFirstOnly(!claimFirstOnly);
                      if (!claimFirstOnly) setClaimCount(1);
                    }}>
                    <View style={[styles.checkbox, claimFirstOnly && styles.checkboxChecked]}>
                      {claimFirstOnly && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      Only claim the first vibe I received
                    </Text>
                  </TouchableOpacity>
                </View>
                {!claimFirstOnly && (
                  <View style={styles.countRow}>
                    {[1, 2, 3].filter((n) => n <= pendingCount).map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.countBtn,
                          claimCount === n && styles.countBtnActive,
                        ]}
                        onPress={() => setClaimCount(n)}>
                        <Text
                          style={[
                            styles.countBtnText,
                            claimCount === n && styles.countBtnTextActive,
                          ]}>
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {pendingCount > 3 && (
                      <TouchableOpacity
                        style={[
                          styles.countBtn,
                          claimCount === pendingCount && styles.countBtnActive,
                        ]}
                        onPress={() => setClaimCount(pendingCount)}>
                        <Text
                          style={[
                            styles.countBtnText,
                            claimCount === pendingCount && styles.countBtnTextActive,
                          ]}>
                          All ({pendingCount})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{error}</Text>
              </View>
            )}

            {/* Cancel */}
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

  // Title — paddingVertical expands the actual tappable area
  title: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },

  // NFT Image
  nftImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
    marginBottom: 20,
  },

  // Pending vibes carousel (swipe to view each)
  carouselWrap: {
    width: '100%',
    marginBottom: 16,
  },
  carouselHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
    textAlign: 'center',
  },
  carouselContent: {
    paddingHorizontal: 6,
  },
  carouselCard: {
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  carouselCardImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#111',
  },
  carouselCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  carouselCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14F195',
  },
  carouselCardWallet: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
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
  pendingCountText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: -8,
    marginBottom: 12,
  },
  signingBannerInline: {
    width: '100%',
    backgroundColor: 'rgba(20,241,149,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  signingBannerTitleSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  signingBannerSubSmall: {
    fontSize: 11,
    color: 'rgba(20,241,149,0.9)',
    textAlign: 'center',
    marginTop: 2,
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
  claimCountSection: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  claimCountLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  checkboxRow: {
    marginBottom: 12,
  },
  checkboxTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#14F195',
    backgroundColor: 'rgba(20,241,149,0.2)',
  },
  checkboxCheck: {
    color: '#14F195',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  countRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  countBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  countBtnActive: {
    borderColor: 'rgba(20,241,149,0.5)',
    backgroundColor: 'rgba(20,241,149,0.12)',
  },
  countBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  countBtnTextActive: {
    color: '#14F195',
    fontWeight: '600',
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
