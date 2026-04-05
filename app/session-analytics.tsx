import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 2 - spacing.lg * 2;

interface FreestyleSession {
  id: string;
  title: string;
  scheduled_date: string;
  duration_minutes: number;
  notes: string;
  status: string;
  completed_at: string;
  // Parsed from notes
  physicalRating?: number;
  mentalRating?: number;
  tacticalRating?: number;
  technicalRating?: number;
  ballsFaced?: number;
  focusArea?: string;
  sessionGoal?: string;
  trainingTypes?: string[];
  sessionNotes?: string;
}

interface LatestSession extends FreestyleSession {
  avgRating: number;
  strengths: string[];
  improvements: string[];
}

/** Parse the notes string from a freestyle session into structured data */
function parseSessionNotes(notes: string): Partial<FreestyleSession> {
  const result: Partial<FreestyleSession> = {};
  if (!notes) return result;

  const lines = notes.split('\n');
  for (const line of lines) {
    if (line.startsWith('Training Types:')) {
      result.trainingTypes = line.replace('Training Types:', '').trim().split(', ').filter(Boolean);
    } else if (line.startsWith('Focus Area:')) {
      result.focusArea = line.replace('Focus Area:', '').trim();
    } else if (line.startsWith('Session Goal:')) {
      result.sessionGoal = line.replace('Session Goal:', '').trim();
    } else if (line.startsWith('Balls Faced:')) {
      result.ballsFaced = parseInt(line.replace('Balls Faced:', '').trim()) || 0;
    } else if (line.startsWith('Physical:')) {
      result.physicalRating = parseInt(line.replace('Physical:', '').replace('/5', '').trim()) || 0;
    } else if (line.startsWith('Mental:')) {
      result.mentalRating = parseInt(line.replace('Mental:', '').replace('/5', '').trim()) || 0;
    } else if (line.startsWith('Tactical:')) {
      result.tacticalRating = parseInt(line.replace('Tactical:', '').replace('/5', '').trim()) || 0;
    } else if (line.startsWith('Technical:')) {
      result.technicalRating = parseInt(line.replace('Technical:', '').replace('/5', '').trim()) || 0;
    }
  }

  // Extract notes after "Notes:"
  const notesIdx = notes.indexOf('\n\nNotes:');
  if (notesIdx !== -1) {
    result.sessionNotes = notes.substring(notesIdx + 8).trim();
  }

  return result;
}

function getStrengthsAndImprovements(session: FreestyleSession): { strengths: string[]; improvements: string[] } {
  const ratings = [
    { label: 'Physical', value: session.physicalRating || 0 },
    { label: 'Mental', value: session.mentalRating || 0 },
    { label: 'Tactical', value: session.tacticalRating || 0 },
    { label: 'Technical', value: session.technicalRating || 0 },
  ];

  const strengths = ratings.filter(r => r.value >= 4).map(r => r.label);
  const improvements = ratings.filter(r => r.value <= 2).map(r => r.label);

  return { strengths, improvements };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Custom Bar Chart ─────────────────────────────────────────────────────────
function BarChart({ data, color }: { data: { label: string; value: number; max: number }[]; color: string }) {
  const BAR_HEIGHT = 180;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: BAR_HEIGHT + 40 }}>
      {data.map((item, i) => {
        const pct = item.max > 0 ? item.value / item.max : 0;
        const barH = Math.max(4, Math.round(pct * BAR_HEIGHT));
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={barChartStyles.valueLabel}>{item.value > 0 ? item.value : ''}</Text>
            <View style={[barChartStyles.bar, { height: barH, backgroundColor: color }]} />
            <Text style={barChartStyles.barLabel} numberOfLines={1}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const barChartStyles = StyleSheet.create({
  bar: { width: '100%', borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  valueLabel: { fontSize: 11, fontWeight: '700', color: colors.text, marginBottom: 2 },
});

// ─── Radar-style chart (octagonal area) ───────────────────────────────────────
function RadarChart({ physical, mental, tactical, technical }: {
  physical: number; mental: number; tactical: number; technical: number;
}) {
  const SIZE = 160;
  const CENTER = SIZE / 2;
  const MAX_RADIUS = 60;

  const toXY = (angle: number, r: number) => ({
    x: CENTER + r * Math.cos((angle - 90) * (Math.PI / 180)),
    y: CENTER + r * Math.sin((angle - 90) * (Math.PI / 180)),
  });

  const axes = [
    { label: 'Physical', angle: 0, value: physical, color: colors.physical },
    { label: 'Mental', angle: 90, value: mental, color: colors.mental },
    { label: 'Tactical', angle: 180, value: tactical, color: colors.tactical },
    { label: 'Technical', angle: 270, value: technical, color: colors.technical },
  ];

  // Build polygon path for data
  const dataPoints = axes.map(a => {
    const r = (a.value / 5) * MAX_RADIUS;
    return toXY(a.angle, r);
  });

  const gridLevels = [1, 2, 3, 4, 5];

  return (
    <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
      <View style={{ width: SIZE, height: SIZE, position: 'relative' }}>
        {/* SVG-like rendering using absolute positioned Views for grid */}
        {gridLevels.map(level => {
          const r = (level / 5) * MAX_RADIUS;
          const pts = [0, 90, 180, 270].map(angle => toXY(angle, r));
          return (
            <View
              key={level}
              style={{
                position: 'absolute',
                left: pts[0].x,
                top: pts[1].y,
                width: (pts[2].x - pts[0].x),
                height: (pts[3].y - pts[1].y),
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          );
        })}

        {/* Axis lines */}
        {axes.map((a, i) => {
          const end = toXY(a.angle, MAX_RADIUS);
          const dx = end.x - CENTER;
          const dy = end.y - CENTER;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: CENTER,
                top: CENTER,
                width: length,
                height: 1,
                backgroundColor: colors.border,
                transformOrigin: '0 50%',
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          );
        })}

        {/* Data dots */}
        {dataPoints.map((pt, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: pt.x - 5,
              top: pt.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: axes[i].color,
            }}
          />
        ))}

        {/* Center dot */}
        <View style={{
          position: 'absolute',
          left: CENTER - 4,
          top: CENTER - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.textSecondary,
        }} />
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'center' }}>
        {axes.map(a => (
          <View key={a.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.color }} />
            <Text style={{ fontSize: 12, color: colors.text }}>{a.label} ({a.value}/5)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Star display ─────────────────────────────────────────────────────────────
function StarDisplay({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <MaterialIcons
          key={s}
          name={s <= rating ? 'star' : 'star-border'}
          size={16}
          color={s <= rating ? color : colors.border}
        />
      ))}
    </View>
  );
}

export default function SessionAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<FreestyleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'latest' | 'history' | 'trends'>('latest');

  // Latest session data passed directly from step 4
  const fromParams: Partial<FreestyleSession> = {
    physicalRating: parseInt(params.physical as string) || undefined,
    mentalRating: parseInt(params.mental as string) || undefined,
    tacticalRating: parseInt(params.tactical as string) || undefined,
    technicalRating: parseInt(params.technical as string) || undefined,
    ballsFaced: parseInt(params.balls as string) || undefined,
    duration_minutes: parseInt(params.duration as string) || undefined,
    trainingTypes: params.types ? (params.types as string).split(',') : undefined,
    sessionNotes: params.notes as string || undefined,
    focusArea: params.focus as string || undefined,
    sessionGoal: params.goal as string || undefined,
  };

  const hasParamRatings = !!fromParams.physicalRating;

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_type', 'Freestyle')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      const parsed = data.map((s: any) => ({
        ...s,
        ...parseSessionNotes(s.notes || ''),
      }));
      setSessions(parsed);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Determine "latest" — prefer params if we just finished a session, else first DB record
  const latest: FreestyleSession | null = hasParamRatings
    ? { ...sessions[0], ...fromParams, id: sessions[0]?.id || 'new' } as FreestyleSession
    : sessions[0] || null;

  const latestStrengths = latest ? getStrengthsAndImprovements(latest as FreestyleSession) : { strengths: [], improvements: [] };
  const latestAvg = latest
    ? ((latest.physicalRating || 0) + (latest.mentalRating || 0) + (latest.tacticalRating || 0) + (latest.technicalRating || 0)) / 4
    : 0;

  // Trends: last 8 sessions
  const trendSessions = sessions.slice(0, 8).reverse();

  const avgByMetric = (key: keyof FreestyleSession) => {
    const vals = sessions.map(s => (s[key] as number) || 0).filter(v => v > 0);
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const getPerformanceLabel = (avg: number) => {
    if (avg >= 4.5) return { label: 'Excellent', color: colors.success };
    if (avg >= 3.5) return { label: 'Good', color: colors.primary };
    if (avg >= 2.5) return { label: 'Average', color: colors.warning };
    return { label: 'Needs Work', color: colors.error };
  };

  const pillarRatingColor = (val: number) => {
    if (val >= 4) return colors.success;
    if (val >= 3) return colors.primary;
    if (val >= 2) return colors.warning;
    return colors.error;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Session Analytics</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['latest', 'history', 'trends'] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ─── LATEST SESSION ────────────────────────────────────── */}
        {activeTab === 'latest' && (
          <>
            {!latest ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="analytics" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptySubtitle}>Complete a freestyle session to see your analytics</Text>
              </View>
            ) : (
              <>
                {/* Overall score */}
                <View style={styles.card}>
                  <View style={styles.overallRow}>
                    <View style={styles.overallLeft}>
                      <Text style={styles.cardTitle}>Overall Performance</Text>
                      <Text style={styles.overallScore}>{latestAvg.toFixed(1)}<Text style={styles.overallMax}>/5</Text></Text>
                      <View style={[styles.badge, { backgroundColor: getPerformanceLabel(latestAvg).color + '20' }]}>
                        <Text style={[styles.badgeText, { color: getPerformanceLabel(latestAvg).color }]}>
                          {getPerformanceLabel(latestAvg).label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.overallRight}>
                      {latest.duration_minutes ? (
                        <View style={styles.metaStat}>
                          <MaterialIcons name="timer" size={16} color={colors.textSecondary} />
                          <Text style={styles.metaStatText}>{latest.duration_minutes} min</Text>
                        </View>
                      ) : null}
                      {(latest.ballsFaced || 0) > 0 ? (
                        <View style={styles.metaStat}>
                          <MaterialIcons name="sports-cricket" size={16} color={colors.textSecondary} />
                          <Text style={styles.metaStatText}>{latest.ballsFaced} balls</Text>
                        </View>
                      ) : null}
                      {latest.focusArea ? (
                        <View style={styles.metaStat}>
                          <MaterialIcons name="my-location" size={16} color={colors.textSecondary} />
                          <Text style={styles.metaStatText} numberOfLines={2}>{latest.focusArea}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Radar chart */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Performance Radar</Text>
                  <RadarChart
                    physical={latest.physicalRating || 0}
                    mental={latest.mentalRating || 0}
                    tactical={latest.tacticalRating || 0}
                    technical={latest.technicalRating || 0}
                  />
                </View>

                {/* Pillar breakdown */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Pillar Breakdown</Text>
                  <View style={styles.pillarGrid}>
                    {[
                      { label: 'Physical', value: latest.physicalRating || 0, color: colors.physical, icon: 'fitness-center' as const },
                      { label: 'Mental', value: latest.mentalRating || 0, color: colors.mental, icon: 'psychology' as const },
                      { label: 'Tactical', value: latest.tacticalRating || 0, color: colors.tactical, icon: 'lightbulb' as const },
                      { label: 'Technical', value: latest.technicalRating || 0, color: colors.technical, icon: 'sports-cricket' as const },
                    ].map(pillar => (
                      <View key={pillar.label} style={styles.pillarCard}>
                        <View style={[styles.pillarIcon, { backgroundColor: pillar.color + '20' }]}>
                          <MaterialIcons name={pillar.icon} size={22} color={pillar.color} />
                        </View>
                        <Text style={styles.pillarLabel}>{pillar.label}</Text>
                        <Text style={[styles.pillarScore, { color: pillarRatingColor(pillar.value) }]}>
                          {pillar.value}/5
                        </Text>
                        <StarDisplay rating={pillar.value} color={pillar.color} />
                        {/* Progress bar */}
                        <View style={styles.pillarBarBg}>
                          <View style={[styles.pillarBar, { width: `${(pillar.value / 5) * 100}%`, backgroundColor: pillar.color }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Strengths & Improvements */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Analysis</Text>
                  {latestStrengths.strengths.length > 0 && (
                    <View style={styles.analysisBlock}>
                      <View style={styles.analysisHeader}>
                        <MaterialIcons name="thumb-up" size={18} color={colors.success} />
                        <Text style={[styles.analysisTitle, { color: colors.success }]}>What went well</Text>
                      </View>
                      {latestStrengths.strengths.map(s => (
                        <View key={s} style={styles.analysisBullet}>
                          <View style={[styles.bullet, { backgroundColor: colors.success }]} />
                          <Text style={styles.analysisText}>{s} performance was strong (4–5/5)</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {latestStrengths.improvements.length > 0 && (
                    <View style={[styles.analysisBlock, { backgroundColor: '#FFF4E6', borderLeftColor: colors.warning }]}>
                      <View style={styles.analysisHeader}>
                        <MaterialIcons name="trending-up" size={18} color={colors.warning} />
                        <Text style={[styles.analysisTitle, { color: colors.warning }]}>What to work on</Text>
                      </View>
                      {latestStrengths.improvements.map(s => (
                        <View key={s} style={styles.analysisBullet}>
                          <View style={[styles.bullet, { backgroundColor: colors.warning }]} />
                          <Text style={styles.analysisText}>{s} needs attention — rated 1–2/5</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {latestStrengths.strengths.length === 0 && latestStrengths.improvements.length === 0 && (
                    <Text style={styles.analysisNeutral}>
                      Average performance across all pillars (3/5). Focus on consistency to improve your rating next session!
                    </Text>
                  )}
                  {latest.sessionNotes ? (
                    <View style={styles.notesBlock}>
                      <Text style={styles.notesLabel}>Your Notes</Text>
                      <Text style={styles.notesText}>{latest.sessionNotes}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Training types */}
                {latest.trainingTypes && latest.trainingTypes.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Training Methods Used</Text>
                    <View style={styles.tagsRow}>
                      {latest.trainingTypes.map(t => (
                        <View key={t} style={styles.tag}>
                          <MaterialIcons name="sports-cricket" size={14} color={colors.primary} />
                          <Text style={styles.tagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ─── HISTORY ───────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <>
            {sessions.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="history" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>No history yet</Text>
                <Text style={styles.emptySubtitle}>Your completed sessions will appear here</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>{sessions.length} Freestyle Sessions</Text>
                {sessions.map((s, idx) => {
                  const avg = ((s.physicalRating || 0) + (s.mentalRating || 0) + (s.tacticalRating || 0) + (s.technicalRating || 0)) / 4;
                  const perf = getPerformanceLabel(avg);
                  return (
                    <View key={s.id || idx} style={styles.historyCard}>
                      <View style={styles.historyTop}>
                        <View style={styles.historyDateBox}>
                          <Text style={styles.historyDate}>
                            {formatDate(s.completed_at || s.scheduled_date)}
                          </Text>
                          <Text style={styles.historyDuration}>{s.duration_minutes || 0} min</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: perf.color + '20' }]}>
                          <Text style={[styles.badgeText, { color: perf.color }]}>{perf.label}</Text>
                        </View>
                        <Text style={styles.historyAvg}>{avg.toFixed(1)}/5</Text>
                      </View>

                      <View style={styles.historyRatings}>
                        {[
                          { label: 'PHY', value: s.physicalRating || 0, color: colors.physical },
                          { label: 'MNT', value: s.mentalRating || 0, color: colors.mental },
                          { label: 'TAC', value: s.tacticalRating || 0, color: colors.tactical },
                          { label: 'TEC', value: s.technicalRating || 0, color: colors.technical },
                        ].map(r => (
                          <View key={r.label} style={styles.historyRatingItem}>
                            <Text style={styles.historyRatingLabel}>{r.label}</Text>
                            <View style={styles.miniBarBg}>
                              <View style={[styles.miniBar, { width: `${(r.value / 5) * 100}%`, backgroundColor: r.color }]} />
                            </View>
                            <Text style={[styles.historyRatingVal, { color: r.color }]}>{r.value}</Text>
                          </View>
                        ))}
                      </View>

                      {(s.ballsFaced || 0) > 0 && (
                        <Text style={styles.historyBalls}>{s.ballsFaced} balls faced</Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ─── TRENDS ────────────────────────────────────────────── */}
        {activeTab === 'trends' && (
          <>
            {sessions.length < 2 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="show-chart" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>Not enough data</Text>
                <Text style={styles.emptySubtitle}>Complete at least 2 sessions to see trends</Text>
              </View>
            ) : (
              <>
                {/* Overall averages */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>All-Time Averages</Text>
                  <Text style={styles.cardSubtitle}>Based on {sessions.length} sessions</Text>
                  <View style={styles.avgGrid}>
                    {[
                      { label: 'Physical', key: 'physicalRating' as const, color: colors.physical, icon: 'fitness-center' as const },
                      { label: 'Mental', key: 'mentalRating' as const, color: colors.mental, icon: 'psychology' as const },
                      { label: 'Tactical', key: 'tacticalRating' as const, color: colors.tactical, icon: 'lightbulb' as const },
                      { label: 'Technical', key: 'technicalRating' as const, color: colors.technical, icon: 'sports-cricket' as const },
                    ].map(m => {
                      const avg = avgByMetric(m.key);
                      return (
                        <View key={m.label} style={[styles.avgCard, { borderTopColor: m.color }]}>
                          <MaterialIcons name={m.icon} size={20} color={m.color} />
                          <Text style={[styles.avgValue, { color: m.color }]}>{avg}</Text>
                          <Text style={styles.avgLabel}>{m.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Bar chart: Physical over sessions */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Physical Rating Trend</Text>
                  <Text style={styles.cardSubtitle}>Last {trendSessions.length} sessions</Text>
                  <BarChart
                    color={colors.physical}
                    data={trendSessions.map((s, i) => ({
                      label: formatDate(s.completed_at || s.scheduled_date),
                      value: s.physicalRating || 0,
                      max: 5,
                    }))}
                  />
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Mental Rating Trend</Text>
                  <Text style={styles.cardSubtitle}>Last {trendSessions.length} sessions</Text>
                  <BarChart
                    color={colors.mental}
                    data={trendSessions.map(s => ({
                      label: formatDate(s.completed_at || s.scheduled_date),
                      value: s.mentalRating || 0,
                      max: 5,
                    }))}
                  />
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Tactical Rating Trend</Text>
                  <Text style={styles.cardSubtitle}>Last {trendSessions.length} sessions</Text>
                  <BarChart
                    color={colors.tactical}
                    data={trendSessions.map(s => ({
                      label: formatDate(s.completed_at || s.scheduled_date),
                      value: s.tacticalRating || 0,
                      max: 5,
                    }))}
                  />
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Technical Rating Trend</Text>
                  <Text style={styles.cardSubtitle}>Last {trendSessions.length} sessions</Text>
                  <BarChart
                    color={colors.technical}
                    data={trendSessions.map(s => ({
                      label: formatDate(s.completed_at || s.scheduled_date),
                      value: s.technicalRating || 0,
                      max: 5,
                    }))}
                  />
                </View>

                {/* Balls faced trend */}
                {sessions.some(s => (s.ballsFaced || 0) > 0) && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Balls Faced Trend</Text>
                    <BarChart
                      color={colors.primary}
                      data={trendSessions.map(s => ({
                        label: formatDate(s.completed_at || s.scheduled_date),
                        value: s.ballsFaced || 0,
                        max: Math.max(...trendSessions.map(x => x.ballsFaced || 0), 1),
                      }))}
                    />
                  </View>
                )}

                {/* Summary stats */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Training Summary</Text>
                  <View style={styles.summaryStats}>
                    <View style={styles.summaryStatItem}>
                      <MaterialIcons name="event" size={22} color={colors.primary} />
                      <Text style={styles.summaryStatValue}>{sessions.length}</Text>
                      <Text style={styles.summaryStatLabel}>Total Sessions</Text>
                    </View>
                    <View style={styles.summaryStatItem}>
                      <MaterialIcons name="timer" size={22} color={colors.info} />
                      <Text style={styles.summaryStatValue}>
                        {sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)}
                      </Text>
                      <Text style={styles.summaryStatLabel}>Total Minutes</Text>
                    </View>
                    <View style={styles.summaryStatItem}>
                      <MaterialIcons name="sports-cricket" size={22} color={colors.tactical} />
                      <Text style={styles.summaryStatValue}>
                        {sessions.reduce((a, s) => a + (s.ballsFaced || 0), 0)}
                      </Text>
                      <Text style={styles.summaryStatLabel}>Total Balls</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tab: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { ...typography.h4, color: colors.text, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },

  // Overall row
  overallRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  overallLeft: { flex: 1 },
  overallRight: { flex: 1, alignItems: 'flex-end', gap: spacing.xs },
  overallScore: { fontSize: 48, fontWeight: '800', color: colors.text, lineHeight: 56 },
  overallMax: { fontSize: 20, color: colors.textSecondary },

  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full, alignSelf: 'flex-start' },
  badgeText: { ...typography.caption, fontWeight: '700' },

  metaStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaStatText: { ...typography.caption, color: colors.textSecondary, maxWidth: 120 },

  // Pillars
  pillarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pillarCard: {
    width: '46%', backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  pillarIcon: { width: 40, height: 40, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  pillarLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  pillarScore: { ...typography.h3, fontWeight: '800' },
  pillarBarBg: { width: '100%', height: 6, backgroundColor: colors.border, borderRadius: 3 },
  pillarBar: { height: 6, borderRadius: 3 },

  // Analysis
  analysisBlock: {
    backgroundColor: '#E8F5E9', borderRadius: borderRadius.md, padding: spacing.md,
    marginTop: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  analysisTitle: { ...typography.body, fontWeight: '700' },
  analysisBullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  analysisText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  analysisNeutral: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  notesBlock: {
    marginTop: spacing.md, backgroundColor: colors.background,
    borderRadius: borderRadius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  notesLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  notesText: { ...typography.body, color: colors.text, lineHeight: 22 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '15', paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  tagText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  // History
  sectionLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  historyCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  historyDateBox: { flex: 1 },
  historyDate: { ...typography.body, color: colors.text, fontWeight: '700' },
  historyDuration: { ...typography.caption, color: colors.textSecondary },
  historyAvg: { ...typography.h4, color: colors.text, fontWeight: '800' },
  historyRatings: { gap: 6 },
  historyRatingItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyRatingLabel: { ...typography.caption, color: colors.textSecondary, width: 30, fontWeight: '600' },
  miniBarBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4 },
  miniBar: { height: 8, borderRadius: 4, minWidth: 4 },
  historyRatingVal: { ...typography.caption, fontWeight: '800', width: 16, textAlign: 'right' },
  historyBalls: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },

  // Trends
  avgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  avgCard: {
    flex: 1, minWidth: '40%', backgroundColor: colors.background,
    borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', gap: 4,
    borderTopWidth: 3, borderWidth: 1, borderColor: colors.border,
  },
  avgValue: { fontSize: 28, fontWeight: '800' },
  avgLabel: { ...typography.caption, color: colors.textSecondary },

  summaryStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  summaryStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryStatValue: { ...typography.h3, fontWeight: '800', color: colors.text },
  summaryStatLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
