import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { academyService, AcademyTrainingLog } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - spacing.md * 2 - spacing.md * 2 - 2; // card padding

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ic(intensity: number): string {
  if (intensity <= 3) return colors.success;
  if (intensity <= 6) return colors.warning;
  return colors.error;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart({
  data, maxVal, barColor, labelKey, valueKey, height = 140,
}: {
  data: Array<Record<string, any>>;
  maxVal: number;
  barColor: string | ((item: any) => string);
  labelKey: string;
  valueKey: string;
  height?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
      {data.map((item, i) => {
        const val = item[valueKey] || 0;
        const barH = maxVal > 0 ? Math.max(4, Math.round((val / maxVal) * (height - 28))) : 4;
        const col = typeof barColor === 'function' ? barColor(item) : barColor;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
            {val > 0 ? <Text style={{ fontSize: 9, color: colors.text, fontWeight: '700' }}>{val}</Text> : null}
            <View style={{ width: '100%', height: barH, borderRadius: 3, backgroundColor: col, opacity: 0.85 }} />
            <Text style={{ fontSize: 9, color: colors.textSecondary, textAlign: 'center' }} numberOfLines={1}>{item[labelKey]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Horizontal progress row ──────────────────────────────────────────────────
function MetricBar({
  icon, iconColor, label, value, maxValue, unit, color,
}: {
  icon: string; iconColor: string; label: string;
  value: number; maxValue: number; unit?: string; color: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <View style={mb.row}>
      <MaterialIcons name={icon as any} size={15} color={iconColor} style={mb.icon} />
      <Text style={mb.label}>{label}</Text>
      <View style={mb.track}>
        <View style={[mb.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[mb.val, { color }]}>{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}{unit || ''}</Text>
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
function StatCard({ icon, iconColor, val, label }: { icon: string; iconColor: string; val: string | number; label: string }) {
  return (
    <View style={sc.card}>
      <MaterialIcons name={icon as any} size={20} color={iconColor} />
      <Text style={sc.val}>{val}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: { flex: 1, minWidth: '28%', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: colors.border },
  val: { ...typography.h4, color: colors.text, fontWeight: '800' },
  label: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 13 },
});

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
    const [logsRes, memberRes] = await Promise.all([
      academyService.getMyLogs(user.id, academyId, 90),
      academyService.getMyAcademies(user.id),
    ]);
    setLogs(logsRes.data || []);
    const found = (memberRes.data || []).find(m => m.academy.id === academyId);
    if (found) setMemberInfo({ display_name: found.member.display_name, position: found.member.position });
    setLoading(false);
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
          stats: {
            logs,
            memberName: memberInfo?.display_name || user.username || 'Player',
            answers: [],
          },
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
  const totalBallsFaced = logs.reduce((a, l) => a + (l.balls_faced || 0), 0);
  const totalBallsHit = logs.reduce((a, l) => a + (l.runs_scored || 0), 0); // successfully hit (stored as runs_scored in DB)
  const totalBallsBowled = logs.reduce((a, l) => a + (l.balls_bowled || 0), 0);
  const totalCatches = logs.reduce((a, l) => a + (l.catches || 0), 0);
  const totalFieldingChances = logs.reduce((a, l) => a + (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0), 0);

  // Weekly data — last 12 weeks
  const weeklyData = (() => {
    const today = new Date();
    return Array.from({ length: 12 }, (_, w) => {
      const idx = 11 - w;
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

  // Intensity distribution
  const intensityDist = [
    { label: 'Low\n1–3', count: logs.filter(l => l.intensity <= 3).length, color: colors.success },
    { label: 'Mod\n4–6', count: logs.filter(l => l.intensity >= 4 && l.intensity <= 6).length, color: colors.warning },
    { label: 'High\n7–10', count: logs.filter(l => l.intensity >= 7).length, color: colors.error },
  ];

  // Session type breakdown
  const typeMap: Record<string, number> = {};
  logs.forEach(l => { typeMap[l.session_type] = (typeMap[l.session_type] || 0) + 1; });
  const typeData = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

  // Last 10 sessions intensity trend
  const last10 = [...logs].slice(0, 10).reverse();

  // Self-assessment averages
  const techAvg = avg(logs.map(l => l.technical_rating || 0).filter(v => v > 0));

  // Streak calc
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
          <Pressable onPress={() => router.back()} style={styles.backBtn}><MaterialIcons name="arrow-back" size={24} color={colors.text} /></Pressable>
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
        <Pressable onPress={() => router.back()} style={styles.backBtn}><MaterialIcons name="arrow-back" size={24} color={colors.text} /></Pressable>
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
        {n === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="insights" size={80} color={colors.border} />
            <Text style={styles.emptyTitle}>No sessions logged yet</Text>
            <Text style={styles.emptySub}>Start logging your training to see analytics here.</Text>
          </View>
        ) : (
          <>
            {/* ── OVERVIEW TAB ───────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <>
                {/* Player card */}
                <View style={styles.playerCard}>
                  <View style={[styles.playerAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={styles.playerInitial}>{(memberInfo?.display_name || 'P').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName}>{memberInfo?.display_name || 'Player'}</Text>
                    <Text style={styles.playerPos}>{(memberInfo?.position && memberInfo.position !== 'Coach') ? memberInfo.position : 'Player'} · Last 90 days</Text>
                  </View>
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakNum}>{streak}</Text>
                    <Text style={styles.streakLabel}>day streak</Text>
                  </View>
                </View>

                {/* Key stats grid */}
                <View style={styles.statGrid}>
                  <StatCard icon="event" iconColor={colors.primary} val={n} label="Sessions" />
                  <StatCard icon="timer" iconColor={colors.mental} val={`${Math.round(totalMin / 60)}h ${totalMin % 60}m`} label="Total Time" />
                  <StatCard icon="flash-on" iconColor={ic(Math.round(avgInt))} val={avgInt.toFixed(1)} label="Avg Intensity" />
                  {totalBallsFaced > 0 && <StatCard icon="sports-cricket" iconColor={colors.technical} val={`${totalBallsFaced}/${totalBallsHit}`} label="Faced / Successful" />}
                  {totalBallsBowled > 0 && <StatCard icon="sports-cricket" iconColor={colors.physical} val={totalBallsBowled} label="Bowled" />}
                  {totalFieldingChances > 0 && <StatCard icon="sports-handball" iconColor={colors.tactical} val={`${totalFieldingChances}/${totalCatches}`} label="Chances / Successful" />}
                </View>

                {/* Intensity distribution */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Intensity Distribution</Text>
                  <Text style={styles.cardSub}>{n} sessions total</Text>
                  <View style={styles.distRow}>
                    {intensityDist.map((d, i) => {
                      const pct = n > 0 ? Math.round((d.count / n) * 100) : 0;
                      return (
                        <View key={i} style={styles.distBlock}>
                          <View style={styles.distBarWrap}>
                            <View style={[styles.distBar, { height: Math.max(8, Math.round((d.count / n) * 120)), backgroundColor: d.color }]} />
                          </View>
                          <Text style={[styles.distPct, { color: d.color }]}>{pct}%</Text>
                          <Text style={styles.distLabel}>{d.label}</Text>
                          <Text style={styles.distCount}>{d.count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Session types */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Training Focus</Text>
                  {typeData.map(([type, count]) => (
                    <MetricBar
                      key={type}
                      icon="sports"
                      iconColor={colors.primary}
                      label={type.replace(' — ', ' ')}
                      value={count}
                      maxValue={n}
                      color={colors.primary}
                    />
                  ))}
                </View>

                {/* Last 5 logs */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Recent Sessions</Text>
                  {logs.slice(0, 5).map((log, i) => (
                    <View key={log.id} style={[styles.recentRow, i === logs.slice(0, 5).length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[styles.recentDot, { backgroundColor: ic(log.intensity) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recentType}>{log.session_type}</Text>
                        <Text style={styles.recentMeta}>{log.log_date} · {log.duration_minutes}min</Text>
                        {(log.balls_faced || log.balls_bowled || log.catches) ? (
                          <Text style={styles.recentStats}>
                            {log.balls_faced ? `${log.balls_faced} faced / ${log.runs_scored || 0} successful` : ''}
                            {log.balls_bowled ? `${log.balls_faced ? ' · ' : ''}${log.balls_bowled} bowled` : ''}
                            {log.catches ? `${(log.balls_faced || log.balls_bowled) ? ' · ' : ''}${log.catches} catches` : ''}
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
                {/* Weekly sessions chart */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Weekly Session Count</Text>
                  <Text style={styles.cardSub}>Last 12 weeks</Text>
                  <BarChart
                    data={weeklyData}
                    maxVal={maxWeekCount}
                    barColor={(item) => item.avgInt > 0 ? ic(Math.round(item.avgInt)) : colors.border}
                    labelKey="label"
                    valueKey="count"
                    height={140}
                  />
                  <View style={styles.legendRow}>
                    {[{ c: colors.success, t: 'Low intensity' }, { c: colors.warning, t: 'Moderate' }, { c: colors.error, t: 'High' }].map(l => (
                      <View key={l.t} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: l.c }]} />
                        <Text style={styles.legendText}>{l.t}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Weekly minutes chart */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Weekly Training Minutes</Text>
                  <Text style={styles.cardSub}>Last 12 weeks</Text>
                  <BarChart
                    data={weeklyData}
                    maxVal={maxWeekMins}
                    barColor={colors.mental}
                    labelKey="label"
                    valueKey="mins"
                    height={140}
                  />
                </View>

                {/* Intensity trend (last 10 sessions) */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Intensity Trend</Text>
                  <Text style={styles.cardSub}>Last {last10.length} sessions (oldest → newest)</Text>
                  <BarChart
                    data={last10.map(l => ({ label: l.log_date.slice(5), val: l.intensity }))}
                    maxVal={10}
                    barColor={(item) => ic(item.val)}
                    labelKey="label"
                    valueKey="val"
                    height={120}
                  />
                  <View style={styles.trendSummary}>
                    <Text style={styles.trendLabel}>Avg: </Text>
                    <Text style={[styles.trendVal, { color: ic(Math.round(avgInt)) }]}>{avgInt.toFixed(1)}/10</Text>
                    <Text style={[styles.trendLabel, { marginLeft: spacing.md }]}>Highest: </Text>
                    <Text style={[styles.trendVal, { color: colors.error }]}>{Math.max(...logs.map(l => l.intensity))}</Text>
                    <Text style={[styles.trendLabel, { marginLeft: spacing.md }]}>Lowest: </Text>
                    <Text style={[styles.trendVal, { color: colors.success }]}>{Math.min(...logs.map(l => l.intensity))}</Text>
                  </View>
                </View>

                {/* Summary stats */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Volume Summary</Text>
                  <MetricBar icon="event" iconColor={colors.primary} label="Total Sessions" value={n} maxValue={90} color={colors.primary} />
                  <MetricBar icon="timer" iconColor={colors.mental} label="Total Hours" value={Math.round(totalMin / 60)} maxValue={100} color={colors.mental} />
                  <MetricBar icon="today" iconColor={colors.warning} label="Avg Session (min)" value={Math.round(totalMin / n)} maxValue={120} color={colors.warning} unit="m" />
                  <MetricBar icon="flash-on" iconColor={ic(Math.round(avgInt))} label="Avg Intensity" value={parseFloat(avgInt.toFixed(1))} maxValue={10} color={ic(Math.round(avgInt))} />
                </View>
              </>
            )}

            {/* ── SKILLS TAB ─────────────────────────────────────────────────── */}
            {activeTab === 'skills' && (
              <>
                {/* Batting stats */}
                {totalBallsFaced > 0 && (
                  <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colors.technical }]}>
                    <View style={styles.cardTitleRow}>
                      <MaterialIcons name="sports-cricket" size={18} color={colors.technical} />
                      <Text style={[styles.cardTitle, { color: colors.technical }]}>Batting Performance</Text>
                    </View>
                    <View style={styles.bigStatRow}>
                      <View style={styles.bigStat}>
                        <Text style={[styles.bigStatVal, { color: colors.technical }]}>{totalBallsFaced}</Text>
                        <Text style={styles.bigStatLabel}>Balls Faced</Text>
                      </View>
                      <View style={styles.bigStat}>
                        <Text style={[styles.bigStatVal, { color: colors.success }]}>{totalBallsHit}</Text>
                        <Text style={styles.bigStatLabel}>Successfully Hit</Text>
                      </View>
                    </View>

                    {/* Per-session batting trend */}
                    {logs.some(l => l.balls_faced) && (
                      <>
                        <Text style={styles.trendSubTitle}>Balls Faced Per Session</Text>
                        <BarChart
                          data={logs.filter(l => l.balls_faced).slice(0, 10).reverse().map(l => ({ label: l.log_date.slice(5), val: l.balls_faced || 0 }))}
                          maxVal={Math.max(...logs.map(l => l.balls_faced || 0), 1)}
                          barColor={colors.technical}
                          labelKey="label"
                          valueKey="val"
                          height={100}
                        />
                      </>
                    )}
                    {logs.some(l => l.runs_scored) && (
                      <>
                        <Text style={[styles.trendSubTitle, { marginTop: spacing.md }]}>Successfully Hit Per Session</Text>
                        <BarChart
                          data={logs.filter(l => (l.runs_scored || 0) >= 0).slice(0, 10).reverse().map(l => ({ label: l.log_date.slice(5), val: l.runs_scored || 0 }))}
                          maxVal={Math.max(...logs.map(l => l.runs_scored || 0), 1)}
                          barColor={colors.success}
                          labelKey="label"
                          valueKey="val"
                          height={100}
                        />
                      </>
                    )}
                  </View>
                )}

                {/* Bowling stats */}
                {totalBallsBowled > 0 && (() => {
                  const totalSuccessfulBowl = logs.reduce((a, l) => a + (l.wickets || 0), 0);
                  return (
                    <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colors.physical }]}>
                      <View style={styles.cardTitleRow}>
                        <MaterialIcons name="sports-cricket" size={18} color={colors.physical} />
                        <Text style={[styles.cardTitle, { color: colors.physical }]}>Bowling Performance</Text>
                      </View>
                      <View style={styles.bigStatRow}>
                        <View style={styles.bigStat}>
                          <Text style={[styles.bigStatVal, { color: colors.physical }]}>{totalBallsBowled}</Text>
                          <Text style={styles.bigStatLabel}>Balls Bowled</Text>
                        </View>
                        <View style={styles.bigStat}>
                          <Text style={[styles.bigStatVal, { color: colors.success }]}>{totalSuccessfulBowl}</Text>
                          <Text style={styles.bigStatLabel}>Successfully Bowled</Text>
                        </View>
                      </View>
                      {logs.some(l => l.balls_bowled) && (
                        <>
                          <Text style={styles.trendSubTitle}>Balls Bowled Per Session</Text>
                          <BarChart
                            data={logs.filter(l => l.balls_bowled).slice(0, 10).reverse().map(l => ({ label: l.log_date.slice(5), val: l.balls_bowled || 0 }))}
                            maxVal={Math.max(...logs.map(l => l.balls_bowled || 0), 1)}
                            barColor={colors.physical}
                            labelKey="label"
                            valueKey="val"
                            height={100}
                          />
                        </>
                      )}
                      {logs.some(l => l.wickets) && (
                        <>
                          <Text style={[styles.trendSubTitle, { marginTop: spacing.md }]}>Successfully Bowled Per Session</Text>
                          <BarChart
                            data={logs.filter(l => (l.wickets || 0) >= 0).slice(0, 10).reverse().map(l => ({ label: l.log_date.slice(5), val: l.wickets || 0 }))}
                            maxVal={Math.max(...logs.map(l => l.wickets || 0), 1)}
                            barColor={colors.success}
                            labelKey="label"
                            valueKey="val"
                            height={100}
                          />
                        </>
                      )}
                    </View>
                  );
                })()}

                {/* Fielding stats */}
                {totalFieldingChances > 0 && (
                  <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: colors.tactical }]}>
                    <View style={styles.cardTitleRow}>
                      <MaterialIcons name="sports-handball" size={18} color={colors.tactical} />
                      <Text style={[styles.cardTitle, { color: colors.tactical }]}>Catching</Text>
                    </View>
                    <View style={styles.bigStatRow}>
                      <View style={styles.bigStat}>
                        <Text style={[styles.bigStatVal, { color: colors.textSecondary }]}>{totalFieldingChances}</Text>
                        <Text style={styles.bigStatLabel}>Chances</Text>
                      </View>
                      <View style={styles.bigStat}>
                        <Text style={[styles.bigStatVal, { color: colors.tactical }]}>{totalCatches}</Text>
                        <Text style={styles.bigStatLabel}>Catches Taken</Text>
                      </View>
                    </View>
                    {logs.some(l => (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0) > 0) && (
                      <>
                        <Text style={styles.trendSubTitle}>Chances Per Session</Text>
                        <BarChart
                          data={logs.filter(l => (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0) > 0).slice(0, 10).reverse().map(l => ({ label: l.log_date.slice(5), val: (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0) }))}
                          maxVal={Math.max(...logs.map(l => (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0)), 1)}
                          barColor={colors.textSecondary}
                          labelKey="label"
                          valueKey="val"
                          height={100}
                        />
                        <Text style={[styles.trendSubTitle, { marginTop: spacing.md }]}>Catches Taken Per Session</Text>
                        <BarChart
                          data={logs.filter(l => (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0) > 0).slice(0, 10).reverse().map(l => ({ label: l.log_date.slice(5), val: l.catches || 0 }))}
                          maxVal={Math.max(...logs.map(l => l.catches || 0), 1)}
                          barColor={colors.tactical}
                          labelKey="label"
                          valueKey="val"
                          height={100}
                        />
                      </>
                    )}
                  </View>
                )}

                {/* If no skill data logged */}
                {totalBallsFaced === 0 && totalBallsBowled === 0 && totalFieldingChances === 0 && (
                  <View style={styles.emptySkills}>
                    <MaterialIcons name="sports-cricket" size={48} color={colors.border} />
                    <Text style={styles.emptySkillsText}>No stats logged yet</Text>
                    <Text style={styles.emptySkillsSub}>When you log balls faced, bowled or catches, your skill charts will appear here.</Text>
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
                    <MaterialIcons name="psychology" size={48} color={colors.primary + '60'} />
                    <Text style={styles.aiPromptTitle}>Ready to analyse your training</Text>
                    <Text style={styles.aiPromptSub}>
                      Based on your last {n} sessions, the AI will identify your strengths, weaknesses, training load, and give you a personalised 2-week plan.
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
  tabScroll: { maxHeight: 50, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabContent: { flexDirection: 'row', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, marginRight: spacing.xs },
  tabActive: { backgroundColor: colors.primary + '15' },
  tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  emptySub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptySkills: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptySkillsText: { ...typography.body, color: colors.text, fontWeight: '700' },
  emptySkillsSub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  playerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  playerAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  playerInitial: { fontSize: 20, fontWeight: '800', color: colors.primary },
  playerName: { ...typography.body, color: colors.text, fontWeight: '700' },
  playerPos: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  streakBadge: { alignItems: 'center', backgroundColor: colors.primary + '15', borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  streakNum: { ...typography.h4, color: colors.primary, fontWeight: '800' },
  streakLabel: { fontSize: 9, color: colors.primary, fontWeight: '600' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700', marginBottom: 2 },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },

  distRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160 },
  distBlock: { flex: 1, alignItems: 'center', gap: 4 },
  distBarWrap: { width: '60%', height: 120, justifyContent: 'flex-end' },
  distBar: { width: '100%', borderRadius: 4, minHeight: 8 },
  distPct: { fontSize: 16, fontWeight: '800' },
  distLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  distCount: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: colors.textSecondary },

  trendSummary: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  trendLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  trendVal: { fontSize: 13, fontWeight: '800' },
  trendSubTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.sm },

  bigStatRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  bigStat: { alignItems: 'center', gap: 2 },
  bigStatVal: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  bigStatLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },

  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  recentDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  recentType: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  recentMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  recentStats: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 1 },
  recentIntBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: borderRadius.sm },
  recentIntText: { fontSize: 11, fontWeight: '800' },

  aiPromptArea: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  aiPromptTitle: { ...typography.h4, color: colors.text, fontWeight: '700', textAlign: 'center' },
  aiPromptSub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md, width: '100%', justifyContent: 'center' },
  aiBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
  aiReportBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginVertical: spacing.sm },
  aiReportText: { ...typography.bodySmall, color: colors.text, lineHeight: 22 },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: spacing.xs },
  regenerateText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
