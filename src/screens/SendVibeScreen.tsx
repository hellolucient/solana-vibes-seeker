import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useMobileWallet} from '../hooks/useMobileWallet';
import {WalletButton} from '../components/WalletButton';
import {useVibeApi} from '../hooks/useVibeApi';

type SendState = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success';

export function SendVibeScreen() {
  const {connected, publicKey, signTransaction} = useMobileWallet();
  const {prepareVibe, confirmVibe} = useVibeApi();

  const [targetUsername, setTargetUsername] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [vibeResult, setVibeResult] = useState<{
    id: string;
    claimUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendVibe = async () => {
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

    try {
      // Step 1: Prepare the transaction on the backend
      const prepareResult = await prepareVibe({
        targetUsername: username,
        senderWallet: publicKey.toBase58(),
      });

      setSendState('signing');

      // Step 2: Sign the transaction with MWA
      const signedTx = await signTransaction(prepareResult.transaction);

      setSendState('confirming');

      // Step 3: Send signed transaction to backend for confirmation
      const confirmResult = await confirmVibe({
        vibeId: prepareResult.vibeId,
        signedTransaction: signedTx,
        blockhash: prepareResult.blockhash,
        lastValidBlockHeight: prepareResult.lastValidBlockHeight,
      });

      // Success!
      setSendState('success');
      setVibeResult({
        id: confirmResult.vibeId,
        claimUrl: confirmResult.claimUrl,
      });
    } catch (err) {
      console.error('Send vibe error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong';
      // Add context about which step failed
      const step = sendState === 'preparing'
        ? 'preparing'
        : sendState === 'signing'
        ? 'signing'
        : 'confirming';
      setError(`Error while ${step}: ${message}`);
      setSendState('idle');
    }
  };

  const handleShare = async () => {
    if (!vibeResult) return;

    try {
      await Share.share({
        message: `I just sent you a vibe on Solana! 🎉\n\nClaim your unique NFT here:\n${vibeResult.claimUrl}`,
        url: vibeResult.claimUrl,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleReset = () => {
    setTargetUsername('');
    setSendState('idle');
    setVibeResult(null);
    setError(null);
  };

  // Not connected state
  if (!connected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Send a Vibe</Text>
          <WalletButton />
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>Connect your wallet to send vibes</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success state
  if (sendState === 'success' && vibeResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Vibe Sent! ✨</Text>
        </View>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>🎉</Text>
          </View>
          <Text style={styles.successTitle}>
            Vibe sent to @{targetUsername}
          </Text>
          <Text style={styles.successSubtitle}>
            Share the claim link so they can receive their NFT
          </Text>

          <View style={styles.claimLinkBox}>
            <Text style={styles.claimLinkLabel}>Claim Link</Text>
            <Text style={styles.claimLinkUrl} numberOfLines={2}>
              {vibeResult.claimUrl}
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleShare}>
            <Text style={styles.primaryButtonText}>Share Link 📤</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>Send Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading states
  const isLoading = sendState !== 'idle';
  const loadingMessage = {
    preparing: 'Preparing transaction...',
    signing: 'Waiting for wallet signature...',
    confirming: 'Confirming on Solana...',
  }[sendState as 'preparing' | 'signing' | 'confirming'];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.title}>Send a Vibe</Text>
          <WalletButton />
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Who do you want to vibe?</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputPrefix}>@</Text>
            <TextInput
              style={styles.input}
              value={targetUsername}
              onChangeText={setTargetUsername}
              placeholder="username"
              placeholderTextColor="#666666"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.costInfo}>
            <Text style={styles.costLabel}>Transaction Cost</Text>
            <Text style={styles.costValue}>~0.006 SOL</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!targetUsername.trim() || isLoading) && styles.primaryButtonDisabled,
            ]}
            onPress={handleSendVibe}
            disabled={!targetUsername.trim() || isLoading}>
            {isLoading ? (
              <View style={styles.loadingContent}>
                <ActivityIndicator color="#0a0a0a" size="small" />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Send Vibe ✨</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Each X user can only receive one vibe. The recipient will need to
            verify their X account to claim.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 16,
  },
  inputPrefix: {
    fontSize: 18,
    color: '#14F195',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#ffffff',
    paddingVertical: 16,
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
  costInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  costLabel: {
    fontSize: 14,
    color: '#888888',
  },
  costValue: {
    fontSize: 14,
    color: '#14F195',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#14F195',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  successContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 32,
  },
  claimLinkBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  claimLinkLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8,
  },
  claimLinkUrl: {
    fontSize: 14,
    color: '#14F195',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888888',
  },
});
