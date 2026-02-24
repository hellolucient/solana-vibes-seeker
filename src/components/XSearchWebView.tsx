import React, {useRef, useState, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import {WebView, WebViewNavigation} from 'react-native-webview';

const X_SEARCH_URL = 'https://x.com/search';
const X_NON_PROFILE_PATHS = [
  'search',
  'home',
  'explore',
  'settings',
  'compose',
  'messages',
  'notifications',
  'i',
  'intent',
  'hashtag',
  'share',
  'oauth',
  'account',
  'tos',
  'privacy',
  'about',
  'help',
];

/**
 * Extract X username from profile URL, or null if not a profile page.
 */
function getUsernameFromProfileUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'x.com' && host !== 'twitter.com') return null;
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    if (pathSegments.length !== 1) return null;
    const username = pathSegments[0];
    if (X_NON_PROFILE_PATHS.includes(username.toLowerCase())) return null;
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(username)) return null;
    return username;
  } catch {
    return null;
  }
}

interface XSearchWebViewProps {
  visible: boolean;
  onClose: () => void;
  onSelectUsername: (username: string) => void;
}

export function XSearchWebView({
  visible,
  onClose,
  onSelectUsername,
}: XSearchWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const {url} = navState;
      const username = getUsernameFromProfileUrl(url);
      if (username) {
        setError(null);
        // Defer to avoid updating parent state during WebView navigation (can crash on Android)
        setTimeout(() => {
          onSelectUsername(username);
          onClose();
        }, 0);
      }
    },
    [onSelectUsername, onClose],
  );

  const handleClose = useCallback(() => {
    setLoading(true);
    setError(null);
    onClose();
  }, [onClose]);

  const handleWebViewError = useCallback(() => {
    setError('The in-app browser had a problem. You can open X in your regular browser instead.');
  }, []);

  const openInBrowser = useCallback(() => {
    Linking.openURL(X_SEARCH_URL);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* Native-style header — matches app */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search on X</Text>
          <Text style={styles.headerSubtitle}>
            Find a user, then tap their profile to select
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.browserFallbackBtn}
              onPress={openInBrowser}
              activeOpacity={0.8}>
              <Text style={styles.browserFallbackText}>Open X in browser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setError(null)}
              activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* App-style loading: centered, no browser progress bar */}
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#14F195" size="large" />
                <Text style={styles.loadingLabel}>Loading...</Text>
              </View>
            )}
            {visible && (
              <View style={styles.webviewWrap}>
                <WebView
                  ref={webViewRef}
                  source={{uri: X_SEARCH_URL}}
                  style={styles.webview}
                  onNavigationStateChange={handleNavigationStateChange}
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={handleWebViewError}
                  onHttpError={handleWebViewError}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  thirdPartyCookiesEnabled={true}
                  sharedCookiesEnabled={true}
                  scrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                  overScrollMode="never"
                  userAgent={
                    Platform.OS === 'ios'
                      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
                      : 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
                  }
                />
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 1.2,
    color: '#ffffff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    marginTop: 14,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  webviewWrap: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  errorBox: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
  },
  browserFallbackBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(20,241,149,0.2)',
    borderWidth: 1,
    borderColor: '#14F195',
    marginBottom: 12,
  },
  browserFallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#14F195',
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryBtnText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
});
