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
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FreestyleSession {
  id: string;
  title: string;
  scheduled_date: string;
  completed_at: string;
  duration_minutes: number;
  notes: string;
  status: string;
  ballsFaced?: number;
  ballsMiddled?: number;
  middlePercent?: number;
  boundariesHit?: number;
  shotExecution?: number;
  footwork?: number;
  timing?: number;
  focus?: number;
  confidence?: number;
  pressureHandling?: number;
  energyLevel?: number;
  reactionSpeed?: number;
  shotSelection?: number;
  gameAwareness?: number;
  physicalRating?: number;
  mentalRating?: number;
  tacticalRating?: number;
  technicalRating?: number;
  trainingTypes?: string[];
  sessionNotes?: string;
}

function parseSessionNotes(notes: string): Partial<FreestyleSession> {
  const result: Partial<FreestyleSession> = {};
  if (!notes) return result;
  const lines = notes.split('\n');
  for (const line of lines) {
    const clean = line.trim();
    if (clean.startsWith('Training Types:')) result.trainingTypes = clean.replace('Training Types:', '').trim().split(', ').filter(Boolean);
    else if (clean.startsWith('Balls Faced:')) result.ballsFaced = parseInt(clean.replace('Balls Faced:', '').trim()) || 0;
    else if (clean.startsWith('Balls Middled:')) result.ballsMiddled = parseInt(clean.replace('Balls Middled:', '').trim()) || 0;
    else if (clean.startsWith('Middle %:')) result.middlePercent = parseInt(clean.replace('Middle %:', '').trim()) || 0;
    else if (clean.startsWith('Boundaries Hit:')) result.boundariesHit = parseInt(clean.replace('Boundaries Hit:', '').trim()) || 0;
    else if (clean.startsWith('Shot Execution:')) result.shotExecution = parseInt(clean.replace('Shot Execution:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Footwork:')) result.footwork = parseInt(clean.replace('Footwork:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Timing:')) result.timing = parseInt(clean.replace('Timing:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Focus:')) result.focus = parseInt(clean.replace('Focus:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Confidence:')) result.confidence = parseInt(clean.replace('Confidence:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Pressure Handling:')) result.pressureHandling = parseInt(clean.replace('Pressure Handling:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Energy Level:')) result.energyLevel = parseInt(clean.replace('Energy Level:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Reaction Speed:')) result.reactionSpeed = parseInt(clean.replace('Reaction Speed:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Shot Selection:')) result.shotSelection = parseInt(clean.replace('Shot Selection:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Game Awareness:')) result.gameAwareness = parseInt(clean.replace('Game Awareness:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Physical:')) result.physicalRating = parseInt(clean.replace('Physical:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Mental:')) result.mentalRating = parseInt(clean.replace('Mental:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Tactical:')) result.tacticalRating = parseInt(clean.replace('Tactical:', '').replace('/5', '').trim()) || 0;
    else if (clean.startsWith('Technical:')) result.technicalRating = parseInt(clean.replace('Technical:', '').replace('/5', '').trim()) || 0;
  }
  const notesIdx = notes.indexOf('\n\nNotes:');
  if (notesIdx !== -1) result.sessionNotes = notes.substring(notesIdx + 8).trim();
  return result;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPerformanceLabel(avg: number): { label: string; color: string } {
  if (avg >= 4.5) return { label: 'Elite', color: '#7C3AED' };
  if (avg >= 4) return { label: 'Excellent', color: colors.success };
  if (avg >= 3.5) return { label: 'Good', color: colors.primary };
  if (avg >= 2.5) return { label: 'Average', color: colors.warning };
  return { label: 'Needs Work', color: colors.error };
}

function avgOf(vals: (number | undefined)[]): number {
  const valid = vals.filter((v): v is number => (v || 0) > 0) as number[];
  if (!valid.length) return 0;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function MetricBar({ label, value, max = 5, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) * 100 : 0;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.val, { color }]}>{value > 0 ? `${value}/5` : '—'}</Text>
    </View>
  );
}
const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 10 },
  label: { ...typography.bodySmall, color: colors.text, width: 120 },
  track: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4 },
  fill: { height: 8, borderRadius: 4, minWidth: 4 },
  val: { ...typography.bodySmall, fontWeight: '800', width: 36, textAlign: 'right' },
});

function BarChart({ data, color, maxVal = 5 }: { data: { label: string; value: number }[]; color: string; maxVal?: number }) {
  const BAR_HEIGHT = 120;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: BAR_HEIGHT + 40 }}>
      {data.map((item, i) => {
        const pct = maxVal > 0 ? item.value / maxVal : 0;
        const barH = Math.max(4, Math.round(pct * BAR_HEIGHT));
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.text, marginBottom: 2 }}>
              {item.value > 0 ? item.value : ''}
            </Text>
            <View style={{ height: barH, width: '100%', backgroundColor: color, borderRadius: 4 }} />
            <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <MaterialIcons key={s} name={s <= rating ? 'star' : 'star-border'} size={14} color={s <= rating ? color : colors.border} />
      ))}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FreestyleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'latest' | 'history' | 'trends'>('latest');

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
      .limit(30);
    if (!error && data) {
      const parsed = data.map((s: any) => ({ ...s, ...parseSessionNotes(s.notes || '') }));
      setSessions(parsed);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadSessions(); }, [loadSessions]));

  const latest = sessions[0] || null;
  const latestTechnical = avgOf([latest?.shotExecution, latest?.footwork, latest?.timing]) || latest?.technicalRating || 0;
  const latestMental = avgOf([latest?.focus, latest?.confidence, latest?.pressureHandling]) || latest?.mentalRating || 0;
  const latestPhysical = avgOf([latest?.energyLevel, latest?.reactionSpeed]) || latest?.physicalRating || 0;
  const latestTactical = avgOf([latest?.shotSelection, latest?.gameAwareness]) || latest?.tacticalRating || 0;
  const latestOverall = avgOf([latestTechnical, latestMental, latestPhysical, latestTactical]);
  const latestMiddlePct = latest?.middlePercent || (latest?.ballsFaced && latest?.ballsMiddled && (latest.ballsFaced || 0) > 0
    ? Math.round(((latest.ballsMiddled || 0) / (latest.ballsFaced || 1)) * 100) : null);

  const trendSessions = sessions.slice(0, 10).reverse();

  const avgAcrossSessions = (key: keyof FreestyleSession) => {
    const vals = sessions.map(s => (s[key] as number) || 0).filter(v => v > 0);
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const totalBallsFaced = sessions.reduce((a, s) => a + (s.ballsFaced || 0), 0);
  const totalBoundaries = sessions.reduce((a, s) => a + (s.boundariesHit || 0), 0);
  const avgMiddlePct = (() => {
    const sessWithPct = sessions.filter(s => (s.middlePercent || 0) > 0);
    if (!sessWithPct.length) return null;
    return Math.round(sessWithPct.reduce((a, s) => a + (s.middlePercent || 0), 0) / sessWithPct.length);
  })();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Performance Hub</Text>
          <Text style={styles.headerSub}>Freestyle session analytics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading performance data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>Performance Hub</Text>
          <Text style={styles.headerSub}>{sessions.length} freestyle sessions tracked</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
          <MaterialIcons name="analytics" size={18} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>Live Data</Text>
        </View>
      </View>

      {/* Sub-tabs */}
      <View style={styles.tabBar}>
        {(['latest', 'history', 'trends'] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <MaterialIcons
              name={tab === 'latest' ? 'analytics' : tab === 'history' ? 'history' : 'show-chart'}
              size={16}
              color={activeTab === tab ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ─── LATEST ─── */}
        {activeTab === 'latest' && (
          <>
            {!latest ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="sports-cricket" size={72} color={colors.border} />
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptySubtitle}>Complete a freestyle session to see your performance breakdown here. Go to Training → Start Freestyle Session.</Text>
              </View>
            ) : (
              <>
                <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroLabel}>Overall Performance</Text>
                    <Text style={styles.heroScore}>{latestOverall.toFixed(1)}<Text style={styles.heroMax}>/5</Text></Text>
                    <View style={[styles.badgeSmall, { backgroundColor: getPerformanceLabel(latestOverall).color + '25' }]}>
                      <Text style={[styles.badgeSmallText, { color: getPerformanceLabel(latestOverall).color }]}>
                        {getPerformanceLabel(latestOverall).label}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {latest.duration_minutes ? (
                      <View style={styles.statChip}>
                        <MaterialIcons name="timer" size={13} color={colors.textSecondary} />
                        <Text style={styles.statChipText}>{latest.duration_minutes} min</Text>
                      </View>
                    ) : null}
                    {(latest.ballsFaced || 0) > 0 ? (
                      <View style={styles.statChip}>
                        <MaterialIcons name="sports-cricket" size={13} color={colors.textSecondary} />
                        <Text style={styles.statChipText}>{latest.ballsFaced} balls</Text>
                      </View>
                    ) : null}
                    {latestMiddlePct !== null ? (
                      <View style={styles.statChip}>
                        <MaterialIcons name="gps-fixed" size={13} color={colors.success} />
                        <Text style={[styles.statChipText, { color: colors.success, fontWeight: '700' }]}>{latestMiddlePct}% middle</Text>
                      </View>
                    ) : null}
                    {(latest.boundariesHit || 0) > 0 ? (
                      <View style={styles.statChip}>
                        <MaterialIcons name="star" size={13} color={colors.warning} />
                        <Text style={styles.statChipText}>{latest.boundariesHit} boundaries</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Pillar Averages</Text>
                  <View style={styles.pillarGrid}>
                    {[
                      { label: 'Technical', value: latestTechnical, color: colors.technical, icon: 'sports-cricket' as const },
                      { label: 'Mental', value: latestMental, color: colors.mental, icon: 'psychology' as const },
                      { label: 'Physical', value: latestPhysical, color: colors.physical, icon: 'fitness-center' as const },
                      { label: 'Tactical', value: latestTactical, color: colors.tactical, icon: 'lightbulb' as const },
                    ].map(p => (
                      <View key={p.label} style={[styles.pillarCard, { borderTopColor: p.color }]}>
                        <MaterialIcons name={p.icon} size={20} color={p.color} />
                        <Text style={[styles.pillarScore, { color: p.color }]}>{p.value > 0 ? p.value.toFixed(1) : '—'}</Text>
                        <Text style={styles.pillarLabel}>{p.label}</Text>
                        <Stars rating={Math.round(p.value)} color={p.color} />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <MaterialIcons name="sports-cricket" size={18} color={colors.technical} />
                    <Text style={[styles.cardTitle, { color: colors.technical }]}>Technical</Text>
                  </View>
                  <MetricBar label="Shot Execution" value={latest.shotExecution || 0} color={colors.technical} />
                  <MetricBar label="Footwork" value={latest.footwork || 0} color={colors.technical} />
                  <MetricBar label="Timing" value={latest.timing || 0} color={colors.technical} />
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <MaterialIcons name="psychology" size={18} color={colors.mental} />
                    <Text style={[styles.cardTitle, { color: colors.mental }]}>Mental</Text>
                  </View>
                  <MetricBar label="Focus" value={latest.focus || 0} color={colors.mental} />
                  <MetricBar label="Confidence" value={latest.confidence || 0} color={colors.mental} />
                  <MetricBar label="Pressure Handling" value={latest.pressureHandling || 0} color={colors.mental} />
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <MaterialIcons name="fitness-center" size={18} color={colors.physical} />
                    <Text style={[styles.cardTitle, { color: colors.physical }]}>Physical</Text>
                  </View>
                  <MetricBar label="Energy Level" value={latest.energyLevel || 0} color={colors.physical} />
                  <MetricBar label="Reaction Speed" value={latest.reactionSpeed || 0} color={colors.physical} />
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <MaterialIcons name="lightbulb" size={18} color={colors.tactical} />
                    <Text style={[styles.cardTitle, { color: colors.tactical }]}>Tactical</Text>
                  </View>
                  <MetricBar label="Shot Selection" value={latest.shotSelection || 0} color={colors.tactical} />
                  <MetricBar label="Game Awareness" value={latest.gameAwareness || 0} color={colors.tactical} />
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Session Analysis</Text>
                  {[
                    { label: 'Shot Execution', value: latest.shotExecution || 0 },
                    { label: 'Footwork', value: latest.footwork || 0 },
                    { label: 'Timing', value: latest.timing || 0 },
                    { label: 'Focus', value: latest.focus || 0 },
                    { label: 'Confidence', value: latest.confidence || 0 },
                    { label: 'Pressure Handling', value: latest.pressureHandling || 0 },
                    { label: 'Energy Level', value: latest.energyLevel || 0 },
                    { label: 'Reaction Speed', value: latest.reactionSpeed || 0 },
                    { label: 'Shot Selection', value: latest.shotSelection || 0 },
                    { label: 'Game Awareness', value: latest.gameAwareness || 0 },
                  ].filter(m => m.value >= 4).length > 0 && (
                    <View style={[styles.analysisBlock, { backgroundColor: '#E8F5E9', borderLeftColor: colors.success }]}>
                      <View style={styles.analysisHeader}>
                        <MaterialIcons name="thumb-up" size={16} color={colors.success} />
                        <Text style={[styles.analysisTitle, { color: colors.success }]}>Strengths this session</Text>
                      </View>
                      {[
                        { label: 'Shot Execution', value: latest.shotExecution || 0 },
                        { label: 'Footwork', value: latest.footwork || 0 },
                        { label: 'Timing', value: latest.timing || 0 },
                        { label: 'Focus', value: latest.focus || 0 },
                        { label: 'Confidence', value: latest.confidence || 0 },
                        { label: 'Pressure Handling', value: latest.pressureHandling || 0 },
                        { label: 'Energy Level', value: latest.energyLevel || 0 },
                        { label: 'Reaction Speed', value: latest.reactionSpeed || 0 },
                        { label: 'Shot Selection', value: latest.shotSelection || 0 },
                        { label: 'Game Awareness', value: latest.gameAwareness || 0 },
                      ].filter(m => m.value >= 4).map(m => (
                        <View key={m.label} style={styles.analysisBullet}>
                          <View style={[styles.bullet, { backgroundColor: colors.success }]} />
                          <Text style={styles.analysisText}>{m.label} — {m.value}/5</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {[
                    { label: 'Shot Execution', value: latest.shotExecution || 0 },
                    { label: 'Footwork', value: latest.footwork || 0 },
                    { label: 'Timing', value: latest.timing || 0 },
                    { label: 'Focus', value: latest.focus || 0 },
                    { label: 'Confidence', value: latest.confidence || 0 },
                    { label: 'Pressure Handling', value: latest.pressureHandling || 0 },
                    { label: 'Energy Level', value: latest.energyLevel || 0 },
                    { label: 'Reaction Speed', value: latest.reactionSpeed || 0 },
                    { label: 'Shot Selection', value: latest.shotSelection || 0 },
                    { label: 'Game Awareness', value: latest.gameAwareness || 0 },
                  ].filter(m => m.value > 0 && m.value <= 2).length > 0 && (
                    <View style={[styles.analysisBlock, { backgroundColor: '#FFF4E6', borderLeftColor: colors.warning, marginTop: spacing.sm }]}>
                      <View style={styles.analysisHeader}>
                        <MaterialIcons name="trending-up" size={16} color={colors.warning} />
                        <Text style={[styles.analysisTitle, { color: colors.warning }]}>Focus for next session</Text>
                      </View>
                      {[
                        { label: 'Shot Execution', value: latest.shotExecution || 0 },
                        { label: 'Footwork', value: latest.footwork || 0 },
                        { label: 'Timing', value: latest.timing || 0 },
                        { label: 'Focus', value: latest.focus || 0 },
                        { label: 'Confidence', value: latest.confidence || 0 },
                        { label: 'Pressure Handling', value: latest.pressureHandling || 0 },
                        { label: 'Energy Level', value: latest.energyLevel || 0 },
                        { label: 'Reaction Speed', value: latest.reactionSpeed || 0 },
                        { label: 'Shot Selection', value: latest.shotSelection || 0 },
                        { label: 'Game Awareness', value: latest.gameAwareness || 0 },
                      ].filter(m => m.value > 0 && m.value <= 2).map(m => (
                        <View key={m.label} style={styles.analysisBullet}>
                          <View style={[styles.bullet, { backgroundColor: colors.warning }]} />
                          <Text style={styles.analysisText}>{m.label} — needs work ({m.value}/5)</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* ─── HISTORY ─── */}
        {activeTab === 'history' && (
          <>
            {sessions.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="history" size={72} color={colors.border} />
                <Text style={styles.emptyTitle}>No history yet</Text>
                <Text style={styles.emptySubtitle}>Your completed sessions will appear here</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>{sessions.length} sessions recorded</Text>
                {sessions.map((s, idx) => {
                  const tech = avgOf([s.shotExecution, s.footwork, s.timing]) || s.technicalRating || 0;
                  const ment = avgOf([s.focus, s.confidence, s.pressureHandling]) || s.mentalRating || 0;
                  const phys = avgOf([s.energyLevel, s.reactionSpeed]) || s.physicalRating || 0;
                  const tact = avgOf([s.shotSelection, s.gameAwareness]) || s.tacticalRating || 0;
                  const overall = avgOf([tech, ment, phys, tact]);
                  const perf = getPerformanceLabel(overall);
                  const mPct = s.middlePercent || (s.ballsFaced && s.ballsMiddled && (s.ballsFaced || 0) > 0
                    ? Math.round(((s.ballsMiddled || 0) / (s.ballsFaced || 1)) * 100) : null);
                  return (
                    <View key={s.id || idx} style={styles.historyCard}>
                      <View style={styles.historyTop}>
                        <View>
                          <Text style={styles.historyDate}>{formatDate(s.completed_at || s.scheduled_date)}</Text>
                          <Text style={styles.historyDuration}>{s.duration_minutes || 0} min</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          {mPct !== null && <Text style={styles.middlePctChip}>{mPct}% middle</Text>}
                          {(s.ballsFaced || 0) > 0 && <Text style={styles.ballsFacedChip}>{s.ballsFaced} balls</Text>}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={[styles.badgeSmall, { backgroundColor: perf.color + '20' }]}>
                            <Text style={[styles.badgeSmallText, { color: perf.color }]}>{perf.label}</Text>
                          </View>
                          <Text style={styles.historyAvg}>{overall > 0 ? overall.toFixed(1) : '—'}/5</Text>
                        </View>
                      </View>
                      <View style={styles.historyMetrics}>
                        {[
                          { label: 'Shot Exec', value: s.shotExecution || 0, color: colors.technical },
                          { label: 'Footwork', value: s.footwork || 0, color: colors.technical },
                          { label: 'Timing', value: s.timing || 0, color: colors.technical },
                          { label: 'Focus', value: s.focus || 0, color: colors.mental },
                          { label: 'Confidence', value: s.confidence || 0, color: colors.mental },
                          { label: 'Pressure', value: s.pressureHandling || 0, color: colors.mental },
                          { label: 'Energy', value: s.energyLevel || 0, color: colors.physical },
                          { label: 'Reaction', value: s.reactionSpeed || 0, color: colors.physical },
                          { label: 'Shot Sel.', value: s.shotSelection || 0, color: colors.tactical },
                          { label: 'Game IQ', value: s.gameAwareness || 0, color: colors.tactical },
                        ].filter(m => m.value > 0).map(m => (
                          <View key={m.label} style={styles.historyMetricChip}>
                            <Text style={[styles.historyMetricLabel, { color: m.color }]}>{m.label}</Text>
                            <Text style={[styles.historyMetricVal, { color: m.color }]}>{m.value}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ─── TRENDS ─── */}
        {activeTab === 'trends' && (
          <>
            {sessions.length < 2 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="show-chart" size={72} color={colors.border} />
                <Text style={styles.emptyTitle}>Not enough data</Text>
                <Text style={styles.emptySubtitle}>Complete at least 2 sessions to see trends</Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Career Stats</Text>
                  <View style={styles.careerGrid}>
                    <View style={styles.careerStat}>
                      <MaterialIcons name="event" size={20} color={colors.primary} />
                      <Text style={styles.careerVal}>{sessions.length}</Text>
                      <Text style={styles.careerLabel}>Sessions</Text>
                    </View>
                    <View style={styles.careerStat}>
                      <MaterialIcons name="timer" size={20} color={colors.info} />
                      <Text style={styles.careerVal}>{sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)}</Text>
                      <Text style={styles.careerLabel}>Total Mins</Text>
                    </View>
                    <View style={styles.careerStat}>
                      <MaterialIcons name="sports-cricket" size={20} color={colors.technical} />
                      <Text style={styles.careerVal}>{totalBallsFaced}</Text>
                      <Text style={styles.careerLabel}>Balls Faced</Text>
                    </View>
                    {avgMiddlePct !== null && (
                      <View style={styles.careerStat}>
                        <MaterialIcons name="gps-fixed" size={20} color={colors.success} />
                        <Text style={[styles.careerVal, { color: colors.success }]}>{avgMiddlePct}%</Text>
                        <Text style={styles.careerLabel}>Avg Middle %</Text>
                      </View>
                    )}
                    {totalBoundaries > 0 && (
                      <View style={styles.careerStat}>
                        <MaterialIcons name="star" size={20} color={colors.warning} />
                        <Text style={styles.careerVal}>{totalBoundaries}</Text>
                        <Text style={styles.careerLabel}>Boundaries</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>All-Time Averages</Text>
                  <Text style={styles.cardSubtitle}>Across {sessions.length} sessions</Text>
                  {[
                    { label: 'Shot Execution', key: 'shotExecution' as const, color: colors.technical },
                    { label: 'Footwork', key: 'footwork' as const, color: colors.technical },
                    { label: 'Timing', key: 'timing' as const, color: colors.technical },
                    { label: 'Focus', key: 'focus' as const, color: colors.mental },
                    { label: 'Confidence', key: 'confidence' as const, color: colors.mental },
                    { label: 'Pressure Handling', key: 'pressureHandling' as const, color: colors.mental },
                    { label: 'Energy Level', key: 'energyLevel' as const, color: colors.physical },
                    { label: 'Reaction Speed', key: 'reactionSpeed' as const, color: colors.physical },
                    { label: 'Shot Selection', key: 'shotSelection' as const, color: colors.tactical },
                    { label: 'Game Awareness', key: 'gameAwareness' as const, color: colors.tactical },
                  ].map(m => (
                    <MetricBar key={m.label} label={m.label} value={avgAcrossSessions(m.key)} color={m.color} />
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Shot Execution Trend</Text>
                  <BarChart color={colors.technical} data={trendSessions.map(s => ({ label: formatDate(s.completed_at || s.scheduled_date), value: s.shotExecution || 0 }))} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Footwork Trend</Text>
                  <BarChart color={colors.technical} data={trendSessions.map(s => ({ label: formatDate(s.completed_at || s.scheduled_date), value: s.footwork || 0 }))} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Focus Trend</Text>
                  <BarChart color={colors.mental} data={trendSessions.map(s => ({ label: formatDate(s.completed_at || s.scheduled_date), value: s.focus || 0 }))} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Confidence Trend</Text>
                  <BarChart color={colors.mental} data={trendSessions.map(s => ({ label: formatDate(s.completed_at || s.scheduled_date), value: s.confidence || 0 }))} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Energy Level Trend</Text>
                  <BarChart color={colors.physical} data={trendSessions.map(s => ({ label: formatDate(s.completed_at || s.scheduled_date), value: s.energyLevel || 0 }))} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Shot Selection Trend</Text>
                  <BarChart color={colors.tactical} data={trendSessions.map(s => ({ label: formatDate(s.completed_at || s.scheduled_date), value: s.shotSelection || 0 }))} />
                </View>
                {sessions.some(s => (s.middlePercent || 0) > 0) && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Middle % Trend</Text>
                    <BarChart color={colors.success} maxVal={100} data={trendSessions.map(s => ({ label: formatDate(s.completed_at || s.scheduled_date), value: s.middlePercent || 0 }))} />
                  </View>
                )}
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

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textSecondary },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full },
  badgeText: { ...typography.caption, fontWeight: '700' },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 24 },

  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { ...typography.h4, color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  cardSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.md },

  heroLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  heroScore: { fontSize: 48, fontWeight: '800', color: colors.text, lineHeight: 56 },
  heroMax: { fontSize: 20, color: colors.textSecondary },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statChipText: { ...typography.caption, color: colors.textSecondary },

  badgeSmall: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.full, alignSelf: 'flex-start' },
  badgeSmallText: { ...typography.caption, fontWeight: '700' },

  pillarGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pillarCard: {
    flex: 1, minWidth: '44%', backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3,
  },
  pillarScore: { fontSize: 24, fontWeight: '800' },
  pillarLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  analysisBlock: { borderRadius: borderRadius.md, padding: spacing.md, borderLeftWidth: 3 },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  analysisTitle: { ...typography.bodySmall, fontWeight: '700' },
  analysisBullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  analysisText: { ...typography.bodySmall, color: colors.text, flex: 1 },

  sectionLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  historyCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  historyDate: { ...typography.body, color: colors.text, fontWeight: '700' },
  historyDuration: { ...typography.caption, color: colors.textSecondary },
  historyAvg: { ...typography.h4, color: colors.text, fontWeight: '800' },
  middlePctChip: { ...typography.caption, color: colors.success, fontWeight: '700' },
  ballsFacedChip: { ...typography.caption, color: colors.textSecondary },
  historyMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  historyMetricChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border,
  },
  historyMetricLabel: { fontSize: 10, fontWeight: '600' },
  historyMetricVal: { fontSize: 11, fontWeight: '800' },

  careerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  careerStat: { flex: 1, minWidth: '28%', alignItems: 'center', gap: 4 },
  careerVal: { ...typography.h3, fontWeight: '800', color: colors.text },
  careerLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
});
