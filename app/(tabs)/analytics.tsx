import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polygon, Line, Text as SvgText, G, Path } from 'react-native-svg';
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
  created_at: string;
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
  balls_faced: number;
  balls_middled: number;
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
  { key: 'overall',   label: 'Overall',   icon: 'dashboard',     color: '#6366F1' },
  { key: 'technical', label: 'Technical', icon: 'sports-cricket', color: colors.technical || '#2196F3' },
  { key: 'physical',  label: 'Physical',  icon: 'fitness-center', color: colors.physical  || '#4CAF50' },
  { key: 'mental',    label: 'Mental',    icon: 'psychology',     color: colors.mental    || '#9C27B0' },
  { key: 'tactical',  label: 'Tactical',  icon: 'lightbulb',      color: colors.tactical  || '#FF9800' },
  { key: 'freestyle', label: 'Freestyle', icon: 'flash-on',       color: '#E53935' },
];

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'Last 30 Days' },
  { key: 'season',  label: 'This Season' },
  { key: 'alltime', label: 'All-Time' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  if (tf === 'alltime') return items;
  const now = new Date();
  let from = new Date('2000-01-01');
  if (tf === 'week') { from = new Date(); from.setDate(now.getDate() - 7); }
  else if (tf === 'month') { from = new Date(); from.setDate(now.getDate() - 30); }
  else if (tf === 'season') { from = new Date(); from.setMonth(now.getMonth() - 6); }
  const fromMs = from.getTime();
  return items.filter(item => {
    const rawDate = item.completed_at || item.created_at || item.log_date || '';
    if (!rawDate) return true;
    return new Date(rawDate).getTime() >= fromMs;
  });
}
function parseSessionNotes(notes: string): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  if (!notes) return result;
  for (const line of notes.split('\n')) {
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

// ─── Info Tooltip ─────────────────────────────────────────────────────────────
function InfoTooltip({ text, color }: { text: string; color: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={12} style={{ padding: 2 }}>
        <Text style={[ittS.icon, { color, borderColor: color + '60', backgroundColor: color + '14' }]}>i</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={ittS.overlay} onPress={() => setVisible(false)}>
          <View style={[ittS.card, { borderColor: color + '40' }]}>
            <View style={[ittS.headerRow, { backgroundColor: color + '12' }]}>
              <View style={[ittS.circle, { backgroundColor: color + '22' }]}>
                <Text style={[ittS.circleText, { color }]}>i</Text>
              </View>
              <Text style={[ittS.cardTitle, { color }]}>How to read this</Text>
            </View>
            <Text style={ittS.cardBody}>{text}</Text>
            <Pressable style={[ittS.gotIt, { backgroundColor: color }]} onPress={() => setVisible(false)}>
              <Text style={ittS.gotItText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
const ittS = StyleSheet.create({
  icon: { fontSize: 11, fontWeight: '900', width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, textAlign: 'center', lineHeight: 18, overflow: 'hidden' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1.5, overflow: 'hidden', width: '100%', maxWidth: 340 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.sm },
  circle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  circleText: { fontSize: 14, fontWeight: '900' },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardBody: { fontSize: 14, color: colors.text, lineHeight: 22, padding: spacing.md, paddingTop: spacing.sm },
  gotIt: { margin: spacing.md, marginTop: 0, borderRadius: borderRadius.md, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  gotItText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

// ─── AI Coach Card ────────────────────────────────────────────────────────────
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
        setInsight('');
      } else {
        setInsight(data?.insight || '');
      }
    } catch { setInsight(''); }
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
  card: { borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1.5, backgroundColor: colors.surface, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  subtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  loadText: { fontSize: 12, fontStyle: 'italic' },
  text: { fontSize: 14, color: colors.text, lineHeight: 22, fontStyle: 'italic' },
});

// ─── KPI Row ──────────────────────────────────────────────────────────────────
function KPIRow({ items }: { items: { label: string; value: string; icon: string; color: string; sub?: string }[] }) {
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
  card: { flex: 1, minWidth: '44%', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, alignItems: 'center', gap: 4 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  sub: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
});

// ─── Section Card ─────────────────────────────────────────────────────────────
function SCard({ title, icon, color, info, children }: { title: string; icon: string; color: string; info?: string; children: React.ReactNode }) {
  return (
    <View style={sc.card}>
      <View style={sc.header}>
        <MaterialIcons name={icon as any} size={16} color={color} />
        <Text style={[sc.title, { flex: 1 }]}>{title}</Text>
        {info ? <InfoTooltip text={info} color={color} /> : null}
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

// ─── Trend Line ───────────────────────────────────────────────────────────────
function TrendLine({ points, color, label }: { points: { x: string; y: number }[]; color: string; label: string }) {
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
    val: p.y, label: p.x,
  }));
  const pathD = coords.length >= 2 ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') : '';
  const areaD = pathD && coords.length >= 2 ? `${pathD} L${coords[coords.length-1].x.toFixed(1)},${(PAD_T+iH).toFixed(1)} L${coords[0].x.toFixed(1)},${(PAD_T+iH).toFixed(1)} Z` : '';
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

// ─── Radar Chart ──────────────────────────────────────────────────────────────
function RadarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const SIZE = 200; const CX = SIZE / 2; const CY = SIZE / 2; const MAX_R = 70;
  const n = data.length;
  const pt = (angle: number, r: number) => ({ x: CX + r * Math.cos((angle * Math.PI) / 180), y: CY + r * Math.sin((angle * Math.PI) / 180) });
  const angles = data.map((_, i) => -90 + (360 / n) * i);
  const gridPolys = [0.25, 0.5, 0.75, 1].map(f => angles.map(a => pt(a, MAX_R * f)).map(({ x, y }) => `${x},${y}`).join(' '));
  const dataPolygon = data.map((d, i) => { const r = (d.value / 10) * MAX_R; const p = pt(angles[i], r); return `${p.x},${p.y}`; }).join(' ');
  if (Math.max(...data.map(d => d.value), 0) === 0) return null;
  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
      <Svg width={SIZE + 60} height={SIZE + 40} viewBox={`-30 -20 ${SIZE + 60} ${SIZE + 40}`}>
        {gridPolys.map((pts, i) => <Polygon key={i} points={pts} fill="none" stroke={colors.border} strokeWidth={1} />)}
        {angles.map((a, i) => { const end = pt(a, MAX_R); return <Line key={i} x1={CX} y1={CY} x2={end.x} y2={end.y} stroke={colors.border} strokeWidth={1} />; })}
        <Polygon points={dataPolygon} fill={color + '30'} stroke={color} strokeWidth={2} />
        {data.map((d, i) => { const r = (d.value / 10) * MAX_R; const p = pt(angles[i], r); return <Circle key={i} cx={p.x} cy={p.y} r={4} fill={color} />; })}
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

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ pct, color, label, sublabel }: { pct: number; color: string; label: string; sublabel?: string }) {
  const SIZE = 120; const STROKE = 14; const R = (SIZE - STROKE) / 2;
  const CIRCUM = 2 * Math.PI * R;
  const offset = CIRCUM * (1 - pct / 100);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Circle cx={SIZE/2} cy={SIZE/2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
          <Circle cx={SIZE/2} cy={SIZE/2} r={R} stroke={color} strokeWidth={STROKE} fill="none"
            strokeDasharray={`${CIRCUM} ${CIRCUM}`} strokeDashoffset={offset}
            strokeLinecap="round" rotation="-90" originX={SIZE/2} originY={SIZE/2} />
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
  const maxVal = Math.max(...items.map(i => i.maxVal || 10), 1);
  const chartW = Math.max(1, SCREEN_WIDTH - spacing.md * 4 - 32 - 80);
  return (
    <View style={{ gap: spacing.xs + 2 }}>
      {items.map((item, idx) => {
        const mV = item.maxVal || 10;
        const pct = item.value > 0 ? Math.min(100, (item.value / mV) * 100) : 0;
        const barW = Math.max(4, (pct / 100) * chartW);
        const hasVal = item.value > 0;
        const barColor = hasVal ? color : colors.border;
        const tier = item.value >= 8 ? '🔥' : item.value >= 6 ? '✓' : item.value >= 4 ? '~' : item.value > 0 ? '↑' : '';
        return (
          <View key={idx} style={pbS.row}>
            <Text style={pbS.label} numberOfLines={1}>{item.label}</Text>
            <View style={pbS.barTrack}>
              <View style={[pbS.barFill, { width: barW, backgroundColor: barColor }]}>
                {hasVal && pct > 18 && (
                  <Text style={pbS.inlineVal}>{item.value.toFixed(1)}</Text>
                )}
              </View>
              {(!hasVal || pct <= 18) && (
                <Text style={[pbS.sideVal, { color: hasVal ? color : colors.textSecondary }]}>
                  {hasVal ? item.value.toFixed(1) : '—'}
                </Text>
              )}
            </View>
            <View style={pbS.badge}>
              <Text style={[pbS.badgeScore, { color: hasVal ? color : colors.textSecondary }]}>
                {hasVal ? `${item.value.toFixed(1)}` : '—'}
              </Text>
              <Text style={pbS.badgeMax}>/{mV}</Text>
              {tier ? <Text style={{ fontSize: 11 }}>{tier}</Text> : null}
            </View>
          </View>
        );
      })}
      <View style={pbS.scaleRow}>
        {[0, 2, 4, 6, 8, 10].map(v => (
          <Text key={v} style={pbS.scaleTick}>{v}</Text>
        ))}
      </View>
    </View>
  );
}
const pbS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  label: { fontSize: 11, fontWeight: '700', color: colors.text, width: 88, flexShrink: 0 },
  barTrack: { flex: 1, height: 22, backgroundColor: colors.border + '60', borderRadius: 11, overflow: 'hidden', justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 11, justifyContent: 'center', paddingLeft: 6 },
  inlineVal: { fontSize: 11, fontWeight: '900', color: '#fff' },
  sideVal: { fontSize: 11, fontWeight: '700', paddingLeft: 6 },
  badge: { flexDirection: 'row', alignItems: 'baseline', gap: 0, width: 58, justifyContent: 'flex-end' },
  badgeScore: { fontSize: 13, fontWeight: '900' },
  badgeMax: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 92, paddingRight: 62, marginTop: 2 },
  scaleTick: { fontSize: 9, color: colors.textSecondary },
});

// ─── Objective Strike Rate (Freestyle only) ───────────────────────────────────
function ObjectiveStrikeRate({ sessionsMet, totalSessions, tabColor }: {
  sessionsMet: number; totalSessions: number; tabColor: string;
}) {
  if (totalSessions === 0) return null;
  const pct = Math.round((sessionsMet / totalSessions) * 100);
  const tier = pct >= 90 ? 'Elite Execution' : pct >= 80 ? 'Elite Performer' : pct >= 60 ? 'Consistent' : pct >= 40 ? 'Developing' : 'Needs Work';
  const tierColor = pct >= 80 ? colors.success : pct >= 60 ? '#2196F3' : pct >= 40 ? colors.warning : colors.error;
  const SIZE = 140; const STROKE = 18; const R = (SIZE - STROKE) / 2;
  const CIRCUM = 2 * Math.PI * R;
  const offset = CIRCUM * (1 - pct / 100);
  return (
    <SCard title="Objective Strike Rate" icon="center-focus-strong" color={tabColor}
      info="Shows the percentage of your freestyle sessions where you hit your target. Target = sessions where your average pillar rating is 3.5/5 or above. A rising % means you are converting training into quality execution more consistently. Tier badges: Needs Work <40%, Developing 40-60%, Consistent 60-80%, Elite Performer 80-90%, Elite Execution 90%+.">
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md }}>Sessions where you hit your target</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
        <View style={{ width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' }}>
          <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
            <Circle cx={SIZE/2} cy={SIZE/2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            <Circle cx={SIZE/2} cy={SIZE/2} r={R} stroke={tierColor} strokeWidth={STROKE} fill="none"
              strokeDasharray={`${CIRCUM} ${CIRCUM}`} strokeDashoffset={offset}
              strokeLinecap="round" rotation="-90" originX={SIZE/2} originY={SIZE/2} />
          </Svg>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 34, fontWeight: '900', color: tierColor, lineHeight: 38 }}>{pct}</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: tierColor }}>%</Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 2 }}>of sessions</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={[osrS.tierBadge, { backgroundColor: tierColor + '18', borderColor: tierColor + '40' }]}>
            <Text style={[osrS.tierText, { color: tierColor }]}>{tier}</Text>
          </View>
          <View style={osrS.statRow}>
            <Text style={[osrS.statIcon, { color: tierColor }]}>{'\u2713'}</Text>
            <Text style={osrS.statText}><Text style={osrS.statBold}>{sessionsMet} objectives</Text> met</Text>
          </View>
          <View style={osrS.statRow}>
            <MaterialIcons name="calendar-today" size={14} color={colors.textSecondary} />
            <Text style={osrS.statText}><Text style={osrS.statBold}>{totalSessions} total</Text> sessions</Text>
          </View>
          <View style={[osrS.statRow, { alignItems: 'flex-start', marginTop: 2 }]}>
            <Text style={[osrS.statIcon, { color: colors.textSecondary, fontSize: 11 }]}>i</Text>
            <Text style={[osrS.statText, { flex: 1 }]}>Target: avg rating {'>='}3.5/5 in selected pillar</Text>
          </View>
        </View>
      </View>
    </SCard>
  );
}
const osrS = StyleSheet.create({
  tierBadge: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  tierText: { fontSize: 13, fontWeight: '800' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statIcon: { fontSize: 14, fontWeight: '900', width: 16, color: colors.success },
  statText: { fontSize: 13, color: colors.text, lineHeight: 18, flexShrink: 1 },
  statBold: { fontWeight: '800' },
});

// ─── Empty State ──────────────────────────────────────────────────────────────
const emptyStyle = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: 40, gap: spacing.md },
  text: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.xl },
});

// ─── TAB: Overall ─────────────────────────────────────────────────────────────
function OverallTab({ sessions, academyLogs, techLogs, physLogs, mentalLogs, tacLogs, tf }: {
  sessions: SessionNote[]; academyLogs: AcademyLog[];
  techLogs: TechLog[]; physLogs: PhysLog[]; mentalLogs: MentalLog[]; tacLogs: TacLog[]; tf: Timeframe;
}) {
  const totalTime = Math.round(
    sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0) +
    academyLogs.reduce((a, l) => a + (l.duration_minutes || 0), 0) +
    [...techLogs, ...physLogs, ...mentalLogs, ...tacLogs].reduce((a, l: any) => a + Math.round((l.time_elapsed || 0) / 60), 0)
  );
  const totalSessions = sessions.length + academyLogs.length + techLogs.length + physLogs.length + mentalLogs.length + tacLogs.length;

  const ballsFromAcademy = academyLogs.reduce((a, l) => a + (Number(l.balls_faced) || 0), 0);
  const ballsFromTechDrills = techLogs.reduce((a, l) => a + (Number(l.balls_faced) || 0), 0);
  const middledFromTechDrills = techLogs.reduce((a, l) => a + (Number(l.balls_middled) || 0), 0);
  let ballsFromSessNotes = 0, middledFromSessNotes = 0;
  sessions.forEach(s => {
    if (!s.notes) return;
    s.notes.split('\n').forEach(line => {
      const lower = line.toLowerCase().trim();
      if (lower.startsWith('balls faced:')) { const v = parseInt(lower.replace('balls faced:', '').trim()); if (!isNaN(v) && v > 0) ballsFromSessNotes += v; }
      if (lower.startsWith('balls middled:')) { const v = parseInt(lower.replace('balls middled:', '').trim()); if (!isNaN(v) && v > 0) middledFromSessNotes += v; }
    });
  });
  const totalBalls = ballsFromAcademy + ballsFromTechDrills + ballsFromSessNotes;
  const totalMiddled = middledFromTechDrills + middledFromSessNotes;
  const totalRuns = academyLogs.reduce((a, l) => a + (l.runs_scored || 0), 0);
  const overallMiddleRate = totalBalls > 0 && totalMiddled > 0 ? Math.round((totalMiddled / totalBalls) * 100) : null;
  const strikeRate = ballsFromAcademy > 0 ? Math.round((totalRuns / ballsFromAcademy) * 100) : null;

  const pillarMins = {
    Technical: Math.round(techLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)),
    Physical: Math.round(physLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)),
    Mental: Math.round(mentalLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)),
    Tactical: Math.round(tacLogs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)),
    Freestyle: Math.round(sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)),
  };
  const pillarColors: Record<string, string> = { Technical: colors.technical || '#2196F3', Physical: colors.physical || '#4CAF50', Mental: colors.mental || '#9C27B0', Tactical: colors.tactical || '#FF9800', Freestyle: '#E53935' };
  const maxMins = Math.max(...Object.values(pillarMins), 1);
  const radarData = [
    { label: 'Technical', value: avg(techLogs.map(l => l.technique_quality)) },
    { label: 'Physical',  value: avg(physLogs.map(l => l.focus_level)) },
    { label: 'Tactical',  value: avg(tacLogs.map(l => l.field_reading)) },
    { label: 'Mental',    value: avg(mentalLogs.map(l => l.adherence)) },
  ];

  // Sessions per week
  const weekMap: Record<string, number> = {};
  const allDates = [
    ...sessions.map(s => s.created_at || s.completed_at),
    ...techLogs.map(l => l.created_at), ...physLogs.map(l => l.created_at),
    ...mentalLogs.map(l => l.created_at), ...tacLogs.map(l => l.created_at),
    ...academyLogs.map(l => l.log_date),
  ];
  allDates.forEach(d => {
    if (!d) return;
    const dt = new Date(d);
    const mon = new Date(dt);
    mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const key = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weekMap[key] = (weekMap[key] || 0) + 1;
  });
  const weeks = Object.entries(weekMap).slice(-8);
  const maxW = Math.max(...weeks.map(w => w[1]), 1);

  return (
    <>
      <AIInsightCard tab="overall" timeframe={tf} tabColor="#6366F1" title="Career" />
      <KPIRow items={[
        { label: 'Total Time', value: fmtMins(totalTime), icon: 'timer', color: '#6366F1' },
        { label: 'Sessions', value: String(totalSessions), icon: 'check-circle', color: colors.success },
        { label: 'Balls Faced', value: totalBalls > 0 ? String(totalBalls) : '—', icon: 'adjust', color: colors.technical || '#2196F3' },
        { label: 'Middle Rate', value: overallMiddleRate !== null ? `${overallMiddleRate}%` : '—', icon: 'center-focus-strong', color: colors.success, sub: totalMiddled > 0 ? `${totalMiddled}/${totalBalls}` : undefined },
        ...(strikeRate !== null ? [{ label: 'Strike Rate', value: String(strikeRate), icon: 'trending-up', color: colors.warning, sub: `${totalRuns}r / ${ballsFromAcademy}b` }] : []),
      ]} />

      <SCard title="Pillar Balance" icon="radar" color="#6366F1"
        info="The radar (spider) chart shows your average performance rating across 4 training pillars. Each axis goes from 0 (centre) to 10 (outer edge). A well-rounded player has a large, even polygon. A lopsided shape shows which pillars need more attention.">
        <RadarChart data={radarData} color="#6366F1" />
      </SCard>

      <SCard title="Volume Breakdown" icon="bar-chart" color="#6366F1"
        info="Horizontal bars showing total training minutes per pillar. Longer bar = more time spent. Use this to ensure you are not neglecting any area of your game.">
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

      {weeks.length >= 2 && (
        <SCard title="Sessions Per Week" icon="date-range" color="#6366F1"
          info="Each bar represents one calendar week. The height shows how many total training sessions (all pillars combined) you completed that week. Use this to spot gaps in your training routine and build a habit of regular practice.">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 }}>
            {weeks.map(([label, count], i) => {
              const barH = Math.max(4, (count / maxW) * 56);
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 80 }}>
                  <Text style={{ fontSize: 9, color: '#6366F1', fontWeight: '800', marginBottom: 2 }}>{count}</Text>
                  <View style={{ width: '100%', height: barH, backgroundColor: '#6366F1', borderRadius: 3, opacity: 0.85 }} />
                  <Text style={{ fontSize: 8, color: colors.textSecondary, marginTop: 3, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
                </View>
              );
            })}
          </View>
        </SCard>
      )}
    </>
  );
}

// ─── TAB: Technical ───────────────────────────────────────────────────────────
function TechnicalTab({ logs, sessions, academyLogs, tf }: { logs: TechLog[]; sessions: SessionNote[]; academyLogs: AcademyLog[]; tf: Timeframe }) {
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0));
  const ballsFromDrills = logs.reduce((a, l) => a + (Number(l.balls_faced) || 0), 0);
  const middledFromDrills = logs.reduce((a, l) => a + (Number(l.balls_middled) || 0), 0);
  const ballsFromAcademy = academyLogs.reduce((a, l) => a + (Number(l.balls_faced) || 0), 0);
  const runsFromAcademy = academyLogs.reduce((a, l) => a + (Number(l.runs_scored) || 0), 0);
  let ballsFromSessions = 0, middledFromSessions = 0;
  sessions.forEach(s => {
    if (!s.notes) return;
    s.notes.split('\n').forEach(line => {
      const lower = line.toLowerCase().trim();
      if (lower.startsWith('balls faced:')) { const v = parseInt(lower.replace('balls faced:', '').trim()); if (!isNaN(v) && v > 0) ballsFromSessions += v; }
      if (lower.startsWith('balls middled:')) { const v = parseInt(lower.replace('balls middled:', '').trim()); if (!isNaN(v) && v > 0) middledFromSessions += v; }
    });
  });
  const totalBalls = ballsFromDrills + ballsFromAcademy + ballsFromSessions;
  const totalMiddled = middledFromDrills + middledFromSessions;
  const totalMiddledAll = totalMiddled > 0 ? totalMiddled : runsFromAcademy;
  const middleRate = totalBalls > 0 ? Math.round((totalMiddledAll / totalBalls) * 100) : null;
  const techStrikeRate = ballsFromAcademy > 0 ? Math.round((runsFromAcademy / ballsFromAcademy) * 100) : null;

  const metricData = [
    { label: 'Shot Execution', value: avg(logs.map(l => Number(l.technique_quality) || 0)) },
    { label: 'Footwork', value: avg(logs.map(l => Number(l.consistency) || 0)) },
    { label: 'Timing', value: avg(logs.map(l => Number(l.timing) || 0)) },
    { label: 'Shot Control', value: avg(logs.map(l => Number(l.shot_control) || 0)) },
    { label: 'Focus Level', value: avg(logs.map(l => Number(l.focus_level) || 0)) },
    { label: 'Confidence', value: avg(logs.map(l => Number(l.confidence_level) || 0)) },
  ];
  const trendPoints = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: avg([l.technique_quality, l.timing, l.shot_control]) }));

  const focusAreas: Record<string, number> = {};
  sessions.forEach(s => {
    const p = parseSessionNotes(s.notes || '');
    const fa = String(p['focus_area'] || p['focus:'] || '').trim();
    if (fa && fa.length > 1) focusAreas[fa] = (focusAreas[fa] || 0) + 1;
  });
  const topFocusAreas = Object.entries(focusAreas).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const drillCount: Record<string, number> = {};
  logs.forEach(l => { if (l.drill_name) drillCount[l.drill_name] = (drillCount[l.drill_name] || 0) + 1; });
  const topDrills = Object.entries(drillCount).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const maxDC = Math.max(...topDrills.map(t => t[1]), 1);

  return (
    <>
      <AIInsightCard tab="technical" timeframe={tf} tabColor={colors.technical || '#2196F3'} title="Technique" />
      <KPIRow items={[
        { label: 'Sessions', value: String(logs.length), icon: 'sports-cricket', color: colors.technical || '#2196F3' },
        { label: 'Training Time', value: fmtMins(totalMins), icon: 'timer', color: colors.technical || '#2196F3' },
        { label: 'Balls Faced', value: totalBalls > 0 ? String(totalBalls) : '—', icon: 'adjust', color: colors.warning },
        { label: 'Middle Rate', value: middleRate !== null ? `${middleRate}%` : '—', icon: 'center-focus-strong', color: colors.success },
        ...(techStrikeRate !== null ? [{ label: 'Strike Rate', value: String(techStrikeRate), icon: 'trending-up', color: '#2196F3', sub: 'runs per 100 balls' }] : []),
      ]} />
      <SCard title="Metric Averages" icon="bar-chart" color={colors.technical || '#2196F3'}
        info="Each bar shows your average self-rated score (out of 10) for that technical quality. Shot Execution = bat-swing mechanics, Footwork = foot movement to the ball, Timing = contact point, Shot Control = directing the ball, Focus Level = mental sharpness, Confidence = belief in your stroke.">
        <ProgressBars items={metricData} color={colors.technical || '#2196F3'} />
      </SCard>
      {trendPoints.length >= 2 && (
        <SCard title="Performance Trend" icon="show-chart" color={colors.technical || '#2196F3'}
          info="Line chart plotting the combined average of Shot Execution, Timing, and Shot Control over your last 10 sessions (oldest left, newest right). Each dot = one session. The badge (↑ ↓ →) shows whether quality is improving or declining compared to your first session in the range.">
          <TrendLine points={trendPoints} color={colors.technical || '#2196F3'} label="Avg quality over last sessions" />
        </SCard>
      )}
      {topDrills.length >= 2 && (
        <SCard title="Most Practised Drills" icon="repeat" color={colors.technical || '#2196F3'}
          info="How many times you completed each technical drill in this period. Drills you repeat more often will improve faster — but if one drill completely dominates, you may be avoiding harder challenges.">
          <View style={{ gap: spacing.sm }}>
            {topDrills.map(([name, count], i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, width: 16, textAlign: 'right' }}>{i+1}.</Text>
                <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>{name}</Text>
                <View style={{ width: 80, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(4,(count/maxDC)*100)}%`, height: '100%', backgroundColor: colors.technical || '#2196F3', borderRadius: 4 }} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.technical || '#2196F3', width: 24 }}>{count}×</Text>
              </View>
            ))}
          </View>
        </SCard>
      )}
      {topFocusAreas.length > 0 && (
        <SCard title="Focus Area Tags" icon="label" color={colors.technical || '#2196F3'}
          info="Tags from your session notes describing what you focused on. Larger text = appeared in more sessions. A recurring tag (e.g. 'straight drive') signals an area you are actively working to improve.">
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

// ─── TAB: Physical ────────────────────────────────────────────────────────────
function PhysicalTab({ logs, sessions, tf }: { logs: PhysLog[]; sessions: SessionNote[]; tf: Timeframe }) {
  const physicalFreestyle = sessions.filter(s => s.session_type === 'Freestyle-Physical');
  const freestyleMins = physicalFreestyle.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)) + freestyleMins;
  const avgEnergy = avg(logs.map(l => l.focus_level));
  const avgReaction = avg(logs.map(l => l.confidence_level));
  const avgConsistency = avg(logs.map(l => l.consistency));
  const avgTech = avg(logs.map(l => l.technique_quality));
  const energyTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.focus_level || 0 }));
  const reactionTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.confidence_level || 0 }));
  const cTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.consistency || 0 }));
  const tTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.technique_quality || 0 }));
  const longSessions = logs.filter(l => (l.time_elapsed || 0) > 3600);
  const longAvgEnergy = longSessions.length > 0 ? avg(longSessions.map(l => l.focus_level)) : null;

  return (
    <>
      <AIInsightCard tab="physical" timeframe={tf} tabColor={colors.physical || '#4CAF50'} title="Workload" />
      <KPIRow items={[
        { label: 'Sessions', value: String(logs.length + physicalFreestyle.length), icon: 'fitness-center', color: colors.physical || '#4CAF50' },
        { label: 'Training Time', value: fmtMins(totalMins), icon: 'timer', color: colors.physical || '#4CAF50' },
        { label: 'Avg Energy', value: avgEnergy > 0 ? `${avgEnergy}/10` : '—', icon: 'bolt', color: colors.warning },
        { label: 'Avg Reaction', value: avgReaction > 0 ? `${avgReaction}/10` : '—', icon: 'trending-up', color: colors.success },
      ]} />
      <SCard title="Avg Ratings" icon="show-chart" color={colors.physical || '#4CAF50'}
        info="Average self-rated scores (out of 10) across all physical drill sessions. Energy Level = how energised you felt, Reaction Speed = quickness of response, Consistency = maintained form throughout, Technique Quality = overall movement execution.">
        <ProgressBars items={[
          { label: 'Energy Level', value: avgEnergy },
          { label: 'Reaction Speed', value: avgReaction },
          { label: 'Consistency', value: avgConsistency },
          { label: 'Technique Quality', value: avgTech },
        ]} color={colors.physical || '#4CAF50'} />
      </SCard>
      {energyTrend.length >= 2 && (
        <SCard title="Energy & Reaction Trend" icon="trending-up" color={colors.physical || '#4CAF50'}
          info="Two trend lines over your last 10 physical sessions. Green = Energy/Focus level, Yellow = Reaction Speed/Confidence. If both lines decline in recent sessions, you may be overtraining — a rest day is recommended.">
          <TrendLine points={energyTrend} color={colors.physical || '#4CAF50'} label="Energy / Focus per session" />
          <TrendLine points={reactionTrend} color={colors.warning} label="Reaction Speed / Confidence" />
        </SCard>
      )}
      {logs.length >= 2 && !cTrend.every(p => p.y === 0) && (
        <SCard title="Consistency vs Technique" icon="compare-arrows" color={colors.physical || '#4CAF50'}
          info="Blue line = Consistency (how repeatable your movements are session to session). Green line = Technique Quality. These two should rise together — if Consistency is high but Technique is low, your movements are repetitive but need mechanical refinement.">
          <TrendLine points={cTrend} color="#2196F3" label="Consistency per session" />
          <TrendLine points={tTrend} color={colors.physical || '#4CAF50'} label="Technique Quality per session" />
        </SCard>
      )}
      {longSessions.length > 0 && (
        <SCard title="Workload Monitor" icon="warning" color={colors.warning}>
          <View style={{ backgroundColor: colors.warning + '12', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.warning + '30' }}>
            <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>
              <Text style={{ fontWeight: '800' }}>{longSessions.length} long sessions</Text> (over 60 min) detected.
              {longAvgEnergy !== null ? ` Avg energy in those sessions: ${longAvgEnergy.toFixed(1)}/10.` : ''}
              {'\n'}Consider splitting into two high-intensity 30-min blocks to maintain output quality.
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

// ─── TAB: Mental ──────────────────────────────────────────────────────────────
function MentalTab({ logs, sessions, tf }: { logs: MentalLog[]; sessions: SessionNote[]; tf: Timeframe }) {
  const mentalFreestyle = sessions.filter(s => s.session_type === 'Freestyle-Mental');
  const freestyleMins = mentalFreestyle.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)) + freestyleMins;
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
  const eTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.emotional_control || 0 }));
  const fTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.focus_level || 0 }));

  return (
    <>
      <AIInsightCard tab="mental" timeframe={tf} tabColor={colors.mental || '#9C27B0'} title="Mindset" />
      <KPIRow items={[
        { label: 'Sessions', value: String(logs.length + mentalFreestyle.length), icon: 'psychology', color: colors.mental || '#9C27B0' },
        { label: 'Training Time', value: fmtMins(totalMins), icon: 'timer', color: colors.mental || '#9C27B0' },
        { label: 'Avg Confidence', value: avgConfidence > 0 ? `${avgConfidence}/10` : '—', icon: 'star', color: confColor },
        { label: 'Avg Adherence', value: avgAdherence > 0 ? `${avgAdherence}/10` : '—', icon: 'done', color: colors.success },
      ]} />
      <SCard title="Mental Metrics" icon="bar-chart" color={colors.mental || '#9C27B0'}
        info="Five key mental performance indicators averaged across all mental drill sessions. Focus = concentration, Confidence = belief in your skill, Adherence = following drill structure correctly, Pressure Handling = staying composed under stress, Engagement = how invested you were in the drill.">
        <ProgressBars items={moodData} color={colors.mental || '#9C27B0'} />
      </SCard>
      <SCard title="Mood Score" icon="mood" color={colors.mental || '#9C27B0'}
        info="The donut ring shows average engagement expressed as a percentage (0–100%). A score of 70%+ means you were highly engaged. Calculated by converting your average 1–10 engagement rating to a 0–100 scale.">
        <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
          <DonutChart pct={moodPct} color={colors.mental || '#9C27B0'} label="Mood Score" sublabel={`${avgMood.toFixed(1)}/10 avg engagement`} />
        </View>
      </SCard>
      {confidenceTrend.length >= 2 && (
        <SCard title="Confidence Trend" icon="show-chart" color={colors.mental || '#9C27B0'}
          info="Line chart tracking your self-rated Confidence each session (oldest left, newest right). The badge shows whether confidence is rising (↑) or falling (↓). Sustained high confidence (7+) correlates with better match performance.">
          <TrendLine points={confidenceTrend} color={colors.mental || '#9C27B0'} label="Confidence per session" />
        </SCard>
      )}
      {logs.length >= 2 && !eTrend.every(p => p.y === 0) && (
        <SCard title="Emotional Control vs Focus" icon="self-improvement" color={colors.mental || '#9C27B0'}
          info="Red line = Emotional Control (staying calm after errors or pressure situations). Purple line = Focus Level. If Emotional Control drops before key sessions or matches, work on pre-shot routines and reset cues between deliveries.">
          <TrendLine points={eTrend} color="#E53935" label="Emotional Control per session" />
          <TrendLine points={fTrend} color={colors.mental || '#9C27B0'} label="Focus Level per session" />
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

// ─── TAB: Tactical ────────────────────────────────────────────────────────────
function TacticalTab({ logs, sessions, tf }: { logs: TacLog[]; sessions: SessionNote[]; tf: Timeframe }) {
  const tacticalFreestyle = sessions.filter(s => s.session_type === 'Freestyle-Tactical');
  const freestyleMins = tacticalFreestyle.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const totalMins = Math.round(logs.reduce((a, l) => a + Math.round((l.time_elapsed || 0) / 60), 0)) + freestyleMins;
  const avgFieldReading = avg(logs.map(l => l.field_reading));
  const avgAdapted = avg(logs.map(l => l.adapted_plan));
  const avgConfidence = avg(logs.map(l => l.confidence_pressure));

  // Parse balls faced from ALL sessions (not just Freestyle-Tactical) since sessions may be tagged 'Freestyle' but contain tactical notes
  let tacBalls = 0, tacMiddled = 0;
  sessions.forEach(s => {
    if (!s.notes) return;
    let inBattingSection = false;
    s.notes.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('---')) { inBattingSection = trimmed.toLowerCase().includes('batting'); return; }
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('balls faced:')) { const v = parseInt(lower.replace('balls faced:', '').trim()); if (!isNaN(v) && v > 0) tacBalls += v; }
      if (lower.startsWith('balls middled:')) { const v = parseInt(lower.replace('balls middled:', '').trim()); if (!isNaN(v) && v > 0) tacMiddled += v; }
    });
  });
  const tacMiddleRate = tacBalls > 0 && tacMiddled > 0 ? Math.round((tacMiddled / tacBalls) * 100) : null;
  const matchedYes = logs.filter(l => l.shot_selection_matched === true).length;
  const matchedNo = logs.filter(l => l.shot_selection_matched === false).length;
  const matchedTotal = matchedYes + matchedNo;
  const matchedPct = matchedTotal > 0 ? Math.round((matchedYes / matchedTotal) * 100) : null;

  const capabilityData = [
    { label: 'Shot Selection', value: avgFieldReading },
    { label: 'Game Awareness', value: avg(logs.map(l => l.confidence)) },
    { label: 'Field Reading', value: avgFieldReading },
    { label: 'Adapted Scoring', value: avgAdapted },
    { label: 'Confidence Pressure', value: avgConfidence },
  ];
  const fTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.field_reading || 0 }));
  const pTrend = logs.slice(0, 10).reverse().map(l => ({ x: fmtDate(l.created_at), y: l.confidence_pressure || 0 }));

  return (
    <>
      <AIInsightCard tab="tactical" timeframe={tf} tabColor={colors.tactical || '#FF9800'} title="Match IQ" />
      <KPIRow items={[
        { label: 'Scenarios', value: String(logs.length + tacticalFreestyle.length), icon: 'lightbulb', color: colors.tactical || '#FF9800' },
        { label: 'Tactical Time', value: fmtMins(totalMins), icon: 'timer', color: colors.tactical || '#FF9800' },
        { label: 'Shot Match', value: matchedPct !== null ? `${matchedPct}%` : '—', icon: 'done', color: colors.success, sub: matchedTotal > 0 ? `${matchedYes}/${matchedTotal}` : undefined },
        { label: 'Field Reading', value: avgFieldReading > 0 ? `${avgFieldReading}/10` : '—', icon: 'visibility', color: colors.warning },
        { label: 'Balls Faced', value: tacBalls > 0 ? String(tacBalls) : '—', icon: 'adjust', color: colors.tactical || '#FF9800' },
        ...(tacMiddleRate !== null ? [{ label: 'Middle Rate', value: `${tacMiddleRate}%`, icon: 'center-focus-strong', color: colors.success, sub: `${tacMiddled}/${tacBalls}` }] : []),
      ]} />
      <SCard title="Decision Success" icon="pie-chart" color={colors.tactical || '#FF9800'}
        info="The donut chart shows the percentage of tactical scenarios where your shot selection matched the situation. Green = you chose the right shot. Red = you did not. A high match rate (70%+) means good game awareness and situational reading.">
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
      <SCard title="Tactical Capability" icon="bar-chart" color={colors.tactical || '#FF9800'}
        info="Average ratings for 5 tactical skills across all scenario sessions. Shot Selection = picking the right shot for the delivery, Game Awareness = reading the game situation, Field Reading = identifying fielding gaps, Adapted Scoring = adjusting your plan mid-innings, Confidence Pressure = trusting your decisions under pressure.">
        <ProgressBars items={capabilityData} color={colors.tactical || '#FF9800'} />
      </SCard>
      {logs.length >= 2 && !fTrend.every(p => p.y === 0) && (
        <SCard title="Decision Quality Trend" icon="show-chart" color={colors.tactical || '#FF9800'}
          info="Two trend lines: Orange = Field Reading (spotting fielding gaps), Red = Confidence Under Pressure. Rising Field Reading means you are getting better at reading the field. If Pressure confidence lags, try last-5-overs pressure simulation scenarios.">
          <TrendLine points={fTrend} color={colors.tactical || '#FF9800'} label="Field Reading per session" />
          <TrendLine points={pTrend} color="#E53935" label="Confidence Under Pressure" />
        </SCard>
      )}
      {logs.length === 0 && (
        <View style={emptyStyle.box}>
          <MaterialIcons name="lightbulb" size={44} color={colors.border} />
          <Text style={emptyStyle.text}>No tactical logs in this period. Use the Scenario Builder in Training to log sessions.</Text>
        </View>
      )}
    </>
  );
}

// ─── TAB: Freestyle ───────────────────────────────────────────────────────────
function FreestyleTab({ sessions, tf }: { sessions: SessionNote[]; tf: Timeframe }) {
  const freestyleSessions = sessions.filter(s => {
    const st = (s.session_type || '').trim();
    return !st || st === 'Freestyle' || st.startsWith('Freestyle') || st === 'Training';
  });
  const totalMins = freestyleSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);

  let freeBalls = 0, freeMiddled = 0;
  freestyleSessions.forEach(s => {
    if (!s.notes) return;
    s.notes.split('\n').forEach(line => {
      const lower = line.toLowerCase().trim();
      if (lower.startsWith('balls faced:')) { const v = parseInt(lower.replace('balls faced:', '').trim()); if (!isNaN(v) && v > 0) freeBalls += v; }
      if (lower.startsWith('balls middled:')) { const v = parseInt(lower.replace('balls middled:', '').trim()); if (!isNaN(v) && v > 0) freeMiddled += v; }
    });
  });
  const freeMiddleRate = freeBalls > 0 && freeMiddled > 0 ? Math.round((freeMiddled / freeBalls) * 100) : null;

  const equipmentCount: Record<string, number> = {};
  freestyleSessions.forEach(s => {
    if (!s.notes) return;
    s.notes.split('\n').forEach(line => {
      if (line.toLowerCase().trim().startsWith('training types:')) {
        const typesStr = line.replace(/training types:/i, '').trim();
        typesStr.split(',').forEach(t => { const trimmed = t.trim(); if (trimmed.length > 1) equipmentCount[trimmed] = (equipmentCount[trimmed] || 0) + 1; });
      }
    });
  });
  const sorted = Object.entries(equipmentCount).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...sorted.map(s => s[1]), 1);
  const EQUIP_COLORS = ['#E53935', '#1565C0', '#2E7D32', '#F57C00', '#7B2FBE', '#0288D1', '#558B2F'];
  const topMethod = sorted[0]?.[0];
  const topPct = sorted[0] && freestyleSessions.length > 0 ? Math.round((sorted[0][1] / freestyleSessions.length) * 100) : null;

  // Pillar distribution
  const pillarMap: Record<string, number> = {
    Technical: freestyleSessions.filter(s => s.session_type === 'Freestyle-Technical').length,
    Physical: freestyleSessions.filter(s => s.session_type === 'Freestyle-Physical').length,
    Mental: freestyleSessions.filter(s => s.session_type === 'Freestyle-Mental').length,
    Tactical: freestyleSessions.filter(s => s.session_type === 'Freestyle-Tactical').length,
    'Open Play': freestyleSessions.filter(s => !s.session_type || s.session_type === 'Freestyle' || s.session_type === 'Training').length,
  };
  const pillarEntries = Object.entries(pillarMap).filter(([, v]) => v > 0);
  const PCOLS: Record<string, string> = { Technical: '#2196F3', Physical: '#4CAF50', Mental: '#9C27B0', Tactical: '#FF9800', 'Open Play': '#E53935' };
  const maxP = Math.max(...pillarEntries.map(e => e[1]), 1);

  // Session duration trend
  const durTrend = freestyleSessions.slice(0, 10).reverse()
    .map(s => ({ x: fmtDate(s.created_at || s.completed_at), y: Math.min(s.duration_minutes || 0, 120) }))
    .filter(p => p.y > 0);

  // Objective met count
  const freeMet = freestyleSessions.filter(s => {
    const p = parseSessionNotes(s.notes || '');
    const vals = [Number(p['technical']),Number(p['mental']),Number(p['physical']),Number(p['tactical'])].filter(v=>v>0);
    return vals.length > 0 && (vals.reduce((a,b)=>a+b,0)/vals.length) >= 3.5;
  }).length;

  return (
    <>
      <AIInsightCard tab="freestyle" timeframe={tf} tabColor="#E53935" title="Training Variety" />
      <KPIRow items={[
        { label: 'Sessions', value: String(freestyleSessions.length), icon: 'flash-on', color: '#E53935' },
        { label: 'Total Time', value: fmtMins(totalMins), icon: 'timer', color: '#E53935' },
        { label: 'Balls Faced', value: freeBalls > 0 ? String(freeBalls) : '—', icon: 'adjust', color: colors.warning },
        { label: 'Middle Rate', value: freeMiddleRate !== null ? `${freeMiddleRate}%` : '—', icon: 'center-focus-strong', color: colors.success, sub: freeBalls > 0 ? `${freeMiddled}/${freeBalls}` : undefined },
        { label: 'Methods Used', value: Object.keys(equipmentCount).length > 0 ? String(Object.keys(equipmentCount).length) : '—', icon: 'view-list', color: '#6366F1' },
        { label: 'Top Method', value: topPct !== null ? `${topPct}%` : '—', icon: 'whatshot', color: colors.primary, sub: topMethod },
      ]} />

      {freestyleSessions.length > 0 && <ObjectiveStrikeRate sessionsMet={freeMet} totalSessions={freestyleSessions.length} tabColor="#E53935" />}

      {pillarEntries.length >= 2 && (
        <SCard title="Focus Area Distribution" icon="donut-small" color="#E53935"
          info="Shows how your freestyle sessions are split across training pillars. Each bar = one pillar — the longer the bar, the more sessions you tagged to that area. Open Play = sessions started without selecting a specific pillar. A balanced spread means you are developing all areas of your game.">
          <View style={{ gap: spacing.sm }}>
            {pillarEntries.map(([name, count]) => {
              const pct = Math.max(4, (count / maxP) * 100);
              const sPct = Math.round((count / freestyleSessions.length) * 100);
              return (
                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PCOLS[name] }} />
                  <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600', width: 80 }}>{name}</Text>
                  <View style={{ flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: PCOLS[name], borderRadius: 5 }} />
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, width: 54, textAlign: 'right' }}>{count}× ({sPct}%)</Text>
                </View>
              );
            })}
          </View>
        </SCard>
      )}

      {sorted.length > 0 && (
        <SCard title="Training Method Distribution" icon="bar-chart" color="#E53935"
          info="How often you use each training method (e.g. Bowling Machine, Live Bowler, Shadow Batting). A dominant method triggering a 70%+ warning means you should vary your training — mixing methods improves adaptability and match readiness.">
          <View style={{ gap: spacing.sm }}>
            {sorted.map(([name, count], i) => {
              const barColor = EQUIP_COLORS[i % EQUIP_COLORS.length];
              const pct = Math.max(4, (count / maxCount) * 100);
              const sessionPct = freestyleSessions.length > 0 ? Math.round((count / freestyleSessions.length) * 100) : 0;
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
      )}

      {durTrend.length >= 2 && (
        <SCard title="Session Duration Trend" icon="schedule" color="#E53935"
          info="Line chart showing how long your freestyle sessions have been over time (capped at 120 min for readability). A rising trend means growing stamina and commitment. Aim for 30–90 minute sessions for optimal focus and physical output.">
          <TrendLine points={durTrend} color="#E53935" label="Duration (minutes) per session" />
        </SCard>
      )}

      {freestyleSessions.length === 0 && (
        <View style={emptyStyle.box}>
          <MaterialIcons name="flash-on" size={44} color={colors.border} />
          <Text style={emptyStyle.text}>No freestyle sessions in this period. Log sessions from Training to track variety here.</Text>
        </View>
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('overall');
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [showTFPicker, setShowTFPicker] = useState(false);

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
      supabase.from('sessions').select('id, completed_at, created_at, duration_minutes, notes, session_type').eq('user_id', user.id).in('status', ['completed']).order('created_at', { ascending: false }).limit(300),
      supabase.from('academy_training_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(200),
      supabase.from('technical_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('workout_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('mental_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('tactical_drill_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ]);
    setAllSessions((sessRes.data || []) as SessionNote[]);
    setAllAcademyLogs(acaRes.data || []);
    setAllTechLogs(techRes.data || []);
    setAllPhysLogs(physRes.data || []);
    setAllMentalLogs(menRes.data || []);
    setAllTacLogs(tacRes.data || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const sessions   = filterByTimeframe(allSessions, timeframe);
  const academyLogs = filterByTimeframe(allAcademyLogs, timeframe);
  const techLogs   = filterByTimeframe(allTechLogs, timeframe);
  const physLogs   = filterByTimeframe(allPhysLogs, timeframe);
  const mentalLogs = filterByTimeframe(allMentalLogs, timeframe);
  const tacLogs    = filterByTimeframe(allTacLogs, timeframe);

  const activeTabInfo = TABS.find(t => t.key === activeTab) ?? TABS[0];
  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || 'Last 30 Days';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}><Text style={styles.headerTitle}>Analytics</Text></View>
        <View style={styles.loading}>
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
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSub}>{activeTabInfo.label} · {tfLabel}</Text>
        </View>
        <Pressable style={styles.tfBtn} onPress={() => setShowTFPicker(true)}>
          <MaterialIcons name="calendar-today" size={14} color={colors.primary} />
          <Text style={styles.tfBtnText}>{tfLabel}</Text>
          <MaterialIcons name="expand-more" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.tabBarOuter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable key={tab.key} style={[styles.tabItem, isActive && { backgroundColor: tab.color + '18', borderBottomColor: tab.color }]} onPress={() => setActiveTab(tab.key)}>
                <MaterialIcons name={tab.icon as any} size={16} color={isActive ? tab.color : colors.textSecondary} />
                <Text style={[styles.tabLabel, isActive && { color: tab.color, fontWeight: '800' }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView key={`${activeTab}_${timeframe}`} style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'overall'   && <OverallTab sessions={sessions} academyLogs={academyLogs} techLogs={techLogs} physLogs={physLogs} mentalLogs={mentalLogs} tacLogs={tacLogs} tf={timeframe} />}
        {activeTab === 'technical' && <TechnicalTab logs={techLogs} sessions={sessions} academyLogs={academyLogs} tf={timeframe} />}
        {activeTab === 'physical'  && <PhysicalTab logs={physLogs} sessions={sessions} tf={timeframe} />}
        {activeTab === 'mental'    && <MentalTab logs={mentalLogs} sessions={sessions} tf={timeframe} />}
        {activeTab === 'tactical'  && <TacticalTab logs={tacLogs} sessions={sessions} tf={timeframe} />}
        {activeTab === 'freestyle' && <FreestyleTab sessions={sessions} tf={timeframe} />}
      </ScrollView>

      <Modal visible={showTFPicker} transparent animationType="fade" onRequestClose={() => setShowTFPicker(false)}>
        <Pressable style={styles.tfOverlay} onPress={() => setShowTFPicker(false)}>
          <View style={styles.tfModal}>
            <Text style={styles.tfModalTitle}>Select Timeframe</Text>
            {TIMEFRAMES.map(tf => (
              <Pressable key={tf.key} style={[styles.tfOption, timeframe === tf.key && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={() => { setTimeframe(tf.key); setShowTFPicker(false); }}>
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
