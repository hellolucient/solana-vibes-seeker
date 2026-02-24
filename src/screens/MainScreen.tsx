import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {useVibeApi, type ConfirmVibeError} from '../hooks/useVibeApi';
import {VibeSpinner} from '../components/VibeSpinner';
import {XSearchWebView} from '../components/XSearchWebView';
import {XAuthWebView} from '../components/XAuthWebView';
import type {RootStackParamList} from '../navigation/RootNavigator';

const X_AUTH_BASE = 'https://solana-vibes-seeker.vercel.app/api/auth/x';
const X_AUTH_RETURN = 'solanavibes://auth/x';
const X_USERNAME_STORAGE_KEY = '@solanavibes/x_username';

/** Parse username from auth callback deep link (solanavibes://auth/x?username=...)
 *  Uses manual string parsing instead of `new URL()` because Hermes on Android
 *  can throw on custom URL schemes like `solanavibes://`, which caused the
 *  "X sign-in failed" false error. */
function parseXAuthCallbackUrl(url: string): string | null {
  if (!url.startsWith('solanavibes://auth/x')) return null;
  // Find ?username=VALUE or &username=VALUE
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return null;
  const queryString = url.slice(qIdx + 1);
  const params = queryString.split('&');
  for (const param of params) {
    const [key, ...rest] = param.split('=');
    if (key === 'username' && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

// The base wave image
const vibesImage = require('../assets/vibes-base.png');

type SendState = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success';

export function MainScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {connected, connecting, publicKey, connect, disconnect, signTransaction} =
    useMobileWallet();
  const {prepareVibe, confirmVibe, completeMetadata, lookupVibeForUser} = useVibeApi();

  const [targetUsername, setTargetUsername] = useState('@');
  const [xSearchVisible, setXSearchVisible] = useState(false);
  const [xConnectVisible, setXConnectVisible] = useState(false);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [vibeResult, setVibeResult] = useState<{
    vibeId: string;
    vibeUrl: string;
    mintAddress: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** When confirm returns metadata_upload_failed, we can retry via complete-metadata */
  const [retryVibeId, setRetryVibeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [xUsername, setXUsername] = useState<string | null>(null);
  // Track whether X auth is in progress so we can suppress stale errors
  const xAuthInProgressRef = useRef(false);
  // Transient X auth status banner (shown briefly after auth completes)
  const [xAuthBanner, setXAuthBanner] = useState<{type: 'success' | 'error'; message: string} | null>(null);
  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  // Pending incoming vibe for the connected X user
  const [pendingVibe, setPendingVibe] = useState<{
    vibeId: string;
    claimStatus: 'pending' | 'claimed';
    pendingCount?: number;
    claimedCount?: number;
    claimedVibes?: Array<{ id: string; vibeUrl?: string; imageUrl?: string; mintAddress?: string; solscanUrl?: string }>;
    mintAddress?: string;
    vibeUrl?: string;
    solscanUrl?: string;
  } | null>(null);

  // Track the step for error reporting
  const stepRef = useRef<string>('idle');

  // Load persisted X username on mount
  useEffect(() => {
    AsyncStorage.getItem(X_USERNAME_STORAGE_KEY).then((stored) => {
      if (stored) setXUsername(stored);
    });
  }, []);

  // Auto-dismiss X auth banner after 3 seconds
  useEffect(() => {
    if (!xAuthBanner) return;
    const timer = setTimeout(() => setXAuthBanner(null), 3000);
    return () => clearTimeout(timer);
  }, [xAuthBanner]);

  // Persist username whenever it changes
  const setAndPersistXUsername = useCallback((username: string | null) => {
    setXUsername(username);
    if (username) {
      AsyncStorage.setItem(X_USERNAME_STORAGE_KEY, username);
    } else {
      AsyncStorage.removeItem(X_USERNAME_STORAGE_KEY);
    }
  }, []);

  // Handle X auth callback deep link.
  // On Android, the deep link intent routes to MainActivity (singleTask + intent filter),
  // so we handle the callback here via Linking rather than via InAppBrowser.openAuth().
  useEffect(() => {
    /** Aggressively close the Chrome Custom Tab / in-app browser.
     *  A single close() call doesn't always work on Android, so we retry. */
    const closeBrowser = () => {
      InAppBrowser.close();
      // Retry after short delays — Chrome Custom Tabs can be stubborn
      setTimeout(() => InAppBrowser.close(), 300);
      setTimeout(() => InAppBrowser.close(), 800);
    };

    const handleUrl = (url: string) => {
      console.log('[X Auth] Deep link received:', url);
      if (!url.startsWith('solanavibes://auth/x')) return;

      const username = parseXAuthCallbackUrl(url);
      if (username) {
        console.log('[X Auth] Username from callback:', username);
        setAndPersistXUsername(username);
        xAuthInProgressRef.current = false;
        // Show success banner (also clears any error banner that might have been set)
        setXAuthBanner({type: 'success', message: `Connected as @${username}`});
        closeBrowser();
      } else {
        // No username param — but don't show error immediately.
        // Delay briefly to see if a second event arrives with the username
        // (Android can fire multiple Linking events for a single redirect).
        console.warn('[X Auth] Callback without username param — waiting briefly...');
        closeBrowser();
        setTimeout(() => {
          // Only show error if auth is still in progress (i.e. no success callback arrived)
          if (xAuthInProgressRef.current) {
            xAuthInProgressRef.current = false;
            setXAuthBanner({type: 'error', message: 'X sign-in failed. Please try again.'});
          }
        }, 1500);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener('url', ({url}) => handleUrl(url));
    return () => sub.remove();
  }, [setAndPersistXUsername]);

  /** Toggle X connection: open in-app WebView (same feel as Search on X), or confirm + disconnect if already connected. */
  const handleConnectX = useCallback(async () => {
    // Already connected → confirm disconnect
    if (xUsername) {
      Alert.alert(
        'Disconnect X?',
        `Disconnect @${xUsername}?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Disconnect', style: 'destructive', onPress: () => setAndPersistXUsername(null)},
        ],
      );
      return;
    }

    setXAuthBanner(null);
    xAuthInProgressRef.current = true;
    setXConnectVisible(true);
  }, [xUsername, setAndPersistXUsername]);

  const handleXConnectSuccess = useCallback(
    (username: string) => {
      xAuthInProgressRef.current = false;
      setXConnectVisible(false);
      setAndPersistXUsername(username);
      setXAuthBanner({type: 'success', message: `Connected as @${username}`});
    },
    [setAndPersistXUsername],
  );

  const handleXConnectClose = useCallback(() => {
    setXConnectVisible(false);
    if (xAuthInProgressRef.current) {
      xAuthInProgressRef.current = false;
    }
  }, []);

  const isLoading = sendState !== 'idle' && sendState !== 'success';

  const shortenedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  /** Toggle wallet connection: connect if not connected, confirm + disconnect if connected */
  const handleWalletToggle = useCallback(async () => {
    if (connecting) return;

    if (connected) {
      // Confirm before disconnecting
      Alert.alert(
        'Disconnect wallet?',
        'You will need to reconnect to send vibes.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Disconnect', style: 'destructive', onPress: disconnect},
        ],
      );
      return;
    }

    try {
      await connect();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  }, [connected, connecting, connect, disconnect]);

  const handleSendVibe = useCallback(async () => {
    if (!connected || !publicKey) {
      Alert.alert('Connect Wallet', 'Please connect your wallet first');
      return;
    }

    const username = targetUsername.replace('@', '').trim();
    if (!username) {
      Alert.alert('Enter Username', 'Please enter an X username');
      return;
    }

    setError(null);
    setSendState('preparing');
    stepRef.current = 'preparing';

    try {
      const prepareResult = await prepareVibe({
        targetUsername: username,
        senderWallet: publicKey.toBase58(),
      });

      setSendState('signing');
      stepRef.current = 'signing';

      const signedTx = await signTransaction(prepareResult.transaction);

      setSendState('confirming');
      stepRef.current = 'confirming';

      const confirmResult = await confirmVibe({
        vibeId: prepareResult.vibeId,
        signedTransaction: signedTx,
        blockhash: prepareResult.blockhash,
        lastValidBlockHeight: prepareResult.lastValidBlockHeight,
      });

      setSendState('success');
      setVibeResult({
        vibeId: confirmResult.vibeId,
        vibeUrl: confirmResult.vibeUrl,
        mintAddress: confirmResult.mintAddress,
      });
    } catch (err) {
      console.error('Send vibe error:', err);
      const vibeErr = err as ConfirmVibeError;
      const isMetadataFailed =
        vibeErr?.code === 'metadata_upload_failed' && vibeErr?.vibeId;
      if (isMetadataFailed) {
        setRetryVibeId(vibeErr.vibeId);
        setError(
          'Mint succeeded but saving the image failed. Tap Retry below to fix.',
        );
      } else {
        const message =
          err instanceof Error ? err.message : 'Something went wrong';
        setError(`Error while ${stepRef.current}: ${message}`);
      }
      setSendState('idle');
    }
  }, [connected, publicKey, targetUsername, prepareVibe, confirmVibe, signTransaction]);

  const handleRetryMetadata = useCallback(async () => {
    if (!retryVibeId) return;
    setError(null);
    setSendState('confirming');
    try {
      const result = await completeMetadata(retryVibeId);
      setRetryVibeId(null);
      setVibeResult({
        vibeId: result.vibeId,
        vibeUrl: result.vibeUrl,
        mintAddress: result.mintAddress ?? '',
      });
      setSendState('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      setError(message);
      setSendState('idle');
    }
  }, [retryVibeId, completeMetadata]);

  const handleCopyLink = useCallback(() => {
    if (!vibeResult?.vibeUrl) return;
    Clipboard.setString(vibeResult.vibeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [vibeResult]);

  const handlePostToX = useCallback(async () => {
    if (!vibeResult?.vibeUrl) return;

    // Strip leading @ from targetUsername to avoid "@@username"
    const cleanUsername = targetUsername.replace(/^@/, '').trim();
    const tweetBody = `I just sent @${cleanUsername} a vibe on Solana! ✨\n\nClaim yours here: ${vibeResult.vibeUrl}`;

    // Try opening the X (Twitter) app directly first
    const xAppUrl = `twitter://post?message=${encodeURIComponent(tweetBody)}`;
    try {
      const canOpenXApp = await Linking.canOpenURL(xAppUrl);
      if (canOpenXApp) {
        await Linking.openURL(xAppUrl);
        return;
      }
    } catch {
      // X app not available, fall back below
    }

    // Fallback: open web compose page (user must tap "Post" manually)
    const text = encodeURIComponent(
      `I just sent @${cleanUsername} a vibe on Solana! ✨\n\nClaim yours here:`,
    );
    const url = encodeURIComponent(vibeResult.vibeUrl);
    Linking.openURL(`https://x.com/intent/post?text=${text}&url=${url}`);
  }, [vibeResult, targetUsername]);

  /** Check if the connected X user has any pending or claimed vibes */
  const checkVibeStatus = useCallback(async () => {
    if (!xUsername) {
      setPendingVibe(null);
      return;
    }
    try {
      const result = await lookupVibeForUser(xUsername);
      if (result && (result.hasPending || result.hasClaimed)) {
        setPendingVibe({
          vibeId: result.vibeId ?? '',
          claimStatus: result.hasClaimed ? 'claimed' : 'pending',
          pendingCount: result.pendingCount,
          claimedCount: result.claimedCount,
          claimedVibes: result.claimedVibes,
          mintAddress: result.mintAddress,
          vibeUrl: result.vibeUrl,
          solscanUrl: result.solscanUrl,
        });
      } else {
        setPendingVibe(null);
      }
    } catch {
      // Silently ignore
    }
  }, [xUsername, lookupVibeForUser]);

  // Check vibe status on mount and whenever X username changes
  useEffect(() => {
    checkVibeStatus();
  }, [checkVibeStatus]);

  const handleReset = useCallback(() => {
    setTargetUsername('@');
    setSendState('idle');
    setVibeResult(null);
    setError(null);
    setRetryVibeId(null);
    setCopied(false);
    checkVibeStatus();
  }, [checkVibeStatus]);

  /** Pull-to-refresh handler */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTargetUsername('@');
    setSendState('idle');
    setVibeResult(null);
    setError(null);
    setRetryVibeId(null);
    setCopied(false);
    await checkVibeStatus();
    setRefreshing(false);
  }, [checkVibeStatus]);

  // Shortened mint address for display
  const shortMint = vibeResult?.mintAddress
    ? `${vibeResult.mintAddress.slice(0, 8)} ... ${vibeResult.mintAddress.slice(-8)}`
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#14F195"
              colors={['#14F195']}
              progressBackgroundColor="#1a1a1a"
            />
          }>
          {/* Title — tap to return to home/idle state */}
          <TouchableOpacity
            onPress={handleReset}
            activeOpacity={0.7}
            hitSlop={{top: 8, bottom: 8, left: 24, right: 24}}>
            <Text style={styles.title}>solana_vibes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Leaderboard')}
            activeOpacity={0.7}
            style={styles.leaderboardLink}>
            <Text style={styles.leaderboardLinkText}>leaderboard</Text>
          </TouchableOpacity>

          {/* Hero wave image */}
          <Image
            source={vibesImage}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* ===== MINTING STATE ===== */}
          {isLoading ? (
            <View style={styles.mintingSection}>
              <View style={styles.mintingBadge}>
                <Text style={styles.mintingBadgeText}>minting</Text>
              </View>
              <VibeSpinner size={48} />
              <Text style={styles.mintingSubtext}>...vibing</Text>
              {(sendState === 'preparing' || sendState === 'signing') && publicKey && (
                <View style={styles.signingWalletHintBox}>
                  <Text style={styles.signingWalletHint}>
                    {sendState === 'signing'
                      ? `Sign with ${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)} in your wallet.`
                      : 'When your wallet opens, sign with the same account.'}
                  </Text>
                  <Text style={styles.signingWalletHintSub}>Don&apos;t switch to another account.</Text>
                </View>
              )}
            </View>
          ) : sendState === 'success' && vibeResult ? (
            /* ===== SUCCESS STATE ===== */
            <View style={styles.successCard}>
              <View style={styles.successCheckCircle}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.successTitle}>vibe ready...</Text>
              <Text style={styles.successSubtitle}>
                Your vibe has been minted on Solana
              </Text>
              <Text style={styles.mintAddress}>{shortMint}</Text>

              {/* Claim URL with Copy */}
              <View style={styles.claimUrlRow}>
                <Text style={styles.claimUrlText} numberOfLines={1}>
                  {vibeResult.vibeUrl}
                </Text>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleCopyLink}>
                  <Text style={styles.copyBtnText}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Post to X */}
              <TouchableOpacity
                style={styles.postToXBtn}
                onPress={handlePostToX}>
                <Text style={styles.xIconBtn}>𝕏</Text>
                <Text style={styles.postToXText}>Post to X</Text>
              </TouchableOpacity>

              {/* Send another */}
              <TouchableOpacity
                style={styles.sendAnotherBtn}
                onPress={handleReset}>
                <Text style={styles.sendAnotherText}>Send another vibe</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ===== IDLE STATE (form) ===== */
            <View style={styles.fullWidth}>
              {/* Pending incoming vibe banner */}
              {pendingVibe && (
                <View
                  style={[
                    styles.vibeBanner,
                    pendingVibe.claimStatus === 'claimed'
                      ? styles.vibeBannerClaimed
                      : styles.vibeBannerPending,
                  ]}>
                  <Text style={styles.vibeBannerText}>
                    {pendingVibe.claimStatus === 'claimed'
                      ? "You've claimed your vibe"
                      : (pendingVibe.pendingCount ?? 1) > 1
                      ? `You have ${pendingVibe.pendingCount} vibes to claim`
                      : "You have 1 vibe to claim"}
                  </Text>
                  {pendingVibe.claimStatus === 'claimed' ? (
                    <View style={styles.vibeBannerLinks}>
                      <TouchableOpacity
                        onPress={() => {
                          const n = pendingVibe.claimedCount ?? 1;
                          if (n > 1)
                            navigation.navigate('YourVibes');
                          else if (pendingVibe.vibeId)
                            navigation.navigate('ClaimVibe', {vibeId: pendingVibe.vibeId});
                        }}
                        activeOpacity={0.8}>
                        <Text style={styles.vibeBannerLinkClaimed}>
                          {(pendingVibe.claimedCount ?? 1) > 1
                            ? `View your vibes (${pendingVibe.claimedCount}) →`
                            : 'View your vibe →'}
                        </Text>
                      </TouchableOpacity>
                      {pendingVibe.solscanUrl ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(pendingVibe.solscanUrl!)}
                          activeOpacity={0.8}>
                          <Text style={styles.vibeBannerLinkSecondary}>View on Solscan</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('VibesToClaim')}
                      activeOpacity={0.8}>
                      <Text style={styles.vibeBannerLink}>
                        {(pendingVibe.pendingCount ?? 1) > 1
                          ? 'View your vibes to claim →'
                          : 'View your vibe to claim →'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Connect Wallet — required first step */}
              <TouchableOpacity
                style={[
                  styles.connectBtn,
                  connected && styles.connectBtnDone,
                ]}
                onPress={handleWalletToggle}
                activeOpacity={0.8}>
                {connecting ? (
                  <>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.connectBtnLabel}>Connecting...</Text>
                  </>
                ) : connected ? (
                  <>
                    <View style={styles.walletDot} />
                    <Text style={styles.connectBtnLabelDone}>
                      {shortenedAddress}
                    </Text>
                    <Text style={styles.disconnectWallet}>Disconnect</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.phantomIcon}>◉</Text>
                    <Text style={styles.connectBtnLabel}>Connect wallet</Text>
                  </>
                )}
              </TouchableOpacity>

              {!connected && (
                <Text style={styles.walletFirstHint}>Connect your wallet to continue</Text>
              )}

              {/* Connect X and Send form — only after wallet is connected */}
              {connected && (
                <>
                  {/* Connect X — tap to connect, tap again to disconnect */}
                  <TouchableOpacity
                    style={[
                      styles.connectXBtn,
                      xUsername && styles.connectXBtnDone,
                    ]}
                    onPress={handleConnectX}
                    activeOpacity={0.8}>
                    <Text style={[styles.xIcon, xUsername && styles.xIconDone]}>
                      𝕏
                    </Text>
                    {xUsername ? (
                      <>
                        <Text style={styles.connectXLabelDone}>@{xUsername}</Text>
                        <Text style={styles.disconnectX}>Disconnect</Text>
                      </>
                    ) : (
                      <Text style={styles.connectXLabel}>Connect X</Text>
                    )}
                  </TouchableOpacity>

                  {/* Send form */}
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Send a vibe to</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        value={targetUsername}
                        onChangeText={(text) => {
                          // Ensure it always starts with '@'
                          if (!text.startsWith('@')) {
                            text = '@' + text;
                          }
                          // Remove any '@' symbols after the first character
                          const cleaned = text.charAt(0) + text.slice(1).replace(/@/g, '');
                          setTargetUsername(cleaned);
                        }}
                        placeholder="@username"
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.searchXBtn}
                        onPress={() => setXSearchVisible(true)}
                        activeOpacity={0.7}>
                        <Text style={styles.searchXBtnText}>Search on X</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              <XSearchWebView
                visible={xSearchVisible}
                onClose={() => setXSearchVisible(false)}
                onSelectUsername={(username) => setTargetUsername('@' + username)}
              />

              <XAuthWebView
                visible={xConnectVisible}
                onClose={handleXConnectClose}
                onSuccess={handleXConnectSuccess}
                returnToDeepLink={X_AUTH_RETURN}
              />

              {/* X auth banner (success / error, auto-dismisses) */}
              {xAuthBanner && (
                <View
                  style={[
                    styles.xAuthBanner,
                    xAuthBanner.type === 'success'
                      ? styles.xAuthBannerSuccess
                      : styles.xAuthBannerError,
                  ]}>
                  <Text
                    style={[
                      styles.xAuthBannerText,
                      xAuthBanner.type === 'success'
                        ? styles.xAuthBannerTextSuccess
                        : styles.xAuthBannerTextError,
                    ]}>
                    {xAuthBanner.message}
                  </Text>
                </View>
              )}

              {/* Error + optional Retry for metadata_upload_failed */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                  {retryVibeId ? (
                    <TouchableOpacity
                      style={styles.retryMetadataBtn}
                      onPress={handleRetryMetadata}
                      activeOpacity={0.8}>
                      <Text style={styles.retryMetadataBtnText}>Retry</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {/* Send button with purple ring */}
              <TouchableOpacity
                style={[
                  styles.btnSend,
                  (!connected || !targetUsername.replace('@', '').trim()) &&
                    styles.btnSendDisabled,
                ]}
                onPress={handleSendVibe}
                disabled={!connected || !targetUsername.replace('@', '').trim()}
                activeOpacity={0.8}>
                <Text style={styles.btnSendLabel}>send vibe</Text>
              </TouchableOpacity>

              <Text style={styles.costText}>~0.006 SOL</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },

  // Title — compact for Seeker screen
  title: {
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  leaderboardLink: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  leaderboardLinkText: {
    fontSize: 13,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
  },

  // Hero image — compact height for Seeker
  heroImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#0a0a0a',
  },

  // ===== MINTING STATE =====
  mintingSection: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  mintingBadge: {
    borderWidth: 1,
    borderColor: '#14F195',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 28,
    marginBottom: 12,
  },
  mintingBadgeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#14F195',
  },
  mintingSpinner: {
    marginBottom: 10,
  },
  mintingSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },
  signingWalletHintBox: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(20,241,149,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.3)',
    borderRadius: 10,
    alignItems: 'center',
    maxWidth: '100%',
  },
  signingWalletHint: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
  },
  signingWalletHintSub: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(20,241,149,0.9)',
    textAlign: 'center',
  },

  // ===== SUCCESS STATE =====
  successCard: {
    width: '100%',
    backgroundColor: 'rgba(20,241,149,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.15)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  successCheckCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20,241,149,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  successCheck: {
    fontSize: 20,
    color: '#14F195',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    textAlign: 'center',
  },
  mintAddress: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    marginBottom: 12,
  },
  claimUrlRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingLeft: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  claimUrlText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    paddingVertical: 10,
  },
  copyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  postToXBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  xIconBtn: {
    fontSize: 15,
    color: '#ffffff',
  },
  postToXText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  sendAnotherBtn: {
    paddingVertical: 6,
  },
  sendAnotherText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },

  // ===== IDLE STATE =====
  // Pending vibe banner
  vibeBanner: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
  },
  vibeBannerPending: {
    backgroundColor: 'rgba(0,212,255,0.08)',
    borderColor: 'rgba(0,212,255,0.25)',
  },
  vibeBannerClaimed: {
    backgroundColor: 'rgba(20,241,149,0.08)',
    borderColor: 'rgba(20,241,149,0.25)',
  },
  vibeBannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#14F195',
  },
  vibeBannerLink: {
    fontSize: 13,
    color: 'rgba(0,212,255,0.7)',
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  vibeBannerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
  },
  vibeBannerLinkClaimed: {
    fontSize: 13,
    color: 'rgba(20,241,149,0.9)',
    textDecorationLine: 'underline',
  },
  vibeBannerLinkSecondary: {
    fontSize: 12,
    color: 'rgba(20,241,149,0.7)',
    textDecorationLine: 'underline',
  },

  // Connect wallet button
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,90,255,0.4)',
    backgroundColor: 'rgba(148,90,255,0.08)',
    marginBottom: 8,
  },
  connectBtnDone: {
    borderColor: 'rgba(20,241,149,0.3)',
    backgroundColor: 'rgba(20,241,149,0.06)',
  },
  walletFirstHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  connectBtnLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
  connectBtnLabelDone: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  disconnectWallet: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 'auto',
  },
  phantomIcon: {
    fontSize: 16,
    color: '#9F6AFF',
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9F6AFF',
  },
  checkmark: {
    fontSize: 14,
    color: '#14F195',
    marginLeft: 'auto',
  },

  // Connect X
  connectXBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  connectXBtnDone: {
    borderColor: 'rgba(20,241,149,0.3)',
    backgroundColor: 'rgba(20,241,149,0.06)',
  },
  xIcon: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
  },
  xIconDone: {
    color: '#ffffff',
  },
  connectXLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  connectXLabelDone: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  disconnectX: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 'auto',
  },

  // Form
  formSection: {
    marginTop: 4,
  },
  formLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#ffffff',
  },
  searchXBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  searchXBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },

  // Send button
  btnSend: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,90,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(148,90,255,0.35)',
    marginTop: 10,
  },
  btnSendDisabled: {
    opacity: 0.35,
  },
  btnSendLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  costText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 8,
  },

  // X auth banner
  xAuthBanner: {
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
  },
  xAuthBannerSuccess: {
    backgroundColor: 'rgba(20,241,149,0.08)',
    borderColor: 'rgba(20,241,149,0.25)',
  },
  xAuthBannerError: {
    backgroundColor: 'rgba(255,170,68,0.1)',
    borderColor: 'rgba(255,170,68,0.3)',
  },
  xAuthBannerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  xAuthBannerTextSuccess: {
    color: '#14F195',
  },
  xAuthBannerTextError: {
    color: '#ffaa44',
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
  },
  retryMetadataBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(20,241,149,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.5)',
  },
  retryMetadataBtnText: {
    color: '#14F195',
    fontSize: 14,
    fontWeight: '600',
  },

});
