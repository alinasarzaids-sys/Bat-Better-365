import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { Card } from '../ui/Card';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { UserProgress } from '@/types';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { LEVEL_THRESHOLDS, XP_REWARDS } from '@/services/progressService';

interface StatsRowProps {
  progress: UserProgress | null;
}

// Weekly minutes: sum time_elapsed (seconds) from all drill logs + duration_minutes from completed sessions this week
async function fetchWeeklyMinutes(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const startStr = monday.toISOString();

  let totalSeconds = 0;

  // Technical drill logs
  const { data: techLogs } = await supabase
    .from('technical_drill_logs')
    .select('time_elapsed')
    .eq('user_id', userId)
    .gte('created_at', startStr);
  (techLogs || []).forEach((l: any) => { totalSeconds += l.time_elapsed || 0; });

  // Mental drill logs
  const { data: mentalLogs } = await supabase
    .from('mental_drill_logs')
    .select('time_elapsed')
    .eq('user_id', userId)
    .gte('created_at', startStr);
  (mentalLogs || []).forEach((l: any) => { totalSeconds += l.time_elapsed || 0; });

  // Workout/Physical drill logs
  const { data: workoutLogs } = await supabase
    .from('workout_drill_logs')
    .select('time_elapsed')
    .eq('user_id', userId)
    .gte('created_at', startStr);
  (workoutLogs || []).forEach((l: any) => { totalSeconds += l.time_elapsed || 0; });

  // Tactical drill logs
  const { data: tacticalLogs } = await supabase
    .from('tactical_drill_logs')
    .select('time_elapsed')
    .eq('user_id', userId)
    .gte('created_at', startStr);
  (tacticalLogs || []).forEach((l: any) => { totalSeconds += l.time_elapsed || 0; });

  // Completed sessions (freestyle + drill-based) this week
  const { data: sessions } = await supabase
    .from('sessions')
    .select('duration_minutes')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', startStr);
  (sessions || []).forEach((s: any) => { totalSeconds += (s.duration_minutes || 0) * 60; });

  return Math.round(totalSeconds / 60);
}

const WEEKLY_GOAL = 300;

const PILLAR_INFO = [
  {
    icon: 'settings' as const,
    color: colors.technical || '#2196F3',
    label: 'Technical',
    desc: 'Batting technique, footwork, shot selection. Drills: Pull Shot, Drive, Cut Shot.',
    xpPerDrill: XP_REWARDS.DRILL_COMPLETION,
  },
  {
    icon: 'fitness-center' as const,
    color: colors.physical || '#4CAF50',
    label: 'Physical',
    desc: 'Strength, endurance, agility, fitness circuits. Drills: Core Stability, Sprint Drills.',
    xpPerDrill: XP_REWARDS.DRILL_COMPLETION,
  },
  {
    icon: 'psychology' as const,
    color: colors.mental || '#9C27B0',
    label: 'Mental',
    desc: 'Focus, confidence, composure, pressure management. Drills: Pre-shot Routine, Visualisation.',
    xpPerDrill: XP_REWARDS.DRILL_COMPLETION,
  },
  {
    icon: 'lightbulb' as const,
    color: colors.tactical || '#FF9800',
    label: 'Tactical',
    desc: 'Game reading, shot selection under match conditions. Drills: Tactical Scenarios.',
    xpPerDrill: XP_REWARDS.DRILL_COMPLETION,
  },
];

const LEVELS = [
  { label: 'Beginner', xp: 0, color: '#78909C' },
  { label: 'Intermediate', xp: LEVEL_THRESHOLDS.Intermediate, color: '#42A5F5' },
  { label: 'Advanced', xp: LEVEL_THRESHOLDS.Advanced, color: '#66BB6A' },
  { label: 'Expert', xp: LEVEL_THRESHOLDS.Expert, color: '#FFA726' },
];

export function StatsRow({ progress }: StatsRowProps) {
  const { user } = useAuth();
  const [weeklyMins, setWeeklyMins] = useState<number>(0);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setWeeklyLoading(true);
    fetchWeeklyMinutes(user.id)
      .then(setWeeklyMins)
      .finally(() => setWeeklyLoading(false));
  }, [user?.id, progress]);

  const totalXP = progress
    ? (progress.technical_points || 0) + (progress.physical_points || 0) +
      (progress.mental_points || 0) + (progress.tactical_points || 0)
    : 0;
  const currentLevel = progress?.skill_level || 'Beginner';
  const levelInfo = LEVELS.find(l => l.label === currentLevel) || LEVELS[0];
  const nextLevel = LEVELS.find(l => l.xp > totalXP);
  const prevThreshold = levelInfo.xp;
  const nextThreshold = nextLevel?.xp ?? totalXP;
  const levelPct = nextLevel
    ? Math.min(100, Math.round(((totalXP - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100;

  const remaining = Math.max(0, WEEKLY_GOAL - weeklyMins);
  const weeklyPct = Math.min(100, Math.round((weeklyMins / WEEKLY_GOAL) * 100));

  return (
    <>
      <View style={styles.container}>
        {/* Day Streak */}
        <Card style={styles.statCard}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="local-fire-department" size={24} color={colors.error} />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statValue}>{progress?.current_streak || 0} 🔥</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </Card>

        {/* Weekly Minutes */}
        <Card style={styles.statCard}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="timer" size={24} color={colors.primary} />
          </View>
          <View style={styles.statContent}>
            {weeklyLoading ? (
              <Text style={[styles.statValue, { fontSize: 16 }]}>...</Text>
            ) : (
              <Text style={styles.statValue}>{weeklyMins}<Text style={styles.statValueSuffix}>m</Text></Text>
            )}
            <Text style={styles.statLabel}>Weekly Mins</Text>
            <View style={styles.miniBarTrack}>
              <View style={[styles.miniBarFill, { width: `${weeklyPct}%`, backgroundColor: weeklyPct >= 100 ? colors.success : colors.primary }]} />
            </View>
            <Text style={styles.statSubtext}>
              {weeklyPct >= 100 ? 'Goal reached! 🎉' : `${remaining}m to ${WEEKLY_GOAL}m goal`}
            </Text>
          </View>
        </Card>

        {/* Skill Level with ⓘ */}
        <Card style={styles.statCard}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="emoji-events" size={24} color={levelInfo.color} />
          </View>
          <View style={styles.statContent}>
            <View style={styles.levelRow}>
              <Text style={[styles.statValue, { color: levelInfo.color, fontSize: 15 }]}>{currentLevel}</Text>
              <Pressable
                style={styles.infoBtn}
                onPress={() => setShowPointsModal(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.infoIcon}>ⓘ</Text>
              </Pressable>
            </View>
            <Text style={styles.statLabel}>Player Level</Text>
            <View style={styles.miniBarTrack}>
              <View style={[styles.miniBarFill, { width: `${levelPct}%`, backgroundColor: levelInfo.color }]} />
            </View>
            <Text style={styles.statSubtext}>{totalXP} XP{nextLevel ? ` / ${nextLevel.xp}` : ' — Max!'}</Text>
          </View>
        </Card>

        {/* Total Sessions */}
        <Card style={styles.statCard}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="trending-up" size={24} color={colors.success} />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statValue}>{progress?.total_sessions || 0}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
            <Text style={styles.statSubtext}>Keep it up!</Text>
          </View>
        </Card>
      </View>

      {/* Points System Modal */}
      <Modal visible={showPointsModal} transparent animationType="fade" onRequestClose={() => setShowPointsModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPointsModal(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <MaterialIcons name="emoji-events" size={22} color={colors.warning} />
                <Text style={styles.modalTitle}>Points & Levels</Text>
              </View>
              <Pressable onPress={() => setShowPointsModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Current XP */}
              <View style={styles.xpSummaryBox}>
                <Text style={styles.xpSummaryLabel}>Your Total XP</Text>
                <Text style={[styles.xpSummaryVal, { color: levelInfo.color }]}>{totalXP} XP</Text>
                <Text style={styles.xpSummaryLevel}>{currentLevel}</Text>
                <View style={styles.xpBarTrack}>
                  <View style={[styles.xpBarFill, { width: `${levelPct}%`, backgroundColor: levelInfo.color }]} />
                </View>
                {nextLevel ? (
                  <Text style={styles.xpSummarySub}>{nextLevel.xp - totalXP} XP to {nextLevel.label}</Text>
                ) : (
                  <Text style={styles.xpSummarySub}>Maximum level reached!</Text>
                )}
              </View>

              {/* Level Thresholds */}
              <Text style={styles.sectionLabel}>LEVELS</Text>
              {LEVELS.map((l, i) => {
                const isCurrent = l.label === currentLevel;
                return (
                  <View key={l.label} style={[styles.levelRow2, isCurrent && { backgroundColor: l.color + '15', borderColor: l.color + '40' }]}>
                    <View style={[styles.levelDot, { backgroundColor: l.color }]} />
                    <Text style={[styles.levelLabel, isCurrent && { color: l.color, fontWeight: '800' }]}>{l.label}</Text>
                    <Text style={styles.levelXP}>{l.xp === 0 ? 'Starting level' : `${l.xp}+ XP`}</Text>
                    {isCurrent && <View style={styles.youBadge}><Text style={[styles.youText, { color: l.color }]}>YOU</Text></View>}
                  </View>
                );
              })}

              {/* How to Earn XP */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>HOW TO EARN XP</Text>
              <View style={styles.xpRuleRow}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.xpRuleText}>Complete any drill — <Text style={{ fontWeight: '700', color: colors.text }}>+{XP_REWARDS.DRILL_COMPLETION} XP</Text></Text>
              </View>
              <View style={styles.xpRuleRow}>
                <MaterialIcons name="star" size={16} color={colors.warning} />
                <Text style={styles.xpRuleText}>Rate your session 7+/10 — <Text style={{ fontWeight: '700', color: colors.text }}>+{XP_REWARDS.GOOD_RATING} XP bonus</Text></Text>
              </View>
              <View style={styles.xpRuleRow}>
                <MaterialIcons name="local-fire-department" size={16} color={colors.error} />
                <Text style={styles.xpRuleText}>3+ day training streak — <Text style={{ fontWeight: '700', color: colors.text }}>+{XP_REWARDS.STREAK} XP bonus</Text></Text>
              </View>
              <View style={styles.xpRuleRow}>
                <MaterialIcons name="event-repeat" size={16} color={colors.primary} />
                <Text style={styles.xpRuleText}>3+ sessions this week — <Text style={{ fontWeight: '700', color: colors.text }}>+{XP_REWARDS.CONSISTENCY} XP bonus</Text></Text>
              </View>
              <View style={styles.xpRuleRow}>
                <MaterialIcons name="book" size={16} color={colors.mental} />
                <Text style={styles.xpRuleText}>Complete today's journal — <Text style={{ fontWeight: '700', color: colors.text }}>+40 XP</Text></Text>
              </View>

              {/* Pillars */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>TRAINING PILLARS</Text>
              {PILLAR_INFO.map(p => (
                <View key={p.label} style={styles.pillarRow}>
                  <View style={[styles.pillarIcon, { backgroundColor: p.color + '20' }]}>
                    <MaterialIcons name={p.icon} size={16} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pillarLabel, { color: p.color }]}>{p.label}</Text>
                    <Text style={styles.pillarDesc}>{p.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  iconContainer: { marginRight: spacing.sm },
  statContent: { flex: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { ...typography.h3, color: colors.text },
  statValueSuffix: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  statLabel: { ...typography.bodySmall, color: colors.textSecondary },
  statSubtext: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  infoBtn: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  infoIcon: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  miniBarTrack: {
    height: 4, backgroundColor: colors.border, borderRadius: 2,
    overflow: 'hidden', marginTop: 4, marginBottom: 2,
  },
  miniBarFill: { height: '100%', borderRadius: 2 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },

  xpSummaryBox: {
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  xpSummaryLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  xpSummaryVal: { fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  xpSummaryLevel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  xpBarTrack: { width: '100%', height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.xs },
  xpBarFill: { height: '100%', borderRadius: 4 },
  xpSummarySub: { fontSize: 11, color: colors.textSecondary },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm,
  },

  levelRow2: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md, marginBottom: spacing.xs,
    borderWidth: 1, borderColor: 'transparent',
    backgroundColor: colors.background,
  },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  levelXP: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  youBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'currentColor',
  },
  youText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  xpRuleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm, paddingHorizontal: spacing.xs,
  },
  xpRuleText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  pillarRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  pillarIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  pillarLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  pillarDesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
});
