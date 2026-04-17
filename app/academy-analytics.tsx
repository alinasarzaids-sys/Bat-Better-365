import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { academyService, AcademyTrainingLog } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

function ic(intensity: number): string {
  if (intensity <= 3) return colors.success;
  if (intensity <= 6) return colors.warning;
  return colors.error;
}
function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// ─── Improved Bar Chart ────────────────────────────────────────────────────────
function BarChart({
  data, maxVal, barColor, labelKey, valueKey, height = 130,
}: {
  data: Array<Record<string, any>>;
  maxVal: number;
  barColor: string | ((item: any) => string);
  labelKey: string;
  valueKey: string;
  height?: number;
}) {
  const BAR_AREA = height - 32;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 3 }}>
      {data.map((item, i) => {
        const val = item[valueKey] || 0;
        const barH = maxVal > 0 ? Math.max(4, Math.round((val / maxVal) * BAR_AREA)) : 4;
        const col = typeof barColor === 'function' ? barColor(item) : barColor;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
            {val > 0 ? (
              <Text style={{ fontSize: 8, color: colors.text, fontWeight: '700' }}>{val}</Text>
            ) : null}
            <View style={{ width: '80%', height: barH, borderRadius: 4, backgroundColor: col }} />
            <Text style={{ fontSize: 8, color: colors.textSecondary, textAlign: 'center' }} numberOfLines={1}>
              {item[labelKey]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Stacked Success Bar (Faced vs Hit) ───────────────────────────────────────
function SuccessBar({
  name, total, success, totalMax, color,
}: { name: string; total: number; success: number; totalMax: number; color: string }) {
  const outerPct = totalMax > 0 ? Math.max(4, (total / totalMax) * 100) : 4;
  const innerPct = total > 0 ? Math.min((success / total) * 100, 100) : 0;
  const pctLabel = total > 0 ? Math.round((success / total) * 100) : 0;
  return (
    <View style={sb.row}>
      <Text style={sb.name} numberOfLines={1}>{name}</Text>
      <View style={sb.trackWrap}>
        <View style={[sb.outer, { width: `${outerPct}%`, backgroundColor: color + '28' }]}>
          <View style={[sb.inner, { width: `${innerPct}%`, backgroundColor: color }]} />
        </View>
        <Text style={sb.meta}>{success}/{total}</Text>
      </View>
      <Text style={[sb.pct, { color }]}>{pctLabel}%</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 10 },
  name: { width: 68, fontSize: 11, color: colors.text, fontWeight: '600' },
  trackWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  outer: { height: 12, borderRadius: 6, overflow: 'hidden', minWidth: 8 },
  inner: { height: '100%', borderRadius: 6 },
  meta: { fontSize: 10, color: colors.textSecondary, fontWeight: '500', minWidth: 36 },
  pct: { fontSize: 12, fontWeight: '800', width: 36, textAlign: 'right' },
});

// ─── Metric Bar ───────────────────────────────────────────────────────────────
function MetricBar({
  icon, iconColor, label, value, maxValue, unit, color,
}: {
  icon: string; iconColor: string; label: string;
  value: number; maxValue: number; unit?: string; color: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <View style={mb.row}>
      <MaterialIcons name={icon as any} size={14} color={iconColor} style={mb.icon} />
      <Text style={mb.label}>{label}</Text>
      <View style={mb.track}>
        <View style={[mb.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[mb.val, { color }]}>
        {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}{unit || ''}
      </Text>
    </View>
  );
}
const mb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 10 },
  icon: { flexShrink: 0 },
  label: { width: 110, fontSize: 12, color: colors.text, fontWeight: '500' },
  track: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, minWidth: 4 },
  val: { fontSize: 12, fontWeight: '800', width: 44, textAlign: 'right' },
});

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, iconColor, val, label, sub,
}: { icon: string; iconColor: string; val: string | number; label: string; sub?: string }) {
  return (
    <View style={sc.card}>
      <MaterialIcons name={icon as any} size={22} color={iconColor} />
      <Text style={[sc.val, { color: iconColor }]}>{val}</Text>
      <Text style={sc.label}>{label}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    flex: 1, minWidth: '44%', backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center', gap: 3,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  val: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  sub: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: -2 },
});

// ─── Promo Demo Data ───────────────────────────────────────────────────────────
function buildDemoLogs(userId: string, academyId: string): AcademyTrainingLog[] {
  const today = new Date();
  const d = (offset: number): string => {
    const dt = new Date(today);
    dt.setDate(today.getDate() - offset);
    return dt.toISOString().split('T')[0];
  };

  return [
    // Week 1
    {
      id: 'dl-1', user_id: userId, academy_id: academyId,
      log_date: d(0), session_type: 'Batting', duration_minutes: 75, intensity: 9,
      balls_faced: 180, runs_scored: 134, balls_bowled: 0, overs_bowled: 0,
      wickets: 0, runs_conceded: 0, catches: 2, run_outs: 1, stumpings: 0,
      technical_rating: 5, effort_rating: 5, fitness_rating: 4,
      notes: 'Cover drives clicking. Personal best middle rate.', created_at: d(0),
    },
    {
      id: 'dl-2', user_id: userId, academy_id: academyId,
      log_date: d(1), session_type: 'Bowling', duration_minutes: 55, intensity: 7,
      balls_faced: 0, runs_scored: 0, balls_bowled: 48, overs_bowled: 8,
      wickets: 4, runs_conceded: 32, catches: 1, run_outs: 0, stumpings: 0,
      technical_rating: 4, effort_rating: 5, fitness_rating: 3,
      notes: '4 wickets in the spell drill.', created_at: d(1),
    },
    {
      id: 'dl-3', user_id: userId, academy_id: academyId,
      log_date: d(2), session_type: 'Fitness', duration_minutes: 60, intensity: 8,
      balls_faced: 0, runs_scored: 0, balls_bowled: 0, overs_bowled: 0,
      wickets: 0, runs_conceded: 0, catches: 0, run_outs: 0, stumpings: 0,
      technical_rating: 0, effort_rating: 5, fitness_rating: 5,
      notes: 'Leg day + core circuit. Felt strong.', created_at: d(2),
    },
    {
      id: 'dl-4', user_id: userId, academy_id: academyId,
      log_date: d(4), session_type: 'Batting', duration_minutes: 70, intensity: 8,
      balls_faced: 150, runs_scored: 105, balls_bowled: 0, overs_bowled: 0,
      wickets: 0, runs_conceded: 0, catches: 3, run_outs: 0, stumpings: 1,
      technical_rating: 4, effort_rating: 5, fitness_rating: 4,
      notes: 'Pull shots working well. Reaction speed felt sharp.', created_at: d(4),
    },
    // Week 2
    {
      id: 'dl-5', user_id: userId, academy_id: academyId,
      log_date: d(7), session_type: 'Batting', duration_minutes: 65, intensity: 7,
      balls_faced: 120, runs_scored: 78, balls_bowled: 0, overs_bowled: 0,
      wickets: 0, runs_conceded: 0, catches: 1, run_outs: 1, stumpings: 0,
      technical_rating: 4, effort_rating: 4, fitness_rating: 3,
      notes: 'Solid session. Defence was tight.', created_at: d(7),
    },
    {
      id: 'dl-6', user_id: userId, academy_id: academyId,
      log_date: d(9), session_type: 'Bowling', duration_minutes: 50, intensity: 6,
      balls_faced: 0, runs_scored: 0, balls_bowled: 36, overs_bowled: 6,
      wickets: 3, runs_conceded: 24, catches: 2, run_outs: 0, stumpings: 0,
      technical_rating: 4, effort_rating: 4, fitness_rating: 3,
      notes: 'Good line and length throughout.', created_at: d(9),
    },
    {
      id: 'dl-7', user_id: userId, academy_id: academyId,
      log_date: d(11), session_type: 'Fitness', duration_minutes: 50, intensity: 7,
      balls_faced: 0, runs_scored: 0, balls_bowled: 0, overs_bowled: 0,
      wickets: 0, runs_conceded: 0, catches: 0, run_outs: 0, stumpings: 0,
      technical_rating: 0, effort_rating: 4, fitness_rating: 4,
      notes: 'Upper body and cardio.', created_at: d(11),
    },
    // Week 3
    {
      id: 'dl-8', user_id: userId, academy_id: academyId,
      log_date: d(14), session_type: 'Batting', duration_minutes: 80, intensity: 9,
      balls_faced: 200, runs_scored: 148, balls_bowled: 0, overs_bowled: 0,
      wickets: 0, runs_conceded: 0, catches: 2, run_outs: 2, stumpings: 0,
      technical_rating: 5, effort_rating: 5, fitness_rating: 5,
      notes: '200-ball session. Peak confidence.', created_at: d(14),
    },
    {
      id: 'dl-9', user_id: userId, academy_id: academyId,
      log_date: d(17), session_type: 'Bowling', duration_minutes: 45, intensity: 6,
      balls_faced: 0, runs_scored: 0, balls_bowled: 30, overs_bowled: 5,
      wickets: 2, runs_conceded: 22, catches: 1, run_outs: 0, stumpings: 0,
      technical_rating: 3, effort_rating: 4, fitness_rating: 3,
      notes: 'Focus on slower balls and variations.', created_at: d(17),
    },
    {
      id: 'dl-10', user_id: userId, academy_id: academyId,
      log_date: d(21), session_type: 'Batting', duration_minutes: 60, intensity: 7,
      balls_faced: 130, runs_scored: 88, balls_bowled: 0, overs_bowled: 0,
      wickets: 0, runs_conceded: 0, catches: 2, run_outs: 1, stumpings: 0,
      technical_rating: 4, effort_rating: 4, fitness_rating: 3,
      notes: 'First session of the week. Getting back into rhythm.', created_at: d(21),
    },
  ];
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<'overview' | 'volume' | 'skills' | 'ai'>('overview');

  const load = useCallback(async () => {
    if (!user) return;

    // ── PROMO DEMO DATA ───────────────────────────────────────────────────────
    setLogs(buildDemoLogs(user.id, academyId));
    setMemberInfo({ display_name: 'James Mitchell', position: 'Batsman' });
    setLoading(false);
    // ── END PROMO DATA ────────────────────────────────────────────────────────
  }, [user, academyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleGenerateAI = async () => {
    if (!user || logs.length === 0) return;
    setAiLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('academy-ai-questions', {
        body: {
          mode: 'analysis',
          position: memberInfo?.position || 'Batsman',
          sessionType: '',
          stats: { logs, memberName: memberInfo?.display_name || 'Player', answers: [] },
        },
      });
      if (!error && data?.report) {
        setAiReport(data.report);
      } else {
        showAlert('Error', 'Could not generate report. Try again.');
      }
    } catch {
      showAlert('Error', 'AI service unavailable.');
    }
    setAiLoading(false);
  };

  // ── Aggregations ────────────────────────────────────────────────────────────
  const n = logs.length;
  const totalMin = logs.reduce((a, l) => a + l.duration_minutes, 0);
  const avgInt = n > 0 ? avg(logs.map(l => l.intensity)) : 0;

  const battingLogs = logs.filter(l => (l.balls_faced || 0) > 0);
  const bowlingLogs = logs.filter(l => (l.balls_bowled || 0) > 0);
  const fitnessLogs = logs.filter(l => l.session_type === 'Fitness');

  const totalBallsFaced = logs.reduce((a, l) => a + (l.balls_faced || 0), 0);
  const totalBallsHit = logs.reduce((a, l) => a + (l.runs_scored || 0), 0);
  const totalBallsBowled = logs.reduce((a, l) => a + (l.balls_bowled || 0), 0);
  const totalWickets = logs.reduce((a, l) => a + (l.wickets || 0), 0);
  const totalCatches = logs.reduce((a, l) => a + (l.catches || 0), 0);
  const totalFieldingChances = logs.reduce((a, l) => a + (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0), 0);

  const battingPct = totalBallsFaced > 0 ? Math.round((totalBallsHit / totalBallsFaced) * 100) : 0;
  const bowlingPct = totalBallsBowled > 0 ? Math.round((totalWickets / totalBallsBowled) * 100) : 0;
  const fieldingPct = totalFieldingChances > 0 ? Math.round((totalCatches / totalFieldingChances) * 100) : 0;

  // Weekly data — last 8 weeks
  const weeklyData = (() => {
    const today = new Date();
    return Array.from({ length: 8 }, (_, w) => {
      const idx = 7 - w;
      const end = new Date(today);
      end.setDate(today.getDate() - idx * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      const wLogs = logs.filter(l => {
        const d = new Date(l.log_date);
        return d >= start && d <= end;
      });
      return {
        label: `W${w + 1}`,
        count: wLogs.length,
        mins: wLogs.reduce((a, l) => a + l.duration_minutes, 0),
        avgInt: wLogs.length > 0 ? avg(wLogs.map(l => l.intensity)) : 0,
      };
    });
  })();

  const maxWeekCount = Math.max(...weeklyData.map(w => w.count), 1);
  const maxWeekMins = Math.max(...weeklyData.map(w => w.mins), 1);

  const intensityDist = [
    { label: 'Low\n1–3', count: logs.filter(l => l.intensity <= 3).length, color: colors.success },
    { label: 'Mod\n4–6', count: logs.filter(l => l.intensity >= 4 && l.intensity <= 6).length, color: colors.warning },
    { label: 'High\n7–10', count: logs.filter(l => l.intensity >= 7).length, color: colors.error },
  ];

  const typeMap: Record<string, number> = {};
  logs.forEach(l => { typeMap[l.session_type] = (typeMap[l.session_type] || 0) + 1; });
  const typeData = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

  const last10 = [...logs].slice(0, 10).reverse();

  const streak = (() => {
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      if (logs.some(l => l.log_date === dStr)) s++;
      else if (i > 0) break;
    }
    return s;
  })();

  const TABS = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'volume', label: 'Volume', icon: 'bar-chart' },
    { key: 'skills', label: 'Skills', icon: 'sports-cricket' },
    { key: 'ai', label: 'AI Report', icon: 'psychology' },
  ] as const;

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

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {TABS.map(tab => (
          <Pressable key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
            <MaterialIcons name={tab.icon as any} size={15} color={activeTab === tab.key ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── OVERVIEW TAB ───────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Player Hero Card */}
            <View style={styles.heroCard}>
              <View style={[styles.playerAvatar, { backgroundColor: colors.primary + '20' }]}>
                <Text style={styles.playerInitial}>{(memberInfo?.display_name || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>{memberInfo?.display_name || 'Player'}</Text>
                <Text style={styles.playerPos}>
                  {memberInfo?.position || 'Player'} · Last 90 days
                </Text>
              </View>
              <View style={styles.streakBadge}>
                <Text style={styles.streakNum}>{streak}</Text>
                <Text style={styles.streakLabel}>day streak</Text>
              </View>
            </View>

            {/* Key Stats 2x3 Grid */}
            <View style={styles.statGrid}>
              <StatCard icon="event" iconColor={colors.primary} val={n} label="Sessions" />
              <StatCard icon="timer" iconColor={colors.mental}
                val={`${Math.round(totalMin / 60)}h ${totalMin % 60}m`} label="Total Time" />
              <StatCard icon="flash-on" iconColor={ic(Math.round(avgInt))}
                val={avgInt.toFixed(1)} label="Avg Intensity" />
              {totalBallsFaced > 0 && (
                <StatCard icon="sports-cricket" iconColor={colors.technical}
                  val={`${battingPct}%`} label="Batting Success"
                  sub={`${totalBallsHit}/${totalBallsFaced} balls`} />
              )}
              {totalBallsBowled > 0 && (
                <StatCard icon="sports-cricket" iconColor={colors.physical}
                  val={`${bowlingPct}%`} label="Bowling Success"
                  sub={`${totalWickets} wkts / ${totalBallsBowled} bowled`} />
              )}
              {totalFieldingChances > 0 && (
                <StatCard icon="back-hand" iconColor={colors.tactical}
                  val={`${fieldingPct}%`} label="Fielding Success"
                  sub={`${totalCatches}/${totalFieldingChances} chances`} />
              )}
            </View>

            {/* Intensity Distribution */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Intensity Distribution</Text>
              <Text style={styles.cardSub}>{n} sessions total</Text>
              <View style={styles.distRow}>
                {intensityDist.map((d, i) => {
                  const pct = n > 0 ? Math.round((d.count / n) * 100) : 0;
                  const barH = n > 0 ? Math.max(8, Math.round((d.count / n) * 100)) : 8;
                  return (
                    <View key={i} style={styles.distBlock}>
                      <Text style={[styles.distPct, { color: d.color }]}>{pct}%</Text>
                      <View style={styles.distBarWrap}>
                        <View style={[styles.distBar, { height: barH, backgroundColor: d.color }]} />
                      </View>
                      <Text style={styles.distLabel}>{d.label}</Text>
                      <Text style={styles.distCount}>{d.count} sessions</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Training Focus */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Training Focus</Text>
              <Text style={styles.cardSub}>Session type breakdown</Text>
              {typeData.map(([type, count]) => {
                const typeColor = type === 'Batting' ? colors.technical
                  : type === 'Bowling' ? colors.physical
                  : type === 'Fitness' ? colors.success
                  : colors.primary;
                return (
                  <MetricBar
                    key={type}
                    icon="sports-cricket"
                    iconColor={typeColor}
                    label={type}
                    value={count}
                    maxValue={n}
                    color={typeColor}
                  />
                );
              })}
            </View>

            {/* Recent Sessions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Sessions</Text>
              {logs.slice(0, 5).map((log, i) => (
                <View key={log.id} style={[styles.recentRow, i === Math.min(logs.length, 5) - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.recentDot, { backgroundColor: ic(log.intensity) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentType}>{log.session_type}</Text>
                    <Text style={styles.recentMeta}>{log.log_date} · {log.duration_minutes}min</Text>
                    {(log.balls_faced || log.balls_bowled || log.catches) ? (
                      <Text style={styles.recentStats}>
                        {log.balls_faced ? `${log.balls_faced} faced / ${log.runs_scored || 0} hit` : ''}
                        {log.balls_bowled ? `${log.balls_faced ? ' · ' : ''}${log.balls_bowled} bowled / ${log.wickets || 0} wkts` : ''}
                        {log.catches ? ` · ${log.catches} catches` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.recentIntBadge, { backgroundColor: ic(log.intensity) + '25' }]}>
                    <Text style={[styles.recentIntText, { color: ic(log.intensity) }]}>{log.intensity}/10</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── VOLUME TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'volume' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Sessions</Text>
              <Text style={styles.cardSub}>Last 8 weeks — colour shows avg intensity</Text>
              <BarChart
                data={weeklyData}
                maxVal={maxWeekCount}
                barColor={(item) => item.avgInt > 0 ? ic(Math.round(item.avgInt)) : colors.border}
                labelKey="label"
                valueKey="count"
                height={130}
              />
              <View style={styles.legendRow}>
                {[{ c: colors.success, t: 'Low (1–3)' }, { c: colors.warning, t: 'Moderate (4–6)' }, { c: colors.error, t: 'High (7–10)' }].map(l => (
                  <View key={l.t} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: l.c }]} />
                    <Text style={styles.legendText}>{l.t}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Training Minutes</Text>
              <Text style={styles.cardSub}>Last 8 weeks</Text>
              <BarChart
                data={weeklyData}
                maxVal={maxWeekMins}
                barColor={colors.mental}
                labelKey="label"
                valueKey="mins"
                height={130}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Intensity Trend</Text>
              <Text style={styles.cardSub}>Last {last10.length} sessions · oldest → newest</Text>
              <BarChart
                data={last10.map(l => ({ label: l.log_date.slice(5), val: l.intensity }))}
                maxVal={10}
                barColor={(item) => ic(item.val)}
                labelKey="label"
                valueKey="val"
                height={120}
              />
              <View style={[styles.legendRow, { marginTop: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendText}>Average</Text>
                  <Text style={[styles.trendVal, { color: ic(Math.round(avgInt)) }]}>{avgInt.toFixed(1)}/10</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendText}>Highest</Text>
                  <Text style={[styles.trendVal, { color: colors.error }]}>{Math.max(...logs.map(l => l.intensity))}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendText}>Lowest</Text>
                  <Text style={[styles.trendVal, { color: colors.success }]}>{Math.min(...logs.map(l => l.intensity))}</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Volume Summary</Text>
              <MetricBar icon="event" iconColor={colors.primary} label="Total Sessions" value={n} maxValue={90} color={colors.primary} />
              <MetricBar icon="timer" iconColor={colors.mental} label="Total Hours" value={Math.round(totalMin / 60)} maxValue={60} color={colors.mental} />
              <MetricBar icon="today" iconColor={colors.warning} label="Avg Session" value={Math.round(totalMin / n)} maxValue={120} color={colors.warning} unit="m" />
              <MetricBar icon="flash-on" iconColor={ic(Math.round(avgInt))} label="Avg Intensity" value={parseFloat(avgInt.toFixed(1))} maxValue={10} color={ic(Math.round(avgInt))} />
            </View>
          </>
        )}

        {/* ── SKILLS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'skills' && (
          <>
            {/* Batting */}
            {totalBallsFaced > 0 && (
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colors.technical }]}>
                <View style={styles.cardTitleRow}>
                  <MaterialIcons name="sports-cricket" size={18} color={colors.technical} />
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.technical }]}>Batting Performance</Text>
                    <Text style={styles.cardSub}>Balls faced → successfully hit</Text>
                  </View>
                </View>

                {/* Summary big stats */}
                <View style={styles.bigStatRow}>
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.technical }]}>{totalBallsFaced}</Text>
                    <Text style={styles.bigStatLabel}>Balls Faced</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.success }]}>{totalBallsHit}</Text>
                    <Text style={styles.bigStatLabel}>Successfully Hit</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: battingPct >= 60 ? colors.success : battingPct >= 40 ? colors.warning : colors.error }]}>
                      {battingPct}%
                    </Text>
                    <Text style={styles.bigStatLabel}>Success Rate</Text>
                  </View>
                </View>

                {/* Per session stacked bars */}
                <Text style={styles.chartLabel}>Success Rate Per Session</Text>
                {battingLogs.slice(0, 8).reverse().map(l => {
                  const faced = l.balls_faced || 0;
                  const hit = l.runs_scored || 0;
                  return (
                    <SuccessBar
                      key={l.id}
                      name={l.log_date.slice(5)}
                      total={faced}
                      success={hit}
                      totalMax={Math.max(...battingLogs.map(b => b.balls_faced || 0), 1)}
                      color={colors.technical}
                    />
                  );
                })}

                {/* Balls faced trend */}
                <Text style={[styles.chartLabel, { marginTop: spacing.md }]}>Balls Faced Per Session</Text>
                <BarChart
                  data={battingLogs.slice(0, 8).reverse().map(l => ({ label: l.log_date.slice(5), val: l.balls_faced || 0 }))}
                  maxVal={Math.max(...battingLogs.map(l => l.balls_faced || 0), 1)}
                  barColor={colors.technical}
                  labelKey="label"
                  valueKey="val"
                  height={110}
                />
              </View>
            )}

            {/* Bowling */}
            {totalBallsBowled > 0 && (
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colors.physical }]}>
                <View style={styles.cardTitleRow}>
                  <MaterialIcons name="sports-cricket" size={18} color={colors.physical} />
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.physical }]}>Bowling Performance</Text>
                    <Text style={styles.cardSub}>Balls bowled → wickets taken</Text>
                  </View>
                </View>

                <View style={styles.bigStatRow}>
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.physical }]}>{totalBallsBowled}</Text>
                    <Text style={styles.bigStatLabel}>Balls Bowled</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.success }]}>{totalWickets}</Text>
                    <Text style={styles.bigStatLabel}>Wickets</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: bowlingPct >= 10 ? colors.success : colors.warning }]}>
                      {bowlingPct}%
                    </Text>
                    <Text style={styles.bigStatLabel}>Strike Rate</Text>
                  </View>
                </View>

                <Text style={styles.chartLabel}>Wickets Per Session</Text>
                {bowlingLogs.slice(0, 8).reverse().map(l => (
                  <SuccessBar
                    key={l.id}
                    name={l.log_date.slice(5)}
                    total={l.balls_bowled || 0}
                    success={l.wickets || 0}
                    totalMax={Math.max(...bowlingLogs.map(b => b.balls_bowled || 0), 1)}
                    color={colors.physical}
                  />
                ))}

                <Text style={[styles.chartLabel, { marginTop: spacing.md }]}>Balls Bowled Per Session</Text>
                <BarChart
                  data={bowlingLogs.slice(0, 8).reverse().map(l => ({ label: l.log_date.slice(5), val: l.balls_bowled || 0 }))}
                  maxVal={Math.max(...bowlingLogs.map(l => l.balls_bowled || 0), 1)}
                  barColor={colors.physical}
                  labelKey="label"
                  valueKey="val"
                  height={110}
                />
              </View>
            )}

            {/* Fielding */}
            {totalFieldingChances > 0 && (
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colors.tactical }]}>
                <View style={styles.cardTitleRow}>
                  <MaterialIcons name="back-hand" size={18} color={colors.tactical} />
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.tactical }]}>Fielding & Catching</Text>
                    <Text style={styles.cardSub}>Chances presented → catches taken</Text>
                  </View>
                </View>

                <View style={styles.bigStatRow}>
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.textSecondary }]}>{totalFieldingChances}</Text>
                    <Text style={styles.bigStatLabel}>Chances</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.tactical }]}>{totalCatches}</Text>
                    <Text style={styles.bigStatLabel}>Catches</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: fieldingPct >= 70 ? colors.success : colors.warning }]}>
                      {fieldingPct}%
                    </Text>
                    <Text style={styles.bigStatLabel}>Catch Rate</Text>
                  </View>
                </View>

                <Text style={styles.chartLabel}>Catches Per Session</Text>
                {logs.filter(l => (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0) > 0)
                  .slice(0, 8).reverse().map(l => (
                    <SuccessBar
                      key={l.id}
                      name={l.log_date.slice(5)}
                      total={(l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0)}
                      success={l.catches || 0}
                      totalMax={Math.max(...logs.map(l => (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0)), 1)}
                      color={colors.tactical}
                    />
                  ))}
              </View>
            )}

            {/* Fitness */}
            {fitnessLogs.length > 0 && (
              <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colors.success }]}>
                <View style={styles.cardTitleRow}>
                  <MaterialIcons name="fitness-center" size={18} color={colors.success} />
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.success }]}>Fitness Sessions</Text>
                    <Text style={styles.cardSub}>{fitnessLogs.length} sessions logged</Text>
                  </View>
                </View>
                <View style={styles.bigStatRow}>
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.success }]}>{fitnessLogs.length}</Text>
                    <Text style={styles.bigStatLabel}>Sessions</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: colors.primary }]}>
                      {Math.round(fitnessLogs.reduce((a, l) => a + l.duration_minutes, 0) / fitnessLogs.length)}m
                    </Text>
                    <Text style={styles.bigStatLabel}>Avg Duration</Text>
                  </View>
                  <View style={styles.bigStatDivider} />
                  <View style={styles.bigStat}>
                    <Text style={[styles.bigStatVal, { color: ic(Math.round(avg(fitnessLogs.map(l => l.intensity)))) }]}>
                      {avg(fitnessLogs.map(l => l.intensity)).toFixed(1)}
                    </Text>
                    <Text style={styles.bigStatLabel}>Avg Intensity</Text>
                  </View>
                </View>
                <Text style={styles.chartLabel}>Duration Per Session</Text>
                <BarChart
                  data={fitnessLogs.slice(0, 8).reverse().map(l => ({ label: l.log_date.slice(5), val: l.duration_minutes }))}
                  maxVal={Math.max(...fitnessLogs.map(l => l.duration_minutes), 1)}
                  barColor={colors.success}
                  labelKey="label"
                  valueKey="val"
                  height={100}
                />
              </View>
            )}
          </>
        )}

        {/* ── AI REPORT TAB ──────────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>AI Coaching Report</Text>
            </View>
            <Text style={styles.cardSub}>Personalised analysis powered by OnSpace AI</Text>

            {!aiReport ? (
              <View style={styles.aiPromptArea}>
                <MaterialIcons name="psychology" size={56} color={colors.primary + '50'} />
                <Text style={styles.aiPromptTitle}>Ready to analyse your training</Text>
                <Text style={styles.aiPromptSub}>
                  Based on your {n} sessions, AI will identify strengths, weaknesses, training load and give a personalised 2-week plan.
                </Text>
                <Pressable style={[styles.aiBtn, aiLoading && { opacity: 0.6 }]} onPress={handleGenerateAI}>
                  {aiLoading ? (
                    <>
                      <ActivityIndicator color={colors.textLight} size="small" />
                      <Text style={styles.aiBtnText}>Analysing {n} sessions...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="auto-awesome" size={18} color={colors.textLight} />
                      <Text style={styles.aiBtnText}>Generate My Coaching Report</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.aiReportBox}>
                  <Text style={styles.aiReportText}>{aiReport}</Text>
                </View>
                <Pressable style={styles.regenerateBtn} onPress={handleGenerateAI}>
                  {aiLoading ? <ActivityIndicator size="small" color={colors.primary} /> : (
                    <>
                      <MaterialIcons name="refresh" size={16} color={colors.primary} />
                      <Text style={styles.regenerateText}>Regenerate Report</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },

  tabScroll: { maxHeight: 50, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabContent: { flexDirection: 'row', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, marginRight: spacing.xs,
  },
  tabActive: { backgroundColor: colors.primary + '15' },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  playerAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  playerInitial: { fontSize: 22, fontWeight: '900', color: colors.primary },
  playerName: { ...typography.body, color: colors.text, fontWeight: '700' },
  playerPos: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  streakBadge: {
    alignItems: 'center', backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  streakNum: { ...typography.h4, color: colors.primary, fontWeight: '900' },
  streakLabel: { fontSize: 9, color: colors.primary, fontWeight: '700' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },

  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700', marginBottom: 2 },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  chartLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },

  distRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, marginTop: spacing.sm },
  distBlock: { flex: 1, alignItems: 'center', gap: 4 },
  distBarWrap: { width: '55%', height: 100, justifyContent: 'flex-end' },
  distBar: { width: '100%', borderRadius: 6, minHeight: 8 },
  distPct: { fontSize: 18, fontWeight: '900' },
  distLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  distCount: { fontSize: 9, color: colors.textSecondary, fontWeight: '600' },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.textSecondary },
  trendVal: { fontSize: 16, fontWeight: '800' },

  bigStatRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md },
  bigStat: { flex: 1, alignItems: 'center', gap: 2 },
  bigStatDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  bigStatVal: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  bigStatLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },

  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50',
  },
  recentDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  recentType: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  recentMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  recentStats: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 1 },
  recentIntBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: borderRadius.sm },
  recentIntText: { fontSize: 11, fontWeight: '800' },

  aiPromptArea: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  aiPromptTitle: { ...typography.h4, color: colors.text, fontWeight: '700', textAlign: 'center' },
  aiPromptSub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl, borderRadius: borderRadius.md,
    width: '100%', justifyContent: 'center',
  },
  aiBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
  aiReportBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginVertical: spacing.sm },
  aiReportText: { ...typography.bodySmall, color: colors.text, lineHeight: 22 },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: spacing.xs },
  regenerateText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
