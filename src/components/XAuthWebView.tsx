import React, {useRef, useState, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {WebView, WebViewNavigation} from 'react-native-webview';

const BASE_URL = 'https://solana-vibes.vercel.app';
const AUTH_URL = `${BASE_URL}/api/auth/x`;
const ME_URL = `${BASE_URL}/api/auth/x/me`;

interface XAuthWebViewProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (username: string) => void;
}

export function XAuthWebView({visible, onClose, onSuccess}: XAuthWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const hasChecked = useRef(false);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const {url} = navState;

      // After the OAuth flow completes, the backend redirects to the base URL.
      // When we land back on the base domain (not the Twitter or API auth URL),
      // inject JS to fetch /api/auth/x/me and get the username.
      if (
        url.startsWith(BASE_URL) &&
        !url.includes('/api/auth/x') &&
        !url.includes('twitter.com') &&
        !url.includes('x.com') &&
        !hasChecked.current
      ) {
        hasChecked.current = true;
        setChecking(true);

        // Inject JS into the WebView to call /api/auth/x/me
        // The WebView has the auth cookies set by the backend
        const injectedJS = `
          (async function() {
            try {
              const res = await fetch('${ME_URL}', { credentials: 'include' });
              const data = await res.json();
              window.ReactNativeWebView.postMessage(JSON.stringify(data));
            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ error: err.message }));
            }
          })();
          true;
        `;
        webViewRef.current?.injectJavaScript(injectedJS);
      }
    },
    [onSuccess],
  );

  const handleMessage = useCallback(
    (event: {nativeEvent: {data: string}}) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.connected && (data.username || data.screen_name || data.handle)) {
          const username = data.username || data.screen_name || data.handle;
          onSuccess(username);
        } else if (data.error) {
          console.warn('X auth check error:', data.error);
          // Reset so user can try again
          hasChecked.current = false;
          setChecking(false);
        } else {
          // Not connected - might have cancelled on Twitter side
          console.warn('X auth: not connected', data);
          hasChecked.current = false;
          setChecking(false);
        }
      } catch (err) {
        console.warn('Failed to parse X auth response:', err);
        hasChecked.current = false;
        setChecking(false);
      }
    },
    [onSuccess],
  );

  const handleClose = useCallback(() => {
    hasChecked.current = false;
    setChecking(false);
    setLoading(true);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        {/* Header bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Connect X</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Loading overlay while checking auth */}
        {checking && (
          <View style={styles.checkingOverlay}>
            <ActivityIndicator color="#14F195" size="large" />
            <Text style={styles.checkingText}>Verifying connection...</Text>
          </View>
        )}

        {/* Loading indicator for initial page load */}
        {loading && !checking && (
          <View style={styles.loadingBar}>
            <ActivityIndicator color="#9F6AFF" size="small" />
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{uri: AUTH_URL}}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  loadingBar: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'rgba(10,10,10,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  checkingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
