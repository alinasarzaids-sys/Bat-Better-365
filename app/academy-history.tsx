
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/template';
import { academyService, AcademyTrainingLog } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return colors.success;
  if (intensity <= 6) return colors.warning;
  return colors.error;
}

type LogWithProfile = AcademyTrainingLog & { user_profiles?: { username?: string; email: string } };

export default function AcademyHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const academyId = params.academyId as string;
  const isCoach = params.isCoach === 'true';
  const [logs, setLogs] = useState<LogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    if (isCoach) {
      // Coach/Admin: load ALL logs for the academy (no days limit)
      const supabase = (await import('@/template')).getSupabaseClient();
      const { data, error } = await supabase
        .from('academy_training_logs')
        .select('*, user_profiles(username, email, full_name)')
        .eq('academy_id', academyId)
        .order('log_date', { ascending: false });
      setLogs((data || []) as LogWithProfile[]);
    } else {
      // Player: load own logs (no days limit)
      const supabase = (await import('@/template')).getSupabaseClient();
      const { data } = await supabase
        .from('academy_training_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('academy_id', academyId)
        .order('log_date', { ascending: false });
      setLogs(data || []);
    }
    setLoading(false);
  }, [user, academyId, isCoach]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = async (logId: string) => {
    setDeletingId(logId);
    await academyService.deleteLog(logId);
    setDeletingId(null);
    setLogs(prev => prev.filter(l => l.id !== logId));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Training History</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isCoach ? 'Academy Training Logs' : 'Training History'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="history" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySubtitle}>{isCoach ? 'No training sessions logged by any player yet' : 'Start logging your training sessions'}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{logs.length} sessions{isCoach ? ' across all players' : ' — tap delete to remove'}</Text>
            {logs.map(log => (
              <View key={log.id} style={styles.logCard}>
                <View style={[styles.intensityStripe, { backgroundColor: getIntensityColor(log.intensity) }]} />
                <View style={styles.logContent}>
                  <View style={styles.logTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logType}>{log.session_type}</Text>
                      {isCoach && log.user_profiles && (
                        <Text style={styles.logPlayerName}>
                          {log.user_profiles.full_name || log.user_profiles.username || log.user_profiles.email?.split('@')[0] || 'Player'}
                        </Text>
                      )}
                      <Text style={styles.logDate}>{log.log_date}</Text>
                    </View>
                    <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(log.intensity) + '20' }]}>
                      <Text style={[styles.intensityText, { color: getIntensityColor(log.intensity) }]}>
                        {log.intensity}/10
                      </Text>
                    </View>
                    {!isCoach && (
                      deletingId === log.id ? (
                        <ActivityIndicator size="small" color={colors.error} style={{ marginLeft: spacing.sm }} />
                      ) : (
                        <Pressable style={styles.deleteBtn} onPress={() => handleDelete(log.id)} hitSlop={8}>
                          <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                        </Pressable>
                      )
                    )}
                  </View>
                  <View style={styles.logStats}>
                    <View style={styles.logStat}>
                      <MaterialIcons name="timer" size={13} color={colors.textSecondary} />
                      <Text style={styles.logStatText}>{log.duration_minutes}min</Text>
                    </View>
                    {log.balls_faced ? (
                      <View style={styles.logStat}>
                        <MaterialIcons name="sports-cricket" size={13} color={colors.technical} />
                        <Text style={[styles.logStatText, { color: colors.technical }]}>{log.balls_faced} faced</Text>
                      </View>
                    ) : null}
                    {log.runs_scored !== undefined && log.runs_scored !== null && log.runs_scored > 0 ? (
                      <View style={styles.logStat}>
                        <MaterialIcons name="trending-up" size={13} color={colors.success} />
                        <Text style={[styles.logStatText, { color: colors.success }]}>{log.runs_scored} runs</Text>
                      </View>
                    ) : null}
                    {log.balls_bowled ? (
                      <View style={styles.logStat}>
                        <MaterialIcons name="sports-cricket" size={13} color={colors.physical} />
                        <Text style={[styles.logStatText, { color: colors.physical }]}>{Math.floor(log.balls_bowled / 6)}.{log.balls_bowled % 6} ov</Text>
                      </View>
                    ) : null}
                    {log.wickets ? (
                      <View style={styles.logStat}>
                        <MaterialIcons name="star" size={13} color={colors.warning} />
                        <Text style={[styles.logStatText, { color: colors.warning }]}>{log.wickets}wkt</Text>
                      </View>
                    ) : null}
                    {log.catches ? (
                      <View style={styles.logStat}>
                        <MaterialIcons name="sports-handball" size={13} color={colors.tactical} />
                        <Text style={[styles.logStatText, { color: colors.tactical }]}>{log.catches} ct</Text>
                      </View>
                    ) : null}
                  </View>
                  {(log.technical_rating || log.effort_rating || log.fitness_rating) ? (
                    <View style={styles.ratingsRow}>
                      {log.technical_rating ? (
                        <Text style={[styles.ratingChip, { backgroundColor: colors.technical + '20', color: colors.technical }]}>
                          Tech {log.technical_rating}/5
                        </Text>
                      ) : null}
                      {log.effort_rating ? (
                        <Text style={[styles.ratingChip, { backgroundColor: colors.primary + '20', color: colors.primary }]}>
                          Effort {log.effort_rating}/5
                        </Text>
                      ) : null}
                      {log.fitness_rating ? (
                        <Text style={[styles.ratingChip, { backgroundColor: colors.physical + '20', color: colors.physical }]}>
                          Fitness {log.fitness_rating}/5
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {log.notes ? <Text style={styles.logNotes} numberOfLines={2}>{log.notes}</Text> : null}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 60 },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  logCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  intensityStripe: { width: 5 },
  logContent: { flex: 1, padding: spacing.md },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  logType: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
  logDate: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  logPlayerName: { fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 1 },
  intensityBadge: { paddingHorizontal: spacing.xs + 2, paddingVertical: 3, borderRadius: borderRadius.sm },
  intensityText: { fontSize: 11, fontWeight: '800' },
  deleteBtn: { padding: 4 },
  logStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 4 },
  logStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  logStatText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  ratingsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: 4 },
  ratingChip: { fontSize: 10, fontWeight: '700', paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: borderRadius.sm },
  logNotes: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.sm },
  emptyTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
