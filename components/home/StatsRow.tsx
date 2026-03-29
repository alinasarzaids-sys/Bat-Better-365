import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { UserProgress } from '@/types';

interface StatsRowProps {
  progress: UserProgress | null;
}

export function StatsRow({ progress }: StatsRowProps) {

  const stats = [
    {
      icon: 'local-fire-department' as const,
      label: 'Day Streak',
      value: progress?.current_streak || 0,
      suffix: '🔥',
    },
    {
      icon: 'timer' as const,
      label: 'Weekly Minutes',
      value: '0/300',
      subtext: '300 min to go',
    },
    {
      icon: 'emoji-events' as const,
      label: progress?.skill_level || 'Beginner',
      value: '',
      subtext: 'Current Level',
    },
    {
      icon: 'trending-up' as const,
      label: 'Total Sessions',
      value: progress?.total_sessions || 0,
      subtext: 'Keep it up!',
    },
  ];

  return (
    <View style={styles.container}>
      {stats.map((stat, index) => (
        <Card key={index} style={styles.statCard}>
          <View style={styles.iconContainer}>
            <MaterialIcons name={stat.icon} size={24} color={colors.primary} />
          </View>
          <View style={styles.statContent}>
            {(stat.value || stat.value === 0) && (
              <Text style={styles.statValue}>
                {String(stat.value)}{stat.suffix ? ` ${stat.suffix}` : ''}
              </Text>
            )}
            <Text style={styles.statLabel}>{stat.label}</Text>
            {stat.subtext && <Text style={styles.statSubtext}>{stat.subtext}</Text>}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  statSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  combatStatsCard: {
    marginBottom: spacing.lg,
  },
  combatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  combatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  combatTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  combatSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pillarStatCard: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  pillarIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pillarStatValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  pillarStatLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  totalXPContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  totalXPLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  totalXPValue: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  modalDescription: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  pillarExplanations: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pillarExplanation: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  pillarExplanationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillarExplanationContent: {
    flex: 1,
  },
  pillarExplanationTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  pillarExplanationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  xpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  xpInfoText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
});
