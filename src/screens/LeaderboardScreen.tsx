import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/RootNavigator';

const API_BASE_URL =
  process.env.API_BASE_URL || 'https://solana-vibes-seeker.vercel.app';

type ViewType = 'week' | 'claimed' | 'most_vibed';

interface WeekEntry {
  wallet: string;
  displayWallet: string;
  count: number;
  claimedCount: number;
}

interface ClaimedEntry {
  wallet: string;
  displayWallet: string;
  count: number;
}

interface MostVibedEntry {
  username: string;
  displayUsername: string;
  count: number;
  claimedCount: number;
}

type ApiResponse =
  | {view: 'week'; entries: WeekEntry[]}
  | {view: 'claimed'; entries: ClaimedEntry[]}
  | {view: 'most_vibed'; entries: MostVibedEntry[]};

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Leaderboard'>;

export function LeaderboardScreen() {
  const navigation = useNavigation<NavProp>();
  const [view, setView] = useState<ViewType>('week');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async (v: ViewType) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaderboard?view=${v}`);
      if (!res.ok) throw new Error('Failed to load');
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(view);
  }, [view, fetchLeaderboard]);

  const renderList = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#14F195" size="small" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (view === 'week' && data?.view === 'week') {
      if (data.entries.length === 0) {
        return <Text style={styles.empty}>No vibes sent this week.</Text>;
      }
      return (
        <View style={styles.listWrapper}>
          <ScrollView
            style={styles.listScroll}
            showsVerticalScrollIndicator={false}>
            {data.entries.map((entry, index) => (
              <View
                key={entry.wallet}
                style={[
                  styles.listItem,
                  index === data.entries.length - 1 && styles.listItemLast,
                ]}>
                <View>
                  <Text style={styles.listItemWallet}>
                    {entry.displayWallet}
                  </Text>
                  {entry.claimedCount > 0 && (
                    <Text style={styles.listItemSub}>
                      {entry.claimedCount} claimed
                    </Text>
                  )}
                </View>
                <Text style={styles.listItemCount}>
                  {entry.count} {entry.count === 1 ? 'vibe' : 'vibes'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    if (view === 'claimed' && data?.view === 'claimed') {
      if (data.entries.length === 0) {
        return <Text style={styles.empty}>No claimed vibes yet.</Text>;
      }
      return (
        <View style={styles.listWrapper}>
          <ScrollView
            style={styles.listScroll}
            showsVerticalScrollIndicator={false}>
            {data.entries.map((entry, index) => (
              <View
                key={entry.wallet}
                style={[
                  styles.listItem,
                  index === data.entries.length - 1 && styles.listItemLast,
                ]}>
                <Text style={styles.listItemWallet}>
                  {entry.displayWallet}
                </Text>
                <Text style={styles.listItemCount}>
                  {entry.count} claimed
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    if (view === 'most_vibed' && data?.view === 'most_vibed') {
      if (data.entries.length === 0) {
        return <Text style={styles.empty}>No vibed usernames yet.</Text>;
      }
      return (
        <View style={styles.listWrapper}>
          <ScrollView
            style={styles.listScroll}
            showsVerticalScrollIndicator={false}>
            {data.entries.map((entry, index) => (
              <View
                key={entry.username}
                style={[
                  styles.listItem,
                  index === data.entries.length - 1 && styles.listItemLast,
                ]}>
                <View>
                  <Text style={styles.listItemWallet}>
                    {entry.displayUsername}
                  </Text>
                  {entry.claimedCount > 0 && (
                    <Text style={styles.listItemSub}>
                      {entry.claimedCount} claimed
                    </Text>
                  )}
                </View>
                <Text style={styles.listItemCount}>
                  {entry.count} {entry.count === 1 ? 'vibe' : 'vibes'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{top: 12, bottom: 12, left: 24, right: 24}}>
          <Text style={styles.title}>solana_vibes</Text>
        </TouchableOpacity>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>leaderboard</Text>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'week' && styles.toggleBtnActive]}
            onPress={() => setView('week')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.toggleBtnText,
                view === 'week' && styles.toggleBtnTextActive,
              ]}>
              vibers - this_week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              view === 'claimed' && styles.toggleBtnActive,
            ]}
            onPress={() => setView('claimed')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.toggleBtnText,
                view === 'claimed' && styles.toggleBtnTextActive,
              ]}>
              claimed_vibes - total
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              view === 'most_vibed' && styles.toggleBtnActive,
            ]}
            onPress={() => setView('most_vibed')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.toggleBtnText,
                view === 'most_vibed' && styles.toggleBtnTextActive,
              ]}>
              most_vibed - total
            </Text>
          </TouchableOpacity>
        </View>

        {renderList()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.85)',
  },
  title: {
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
  },
  toggleBtnActive: {
    borderColor: 'rgba(20,241,149,0.35)',
    backgroundColor: 'rgba(20,241,149,0.06)',
  },
  toggleBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  toggleBtnTextActive: {
    color: '#14F195',
  },
  listWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(148,90,255,0.4)',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(148,90,255,0.04)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(148,90,255,0.5)',
        shadowOffset: {width: 0, height: 0},
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  listScroll: {
    maxHeight: 400,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,90,255,0.12)',
    gap: 12,
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  listItemWallet: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
  listItemCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  listItemSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
  },
});
