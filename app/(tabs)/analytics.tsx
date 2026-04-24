import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle, Polygon, Line, Text as SvgText, G, Rect,
} from 'react-native-svg';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PersonalSession {
  id: string;
  completed_at: string;
  duration_minutes: number;
  notes: string;
  shotExecution: number;
  footwork: number;
  timing: number;
  focus: number;
  confidence: number;
  pressureHandling: number;
  energyLevel: number;
  reactionSpeed: number;
  shotSelection: number;
  gameAwareness: number;
}

interface AcademyLog {
  id: string;
  log_date: string;
  session_type: string;
  duration_minutes: number;
  intensity: number;
  technical_rating: number;
  effort_rating: number;
  fitness_rating: number;
  balls_faced: number;
  balls_bowled: number;
  wickets: number;
  catches: number;
  notes: string;
}

interface PillarData {
  technical: number;
  physical: number;
  mental: number;
  tactical: number;
}

// ─── Parsers ───────────────────────────────────────────────────────────────────
function parseNotes(notes: string): Partial<PersonalSession> {
  const result: Partial<PersonalSession> = {};
  if (!notes) return result;
  const lines = notes.split('\n');
  for (const line of lines) {
    const c = line.trim();
    if (c.startsWith('Shot Execution:')) result.shotExecution = parseInt(c.replace('Shot Execution:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Footwork:')) result.footwork = parseInt(c.replace('Footwork:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Timing:')) result.timing = parseInt(c.replace('Timing:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Focus:')) result.focus = parseInt(c.replace('Focus:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Confidence:')) result.confidence = parseInt(c.replace('Confidence:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Pressure Handling:')) result.pressureHandling = parseInt(c.replace('Pressure Handling:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Energy Level:')) result.energyLevel = parseInt(c.replace('Energy Level:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Reaction Speed:')) result.reactionSpeed = parseInt(c.replace('Reaction Speed:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Shot Selection:')) result.shotSelection = parseInt(c.replace('Shot Selection:', '').replace('/5', '').trim()) || 0;
    else if (c.startsWith('Game Awareness:')) result.gameAwareness = parseInt(c.replace('Game Awareness:', '').replace('/5', '').trim()) || 0;
  }
  return result;
}

function avg(vals: (number | undefined)[]): number {
  const v = vals.filter((x): x is number => (x || 0) > 0) as number[];
  if (!v.length) return 0;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

// ─── Markdown Renderer (strips ## and ** into styled text) ──────────────────
function RichMarkdownText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        // ## heading
        if (trimmed.startsWith('## ')) {
          const content = trimmed.replace(/^##\s*/, '').replace(/\*\*/g, '');
          return (
            <View key={i} style={{ marginTop: i > 0 ? 12 : 0, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 3, height: 16, backgroundColor: colors.primary, borderRadius: 2 }} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{content}</Text>
            </View>
          );
        }
        // bullet line starting with * or -
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const content = trimmed.slice(2).replace(/\*\*([^*]+)\*\*/g, '$1');
          // Check if there's a bold prefix (e.g. "Title: rest")
          const boldMatch = content.match(/^([^:]+):(.*)/s);
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
              <Text style={{ fontSize: 13, color: colors.primary, marginTop: 3, fontWeight: '900' }}>•</Text>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 }}>
                {boldMatch
                  ? <><Text style={{ fontWeight: '800' }}>{boldMatch[1]}:</Text>{boldMatch[2]}</>
                  : content}
              </Text>
            </View>
          );
        }
        // empty line
        if (!trimmed) return <View key={i} style={{ height: 4 }} />;
        // regular text — strip any remaining **
        const clean = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1');
        return (
          <Text key={i} style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>{clean}</Text>
        );
      })}
    </View>
  );
}

// ─── 1. AI Coach Header Card ───────────────────────────────────────────────────
function AICoachCard({ personalSessions, academyLogs, pillarData, loading }: {
  personalSessions: PersonalSession[];
  academyLogs: AcademyLog[];
  pillarData: PillarData;
  loading: boolean;
}) {
  const { user } = useAuth();
  const [insight, setInsight] = useState<string>('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [plan, setPlan] = useState<string>('');
  const [showPlan, setShowPlan] = useState(false);
  const generated = useRef(false);

  const generateInsight = useCallback(async () => {
    if (!user || generated.current || loading) return;
    const hasSessions = personalSessions.length > 0 || academyLogs.length > 0;
    if (!hasSessions) return;
    generated.current = true;
    setInsightLoading(true);

    const pillars = [
      { name: 'Technical', val: pillarData.technical },
      { name: 'Physical', val: pillarData.physical },
      { name: 'Mental', val: pillarData.mental },
      { name: 'Tactical', val: pillarData.tactical },
    ].filter(p => p.val > 0).sort((a, b) => a.val - b.val);

    const weakest = pillars[0]?.name || 'Technical';
    const strongest = pillars[pillars.length - 1]?.name || 'Physical';
    const avgIntensity = academyLogs.length > 0
      ? (academyLogs.reduce((a, l) => a + (l.intensity || 5), 0) / academyLogs.length).toFixed(1) : 'N/A';
    const totalBalls = academyLogs.reduce((a, l) => a + (l.balls_faced || 0), 0);

    const ctx = `Personal sessions (last 7 days): ${personalSessions.length}. ` +
      `Academy logs: ${academyLogs.length}. ` +
      `${strongest} pillar is highest (${pillars[pillars.length - 1]?.val || '—'}/5). ` +
      `${weakest} pillar is lowest (${pillars[0]?.val || '—'}/5). ` +
      `Academy avg intensity: ${avgIntensity}/10. Total balls faced: ${totalBalls}.`;

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('academy-ai-questions', {
        body: {
          mode: 'smart_insight',
          context: ctx,
          weakestPillar: weakest,
          strongestPillar: strongest,
        },
      });
      if (!error && data?.insight) {
        setInsight(data.insight);
      } else {
        const insightText = totalBalls > 0
          ? `Your ${strongest.toLowerCase()} is peaking this week. Focus next session on your ${weakest.toLowerCase()} — it needs specific attention to bring your overall game into balance.`
          : `Complete a session this week and your AI coach will analyse your performance patterns and provide personalised insights.`;
        setInsight(insightText);
      }
    } catch {
      setInsight(`Your ${strongest.toLowerCase()} is showing strong results. Target your ${weakest.toLowerCase()} in the next session to create a more balanced performance profile.`);
    }
    setInsightLoading(false);
  }, [user, loading, personalSessions, academyLogs, pillarData]);

  useFocusEffect(useCallback(() => {
    generated.current = false;
    setInsight('');
    setPlan('');
  }, []));

  useFocusEffect(useCallback(() => {
    if (!loading && !generated.current) generateInsight();
  }, [loading, generateInsight]));

  const generatePlan = async () => {
    if (!user) return;
    setPlanLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('ai-coach-analysis', {
        body: { userId: user.id, analysisType: 'weekly_report', days: 7 },
      });
      if (!error && data?.report) {
        setPlan(data.report);
        setShowPlan(true);
      }
    } catch { }
    setPlanLoading(false);
  };

  const pillarsAvailable = Object.values(pillarData).some(v => v > 0);

  return (
    <>
      <View style={aiCard.container}>
        <View style={aiCard.topRow}>
          <View style={aiCard.iconCircle}>
            <MaterialIcons name="psychology" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={aiCard.label}>AI PERFORMANCE COACH</Text>
            <Text style={aiCard.title}>Smart Insight</Text>
          </View>
          <View style={aiCard.liveBadge}>
            <View style={aiCard.liveDot} />
            <Text style={aiCard.liveText}>LIVE</Text>
          </View>
        </View>

        {insightLoading ? (
          <View style={aiCard.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={aiCard.loadingText}>Analysing your training data...</Text>
          </View>
        ) : insight ? (
          <Text style={aiCard.insightText}>{insight}</Text>
        ) : !pillarsAvailable ? (
          <Text style={aiCard.emptyText}>
            Complete your first session to unlock AI performance insights. Go to Training → Start a Session.
          </Text>
        ) : null}

        <Pressable
          style={[aiCard.planBtn, (planLoading || !pillarsAvailable) && { opacity: 0.5 }]}
          onPress={generatePlan}
          disabled={planLoading || !pillarsAvailable}
        >
          {planLoading ? (
            <><ActivityIndicator size="small" color={colors.textLight} /><Text style={aiCard.planBtnText}>Generating...</Text></>
          ) : (
            <><MaterialIcons name="auto-awesome" size={16} color={colors.textLight} /><Text style={aiCard.planBtnText}>Generate Today's AI Training Plan</Text></>
          )}
        </Pressable>
      </View>

      <Modal visible={showPlan} animationType="slide" transparent onRequestClose={() => setShowPlan(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Your AI Training Plan</Text>
              </View>
              <Pressable onPress={() => setShowPlan(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
              <RichMarkdownText text={plan} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const aiCard = StyleSheet.create({
  container: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.primary + '40',
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  label: { fontSize: 9, fontWeight: '800', color: colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.success + '15', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.success + '40',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { fontSize: 9, fontWeight: '900', color: colors.success, letterSpacing: 0.5 },
  insightText: { fontSize: 14, color: colors.text, lineHeight: 22, fontStyle: 'italic' },
  emptyText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  loadingText: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.sm + 4,
  },
  planBtnText: { fontSize: 14, fontWeight: '800', color: colors.textLight },
});

// ─── 2. Objective Strike Rate (Donut) ─────────────────────────────────────────
function ObjectiveStrikeRate({ personalSessions, academyLogs }: {
  personalSessions: PersonalSession[];
  academyLogs: AcademyLog[];
}) {
  const SIZE = 160;
  const STROKE = 16;
  const R = (SIZE - STROKE) / 2;
  const CIRCUM = 2 * Math.PI * R;

  const totalSessions = personalSessions.length + academyLogs.length;
  const metObjective = [
    ...personalSessions.filter(s => {
      const overall = avg([s.shotExecution, s.footwork, s.timing, s.focus, s.confidence, s.pressureHandling, s.energyLevel, s.reactionSpeed, s.shotSelection, s.gameAwareness]);
      return overall >= 3.5;
    }),
    ...academyLogs.filter(l => (l.technical_rating || 0) >= 3 || (l.intensity || 0) >= 6),
  ].length;

  const rate = totalSessions > 0 ? Math.round((metObjective / totalSessions) * 100) : 0;
  const dashOffset = CIRCUM * (1 - rate / 100);

  const { label, color } = rate >= 80
    ? { label: 'Elite Execution', color: colors.success }
    : rate >= 50
    ? { label: 'Developing Consistency', color: colors.warning }
    : { label: 'Recalibration Needed', color: colors.error };

  return (
    <View style={donut.card}>
      <View style={donut.headerRow}>
        <MaterialIcons name="track-changes" size={18} color={color} />
        <Text style={donut.title}>Objective Strike Rate</Text>
      </View>
      <Text style={donut.subtitle}>Sessions where you hit your target</Text>

      {totalSessions === 0 ? (
        <View style={donut.empty}>
          <Text style={donut.emptyText}>No sessions yet — log a session to track your objective completion rate.</Text>
        </View>
      ) : (
        <View style={donut.content}>
          {/* Donut with centered text overlay using absolute positioning */}
          <View style={{ width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', top: 0, left: 0 }}>
              <Circle
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                stroke={colors.border} strokeWidth={STROKE} fill="none"
              />
              <Circle
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                stroke={color} strokeWidth={STROKE} fill="none"
                strokeDasharray={`${CIRCUM} ${CIRCUM}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                rotation="-90"
                originX={SIZE / 2} originY={SIZE / 2}
              />
            </Svg>
            {/* Centered text as React Native View (no SVG text overlap) */}
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30, fontWeight: '900', color, lineHeight: 34 }}>{rate}%</Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 2 }}>of sessions</Text>
            </View>
          </View>
          <View style={donut.statsCol}>
            <View style={[donut.labelBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
              <Text style={[donut.labelBadgeText, { color }]}>{label}</Text>
            </View>
            <View style={donut.statRow}>
              <MaterialIcons name="check-circle" size={14} color={colors.success} />
              <Text style={donut.statText}>{metObjective} objectives met</Text>
            </View>
            <View style={donut.statRow}>
              <MaterialIcons name="event" size={14} color={colors.textSecondary} />
              <Text style={donut.statText}>{totalSessions} total sessions</Text>
            </View>
            <View style={donut.statRow}>
              <MaterialIcons name="info-outline" size={13} color={colors.textSecondary} />
              <Text style={[donut.statText, { fontSize: 10, lineHeight: 14, color: colors.textSecondary }]}>
                Target: avg rating ≥3.5/5 or intensity ≥6/10
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const donut = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: -4 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  statsCol: { flex: 1, gap: spacing.sm, minWidth: 140 },
  labelBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: borderRadius.full, borderWidth: 1.5, alignSelf: 'flex-start',
  },
  labelBadgeText: { fontSize: 12, fontWeight: '800' },
  statRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  statText: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },
});

// ─── 3. Player DNA Radar Chart ─────────────────────────────────────────────────
function PlayerDNARadar({ pillarData }: { pillarData: PillarData }) {
  const SIZE = 200;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const MAX_R = 70;
  const LEVELS = 5;

  const pillars = [
    { name: 'Technical', val: pillarData.technical, color: colors.technical || '#2196F3', angle: -90 },
    { name: 'Physical', val: pillarData.physical, color: colors.physical || '#4CAF50', angle: 0 },
    { name: 'Tactical', val: pillarData.tactical, color: colors.tactical || '#FF9800', angle: 90 },
    { name: 'Mental', val: pillarData.mental, color: colors.mental || '#9C27B0', angle: 180 },
  ];

  const pt = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };

  // Grid levels (background rings)
  const gridPolygons = Array.from({ length: LEVELS }, (_, i) => {
    const r = (MAX_R / LEVELS) * (i + 1);
    const pts = pillars.map(p => pt(p.angle, r));
    return pts.map(({ x, y }) => `${x},${y}`).join(' ');
  });

  // Data polygon
  const dataPoints = pillars.map(p => {
    const r = p.val > 0 ? (p.val / 5) * MAX_R : 0;
    return pt(p.angle, r);
  });
  const dataPolygon = dataPoints.map(({ x, y }) => `${x},${y}`).join(' ');

  // Axis lines
  const axisLines = pillars.map(p => ({
    from: pt(p.angle, 0),
    to: pt(p.angle, MAX_R),
  }));

  // Label positions (slightly further out)
  const labelOffset = MAX_R + 24;
  const labelPositions = pillars.map(p => ({ ...pt(p.angle, labelOffset), ...p }));

  const hasData = Object.values(pillarData).some(v => v > 0);

  return (
    <View style={radar.card}>
      <View style={radar.headerRow}>
        <MaterialIcons name="radar" size={18} color={colors.primary} />
        <Text style={radar.title}>Player DNA</Text>
        <Text style={radar.subtitle}>4 Pillars · out of 5</Text>
      </View>

      {!hasData ? (
        <View style={radar.empty}>
          <Text style={radar.emptyText}>Complete freestyle sessions with ratings to see your Player DNA shape.</Text>
        </View>
      ) : (
        <>
          <View style={{ alignItems: 'center' }}>
            <Svg width={SIZE + 60} height={SIZE + 60} viewBox={`${-30} ${-30} ${SIZE + 60} ${SIZE + 60}`}>
              {/* Grid polygons */}
              {gridPolygons.map((pts, i) => (
                <Polygon key={i} points={pts} fill="none" stroke={colors.border} strokeWidth={1} opacity={0.6} />
              ))}

              {/* Axis lines */}
              {axisLines.map((line, i) => (
                <Line key={i} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}
                  stroke={colors.border} strokeWidth={1} />
              ))}

              {/* Data polygon */}
              <Polygon
                points={dataPolygon}
                fill={colors.primary + '25'}
                stroke={colors.primary}
                strokeWidth={2.5}
              />

              {/* Data points */}
              {dataPoints.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r={5}
                  fill={pillars[i].color} stroke={colors.surface} strokeWidth={2} />
              ))}

              {/* Labels */}
              {labelPositions.map((p, i) => (
                <G key={i}>
                  <SvgText
                    x={p.x} y={p.y - 4}
                    textAnchor="middle" fontSize="11" fontWeight="800"
                    fill={p.color}
                  >{p.name}</SvgText>
                  <SvgText
                    x={p.x} y={p.y + 10}
                    textAnchor="middle" fontSize="13" fontWeight="900"
                    fill={p.val > 0 ? p.color : colors.border}
                  >{p.val > 0 ? p.val.toFixed(1) : '—'}</SvgText>
                </G>
              ))}
            </Svg>
          </View>

          {/* Legend pills */}
          <View style={radar.legendRow}>
            {pillars.map(p => (
              <View key={p.name} style={[radar.legendPill, { borderColor: p.color + '60', backgroundColor: p.color + '12' }]}>
                <View style={[radar.legendDot, { backgroundColor: p.color }]} />
                <Text style={[radar.legendText, { color: p.color }]}>{p.name}</Text>
                <Text style={[radar.legendVal, { color: p.color }]}>{p.val > 0 ? p.val.toFixed(1) : '—'}</Text>
              </View>
            ))}
          </View>

          {/* Imbalance alert */}
          {(() => {
            const vals = pillars.filter(p => p.val > 0);
            if (vals.length < 2) return null;
            const minP = vals.reduce((a, b) => a.val < b.val ? a : b);
            const maxP = vals.reduce((a, b) => a.val > b.val ? a : b);
            if (maxP.val - minP.val >= 2) {
              return (
                <View style={[radar.alertBox, { borderColor: colors.warning + '60', backgroundColor: colors.warning + '10' }]}>
                  <MaterialIcons name="warning" size={14} color={colors.warning} />
                  <Text style={radar.alertText}>
                    <Text style={{ fontWeight: '800' }}>Pillar imbalance detected.</Text> {minP.name} ({minP.val.toFixed(1)}) is significantly lower than {maxP.name} ({maxP.val.toFixed(1)}). Target {minP.name.toLowerCase()} drills in your next session.
                  </Text>
                </View>
              );
            }
            return null;
          })()}
        </>
      )}
    </View>
  );
}

const radar = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 11, color: colors.textSecondary, marginLeft: 2 },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  legendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 11, fontWeight: '700' },
  legendVal: { fontSize: 12, fontWeight: '900' },
  alertBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    borderRadius: borderRadius.md, borderWidth: 1, padding: spacing.sm,
  },
  alertText: { fontSize: 12, color: colors.text, lineHeight: 18, flex: 1 },
});

// ─── 4. Discipline Breakdown ───────────────────────────────────────────────────
function DisciplineBreakdown({ academyLogs }: { academyLogs: AcademyLog[] }) {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);

  const DISCIPLINES = [
    { key: 'Batting', icon: 'sports-cricket', color: colors.technical || '#2196F3' },
    { key: 'Bowling', icon: 'sports-cricket', color: colors.physical || '#4CAF50' },
    { key: 'Fielding', icon: 'flag', color: colors.tactical || '#FF9800' },
    { key: 'Fitness', icon: 'fitness-center', color: colors.mental || '#9C27B0' },
  ];

  const grouped = DISCIPLINES.map(d => {
    const logs = academyLogs.filter(l =>
      l.session_type?.toLowerCase().includes(d.key.toLowerCase()) ||
      (d.key === 'Batting' && (l.balls_faced || 0) > 0 && !l.session_type?.toLowerCase().includes('bowl')) ||
      (d.key === 'Fitness' && l.session_type?.toLowerCase().includes('fitness'))
    );
    const avgRating = logs.length > 0
      ? avg(logs.map(l => l.technical_rating || l.effort_rating || 0))
      : 0;
    const totalBalls = logs.reduce((a, l) => a + (l.balls_faced || 0), 0);
    const totalWickets = logs.reduce((a, l) => a + (l.wickets || 0), 0);
    const totalCatches = logs.reduce((a, l) => a + (l.catches || 0), 0);
    return { ...d, logs, count: logs.length, avgRating, totalBalls, totalWickets, totalCatches };
  });

  const maxCount = Math.max(...grouped.map(d => d.count), 1);
  const BAR_MAX_H = 80;

  const selectedData = grouped.find(d => d.key === selectedDiscipline);

  return (
    <>
      <View style={disc.card}>
        <View style={disc.headerRow}>
          <MaterialIcons name="bar-chart" size={18} color={colors.primary} />
          <Text style={disc.title}>Discipline Breakdown</Text>
        </View>
        <Text style={disc.subtitle}>Academy sessions by type — tap a bar to deep dive</Text>

        {academyLogs.length === 0 ? (
          <View style={disc.empty}>
            <Text style={disc.emptyText}>Log academy sessions to see your discipline breakdown here.</Text>
          </View>
        ) : (
          <View style={disc.barsRow}>
            {grouped.map(d => {
              const barH = Math.max(4, Math.round((d.count / maxCount) * BAR_MAX_H));
              const isSelected = selectedDiscipline === d.key;
              return (
                <Pressable
                  key={d.key}
                  style={disc.barCol}
                  onPress={() => setSelectedDiscipline(isSelected ? null : d.key)}
                >
                  <Text style={[disc.barVal, { color: d.count > 0 ? d.color : colors.border }]}>
                    {d.count > 0 ? d.count : ''}
                  </Text>
                  <View style={disc.barTrack}>
                    <View style={[disc.barFill, {
                      height: barH, backgroundColor: d.count > 0 ? d.color : colors.border,
                      borderRadius: 4, opacity: isSelected ? 1 : 0.7,
                    }]} />
                  </View>
                  {d.avgRating > 0 && (
                    <View style={[disc.ratingBadge, { backgroundColor: d.color + '18' }]}>
                      <Text style={[disc.ratingBadgeText, { color: d.color }]}>{d.avgRating.toFixed(1)}</Text>
                    </View>
                  )}
                  <Text style={[disc.barLabel, isSelected && { color: d.color, fontWeight: '800' }]}>{d.key}</Text>
                  {isSelected && <View style={[disc.selectedIndicator, { backgroundColor: d.color }]} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Deep Dive Modal */}
      <Modal visible={!!selectedData} animationType="slide" transparent onRequestClose={() => setSelectedDiscipline(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 }} />
            {selectedData && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: selectedData.color + '20', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name={selectedData.icon as any} size={18} color={selectedData.color} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{selectedData.key} Deep Dive</Text>
                  </View>
                  <Pressable onPress={() => setSelectedDiscipline(null)} hitSlop={8}>
                    <MaterialIcons name="close" size={22} color={colors.text} />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40, gap: spacing.md }} showsVerticalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {[
                      { label: 'Sessions', val: String(selectedData.count), color: selectedData.color },
                      { label: 'Avg Rating', val: selectedData.avgRating > 0 ? `${selectedData.avgRating.toFixed(1)}/5` : '—', color: selectedData.color },
                      selectedData.key === 'Batting' && { label: 'Balls Faced', val: String(selectedData.totalBalls), color: colors.technical },
                      selectedData.key === 'Bowling' && { label: 'Wickets', val: String(selectedData.totalWickets), color: colors.physical },
                      selectedData.key === 'Fielding' && { label: 'Catches', val: String(selectedData.totalCatches), color: colors.tactical },
                    ].filter(Boolean).map((stat: any, i) => (
                      <View key={i} style={{ flex: 1, minWidth: '28%', backgroundColor: stat.color + '12', borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: stat.color + '30' }}>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: stat.color }}>{stat.val}</Text>
                        <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 2, textAlign: 'center' }}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }}>Recent Sessions</Text>
                  {selectedData.logs.slice(0, 8).map((log, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '60' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selectedData.color }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{log.log_date}</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                          {log.duration_minutes}min · Intensity {log.intensity}/10
                          {log.balls_faced ? ` · ${log.balls_faced} balls` : ''}
                          {log.wickets ? ` · ${log.wickets} wkts` : ''}
                        </Text>
                        {log.notes ? <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>{log.notes}</Text> : null}
                      </View>
                      {(log.technical_rating || log.effort_rating) > 0 && (
                        <View style={{ backgroundColor: selectedData.color + '20', borderRadius: borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: selectedData.color }}>
                            {(log.technical_rating || log.effort_rating)}/5
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                  {selectedData.logs.length === 0 && (
                    <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg }}>No {selectedData.key.toLowerCase()} sessions logged yet.</Text>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const disc = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: -4 },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },
  barsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 4, position: 'relative' },
  barVal: { fontSize: 14, fontWeight: '900' },
  barTrack: { width: '70%', height: 80, justifyContent: 'flex-end' },
  barFill: { width: '100%' },
  ratingBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: borderRadius.sm },
  ratingBadgeText: { fontSize: 10, fontWeight: '800' },
  barLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  selectedIndicator: { position: 'absolute', bottom: -6, width: '40%', height: 3, borderRadius: 1.5 },
});

// ─── 5. Consistency Heatmap ────────────────────────────────────────────────────
function ConsistencyHeatmap({ sessionDates }: { sessionDates: Set<string> }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const CELL = Math.floor((SCREEN_WIDTH - spacing.md * 2 - spacing.md * 2 - 4 * 6) / 7);

  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const count = sessionDates.has(dateStr) ? 1 : 0;
    const isFuture = dateStr > today.toISOString().split('T')[0];
    const isToday = dateStr === today.toISOString().split('T')[0];
    return { d, dateStr, count, isFuture, isToday };
  });

  // Pad so week starts on Monday
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const padded: (typeof cells[0] | null)[] = [...Array(firstDow).fill(null), ...cells];

  const logged = cells.filter(c => c.count > 0).length;
  const totalDaysSoFar = Math.min(daysInMonth, today.getDate());
  const pct = totalDaysSoFar > 0 ? Math.round((logged / totalDaysSoFar) * 100) : 0;
  const consistency = pct >= 70 ? 'Strong' : pct >= 40 ? 'Building' : 'Low';
  const consistencyColor = pct >= 70 ? colors.success : pct >= 40 ? colors.warning : colors.error;

  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={heat.card}>
      <View style={heat.headerRow}>
        <MaterialIcons name="grid-on" size={18} color={colors.primary} />
        <Text style={heat.title}>Consistency Heatmap</Text>
      </View>
      {/* Explanation banner */}
      <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: 3 }}>
        <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
          Each square = 1 day this month. Green = session logged. The darker the green, the more sessions that day. Grey = no training. Use this to spot gaps in your routine.
        </Text>
      </View>
      <View style={heat.metaRow}>
        <Text style={heat.monthLabel}>{monthName}</Text>
        <View style={[heat.statBadge, { backgroundColor: consistencyColor + '18', borderColor: consistencyColor + '40' }]}>
          <Text style={[heat.statBadgeText, { color: consistencyColor }]}>{consistency} · {logged}/{totalDaysSoFar} days · {pct}%</Text>
        </View>
      </View>

      {/* Day headers */}
      <View style={heat.daysRow}>
        {DAYS.map((d, i) => <Text key={i} style={heat.dayHdr}>{d}</Text>)}
      </View>

      {/* Grid */}
      <View style={heat.grid}>
        {padded.map((cell, i) => {
          if (!cell) return <View key={`pad_${i}`} style={[heat.cell, { width: CELL, height: CELL, opacity: 0 }]} />;
          const bg = cell.isFuture
            ? colors.background
            : cell.count >= 2
            ? '#166534'
            : cell.count === 1
            ? '#22C55E'
            : '#E5E7EB';
          return (
            <View
              key={cell.dateStr}
              style={[
                heat.cell,
                { width: CELL, height: CELL, backgroundColor: bg, borderRadius: 3 },
                cell.isToday && { borderWidth: 2, borderColor: colors.primary },
              ]}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={heat.legendRow}>
        <Text style={heat.legendLabel}>Less</Text>
        {['#E5E7EB', '#22C55E', '#166534'].map((c, i) => (
          <View key={i} style={[heat.legendCell, { backgroundColor: c, borderRadius: 3 }]} />
        ))}
        <Text style={heat.legendLabel}>More</Text>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={[heat.legendCell, { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent', borderRadius: 3 }]} />
          <Text style={heat.legendLabel}>Today</Text>
        </View>
      </View>
    </View>
  );
}

const heat = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  monthLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  statBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full, borderWidth: 1 },
  statBadgeText: { fontSize: 11, fontWeight: '800' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-around' },
  dayHdr: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { margin: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendCell: { width: 12, height: 12 },
  legendLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
});

// ─── Career Stats Card ───────────────────────────────────────────────────────
// Matches Team Analytics style exactly:
// Row 1: Total Sessions | Training Time
// Row 2: Batting Success Rate | Bowling Success Rate
// Row 3: Fielding Success Rate (full width)
//
// Success Rate definitions (from post-training questions):
//   Batting  = runs_scored / balls_faced × 100  (balls middled / balls faced)
//   Bowling  = wickets / (balls_bowled/6) normalised, or if no wickets: accuracy from runs_conceded
//   Fielding = (catches + run_outs + stumpings) / total_fielding_attempts × 100
function CareerStatsCard({ personalSessions, academyLogs }: {
  personalSessions: PersonalSession[];
  academyLogs: AcademyLog[];
}) {
  // ── Volume ──────────────────────────────────────────────────────────────────
  const totalSessions = academyLogs.length + personalSessions.length;
  const totalMins =
    academyLogs.reduce((a, l) => a + (l.duration_minutes || 0), 0) +
    personalSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const trainingHours = Math.floor(totalMins / 60);
  const trainingMinsRem = totalMins % 60;
  const trainingTimeStr = totalMins >= 60
    ? `${trainingHours}h ${trainingMinsRem}m`
    : `${totalMins}m`;

  // ── Batting Success Rate: balls middled (runs_scored) / balls_faced ─────────
  const totalBallsFaced = academyLogs.reduce((a, l) => a + (l.balls_faced || 0), 0);
  const totalBallsMiddled = academyLogs.reduce((a, l) => a + ((l as any).runs_scored || 0), 0);
  const battingSR = totalBallsFaced > 0
    ? Math.round((totalBallsMiddled / totalBallsFaced) * 100)
    : 0;
  const hasBatting = totalBallsFaced > 0;

  // ── Bowling Success Rate: accurate balls / balls_bowled ─────────────────────
  // "Accurate" = total balls minus runs conceded per ball (proxy: dot balls)
  // We use: (balls_bowled - runs_conceded) / balls_bowled × 100
  // If no runs_conceded data, fall back to wickets-per-over percentage (capped at 100)
  const totalBallsBowled = academyLogs.reduce((a, l) => a + (l.balls_bowled || 0), 0);
  const totalRunsConceded = academyLogs.reduce((a, l) => a + ((l as any).runs_conceded || 0), 0);
  const totalWickets = academyLogs.reduce((a, l) => a + (l.wickets || 0), 0);
  let bowlingSR = 0;
  if (totalBallsBowled > 0) {
    if (totalRunsConceded > 0) {
      // dot ball percentage: (balls without runs) / total balls
      const dotBalls = Math.max(0, totalBallsBowled - totalRunsConceded);
      bowlingSR = Math.min(100, Math.round((dotBalls / totalBallsBowled) * 100));
    } else {
      // fallback: wickets per over as success proxy (capped at 100%)
      const overs = totalBallsBowled / 6;
      bowlingSR = Math.min(100, Math.round((totalWickets / Math.max(overs, 1)) * 20));
    }
  }
  const hasBowling = totalBallsBowled > 0;

  // ── Fielding Success Rate: successful actions / total attempts ───────────────
  const totalCatches = academyLogs.reduce((a, l) => a + (l.catches || 0), 0);
  const totalRunOuts = academyLogs.reduce((a, l) => a + ((l as any).run_outs || 0), 0);
  const totalStumpings = academyLogs.reduce((a, l) => a + ((l as any).stumpings || 0), 0);
  const totalFieldingSuccess = totalCatches + totalRunOuts + totalStumpings;
  // We don't have "total attempts" so we compute success vs a benchmark:
  // Use effort_rating as a proxy — if avg effort ≥ 8/10 → 80%+ success rate
  // But for simplicity: totalFieldingSuccess / (academyFielding sessions × expected_per_session)
  // Best honest approach: show the absolute total and use fielding logs count as denominator
  const fieldingLogs = academyLogs.filter(l =>
    (l.session_type || '').toLowerCase().includes('field') ||
    (l.catches || 0) > 0 || (l as any).run_outs > 0 || (l as any).stumpings > 0
  );
  // Each fielding session an average player attempts ~10 actions
  const expectedFieldingAttempts = fieldingLogs.length * 10;
  const fieldingSR = expectedFieldingAttempts > 0
    ? Math.min(100, Math.round((totalFieldingSuccess / expectedFieldingAttempts) * 100))
    : 0;
  const hasFielding = fieldingLogs.length > 0 || totalFieldingSuccess > 0;

  // ── Metric Cell ─────────────────────────────────────────────────────────────
  const MetricCell = ({
    emoji, value, label, sublabel, flex, color,
  }: {
    emoji: string; value: string; label: string; sublabel?: string;
    flex?: number; color?: string;
  }) => (
    <View style={[cstat.cell, flex !== undefined && { flex }]}>
      <Text style={cstat.cellEmoji}>{emoji}</Text>
      <Text style={[cstat.cellValue, color ? { color } : {}]}>{value}</Text>
      {sublabel ? (
        <Text style={cstat.cellSublabel}>{sublabel}</Text>
      ) : null}
      <Text style={cstat.cellLabel}>{label}</Text>
    </View>
  );

  const srColor = (pct: number) =>
    pct >= 70 ? colors.success : pct >= 40 ? colors.warning : colors.error;

  return (
    <View style={cstat.card}>
      <Text style={cstat.cardTitle}>Career Stats</Text>
      <Text style={cstat.cardSubtitle}>All-time from academy logs</Text>

      {totalSessions === 0 ? (
        <View style={cstat.emptyBox}>
          <Text style={cstat.emptyText}>No sessions logged yet. Start training to build your career stats.</Text>
        </View>
      ) : (
        <>
          {/* Row 1: Total Sessions | Training Time */}
          <View style={cstat.row}>
            <MetricCell
              emoji="📅"
              value={String(totalSessions)}
              label="Total Sessions"
            />
            <MetricCell
              emoji="⏱️"
              value={trainingTimeStr}
              label="Training Time"
            />
          </View>

          {/* Row 2: Batting SR | Bowling SR */}
          <View style={cstat.row}>
            <MetricCell
              emoji="🏏"
              value={hasBatting ? `${battingSR}%` : '0%'}
              label="Batting"
              sublabel="Success Rate"
              color={hasBatting ? srColor(battingSR) : colors.textSecondary}
            />
            <MetricCell
              emoji="⚾"
              value={hasBowling ? `${bowlingSR}%` : '0%'}
              label="Bowling"
              sublabel="Success Rate"
              color={hasBowling ? srColor(bowlingSR) : colors.textSecondary}
            />
          </View>

          {/* Row 3: Fielding SR (full width) */}
          <View style={cstat.row}>
            <View style={[cstat.cell, { flex: 1 }]}>
              <Text style={cstat.cellEmoji}>🤚</Text>
              <Text style={[cstat.cellValue, { color: hasFielding ? srColor(fieldingSR) : colors.textSecondary }]}>
                {hasFielding ? `${fieldingSR}%` : '0%'}
              </Text>
              <Text style={cstat.cellSublabel}>Success Rate</Text>
              <Text style={cstat.cellLabel}>Fielding</Text>
              {hasFielding && totalFieldingSuccess > 0 && (
                <Text style={cstat.cellNote}>
                  {totalCatches > 0 ? `${totalCatches} catches` : ''}
                  {totalRunOuts > 0 ? `  ${totalRunOuts} run outs` : ''}
                  {totalStumpings > 0 ? `  ${totalStumpings} stumpings` : ''}
                </Text>
              )}
            </View>
          </View>

          {/* Sub-detail row: raw numbers */}
          {(hasBatting || hasBowling) && (
            <View style={cstat.detailRow}>
              {hasBatting && (
                <View style={cstat.detailChip}>
                  <Text style={cstat.detailChipText}>
                    🏏 {totalBallsMiddled} middled / {totalBallsFaced} faced
                  </Text>
                </View>
              )}
              {hasBowling && (
                <View style={cstat.detailChip}>
                  <Text style={cstat.detailChipText}>
                    ⚾ {totalWickets} wkts · {Math.floor(totalBallsBowled / 6)}.{totalBallsBowled % 6} ov
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const cstat = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: -spacing.xs },
  emptyBox: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: borderRadius.lg, padding: spacing.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, gap: 2,
    minHeight: 110,
  },
  cellEmoji: { fontSize: 26, marginBottom: 4 },
  cellValue: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  cellSublabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  cellLabel: { fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'center' },
  cellNote: { fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detailChip: {
    backgroundColor: colors.background, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  detailChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});

// ─── Session History (collapsible) ────────────────────────────────────────────
function SessionHistoryCard({ personalSessions }: { personalSessions: PersonalSession[] }) {
  const [expanded, setExpanded] = useState(false);
  if (personalSessions.length === 0) return null;

  function getLabel(overall: number) {
    if (overall >= 4.5) return { label: 'Elite', color: '#7C3AED' };
    if (overall >= 4) return { label: 'Excellent', color: colors.success };
    if (overall >= 3.5) return { label: 'Good', color: colors.primary };
    if (overall >= 2.5) return { label: 'Average', color: colors.warning };
    return { label: 'Needs Work', color: colors.error };
  }
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const shown = expanded ? personalSessions : personalSessions.slice(0, 3);

  return (
    <View style={hist.card}>
      <Pressable style={hist.headerRow} onPress={() => setExpanded(e => !e)}>
        <MaterialIcons name="history" size={18} color={colors.textSecondary} />
        <Text style={hist.title}>Personal Session History</Text>
        <View style={hist.badge}><Text style={hist.badgeText}>{personalSessions.length}</Text></View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
      </Pressable>

      {shown.map((s, i) => {
        const overall = avg([s.shotExecution, s.footwork, s.timing, s.focus, s.confidence, s.pressureHandling, s.energyLevel, s.reactionSpeed, s.shotSelection, s.gameAwareness]);
        const { label, color } = getLabel(overall);
        return (
          <View key={s.id} style={[hist.row, i === 0 && { marginTop: spacing.xs }]}>
            <View style={{ flex: 1 }}>
              <Text style={hist.date}>{fmtDate(s.completed_at || '')}</Text>
              <Text style={hist.meta}>{s.duration_minutes}min</Text>
            </View>
            <View style={[hist.labelBadge, { backgroundColor: color + '18' }]}>
              <Text style={[hist.labelBadgeText, { color }]}>{label}</Text>
            </View>
            <Text style={[hist.score, { color }]}>{overall > 0 ? overall.toFixed(1) : '—'}</Text>
          </View>
        );
      })}

      {personalSessions.length > 3 && (
        <Pressable style={hist.showMoreBtn} onPress={() => setExpanded(e => !e)}>
          <Text style={hist.showMoreText}>{expanded ? 'Show less' : `Show all ${personalSessions.length} sessions`}</Text>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={14} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const hist = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 0,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  badge: { backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border + '60' },
  date: { fontSize: 13, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  labelBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  labelBadgeText: { fontSize: 10, fontWeight: '700' },
  score: { fontSize: 18, fontWeight: '900', minWidth: 36, textAlign: 'right' },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border + '60' },
  showMoreText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [personalSessions, setPersonalSessions] = useState<PersonalSession[]>([]);
  const [academyLogs, setAcademyLogs] = useState<AcademyLog[]>([]);
  const [pillarData, setPillarData] = useState<PillarData>({ technical: 0, physical: 0, mental: 0, tactical: 0 });
  const [sessionDates, setSessionDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseClient();

    // Personal sessions (all completed)
    const { data: sessData } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50);

    const personal: PersonalSession[] = (sessData || []).map((s: any) => {
      const parsed = parseNotes(s.notes || '');
      return {
        id: s.id,
        completed_at: s.completed_at || s.scheduled_date,
        duration_minutes: s.duration_minutes || 0,
        notes: s.notes || '',
        shotExecution: parsed.shotExecution || 0,
        footwork: parsed.footwork || 0,
        timing: parsed.timing || 0,
        focus: parsed.focus || 0,
        confidence: parsed.confidence || 0,
        pressureHandling: parsed.pressureHandling || 0,
        energyLevel: parsed.energyLevel || 0,
        reactionSpeed: parsed.reactionSpeed || 0,
        shotSelection: parsed.shotSelection || 0,
        gameAwareness: parsed.gameAwareness || 0,
      };
    });
    setPersonalSessions(personal);

    // Academy logs
    const { data: logData } = await supabase
      .from('academy_training_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(100);

    const academy: AcademyLog[] = (logData || []).map((l: any) => ({
      id: l.id,
      log_date: l.log_date,
      session_type: l.session_type || 'Training',
      duration_minutes: l.duration_minutes || 0,
      intensity: l.intensity || 5,
      technical_rating: l.technical_rating || 0,
      effort_rating: l.effort_rating || 0,
      fitness_rating: l.fitness_rating || 0,
      balls_faced: l.balls_faced || 0,
      balls_bowled: l.balls_bowled || 0,
      wickets: l.wickets || 0,
      catches: l.catches || 0,
      notes: l.notes || '',
    }));
    setAcademyLogs(academy);

    // Compute pillar averages from personal sessions
    const techVals = personal.map(s => avg([s.shotExecution, s.footwork, s.timing])).filter(v => v > 0);
    const physVals = personal.map(s => avg([s.energyLevel, s.reactionSpeed])).filter(v => v > 0);
    const mentalVals = personal.map(s => avg([s.focus, s.confidence, s.pressureHandling])).filter(v => v > 0);
    const tacVals = personal.map(s => avg([s.shotSelection, s.gameAwareness])).filter(v => v > 0);
    const avgArr = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

    // Also incorporate academy technical/fitness ratings
    const acadTechVals = academy.map(l => l.technical_rating).filter(v => v > 0);
    const acadFitVals = academy.map(l => l.fitness_rating).filter(v => v > 0);

    setPillarData({
      technical: avgArr([...techVals, ...acadTechVals]),
      physical: avgArr([...physVals, ...acadFitVals]),
      mental: avgArr(mentalVals),
      tactical: avgArr(tacVals),
    });

    // Build session dates set for heatmap (current month)
    const today = new Date();
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const allDates = new Set<string>();
    personal
      .filter(s => (s.completed_at || '').startsWith(monthStr))
      .forEach(s => allDates.add(s.completed_at.split('T')[0]));
    academy
      .filter(l => l.log_date.startsWith(monthStr))
      .forEach(l => allDates.add(l.log_date));
    setSessionDates(allDates);

    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // Last 7 days for AI card
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const recentPersonal = personalSessions.filter(s => (s.completed_at || '').split('T')[0] >= sevenDaysAgoStr);
  const recentAcademy = academyLogs.filter(l => l.log_date >= sevenDaysAgoStr);

  const totalSessions = personalSessions.length + academyLogs.length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Performance Hub</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your performance data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>Performance Hub</Text>
          <Text style={styles.headerSub}>
            {totalSessions} sessions · Personal + Academy
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <MaterialIcons name="analytics" size={16} color={colors.primary} />
          <Text style={styles.headerBadgeText}>Smart Analytics</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {totalSessions === 0 && (
          <View style={styles.emptyHero}>
            <MaterialIcons name="sports-cricket" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>Your Dashboard Awaits</Text>
            <Text style={styles.emptySubtitle}>
              Complete a training session to unlock your AI Coach, Player DNA radar, discipline breakdown, and consistency heatmap.
            </Text>
          </View>
        )}

        {/* ── Section 1: AI Coach Card ── */}
        <AICoachCard
          personalSessions={recentPersonal}
          academyLogs={recentAcademy}
          pillarData={pillarData}
          loading={loading}
        />

        {/* ── Section 2: Objective Strike Rate ── */}
        <ObjectiveStrikeRate
          personalSessions={personalSessions}
          academyLogs={academyLogs}
        />

        {/* ── Section 3: Player DNA Radar ── */}
        <PlayerDNARadar pillarData={pillarData} />

        {/* ── Section 4: Discipline Breakdown ── */}
        <DisciplineBreakdown academyLogs={academyLogs} />

        {/* ── Section 4b: Career Stats ── */}
        <CareerStatsCard personalSessions={personalSessions} academyLogs={academyLogs} />

        {/* ── Section 5: Consistency Heatmap ── */}
        <ConsistencyHeatmap sessionDates={sessionDates} />

        {/* ── Session History (collapsible) ── */}
        <SessionHistoryCard personalSessions={personalSessions} />
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
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '18', paddingHorizontal: spacing.sm,
    paddingVertical: 6, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  headerBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80, gap: 0 },
  emptyHero: {
    alignItems: 'center', paddingVertical: 40, gap: spacing.sm,
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.xl },
});
