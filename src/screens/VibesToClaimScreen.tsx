import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useVibeApi} from '../hooks/useVibeApi';
import type {RootStackParamList} from '../navigation/RootNavigator';

type VibesToClaimNavProp = NativeStackNavigationProp<RootStackParamList, 'VibesToClaim'>;

export function VibesToClaimScreen() {
  const navigation = useNavigation<VibesToClaimNavProp>();
  const {lookupVibeForUser} = useVibeApi();
  const [loading, setLoading] = useState(true);
  const [pendingVibes, setPendingVibes] = useState<
    Array<{
      id: string;
      createdAt?: string;
      maskedWallet?: string;
      imageUrl?: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const username = await AsyncStorage.getItem('@solanavibes/x_username');
        if (!username) {
          if (!cancelled) setError('Connect X first');
          return;
        }
        const result = await lookupVibeForUser(username);
        if (!cancelled && result?.hasPending && result.pendingVibes?.length) {
        setPendingVibes(
          result.pendingVibes.map((v) => ({
            id: v.id,
            createdAt: v.createdAt,
            maskedWallet: v.maskedWallet,
            imageUrl: v.imageUrl,
          })),
        );
        } else if (!cancelled) {
          setPendingVibes([]);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [lookupVibeForUser]);

  const handleGoBack = () => navigation.goBack();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backRow} activeOpacity={0.8}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#14F195" />
          <Text style={styles.loadingText}>Loading vibes to claim...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={handleGoBack} style={styles.backRow} activeOpacity={0.8}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>vibes_to_claim</Text>
      <Text style={styles.subtitle}>Tap one to view and claim</Text>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : pendingVibes.length === 0 ? (
        <Text style={styles.emptyText}>No pending vibes to claim.</Text>
      ) : (
        <>
          <TouchableOpacity
            style={styles.claimAllBtn}
            onPress={() =>
              navigation.navigate('ClaimVibe', {
                vibeId: pendingVibes[0].id,
                claimAll: true,
              })
            }
            activeOpacity={0.8}>
            <Text style={styles.claimAllBtnText}>Claim all ({pendingVibes.length})</Text>
          </TouchableOpacity>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}>
            {pendingVibes.map((v, index) => (
              <TouchableOpacity
                key={v.id}
                style={styles.card}
                onPress={() =>
                  navigation.navigate('ClaimVibe', {vibeId: v.id, singleOnly: true})
                }
                activeOpacity={0.8}>
              {v.imageUrl ? (
                <Image source={{uri: v.imageUrl}} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Vibe {index + 1} of {pendingVibes.length}</Text>
                {v.maskedWallet && (
                  <Text style={styles.cardWallet} numberOfLines={1}>
                    From {v.maskedWallet}
                  </Text>
                )}
              </View>
              <Text style={styles.cardChevron}>→</Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
        </>
      )}
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
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backArrow: {
    fontSize: 20,
    color: '#14F195',
    marginRight: 6,
  },
  backText: {
    fontSize: 16,
    color: '#14F195',
  },
  title: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,100,100,0.9)',
    textAlign: 'center',
    marginHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginHorizontal: 24,
  },
  claimAllBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(20,241,149,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(20,241,149,0.4)',
    alignItems: 'center',
  },
  claimAllBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#14F195',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardImage: {
    width: 72,
    height: 72,
    backgroundColor: '#0a0a0a',
  },
  cardImagePlaceholder: {
    backgroundColor: '#111',
  },
  cardBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cardWallet: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  cardChevron: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.4)',
    paddingRight: 16,
  },
});
