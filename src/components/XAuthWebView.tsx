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
} from 'react-native';
import {WebView, WebViewNavigation} from 'react-native-webview';

const BASE_URL = 'https://solana-vibes-seeker.vercel.app';
const AUTH_URL = `${BASE_URL}/api/auth/x`;
const ME_URL = `${BASE_URL}/api/auth/x/me`;

/** Parse username from app callback URL (e.g. solanavibes://auth/x?username=foo) */
function parseUsernameFromDeepLink(url: string): string | null {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return null;
  const queryString = url.slice(qIdx + 1);
  const params = queryString.split('&');
  for (const param of params) {
    const [key, ...rest] = param.split('=');
    if (key === 'username' && rest.length > 0) {
      return decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    }
  }
  return null;
}

interface XAuthWebViewProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (username: string) => void;
  /** When set, backend redirects here after auth; we intercept this URL and parse username (in-app flow). */
  returnToDeepLink?: string;
}

export function XAuthWebView({visible, onClose, onSuccess, returnToDeepLink}: XAuthWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const hasChecked = useRef(false);

  const authUrl = returnToDeepLink
    ? `${AUTH_URL}?return_to=${encodeURIComponent(returnToDeepLink)}`
    : AUTH_URL;

  const handleShouldStartLoad = useCallback(
    (event: {nativeEvent: {url: string}}) => {
      const url = event.nativeEvent?.url || '';
      if (returnToDeepLink && url.startsWith(returnToDeepLink)) {
        const username = parseUsernameFromDeepLink(url);
        if (username) {
          onSuccess(username);
          onClose();
        }
        return false;
      }
      return true;
    },
    [returnToDeepLink, onSuccess, onClose],
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const {url} = navState;

      // App flow: backend redirects to deep link; intercept and parse username
      if (returnToDeepLink && url.startsWith(returnToDeepLink)) {
        const username = parseUsernameFromDeepLink(url);
        if (username) {
          onSuccess(username);
          onClose();
        }
        return;
      }

      // Web flow: after OAuth, backend redirects to base URL; then call /me
      if (
        !returnToDeepLink &&
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
    [onSuccess, returnToDeepLink, onClose],
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
      onRequestClose={handleClose}
      statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* Native-style header — matches app, not browser chrome */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Connect X</Text>
          <Text style={styles.headerSubtitle}>Sign in with your X account</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
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

        {/* App-style loading: centered, no browser progress bar */}
        {loading && !checking && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#14F195" size="large" />
            <Text style={styles.loadingLabel}>Connecting to X...</Text>
          </View>
        )}

        {/* WebView in a card-like container so it feels in-app */}
        <View style={styles.webviewWrap}>
          <WebView
            ref={webViewRef}
            source={{uri: authUrl}}
            style={styles.webview}
            onNavigationStateChange={handleNavigationStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onMessage={handleMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
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
  checkingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkingText: {
    marginTop: 16,
    fontSize: 15,
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
});
