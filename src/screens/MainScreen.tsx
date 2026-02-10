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
  Alert,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {useVibeApi} from '../hooks/useVibeApi';

const X_AUTH_BASE = 'https://solana-vibes.vercel.app/api/auth/x';
const X_AUTH_RETURN = 'solanavibes://auth/x';

/** Parse username from auth callback deep link (solanavibes://auth/x?username=...) */
function parseXAuthCallbackUrl(url: string): string | null {
  if (!url.startsWith('solanavibes://auth/x')) return null;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('username');
  } catch {
    return null;
  }
}

// The base wave image
const vibesImage = require('../assets/vibes-base.png');

type SendState = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success';

export function MainScreen() {
  const {connected, connecting, publicKey, connect, disconnect, signTransaction} =
    useMobileWallet();
  const {prepareVibe, confirmVibe} = useVibeApi();

  const [targetUsername, setTargetUsername] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [vibeResult, setVibeResult] = useState<{
    vibeId: string;
    vibeUrl: string;
    mintAddress: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [xUsername, setXUsername] = useState<string | null>(null);

  // Track the step for error reporting
  const stepRef = useRef<string>('idle');

  // Handle X auth callback deep link (system browser redirects here after OAuth)
  useEffect(() => {
    const handleUrl = (url: string) => {
      const username = parseXAuthCallbackUrl(url);
      if (username) setXUsername(username);
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener('url', ({url}) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const isLoading = sendState !== 'idle' && sendState !== 'success';

  const shortenedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  const handleConnect = useCallback(async () => {
    if (!connected && !connecting) {
      try {
        await connect();
      } catch (err) {
        console.error('Failed to connect:', err);
      }
    }
  }, [connected, connecting, connect]);

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
      const message =
        err instanceof Error ? err.message : 'Something went wrong';
      setError(`Error while ${stepRef.current}: ${message}`);
      setSendState('idle');
    }
  }, [connected, publicKey, targetUsername, prepareVibe, confirmVibe, signTransaction]);

  const handleCopyLink = useCallback(() => {
    if (!vibeResult?.vibeUrl) return;
    Clipboard.setString(vibeResult.vibeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [vibeResult]);

  const handlePostToX = useCallback(() => {
    if (!vibeResult?.vibeUrl) return;
    const text = encodeURIComponent(
      `I just sent @${targetUsername} a vibe on Solana! ✨\n\nClaim yours here:`,
    );
    const url = encodeURIComponent(vibeResult.vibeUrl);
    Linking.openURL(`https://twitter.com/intent/tweet?text=${text}&url=${url}`);
  }, [vibeResult, targetUsername]);

  const handleReset = useCallback(() => {
    setTargetUsername('');
    setSendState('idle');
    setVibeResult(null);
    setError(null);
    setCopied(false);
  }, []);

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
          keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={styles.title}>solana_vibes</Text>

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
              <ActivityIndicator
                color="#14F195"
                size="small"
                style={styles.mintingSpinner}
              />
              <Text style={styles.mintingSubtext}>...vibing</Text>
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
              {/* Connect Wallet Button */}
              <TouchableOpacity
                style={[
                  styles.connectBtn,
                  connected && styles.connectBtnDone,
                ]}
                onPress={handleConnect}
                disabled={connected || connecting}
                activeOpacity={0.8}>
                {connecting ? (
                  <>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.connectBtnLabel}>Connecting...</Text>
                  </>
                ) : connected ? (
                  <>
                    <View style={styles.walletDot} />
                    <Text style={styles.connectBtnLabel}>
                      {shortenedAddress}
                    </Text>
                    <Text style={styles.checkmark}>✓</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.phantomIcon}>◉</Text>
                    <Text style={styles.connectBtnLabel}>Connect wallet</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Connect X — opens system browser (Chrome Custom Tabs / SFSafariViewController) */}
              <TouchableOpacity
                style={[
                  styles.connectXBtn,
                  xUsername && styles.connectXBtnDone,
                ]}
                onPress={() => {
                  if (!xUsername) {
                    const authUrl = `${X_AUTH_BASE}?return_to=${encodeURIComponent(X_AUTH_RETURN)}`;
                    Linking.openURL(authUrl);
                  }
                }}
                disabled={!!xUsername}
                activeOpacity={0.8}>
                <Text style={[styles.xIcon, xUsername && styles.xIconDone]}>
                  𝕏
                </Text>
                {xUsername ? (
                  <>
                    <Text style={styles.connectXLabelDone}>@{xUsername}</Text>
                    <Text style={styles.checkmark}>✓</Text>
                  </>
                ) : (
                  <Text style={styles.connectXLabel}>Connect X</Text>
                )}
              </TouchableOpacity>

              {/* Send form */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Send a vibe to</Text>
                <TextInput
                  style={styles.input}
                  value={targetUsername}
                  onChangeText={setTargetUsername}
                  placeholder="@username"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Send button with purple ring */}
              <TouchableOpacity
                style={[
                  styles.btnSend,
                  (!connected || !targetUsername.trim()) &&
                    styles.btnSendDisabled,
                ]}
                onPress={handleSendVibe}
                disabled={!connected || !targetUsername.trim()}
                activeOpacity={0.8}>
                <Text style={styles.btnSendLabel}>send vibe</Text>
              </TouchableOpacity>

              <Text style={styles.costText}>~0.006 SOL</Text>

              {/* Disconnect link */}
              {connected && (
                <TouchableOpacity
                  style={styles.disconnectBtn}
                  onPress={disconnect}>
                  <Text style={styles.disconnectLabel}>Disconnect wallet</Text>
                </TouchableOpacity>
              )}
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
    paddingBottom: 40,
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
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

  // Hero image
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 24,
    backgroundColor: '#0a0a0a',
  },

  // ===== MINTING STATE =====
  mintingSection: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  mintingBadge: {
    borderWidth: 1,
    borderColor: '#14F195',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  mintingBadgeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#14F195',
  },
  mintingSpinner: {
    marginBottom: 12,
  },
  mintingSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },

  // ===== SUCCESS STATE =====
  successCard: {
    width: '100%',
    backgroundColor: 'rgba(20,241,149,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.15)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  successCheckCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(20,241,149,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successCheck: {
    fontSize: 24,
    color: '#14F195',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    textAlign: 'center',
  },
  mintAddress: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    marginBottom: 20,
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
    marginBottom: 16,
    overflow: 'hidden',
  },
  claimUrlText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    paddingVertical: 12,
  },
  copyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  postToXBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 12,
  },
  xIconBtn: {
    fontSize: 16,
    color: '#ffffff',
  },
  postToXText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  sendAnotherBtn: {
    paddingVertical: 10,
  },
  sendAnotherText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },

  // ===== IDLE STATE =====
  // Connect wallet button
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,90,255,0.4)',
    backgroundColor: 'rgba(148,90,255,0.08)',
    marginBottom: 12,
  },
  connectBtnDone: {
    borderColor: 'rgba(20,241,149,0.3)',
    backgroundColor: 'rgba(20,241,149,0.06)',
  },
  connectBtnLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  phantomIcon: {
    fontSize: 18,
    color: '#9F6AFF',
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9F6AFF',
  },
  checkmark: {
    fontSize: 16,
    color: '#14F195',
    marginLeft: 'auto',
  },

  // Connect X
  connectXBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  connectXBtnDone: {
    borderColor: 'rgba(20,241,149,0.3)',
    backgroundColor: 'rgba(20,241,149,0.06)',
  },
  xIcon: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
  },
  xIconDone: {
    color: '#ffffff',
  },
  connectXLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  connectXLabelDone: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },

  // Form
  formSection: {
    marginTop: 8,
  },
  formLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#ffffff',
  },

  // Send button - purple ring like webapp
  btnSend: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,90,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(148,90,255,0.35)',
    marginTop: 16,
  },
  btnSendDisabled: {
    opacity: 0.35,
  },
  btnSendLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  costText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 12,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
  },

  // Disconnect
  disconnectBtn: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disconnectLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.25)',
  },
});
