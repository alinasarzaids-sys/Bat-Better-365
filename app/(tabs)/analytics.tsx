import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polygon, Line, Text as SvgText, G, Rect, Path } from 'react-native-svg';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { FunctionsHttpError } from '@supabase/supabase-js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionNote {
  completed_at: string;
  duration_minutes: number;
  notes: string;
  session_type: string;
}
interface AcademyLog {
  log_date: string;
  session_type: string;
  duration_minutes: number;
  intensity: number;
  technical_rating: number;
  effort_rating: number;
  fitness_rating: number;
  balls_faced: number;
  runs_scored: number;
  balls_bowled: number;
  wickets: number;
  catches: number;
  run_outs: number;
  stumpings: number;
  runs_conceded: number;
  notes: string;
}
interface TechLog {
  created_at: string;
  drill_name: string;
  time_elapsed: number;
  technique_quality: number;
  consistency: number;
  shot_control: number;
  timing: number;
  focus_level: number;
  confidence_level: number;
  reflection_notes: string;
}
interface PhysLog {
  created_at: string;
  drill_name: string;
  time_elapsed: number;
  technique_quality: number;
  consistency: number;
  focus_level: number;
  confidence_level: number;
}
interface MentalLog {
  created_at: string;
  drill_name: string;
  time_elapsed: number;
  adherence: number;
  engagement: number;
  focus_level: number;
  confidence_level: number;
  emotional_control: number;
  reflection_notes: string;
}
interface TacLog {
  created_at: string;
  drill_name: string;
  time_elapsed: number;
  field_reading: number;
  shot_selection_matched: boolean;
  adapted_plan: number;
  confidence_pressure: number;
  overall_mood: number;
  confidence: number;
  session_notes: string;
}

type Timeframe = 'week' | 'month' | 'season' | 'alltime';
type TabKey = 'overall' | 'technical' | 'physical' | 'mental' | 'tactical' | 'freestyle';

const TABS: { key: TabKey; label: string; icon: string; color: string }[] = [
  { key: 'overall',   label: 'Overall',   icon: 'dashboard',      color: '#6366F1' },
  { key: 'technical', label: 'Technical', icon: 'sports-cricket',  color: colors.technical || '#2196F3' },
  { key: 'physical',  label: 'Physical',  icon: 'fitness-center',  color: colors.physical  || '#4CAF50' },
  { key: 'mental',    label: 'Mental',    icon: 'psychology',      color: colors.mental    || '#9C27B0' },
  { key: 'tactical',  label: 'Tactical',  icon: 'lightbulb',       color: colors.tactical  || '#FF9800' },
  { key: 'freestyle', label: 'Freestyle', icon: 'flash-on',        color: '#E53935' },
];

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'Last 30 Days' },
  { key: 'season',  label: 'This Season' },
  { key: 'alltime', label: 'All-Time' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function avg(arr: number[]): number {
  const v = arr.filter(x => x > 0);
  if (!v.length) return 0;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}
function fmtMins(m: number): string {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function filterByTimeframe<T extends { created_at?: string; log_date?: string; completed_at?: string }>(items: T[], tf: Timeframe): T[] {
  const now = new Date();
  let from = new Date('2000-01-01');
  if (tf === 'week') { from = new Date(); from.setDate(now.getDate() - 7); }
  else if (tf === 'month') { from = new Date(); from.setDate(now.getDate() - 30); }
  else if (tf === 'season') { from = new Date(); from.setMonth(now.getMonth() - 6); }
  const fromStr = from.toISOString().split('T')[0];
  return items.filter(item => {
    const dateStr = (item.created_at || item.log_date || item.completed_at || '').split('T')[0];
    return dateStr >= fromStr;
  });
}

function parseSessionNotes(notes: string): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  if (!notes) return result;
  const lines = notes.split('\n');
  for (const line of lines) {
    const t = line.trim();
    const kv = t.split(':');
    if (kv.length >= 2) {
      const key = kv[0].trim().toLowerCase().replace(/ /g, '_');
      const val = kv.slice(1).join(':').replace('/5', '').trim();
      const num = parseInt(val);
      result[key] = isNaN(num) ? val : num;
    }
  }
  return result;
}

// ─── AI Coach Card (per-tab) ──────────────────────────────────────────────────
function AIInsightCard({ tab, timeframe, tabColor, title }: {
  tab: TabKey; timeframe: Timeframe; tabColor: string; title: string;
}) {
  const { user } = useAuth();
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const loadedKey = useRef('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const key = `${tab}_${timeframe}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setLoading(true);
    setInsight('');
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('analytics-insights', {
        body: { userId: user.id, tab, timeframe },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await (error as any).context?.text?.() || msg; } catch {}
        }
        console.warn('AI insight error:', msg);
        setInsight('');
      } else {
        setInsight(data?.insight || '');
      }
    } catch (e: any) {
      setInsight('');
    }
    setLoading(false);
  }, [user?.id, tab, timeframe]);

  useEffect(() => { loadedKey.current = ''; }, [tab, timeframe]);
  useEffect(() => { load(); }, [load]);

  if (!loading && !insight) return null;

  return (
    <View style={[aic.card, { borderColor: tabColor + '40' }]}>
      <View style={aic.topRow}>
        <View style={[aic.iconCircle, { backgroundColor: tabColor + '18' }]}>
          <MaterialIcons name="psychology" size={18} color={tabColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[aic.label, { color: tabColor }]}>AI COACH · {title.toUpperCase()}</Text>
          <Text style={aic.subtitle}>Personalised insight from your data</Text>
        </View>
        <View style={[aic.liveBadge, { borderColor: colors.success + '40', backgroundColor: colors.success + '15' }]}>
          <View style={[aic.liveDot, { backgroundColor: colors.success }]} />
          <Text style={[aic.liveText, { color: colors.success }]}>LIVE</Text>
        </View>
      </View>
      {loading ? (
        <View style={aic.loadRow}>
          <ActivityIndicator size="small" color={tabColor} />
          <Text style={[aic.loadText, { color: tabColor }]}>Analysing your {title.toLowerCase()} data...</Text>
        </View>
      ) : (
        <Text style={aic.text}>{insight}</Text>
      )}
    </View>
  );
}
const aic = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1.5, backgroundColor: colors.surface, gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  subtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  loadText: { fontSize: 12, fontStyle: 'italic' },
  text: { fontSize: 14, color: colors.text, lineHeight: 22, fontStyle: 'italic' },
});

// ─── KPI Row ──────────────────────────────────────────────────────────────────
function KPIRow({ items }: {
  items: { label: string; value: string; icon: string; color: string; sub?: string }[]
}) {
  return (
    <View style={kpi.row}>
      {items.map((item, i) => (
        <View key={i} style={[kpi.card, { borderColor: item.color + '30' }]}>
          <View style={[kpi.iconCircle, { backgroundColor: item.color + '18' }]}>
            <MaterialIcons name={item.icon as any} size={18} color={item.color} />
          </View>
          <Text style={[kpi.value, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{item.value}</Text>
          <Text style={kpi.label} numberOfLines={1}>{item.label}</Text>
          {item.sub ? <Text style={kpi.sub} numberOfLines={1}>{item.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}
const kpi = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  card: {
    flex: 1, minWidth: '44%', backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1,
    alignItems: 'center', gap: 4,
  },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  sub: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
});

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function SimpleBarChart({ data, color, title, maxVal = 10 }: {
  data: { label: string; value: number }[]; color: string; title: string; maxVal?: number;
}) {
  if (!data.length || data.every(d => d.value === 0)) return null;
  const maxV = Math.max(...data.map(d => d.value), maxVal * 0.2);
  const BAR_MAX = 100;
  return (
    <View style={bc.card}>
      <Text style={bc.title}>{title}</Text>
      <View style={bc.rows}>
        {data.map((d, i) => {
          const pct = Math.max(4, (d.value / maxV) * BAR_MAX);
          return (
            <View key={i} style={bc.row}>
              <Text style={bc.label} numberOfLines={1}>{d.label}</Text>
              <View style={bc.track}>
                <View style={[bc.fill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
              <Text style={[bc.val, { color }]}>{d.value > 0 ? d.value.toFixed(1) : '—'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const bc = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  rows: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 12, color: colors.textSecondary, width: 100 },
  track: { flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  val: { fontSize: 13, fontWeight: '800', width: 32, textAlign: 'right' },
});

// ─── Trend Line ───────────────────────────────────────────────────────────────
function TrendLine({ points, color, label }: {
  points: { x: string; y: number }[]; color: string; label: string;
}) {
  if (points.length < 1) return null;
  const W = Math.max(1, SCREEN_WIDTH - spacing.md * 4 - 32);
  const H = 130;
  const PAD_L = 32; const PAD_R = 12; const PAD_T = 20; const PAD_B = 30;
  const iW = W - PAD_L - PAD_R;
  const iH = H - PAD_T - PAD_B;
  const minY = Math.max(0, Math.min(...points.map(p => p.y)) - 0.5);
  const maxY = Math.max(...points.map(p => p.y), 1) + 0.5;
  const yRange = Math.max(maxY - minY, 0.1);

  const coords = points.map((p, i) => ({
    x: PAD_L + (points.length === 1 ? iW / 2 : (i / (points.length - 1)) * iW),
    y: PAD_T + iH - ((p.y - minY) / yRange) * iH,
    val: p.y,
    label: p.x,
  }));

  const pathD = coords.length >= 2
    ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
    : '';

  const areaD = pathD && coords.length >= 2
    ? `${pathD} L${coords[coords.length-1].x.toFixed(1)},${(PAD_T+iH).toFixed(1)} L${coords[0].x.toFixed(1)},${(PAD_T+iH).toFixed(1)} Z`
    : '';

  const latest = points[points.length - 1]?.y ?? 0;
  const trend = points.length >= 2 ? latest - points[0].y : 0;
  const trendColor = trend > 0.05 ? colors.success : trend < -0.05 ? colors.error : colors.textSecondary;
  const trendIcon = trend > 0.05 ? '↑' : trend < -0.05 ? '↓' : '→';
  const gridVals = [Math.ceil(minY), Math.round((minY + maxY) / 2), Math.floor(maxY)];

  return (
    <View style={tl2.card}>
      <View style={tl2.topRow}>
        <Text style={tl2.label} numberOfLines={1}>{label}</Text>
        <View style={tl2.statsRow}>
          <Text style={[tl2.latest, { color }]}>{latest.toFixed(1)}<Text style={tl2.sub}>/10</Text></Text>
          {points.length >= 2 && (
            <View style={[tl2.badge, { backgroundColor: trendColor + '20' }]}>
              <Text style={[tl2.badgeText, { color: trendColor }]}>{trendIcon} {Math.abs(trend).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
      <Svg width={W} height={H}>
        {gridVals.filter((v,i,a) => a.indexOf(v)===i).map((v, i) => {
          const y = PAD_T + iH - ((v - minY) / yRange) * iH;
          return (
            <G key={i}>
              <Line x1={PAD_L} y1={y} x2={PAD_L+iW} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray={i===0?'0':'4,3'} />
              <SvgText x={PAD_L-4} y={y+4} fill={colors.textSecondary} fontSize="9" textAnchor="end">{v}</SvgText>
            </G>
          );
        })}
        {areaD ? <Path d={areaD} fill={color} fillOpacity={0.1} /> : null}
        {pathD ? <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {coords.map((c, i) => (
          <G key={i}>
            <Circle cx={c.x} cy={c.y} r={5} fill={colors.surface} stroke={color} strokeWidth={2} />
            <Circle cx={c.x} cy={c.y} r={3} fill={color} />
            <SvgText x={c.x} y={c.y - 10} fill={color} fontSize="10" fontWeight="700" textAnchor="middle">{c.val.toFixed(1)}</SvgText>
          </G>
        ))}
        {coords.map((c, i) => {
          const show = coords.length <= 5 || i === 0 || i === coords.length-1 || i % Math.ceil(coords.length/4) === 0;
          return show ? <SvgText key={`xl${i}`} x={c.x} y={H-4} fill={colors.textSecondary} fontSize="9" textAnchor="middle">{c.label}</SvgText> : null;
        })}
      </Svg>
    </View>
  );
}
const tl2 = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingHorizontal: 4 },
  label: { fontSize: 12, fontWeight: '700', color: colors.text, flex: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  latest: { fontSize: 16, fontWeight: '900' },
  sub: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});

// ─── Radar Chart ─────────────────────────────────────────────────────────────
function RadarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const SIZE = 200; const CX = SIZE / 2; const CY = SIZE / 2; const MAX_R = 70;
  const n = data.length;
  const pt = (angle: number, r: number) => ({
    x: CX + r * Math.cos((angle * Math.PI) / 180),
    y: CY + r * Math.sin((angle * Math.PI) / 180),
  });
  const angles = data.map((_, i) => -90 + (360 / n) * i);
  const gridPolys = [0.25, 0.5, 0.75, 1].map(f => angles.map(a => pt(a, MAX_R * f)).map(({ x, y }) => `${x},${y}`).join(' '));
  const dataPolygon = data.map((d, i) => {
    const r = (d.value / 10) * MAX_R;
    const p = pt(angles[i], r);
    return `${p.x},${p.y}`;
  }).join(' ');
  const maxV = Math.max(...data.map(d => d.value), 0);
  if (maxV === 0) return null;
  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
      <Svg width={SIZE + 60} height={SIZE + 40} viewBox={`-30 -20 ${SIZE + 60} ${SIZE + 40}`}>
        {gridPolys.map((pts, i) => <Polygon key={i} points={pts} fill="none" stroke={colors.border} strokeWidth={1} />)}
        {angles.map((a, i) => { const end = pt(a, MAX_R); return <Line key={i} x1={CX} y1={CY} x2={end.x} y2={end.y} stroke={colors.border} strokeWidth={1} />; })}
        <Polygon points={dataPolygon} fill={color + '30'} stroke={color} strokeWidth={2} />
        {data.map((d, i) => {
          const r = (d.value / 10) * MAX_R;
          const p = pt(angles[i], r);
          return <Circle key={i} cx={p.x} cy={p.y} r={4} fill={color} />;
        })}
        {data.map((d, i) => {
          const p = pt(angles[i], MAX_R + 22);
          return (
            <G key={i}>
              <SvgText x={p.x} y={p.y - 3} textAnchor="middle" fontSize="10" fontWeight="800" fill={colors.text}>{d.label}</SvgText>
              <SvgText x={p.x} y={p.y + 10} textAnchor="middle" fontSize="11" fontWeight="900" fill={color}>{d.value > 0 ? d.value.toFixed(1) : '—'}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── Pie / Donut ──────────────────────────────────────────────────────────────
function DonutChart({ pct, color, label, sublabel }: { pct: number; color: string; label: string; sublabel?: string }) {
  const SIZE = 120; const STROKE = 14; const R = (SIZE - STROKE) / 2;
  const CIRCUM = 2 * Math.PI * R;
  const offset = CIRCUM * (1 - pct / 100);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={color} strokeWidth={STROKE} fill="none"
            strokeDasharray={`${CIRCUM} ${CIRCUM}`} strokeDashoffset={offset}
            strokeLinecap="round" rotation="-90" originX={SIZE / 2} originY={SIZE / 2} />
        </Svg>
        <Text style={{ fontSize: 24, fontWeight: '900', color }}>{pct}%</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 4 }}>{label}</Text>
      {sublabel ? <Text style={{ fontSize: 11, color: colors.textSecondary }}>{sublabel}</Text> : null}
    </View>
  );
}

// ─── Progress Bars ────────────────────────────────────────────────────────────
function ProgressBars({ items, color }: { items: { label: string; value: number; maxVal?: number }[]; color: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((item, i) => {
        const maxV = item.maxVal || 10;
        const pct = item.value > 0 ? Math.min(100, (item.value / maxV) * 100) : 0;
        return (
          <View key={i}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{item.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: item.value > 0 ? color : colors.textSecondary }}>
                {item.value > 0 ? `${item.value.toFixed(1)}/${maxV}` : '—'}
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SCard({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <View style={sc.card}>
      <View style={sc.header}>
        <MaterialIcons name={icon as any} size={16} color={color} />
        <Text style={sc.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
});

// ─── TAB CONTENTS ─────────────────────────────────────────────────────────────

// ── Overall Tab ───────────────────────────────────────────────────────────────
function OverallTab({ sessions, academyLogs, techLogs, physLogs, mentalLogs, tacLogs, tf }: {
  sessions: SessionNote[]; academyLogs: AcademyLog[];
  techLogs: TechLog[]; physLogs: PhysLog[]; mentalLogs: MentalLog[]; tacLogs: TacLog[];
  tf: Timeframe;
}) {
  const totalTime = Math.round(
    sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0) +
    academyLogs.reduce((a, l) => a + (l.duration_minutes || 0), 0) +
    [...techLogs, ...physLogs, ...mentalLogs, ...tacLogs].reduce((a, l: any) => a + Math.round((l.time_elapsed || 0) / 60), 0)
  );
  const totalSessions = sessions.length + academyLogs.length + techLogs.length + physLogs.length + mentalLogs.length + tacLogs.length;
  const totalBalls = academyLogs.reduce((a, l) => a + (l.balls_faced || 0), 0);
  const totalMiddled = academyLogs.reduce((a, l) => a + (l.runs_scored || 0), 0);
  const middleRate = totalBalls > 0 ? Math.round((totalMiddled / totalBalls) * 100) : null;

  const pillarMins = {
    Technical: Math.round(techLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0) + academyLogs.filter(l => (l.session_type || '').toLowerCase().includes('batting') || (l.session_type || '').toLowerCase().includes('tech')).reduce((a, l) => a + (l.duration_minutes || 0), 0)),
    Physical: Math.round(physLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0) + academyLogs.filter(l => (l.session_type || '').toLowerCase().includes('fitness')).reduce((a, l) => a + (l.duration_minutes || 0), 0)),
    Mental: Math.round(mentalLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)),
    Tactical: Math.round(tacLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)),
    Freestyle: Math.round(sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)),
  };

  const pillarColors: Record<string, string> = {
    Technical: colors.technical || '#2196F3',
    Physical: colors.physical || '#4CAF50',
    Mental: colors.mental || '#9C27B0',
    Tactical: colors.tactical || '#FF9800',
    Freestyle: '#E53935',
  };
  const maxMins = Math.max(...Object.values(pillarMins), 1);

  const radarData = [
    { label: 'Technical', value: avg(techLogs.map(l => l.technique_quality)) },
    { label: 'Physical',  value: avg(physLogs.map(l => l.focus_level)) },
    { label: 'Tactical',  value: avg(tacLogs.map(l => l.field_reading)) },
    { label: 'Mental',    value: avg(mentalLogs.map(l => l.adherence)) },
  ];

  return (
    <>
      <AIInsightCard tab="overall" timeframe={tf} tabColor="#6366F1" title="Career" />
      <KPIRow items={[
        { label: 'Total Time', value: fmtMins(totalTime), icon: 'access-time', color: '#6366F1' },
        { label: 'Sessions', value: String(totalSessions), icon: 'event-available', color: colors.success },
        { label: 'Balls Faced', value: totalBalls > 0 ? String(totalBalls) : '—', icon: 'sports-cricket', color: colors.technical || '#2196F3' },
        { label: 'Middle Rate', value: middleRate !== null ? `${middleRate}%` : '—', icon: 'track-changes', color: colors.warning, sub: totalBalls > 0 ? `${totalBalls} faced` : undefined },
      ]} />

      <SCard title="Pillar Balance" icon="radar" color="#6366F1">
        <RadarChart data={radarData} color="#6366F1" />
      </SCard>

      <SCard title="Volume Breakdown" icon="bar-chart" color="#6366F1">
        <View style={{ gap: spacing.sm }}>
          {Object.entries(pillarMins).map(([name, mins]) => {
            const pct = Math.max(2, (mins / maxMins) * 100);
            return (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pillarColors[name] }} />
                <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600', width: 80 }}>{name}</Text>
                <View style={{ flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pillarColors[name], borderRadius: 5 }} />
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, width: 40, textAlign: 'right' }}>{fmtMins(mins)}</Text>
              </View>
            );
          })}
        </View>
      </SCard>
    </>
  );
}

// ── Technical Tab ─────────────────────────────────────────────────────────────
function TechnicalTab({ logs, sessions, academyLogs, tf }: { logs: TechLog[]; sessions: SessionNote[]; academyLogs: AcademyLog[]; tf: Timeframe }) {
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0));
  // Balls faced: academy logs + freestyle session notes
  const ballsFromAcademy = academyLogs.reduce((a, l) => a + (l.balls_faced || 0), 0);
  const ballsFromSessions = sessions.reduce((a, s) => {
    const p = parseSessionNotes(s.notes || '');
    return a + (Number(p['balls_faced']) || 0);
  }, 0);
  const totalBalls = ballsFromAcademy + ballsFromSessions;
  const runsFromAcademy = academyLogs.reduce((a, l) => a + (l.runs_scored || 0), 0);
  const middleRate = totalBalls > 0 ? Math.round((runsFromAcademy / totalBalls) * 100) : null;

  const metricData = [
    { label: 'Shot Execution', value: avg(logs.map(l => l.technique_quality)) },
    { label: 'Footwork', value: avg(logs.map(l => l.consistency)) },
    { label: 'Timing', value: avg(logs.map(l => l.timing)) },
    { label: 'Shot Control', value: avg(logs.map(l => l.shot_control)) },
    { label: 'Focus', value: avg(logs.map((l: any) => l.focus_level || 0)) },
    { label: 'Confidence', value: avg(logs.map((l: any) => l.confidence_level || 0)) },
  ];

  const trendPoints = logs.slice(0, 10).reverse().map((l, i) => ({
    x: fmtDate(l.created_at),
    y: avg([l.technique_quality, l.timing, l.shot_control]),
  }));

  const focusAreas: Record<string, number> = {};
  sessions.forEach(s => {
    const p = parseSessionNotes(s.notes || '');
    const fa = String(p['focus_area'] || p['focus:'] || '').trim();
    if (fa && fa.length > 1) focusAreas[fa] = (focusAreas[fa] || 0) + 1;
  });
  const topFocusAreas = Object.entries(focusAreas).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <AIInsightCard tab="technical" timeframe={tf} tabColor={colors.technical || '#2196F3'} title="Technique" />
      <KPIRow items={[
        { label: 'Sessions', value: String(logs.length), icon: 'sports-cricket', color: colors.technical || '#2196F3' },
        { label: 'Training Time', value: fmtMins(totalMins), icon: 'access-time', color: colors.technical || '#2196F3' },
        { label: 'Balls Faced', value: totalBalls > 0 ? String(totalBalls) : '—', icon: 'sports-cricket', color: colors.warning },
        { label: 'Middle Rate', value: middleRate !== null ? `${middleRate}%` : '—', icon: 'track-changes', color: colors.success },
      ]} />
      <SCard title="Metric Averages" icon="bar-chart" color={colors.technical || '#2196F3'}>
        <ProgressBars items={metricData} color={colors.technical || '#2196F3'} />
      </SCard>
      {trendPoints.length >= 2 && (
        <SCard title="Performance Trend" icon="show-chart" color={colors.technical || '#2196F3'}>
          <TrendLine points={trendPoints} color={colors.technical || '#2196F3'} label="Avg quality over last sessions" />
        </SCard>
      )}
      {topFocusAreas.length > 0 && (
        <SCard title="Focus Area Word Cloud" icon="label" color={colors.technical || '#2196F3'}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {topFocusAreas.map(([area, count], i) => (
              <View key={i} style={{ backgroundColor: (colors.technical || '#2196F3') + '18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: (colors.technical || '#2196F3') + '40' }}>
                <Text style={{ fontSize: 12 + count, color: colors.technical || '#2196F3', fontWeight: '700' }}>{area}</Text>
                <Text style={{ fontSize: 9, color: colors.textSecondary, textAlign: 'center' }}>{count}×</Text>
              </View>
            ))}
          </View>
        </SCard>
      )}
      {logs.length === 0 && (
        <View style={emptyStyle.box}>
          <MaterialIcons name="sports-cricket" size={44} color={colors.border} />
          <Text style={emptyStyle.text}>No technical drill logs in this period. Start a Technical drill to see your data here.</Text>
        </View>
      )}
    </>
  );
}

// ── Physical Tab ──────────────────────────────────────────────────────────────
function PhysicalTab({ logs, tf }: { logs: PhysLog[]; tf: Timeframe }) {
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0));

  const energyTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.focus_level || 0 }));
  const reactionTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.confidence_level || 0 }));

  const avgEnergy = avg(logs.map(l => l.focus_level));
  const avgReaction = avg(logs.map(l => l.confidence_level));
  const avgConsistency = avg(logs.map(l => l.consistency));
  const avgTech = avg(logs.map(l => l.technique_quality));

  // Fatigue flag: sessions > 60 min
  const longSessions = logs.filter(l => (l.time_elapsed || 0) > 3600);
  const longAvgEnergy = longSessions.length > 0 ? avg(longSessions.map(l => l.focus_level)) : null;

  return (
    <>
      <AIInsightCard tab="physical" timeframe={tf} tabColor={colors.physical || '#4CAF50'} title="Workload" />
      <KPIRow items={[
        { label: 'Sessions', value: String(logs.length), icon: 'fitness-center', color: colors.physical || '#4CAF50' },
        { label: 'Training Time', value: fmtMins(totalMins), icon: 'access-time', color: colors.physical || '#4CAF50' },
        { label: 'Avg Energy', value: avgEnergy > 0 ? `${avgEnergy}/10` : '—', icon: 'bolt', color: colors.warning },
        { label: 'Avg Reaction', value: avgReaction > 0 ? `${avgReaction}/10` : '—', icon: 'speed', color: colors.success },
      ]} />
      <SCard title="Avg Ratings Over Time" icon="show-chart" color={colors.physical || '#4CAF50'}>
        <ProgressBars items={[
          { label: 'Energy Level', value: avgEnergy },
          { label: 'Reaction Speed', value: avgReaction },
          { label: 'Consistency', value: avgConsistency },
          { label: 'Technique Quality', value: avgTech },
        ]} color={colors.physical || '#4CAF50'} />
      </SCard>
      {energyTrend.length >= 2 && (
        <SCard title="Energy Trend" icon="trending-up" color={colors.physical || '#4CAF50'}>
          <TrendLine points={energyTrend} color={colors.physical || '#4CAF50'} label="Energy / Focus per session" />
          <TrendLine points={reactionTrend} color={colors.warning} label="Reaction Speed / Confidence" />
        </SCard>
      )}
      {longSessions.length > 0 && (
        <SCard title="Workload Monitor" icon="warning" color={colors.warning}>
          <View style={{ backgroundColor: colors.warning + '12', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.warning + '30' }}>
            <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>
              <Text style={{ fontWeight: '800' }}>{longSessions.length} long sessions</Text> (over 60 min) detected.
              {longAvgEnergy !== null ? ` Average energy in those sessions: ${longAvgEnergy.toFixed(1)}/10.` : ''}
              {'\n'}Consider splitting into two high-intensity 30-min blocks to maintain output.
            </Text>
          </View>
        </SCard>
      )}
      {logs.length === 0 && (
        <View style={emptyStyle.box}>
          <MaterialIcons name="fitness-center" size={44} color={colors.border} />
          <Text style={emptyStyle.text}>No physical drill logs in this period. Start a Physical drill to track workload here.</Text>
        </View>
      )}
    </>
  );
}

// ── Mental Tab ────────────────────────────────────────────────────────────────
function MentalTab({ logs, tf }: { logs: MentalLog[]; tf: Timeframe }) {
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0));

  const avgAdherence = avg(logs.map(l => l.adherence));
  const avgFocus = avg(logs.map(l => l.focus_level));
  const avgConfidence = avg(logs.map(l => l.confidence_level));
  const avgMood = avg(logs.map(l => l.engagement));
  const avgEmotional = avg(logs.map(l => l.emotional_control));

  const moodPct = avgMood > 0 ? Math.round((avgMood / 10) * 100) : 0;
  const confColor = avgConfidence >= 7 ? colors.success : avgConfidence >= 4 ? colors.warning : colors.error;

  const moodData = [
    { label: 'Focus', value: avgFocus },
    { label: 'Confidence', value: avgConfidence },
    { label: 'Adherence', value: avgAdherence },
    { label: 'Pressure Handling', value: avgEmotional },
    { label: 'Engagement', value: avgMood },
  ];

  const confidenceTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.confidence_level || 0 }));

  return (
    <>
      <AIInsightCard tab="mental" timeframe={tf} tabColor={colors.mental || '#9C27B0'} title="Mindset" />
      <KPIRow items={[
        { label: 'Sessions', value: String(logs.length), icon: 'psychology', color: colors.mental || '#9C27B0' },
        { label: 'Training Time', value: fmtMins(totalMins), icon: 'access-time', color: colors.mental || '#9C27B0' },
        { label: 'Avg Confidence', value: avgConfidence > 0 ? `${avgConfidence}/10` : '—', icon: 'star', color: confColor },
        { label: 'Avg Adherence', value: avgAdherence > 0 ? `${avgAdherence}/10` : '—', icon: 'check-circle', color: colors.success },
      ]} />
      <SCard title="Mental Metrics" icon="bar-chart" color={colors.mental || '#9C27B0'}>
        <ProgressBars items={moodData} color={colors.mental || '#9C27B0'} />
      </SCard>
      <SCard title="Overall Mood Average" icon="mood" color={colors.mental || '#9C27B0'}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
          <DonutChart pct={moodPct} color={colors.mental || '#9C27B0'} label="Mood Score" sublabel={`${avgMood.toFixed(1)}/10 avg engagement`} />
        </View>
      </SCard>
      {confidenceTrend.length >= 2 && (
        <SCard title="Confidence Trend" icon="show-chart" color={colors.mental || '#9C27B0'}>
          <TrendLine points={confidenceTrend} color={colors.mental || '#9C27B0'} label="Confidence per session" />
        </SCard>
      )}
      {logs.length === 0 && (
        <View style={emptyStyle.box}>
          <MaterialIcons name="psychology" size={44} color={colors.border} />
          <Text style={emptyStyle.text}>No mental drill logs in this period. Complete Mental drills to track mindset trends.</Text>
        </View>
      )}
    </>
  );
}

// ── Tactical Tab ──────────────────────────────────────────────────────────────
function TacticalTab({ logs, tf }: { logs: TacLog[]; tf: Timeframe }) {
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0));

  const avgFieldReading = avg(logs.map(l => l.field_reading));
  const avgAdapted = avg(logs.map(l => l.adapted_plan));
  const avgConfidence = avg(logs.map(l => l.confidence_pressure));
  const avgMood = avg(logs.map(l => l.overall_mood));

  const matchedYes = logs.filter(l => l.shot_selection_matched === true).length;
  const matchedNo = logs.filter(l => l.shot_selection_matched === false).length;
  const matchedTotal = matchedYes + matchedNo;
  const matchedPct = matchedTotal > 0 ? Math.round((matchedYes / matchedTotal) * 100) : null;

  const capabilityData = [
    { label: 'Shot Selection', value: avgFieldReading },
    { label: 'Game Awareness', value: avg(logs.map(l => l.confidence)) },
    { label: 'Field Reading', value: avgFieldReading },
    { label: 'Adapted Scoring Plan', value: avgAdapted },
    { label: 'Confidence Under Pressure', value: avgConfidence },
  ];

  return (
    <>
      <AIInsightCard tab="tactical" timeframe={tf} tabColor={colors.tactical || '#FF9800'} title="Match IQ" />
      <KPIRow items={[
        { label: 'Scenarios', value: String(logs.length), icon: 'lightbulb', color: colors.tactical || '#FF9800' },
        { label: 'Tactical Time', value: fmtMins(totalMins), icon: 'access-time', color: colors.tactical || '#FF9800' },
        { label: 'Shot Match', value: matchedPct !== null ? `${matchedPct}%` : '—', icon: 'check-circle', color: colors.success, sub: matchedTotal > 0 ? `${matchedYes}/${matchedTotal}` : undefined },
        { label: 'Field Reading', value: avgFieldReading > 0 ? `${avgFieldReading}/10` : '—', icon: 'visibility', color: colors.warning },
      ]} />
      <SCard title="Decision Success" icon="pie-chart" color={colors.tactical || '#FF9800'}>
        {matchedTotal > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: spacing.md }}>
            <DonutChart pct={matchedPct!} color={colors.success} label="Shot Matched" sublabel={`${matchedYes} of ${matchedTotal}`} />
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success }} />
                <Text style={{ fontSize: 13, color: colors.text }}>Yes: {matchedYes} ({matchedPct}%)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error }} />
                <Text style={{ fontSize: 13, color: colors.text }}>No: {matchedNo} ({100 - matchedPct!}%)</Text>
              </View>
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Log scenario sessions to see shot selection data.</Text>
        )}
      </SCard>
      <SCard title="Tactical Capability" icon="bar-chart" color={colors.tactical || '#FF9800'}>
        <ProgressBars items={capabilityData} color={colors.tactical || '#FF9800'} />
      </SCard>
      {logs.length === 0 && (
        <View style={emptyStyle.box}>
          <MaterialIcons name="lightbulb" size={44} color={colors.border} />
          <Text style={emptyStyle.text}>No tactical logs in this period. Use the Scenario Builder in Training to log sessions.</Text>
        </View>
      )}
    </>
  );
}

// ── Freestyle Tab ─────────────────────────────────────────────────────────────
function FreestyleTab({ sessions, tf }: { sessions: SessionNote[]; tf: Timeframe }) {
  const totalMins = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);

  const equipmentCount: Record<string, number> = {};
  sessions.forEach(s => {
    if (!s.notes) return;
    try {
      const parsed = JSON.parse(s.notes);
      if (Array.isArray(parsed.training_types)) {
        parsed.training_types.forEach((t: string) => { equipmentCount[t] = (equipmentCount[t] || 0) + 1; });
      }
    } catch {
      const p = parseSessionNotes(s.notes);
      const eq = String(p['equipment'] || p['training_type'] || '').trim();
      if (eq) equipmentCount[eq] = (equipmentCount[eq] || 0) + 1;
    }
  });

  const sorted = Object.entries(equipmentCount).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...sorted.map(s => s[1]), 1);
  const EQUIP_COLORS = ['#E53935', '#1565C0', '#2E7D32', '#F57C00', '#7B2FBE', '#0288D1', '#558B2F'];

  const topMethod = sorted[0]?.[0];
  const topPct = sorted[0] && sessions.length > 0 ? Math.round((sorted[0][1] / sessions.length) * 100) : null;

  return (
    <>
      <AIInsightCard tab="freestyle" timeframe={tf} tabColor="#E53935" title="Training Variety" />
      <KPIRow items={[
        { label: 'Sessions', value: String(sessions.length), icon: 'flash-on', color: '#E53935' },
        { label: 'Total Time', value: fmtMins(totalMins), icon: 'access-time', color: '#E53935' },
        { label: 'Methods Used', value: String(Object.keys(equipmentCount).length || '—'), icon: 'category', color: colors.warning },
        { label: 'Top Method', value: topPct !== null ? `${topPct}%` : '—', icon: 'star', color: colors.primary, sub: topMethod },
      ]} />
      {sorted.length > 0 ? (
        <SCard title="Training Method Distribution" icon="bar-chart" color="#E53935">
          <View style={{ gap: spacing.sm }}>
            {sorted.map(([name, count], i) => {
              const barColor = EQUIP_COLORS[i % EQUIP_COLORS.length];
              const pct = Math.max(4, (count / maxCount) * 100);
              const sessionPct = sessions.length > 0 ? Math.round((count / sessions.length) * 100) : 0;
              return (
                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: barColor }} />
                  <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600', width: 110 }} numberOfLines={1}>{name}</Text>
                  <View style={{ flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 5 }} />
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, width: 50, textAlign: 'right' }}>{count}× ({sessionPct}%)</Text>
                </View>
              );
            })}
          </View>
          {topPct !== null && topPct > 70 && (
            <View style={{ backgroundColor: colors.warning + '15', borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.md, borderWidth: 1, borderColor: colors.warning + '30', flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' }}>
              <MaterialIcons name="warning" size={14} color={colors.warning} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 }}>
                <Text style={{ fontWeight: '800' }}>{topPct}% of sessions</Text> use {topMethod}. Mix in Side-Arm throws, live bowlers, or different environments to improve game awareness.
              </Text>
            </View>
          )}
        </SCard>
      ) : (
        <View style={emptyStyle.box}>
          <MaterialIcons name="flash-on" size={44} color={colors.border} />
          <Text style={emptyStyle.text}>No freestyle sessions in this period. Log sessions from Training to track variety here.</Text>
        </View>
      )}
    </>
  );
}

const emptyStyle = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: 40, gap: spacing.md },
  text: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.xl },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('overall');
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [showTFPicker, setShowTFPicker] = useState(false);

  // Raw data (all-time, filtered client-side)
  const [allSessions, setAllSessions] = useState<SessionNote[]>([]);
  const [allAcademyLogs, setAllAcademyLogs] = useState<AcademyLog[]>([]);
  const [allTechLogs, setAllTechLogs] = useState<TechLog[]>([]);
  const [allPhysLogs, setAllPhysLogs] = useState<PhysLog[]>([]);
  const [allMentalLogs, setAllMentalLogs] = useState<MentalLog[]>([]);
  const [allTacLogs, setAllTacLogs] = useState<TacLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseClient();
    const [sessRes, acaRes, techRes, physRes, menRes, tacRes] = await Promise.all([
      supabase.from('sessions').select('completed_at, duration_minutes, notes, session_type').eq('user_id', user.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(200),
      supabase.from('academy_training_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(200),
      supabase.from('technical_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('workout_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('mental_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('tactical_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ]);
    setAllSessions(sessRes.data || []);
    setAllAcademyLogs(acaRes.data || []);
    setAllTechLogs(techRes.data || []);
    setAllPhysLogs(physRes.data || []);
    setAllMentalLogs(menRes.data || []);
    setAllTacLogs(tacRes.data || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // Apply timeframe filter
  const sessions  = filterByTimeframe(allSessions, timeframe);
  const academyLogs = filterByTimeframe(allAcademyLogs, timeframe);
  const techLogs  = filterByTimeframe(allTechLogs, timeframe);
  const physLogs  = filterByTimeframe(allPhysLogs, timeframe);
  const mentalLogs = filterByTimeframe(allMentalLogs, timeframe);
  const tacLogs   = filterByTimeframe(allTacLogs, timeframe);

  const activeTabInfo = TABS.find(t => t.key === activeTab) ?? TABS[0];
  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || 'Last 30 Days';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading performance data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSub}>{activeTabInfo.label} · {tfLabel}</Text>
        </View>
        <Pressable style={styles.tfBtn} onPress={() => setShowTFPicker(true)}>
          <MaterialIcons name="calendar-today" size={14} color={colors.primary} />
          <Text style={styles.tfBtnText}>{tfLabel}</Text>
          <MaterialIcons name="expand-more" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBarOuter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabItem, isActive && { backgroundColor: tab.color + '18', borderBottomColor: tab.color }]}
                onPress={() => setActiveTab(tab.key)}
              >
                <MaterialIcons name={tab.icon as any} size={16} color={isActive ? tab.color : colors.textSecondary} />
                <Text style={[styles.tabLabel, isActive && { color: tab.color, fontWeight: '800' }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        key={`${activeTab}_${timeframe}`}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overall'   && <OverallTab sessions={sessions} academyLogs={academyLogs} techLogs={techLogs} physLogs={physLogs} mentalLogs={mentalLogs} tacLogs={tacLogs} tf={timeframe} />}
        {activeTab === 'technical' && <TechnicalTab logs={techLogs} sessions={sessions} academyLogs={academyLogs} tf={timeframe} />}
        {activeTab === 'physical'  && <PhysicalTab logs={physLogs} tf={timeframe} />}
        {activeTab === 'mental'    && <MentalTab logs={mentalLogs} tf={timeframe} />}
        {activeTab === 'tactical'  && <TacticalTab logs={tacLogs} tf={timeframe} />}
        {activeTab === 'freestyle' && <FreestyleTab sessions={sessions} tf={timeframe} />}
      </ScrollView>

      {/* Timeframe Picker Modal */}
      <Modal visible={showTFPicker} transparent animationType="fade" onRequestClose={() => setShowTFPicker(false)}>
        <Pressable style={styles.tfOverlay} onPress={() => setShowTFPicker(false)}>
          <View style={styles.tfModal}>
            <Text style={styles.tfModalTitle}>Select Timeframe</Text>
            {TIMEFRAMES.map(tf => (
              <Pressable
                key={tf.key}
                style={[styles.tfOption, timeframe === tf.key && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                onPress={() => { setTimeframe(tf.key); setShowTFPicker(false); }}
              >
                <Text style={[styles.tfOptionText, timeframe === tf.key && { color: colors.primary, fontWeight: '800' }]}>{tf.label}</Text>
                {timeframe === tf.key && <MaterialIcons name="check" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    zIndex: 10, elevation: 4,
  },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  tfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '18', paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.primary + '40',
  },
  tfBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  tabBarOuter: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBar: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 3, borderBottomColor: 'transparent',
    marginHorizontal: 2,
  },
  tabLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },

  // Timeframe modal
  tfOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  tfModal: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, width: '100%', maxWidth: 320, gap: spacing.sm },
  tfModalTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  tfOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
  },
  tfOptionText: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
