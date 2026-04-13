import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useAuth } from '@/template';
import { leaderboardService, LeaderboardEntry, LeaderboardType } from '@/services/leaderboardService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const leaderboardTabs: { key: LeaderboardType; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'overall', label: 'Overall', icon: 'emoji-events' },
  { key: 'streak', label: 'Streak', icon: 'local-fire-department' },
  { key: 'technical', label: 'Technical', icon: 'sports-cricket' },
  { key: 'physical', label: 'Physical', icon: 'fitness-center' },
  { key: 'mental', label: 'Mental', icon: 'psychology' },
  { key: 'tactical', label: 'Tactical', icon: 'lightbulb' },
];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('overall');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  const loadLeaderboard = async () => {
    setLoading(true);
    const { data } = await leaderboardService.getLeaderboard(activeTab);
    if (data) {
      setLeaderboard(data);
    }
    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getRankDescription = () => {
    switch (activeTab) {
      case 'overall':
        return 'Players ranked by total training XP across all pillars';
      case 'streak':
        return 'Players with the longest consecutive training days';
      case 'technical':
        return 'Players with the most technical skill development XP';
      case 'physical':
        return 'Players with the most physical conditioning XP';
      case 'mental':
        return 'Players with the most mental strength XP';
      case 'tactical':
        return 'Players with the most tactical awareness XP';
    }
  };

  const getDisplayValue = (entry: LeaderboardEntry) => {
    switch (activeTab) {
      case 'overall':
        return `${entry.total_xp} Total XP`;
      case 'streak':
        return `${entry.current_streak} Day Streak`;
      case 'technical':
        return `${entry.technical_points} XP`;
      case 'physical':
        return `${entry.physical_points} XP`;
      case 'mental':
        return `${entry.mental_points} XP`;
      case 'tactical':
        return `${entry.tactical_points} XP`;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="emoji-events" size={32} color={colors.textLight} />
        </View>
        <Text style={styles.headerTitle}>Leaderboards</Text>
        <Text style={styles.headerSubtitle}>See who's training the hardest and climbing the ranks!</Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {leaderboardTabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Description */}
      <View style={styles.descriptionContainer}>
        <MaterialIcons name="info-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.descriptionText}>{getRankDescription()}</Text>
      </View>

      {/* Leaderboard List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadLeaderboard}
            tintColor={colors.primary}
          />
        }
      >
        {leaderboard.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="leaderboard" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>No rankings available yet</Text>
            <Text style={styles.emptyStateSubtext}>Complete training sessions to appear on the leaderboard!</Text>
          </View>
        ) : (
          <View style={styles.leaderboardList}>
            {leaderboard.map((entry) => {
              const isCurrentUser = user?.id === entry.id;
              const isTopThree = entry.rank <= 3;

              return (
                <View
                  key={entry.id}
                  style={[
                    styles.leaderboardEntry,
                    isCurrentUser && styles.leaderboardEntryCurrentUser,
                    isTopThree && !isCurrentUser && styles.leaderboardEntryTopThree,
                    entry.rank === 1 && !isCurrentUser && styles.leaderboardEntryFirst,
                  ]}
                >
                  {/* Rank Icon */}
                  <View style={styles.rankIconContainer}>
                    <Text style={[styles.rankIcon, entry.rank === 1 && styles.rankIconFirst]}>{getRankIcon(entry.rank)}</Text>
                    {entry.rank === 1 && !isCurrentUser && (
                      <View style={styles.fireBadge}>
                        <MaterialIcons name="whatshot" size={14} color="#FF6F00" />
                      </View>
                    )}
                  </View>

                  {/* User Info */}
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text
                        style={[
                          styles.username,
                          isCurrentUser && styles.usernameCurrentUser,
                        ]}
                        numberOfLines={1}
                      >
                        {entry.username}
                      </Text>
                      {isCurrentUser && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>You</Text>
                        </View>
                      )}
                      {entry.rank === 1 && !isCurrentUser && (
                        <View style={styles.topPlayerBadge}>
                          <Text style={styles.topPlayerBadgeText}>🏆 Hardest Worker</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.skillLevel}>{entry.skill_level}</Text>
                  </View>

                  {/* Points */}
                  <View style={styles.pointsContainer}>
                    <Text
                      style={[
                        styles.points,
                        isCurrentUser && styles.pointsCurrentUser,
                      ]}
                    >
                      {getDisplayValue(entry).split(' ')[0]}
                    </Text>
                    <Text style={styles.pointsLabel}>
                      {getDisplayValue(entry).substring(getDisplayValue(entry).indexOf(' ') + 1)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabsContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 56,
  },
  tabsContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primaryLight + '20',
    borderColor: colors.primary,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descriptionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyStateText: {
    ...typography.h4,
    color: colors.textSecondary,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  leaderboardList: {
    gap: spacing.sm,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  leaderboardEntryCurrentUser: {
    backgroundColor: '#FFF9E6',
    borderColor: '#FFB800',
  },
  leaderboardEntryTopThree: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BBDEFB',
  },
  leaderboardEntryFirst: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB800',
  },
  rankIconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankIcon: {
    fontSize: 28,
    fontWeight: '700',
  },
  rankIconFirst: {
    fontSize: 32,
  },
  fireBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  username: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  usernameCurrentUser: {
    color: '#000000',
  },
  youBadge: {
    backgroundColor: '#52B788',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  youBadgeText: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 10,
  },
  topPlayerBadge: {
    backgroundColor: '#FF6F00',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  topPlayerBadgeText: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 10,
  },
  skillLevel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  points: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  pointsCurrentUser: {
    color: '#000000',
  },
  pointsLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
