import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, AcademyTrainingLog } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return colors.success;
  if (intensity <= 6) return colors.warning;
  return colors.error;
}

export default function AcademyAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const academyId = params.academyId as string;

  const [logs, setLogs] = useState<AcademyTrainingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [memberInfo, setMemberInfo] = useState<{ display_name?: string; position: string } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [logsRes, memberRes] = await Promise.all([
      academyService.getMyLogs(user.id, academyId, 90),
      academyService.getMyAcademies(user.id),
    ]);
    setLogs(logsRes.data || []);
    const found = (memberRes.data || []).find(m => m.academy.id === academyId);
    if (found) {
      setMemberInfo({ display_name: found.member.display_name, position: found.member.position });
    }
    setLoading(false);
  }, [user, academyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleGenerateAI = async () => {
    if (!user || logs.length === 0) return;
    setAiLoading(true);
    const name = memberInfo?.display_name || user.username || 'Player';
    const position = memberInfo?.position || 'Batsman';
    const { data, error } = await academyService.getAIAnalytics(logs, name, position);
    setAiLoading(false);
    if (error) { showAlert('Error', error); return; }
    setAiReport(data || '');
  };

  // Aggregations
  const totalSessions = logs.length;
  const totalMinutes = logs.reduce((a, l) => a + l.duration_minutes, 0);
  const avgIntensity = totalSessions > 0
    ? (logs.reduce((a, l) => a + l.intensity, 0) / totalSessions).toFixed(1) : null;
  const totalBallsFaced = logs.reduce((a, l) => a + (l.balls_faced || 0), 0);
  const totalBallsBowled = logs.reduce((a, l) => a + (l.balls_bowled || 0), 0);
  const totalRuns = logs.reduce((a, l) => a + (l.runs_scored || 0), 0);
  const totalWickets = logs.reduce((a, l) => a + (l.wickets || 0), 0);
  const totalCatches = logs.reduce((a, l) => a + (l.catches || 0), 0);
  const avgTechnical = (() => {
    const vals = logs.map(l => l.technical_rating).filter(Boolean) as number[];
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  })();
  const avgEffort = (() => {
    const vals = logs.map(l => l.effort_rating).filter(Boolean) as number[];
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  })();
  const avgFitness = (() => {
    const vals = logs.map(l => l.fitness_rating).filter(Boolean) as number[];
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  })();

  // Sessions per week breakdown (last 8 weeks)
  const weeklyData = (() => {
    const weeks: { label: string; count: number; avgIntensity: number }[] = [];
    const today = new Date();
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - w * 7 - 6);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - w * 7);
      const weekLogs = logs.filter(l => {
        const d = new Date(l.log_date);
        return d >= weekStart && d <= weekEnd;
      });
      const weekLabel = `W${8 - w}`;
      weeks.push({
        label: weekLabel,
        count: weekLogs.length,
        avgIntensity: weekLogs.length > 0 ? weekLogs.reduce((a, l) => a + l.intensity, 0) / weekLogs.length : 0,
      });
    }
    return weeks;
  })();

  const maxWeekCount = Math.max(...weeklyData.map(w => w.count), 1);

  // Session type breakdown
  const sessionTypes: Record<string, number> = {};
  logs.forEach(l => { sessionTypes[l.session_type] = (sessionTypes[l.session_type] || 0) + 1; });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>My Analytics</Text>
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
        <Text style={styles.headerTitle}>My Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {totalSessions === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="insights" size={72} color={colors.border} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>Log your training sessions to see your performance analytics here.</Text>
          </View>
        ) : (
          <>
            {/* Header stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialIcons name="event" size={20} color={colors.primary} />
                <Text style={styles.statVal}>{totalSessions}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialIcons name="timer" size={20} color={colors.mental} />
                <Text style={styles.statVal}>{Math.round(totalMinutes / 60)}h</Text>
                <Text style={styles.statLabel}>Total Time</Text>
              </View>
              {totalBallsFaced > 0 && (
                <View style={styles.statCard}>
                  <MaterialIcons name="sports-cricket" size={20} color={colors.technical} />
                  <Text style={styles.statVal}>{totalBallsFaced}</Text>
                  <Text style={styles.statLabel}>Balls Faced</Text>
                </View>
              )}
              {totalBallsBowled > 0 && (
                <View style={styles.statCard}>
                  <MaterialIcons name="sports-cricket" size={20} color={colors.physical} />
                  <Text style={styles.statVal}>{Math.floor(totalBallsBowled / 6)}.{totalBallsBowled % 6}</Text>
                  <Text style={styles.statLabel}>Overs Bowled</Text>
                </View>
              )}
              {totalRuns > 0 && (
                <View style={styles.statCard}>
                  <MaterialIcons name="trending-up" size={20} color={colors.success} />
                  <Text style={styles.statVal}>{totalRuns}</Text>
                  <Text style={styles.statLabel}>Runs Scored</Text>
                </View>
              )}
              {totalWickets > 0 && (
                <View style={styles.statCard}>
                  <MaterialIcons name="star" size={20} color={colors.warning} />
                  <Text style={styles.statVal}>{totalWickets}</Text>
                  <Text style={styles.statLabel}>Wickets</Text>
                </View>
              )}
              {totalCatches > 0 && (
                <View style={styles.statCard}>
                  <MaterialIcons name="sports-handball" size={20} color={colors.tactical} />
                  <Text style={styles.statVal}>{totalCatches}</Text>
                  <Text style={styles.statLabel}>Catches</Text>
                </View>
              )}
              {avgIntensity && (
                <View style={styles.statCard}>
                  <MaterialIcons name="flash-on" size={20} color={getIntensityColor(parseFloat(avgIntensity))} />
                  <Text style={[styles.statVal, { color: getIntensityColor(parseFloat(avgIntensity)) }]}>{avgIntensity}</Text>
                  <Text style={styles.statLabel}>Avg Intensity</Text>
                </View>
              )}
            </View>

            {/* Self-assessment averages */}
            {(avgTechnical || avgEffort || avgFitness) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Self-Assessment Averages</Text>
                {avgTechnical && (
                  <View style={styles.ratingRow}>
                    <MaterialIcons name="sports-cricket" size={16} color={colors.technical} />
                    <Text style={styles.ratingLabel}>Technical Quality</Text>
                    <View style={styles.ratingTrack}>
                      <View style={[styles.ratingFill, { width: `${(parseFloat(avgTechnical) / 5) * 100}%`, backgroundColor: colors.technical }]} />
                    </View>
                    <Text style={[styles.ratingVal, { color: colors.technical }]}>{avgTechnical}/5</Text>
                  </View>
                )}
                {avgEffort && (
                  <View style={styles.ratingRow}>
                    <MaterialIcons name="bolt" size={16} color={colors.primary} />
                    <Text style={styles.ratingLabel}>Effort & Focus</Text>
                    <View style={styles.ratingTrack}>
                      <View style={[styles.ratingFill, { width: `${(parseFloat(avgEffort) / 5) * 100}%`, backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={[styles.ratingVal, { color: colors.primary }]}>{avgEffort}/5</Text>
                  </View>
                )}
                {avgFitness && (
                  <View style={styles.ratingRow}>
                    <MaterialIcons name="fitness-center" size={16} color={colors.physical} />
                    <Text style={styles.ratingLabel}>Fitness Level</Text>
                    <View style={styles.ratingTrack}>
                      <View style={[styles.ratingFill, { width: `${(parseFloat(avgFitness) / 5) * 100}%`, backgroundColor: colors.physical }]} />
                    </View>
                    <Text style={[styles.ratingVal, { color: colors.physical }]}>{avgFitness}/5</Text>
                  </View>
                )}
              </View>
            )}

            {/* Weekly volume chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Session Volume</Text>
              <Text style={styles.cardSub}>Last 8 weeks</Text>
              <View style={styles.weekChart}>
                {weeklyData.map((w, i) => {
                  const barH = Math.max(4, Math.round((w.count / maxWeekCount) * 100));
                  return (
                    <View key={i} style={styles.weekBarCol}>
                      {w.count > 0 && <Text style={styles.weekBarCount}>{w.count}</Text>}
                      <View style={[styles.weekBar, { height: barH, backgroundColor: w.avgIntensity > 0 ? getIntensityColor(Math.round(w.avgIntensity)) : colors.border }]} />
                      <Text style={styles.weekBarLabel}>{w.label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>Low intensity</Text>
                <View style={[styles.legendDot, { backgroundColor: colors.warning, marginLeft: spacing.md }]} />
                <Text style={styles.legendText}>Moderate</Text>
                <View style={[styles.legendDot, { backgroundColor: colors.error, marginLeft: spacing.md }]} />
                <Text style={styles.legendText}>High</Text>
              </View>
            </View>

            {/* Session type breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Training Focus Breakdown</Text>
              {Object.entries(sessionTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <View key={type} style={styles.typeRow}>
                  <Text style={styles.typeLabel}>{type}</Text>
                  <View style={styles.typeTrack}>
                    <View style={[styles.typeFill, { width: `${(count / totalSessions) * 100}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={styles.typeCount}>{count}</Text>
                  <Text style={styles.typePct}>{Math.round((count / totalSessions) * 100)}%</Text>
                </View>
              ))}
            </View>

            {/* Intensity trend (last 10 sessions) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Intensity Trend</Text>
              <Text style={styles.cardSub}>Last {Math.min(10, logs.length)} sessions</Text>
              <View style={styles.intensityTrend}>
                {logs.slice(0, 10).reverse().map((log, i) => {
                  const h = Math.round((log.intensity / 10) * 80);
                  return (
                    <View key={i} style={styles.intensityBarCol}>
                      <Text style={{ fontSize: 9, color: colors.textSecondary }}>{log.intensity}</Text>
                      <View style={[styles.intensityBar, { height: h, backgroundColor: getIntensityColor(log.intensity) }]} />
                      <Text style={styles.intensityBarDate}>{log.log_date.slice(5)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* AI Report */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>AI Coaching Analysis</Text>
              </View>
              <Text style={styles.cardSub}>Powered by OnSpace AI</Text>
              {!aiReport ? (
                <Pressable style={[styles.aiBtn, aiLoading && { opacity: 0.6 }]} onPress={handleGenerateAI}>
                  {aiLoading ? (
                    <>
                      <ActivityIndicator color={colors.textLight} size="small" />
                      <Text style={styles.aiBtnText}>Analysing your training data...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="psychology" size={18} color={colors.textLight} />
                      <Text style={styles.aiBtnText}>Generate My Coaching Report</Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <>
                  <Text style={styles.aiReportText}>{aiReport}</Text>
                  <Pressable style={styles.regenerateBtn} onPress={handleGenerateAI}>
                    <MaterialIcons name="refresh" size={16} color={colors.primary} />
                    <Text style={styles.regenerateBtnText}>Regenerate</Text>
                  </Pressable>
                </>
              )}
            </View>
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
  scrollContent: { padding: spacing.md, paddingBottom: 80 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, minWidth: '28%', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border },
  statVal: { ...typography.h4, color: colors.text, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700', marginBottom: 2 },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  ratingLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '600', width: 110 },
  ratingTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  ratingFill: { height: 8, borderRadius: 4, minWidth: 4 },
  ratingVal: { fontSize: 12, fontWeight: '800', width: 32, textAlign: 'right' },
  weekChart: { flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 4 },
  weekBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  weekBar: { width: '100%', borderRadius: 3, minHeight: 4 },
  weekBarCount: { fontSize: 9, fontWeight: '700', color: colors.text },
  weekBarLabel: { fontSize: 9, color: colors.textSecondary },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.textSecondary },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  typeLabel: { width: 110, fontSize: 12, color: colors.text, fontWeight: '500' },
  typeTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  typeFill: { height: 8, borderRadius: 4, minWidth: 4 },
  typeCount: { fontSize: 12, fontWeight: '700', color: colors.text, width: 20, textAlign: 'right' },
  typePct: { fontSize: 11, color: colors.textSecondary, width: 32, textAlign: 'right' },
  intensityTrend: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 4 },
  intensityBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  intensityBar: { width: '100%', borderRadius: 3, minHeight: 4 },
  intensityBarDate: { fontSize: 8, color: colors.textSecondary },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.sm },
  aiBtnText: { ...typography.bodySmall, color: colors.textLight, fontWeight: '700' },
  aiReportText: { ...typography.bodySmall, color: colors.text, lineHeight: 20 },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: spacing.md },
  regenerateBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
