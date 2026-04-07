import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  Modal, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import {
  academyService, Academy, AcademyMember, AcademyTrainingLog,
} from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// ─── Mock data for demo/preview ─────────────────────────────────────────────
const DEMO_ACADEMY: Academy = {
  id: 'demo',
  name: 'Demo Cricket Academy',
  description: 'Preview mode',
  sport: 'Cricket',
  player_code: 'DEMO01',
  coach_code: 'DEMO02',
  created_by: 'demo',
  created_at: new Date().toISOString(),
};

const DEMO_PLAYER_MEMBER: AcademyMember = {
  id: 'demo-member',
  academy_id: 'demo',
  user_id: 'demo',
  role: 'player',
  position: 'Batsman',
  display_name: 'Demo Player',
  joined_at: new Date().toISOString(),
};

const DEMO_COACH_MEMBER: AcademyMember = {
  id: 'demo-coach',
  academy_id: 'demo',
  user_id: 'demo',
  role: 'coach',
  position: 'Coach',
  display_name: 'Demo Coach',
  joined_at: new Date().toISOString(),
};

const today = new Date();
const dStr = (daysAgo: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const DEMO_LOGS: AcademyTrainingLog[] = [
  { id: '1', user_id: 'demo', academy_id: 'demo', log_date: dStr(0), session_type: 'Nets', duration_minutes: 90, intensity: 7, balls_faced: 120, runs_scored: 58, created_at: new Date().toISOString() },
  { id: '2', user_id: 'demo', academy_id: 'demo', log_date: dStr(1), session_type: 'Fitness', duration_minutes: 60, intensity: 8, created_at: new Date().toISOString() },
  { id: '3', user_id: 'demo', academy_id: 'demo', log_date: dStr(2), session_type: 'Match', duration_minutes: 120, intensity: 9, balls_faced: 44, runs_scored: 32, created_at: new Date().toISOString() },
  { id: '4', user_id: 'demo', academy_id: 'demo', log_date: dStr(4), session_type: 'Nets', duration_minutes: 75, intensity: 6, balls_faced: 90, created_at: new Date().toISOString() },
  { id: '5', user_id: 'demo', academy_id: 'demo', log_date: dStr(6), session_type: 'Fielding', duration_minutes: 45, intensity: 5, catches: 12, created_at: new Date().toISOString() },
];

// ─── Quick Session Types ────────────────────────────────────────────────────
const QUICK_TYPES = [
  { label: 'Nets', icon: 'sports-cricket' },
  { label: 'Match', icon: 'emoji-events' },
  { label: 'Fitness', icon: 'fitness-center' },
  { label: 'Fielding', icon: 'sports-handball' },
  { label: 'Video', icon: 'ondemand-video' },
  { label: 'Other', icon: 'more-horiz' },
];

const POSITIONS = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper', 'Fielder'];

function getIntensityColor(n: number) {
  if (n <= 3) return colors.success;
  if (n <= 6) return colors.warning;
  return colors.error;
}

// ─── Demo Banner ─────────────────────────────────────────────────────────────
function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <View style={demo.bar}>
      <MaterialIcons name="visibility" size={14} color={colors.textLight} />
      <Text style={demo.barText}>Preview Mode — Join with a real code to activate</Text>
      <Pressable onPress={onExit} hitSlop={8}>
        <MaterialIcons name="close" size={16} color={colors.textLight} />
      </Pressable>
    </View>
  );
}
const demo = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  barText: { flex: 1, fontSize: 11, color: colors.textLight, fontWeight: '700' },
});

// ─── Weekly Activity Bar ────────────────────────────────────────────────────
function WeekBar({ logs }: { logs: AcademyTrainingLog[] }) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const counts = Array(7).fill(0);
  logs.forEach(log => {
    const diff = Math.floor((new Date(log.log_date).getTime() - monday.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) counts[diff] = Math.min(4, counts[diff] + 1);
  });
  return (
    <View style={wb.row}>
      {days.map((d, i) => (
        <View key={i} style={wb.col}>
          <View style={[wb.bar, { height: Math.max(4, counts[i] * 10), backgroundColor: counts[i] > 0 ? colors.primary : colors.border }]} />
          <Text style={wb.label}>{d}</Text>
        </View>
      ))}
    </View>
  );
}
const wb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 52, paddingBottom: 18 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '80%', borderRadius: 3, minHeight: 4 },
  label: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
});

// ─── Intensity Picker ────────────────────────────────────────────────────────
function IntensityPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          style={[ip.btn, n <= value && { backgroundColor: getIntensityColor(n), borderColor: getIntensityColor(n) }]}
          hitSlop={4}
        >
          <Text style={[ip.txt, n <= value && { color: colors.textLight }]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const ip = StyleSheet.create({
  btn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  txt: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
});

// ─── Quick Log Sheet ────────────────────────────────────────────────────────
function QuickLogSheet({
  visible, onClose, onSave, academyId, userId, position, isDemo,
}: {
  visible: boolean; onClose: () => void; onSave: () => void;
  academyId: string; userId: string; position: string; isDemo?: boolean;
}) {
  const { showAlert } = useAlert();
  const [sessionType, setSessionType] = useState('Nets');
  const [balls, setBalls] = useState('');
  const [duration, setDuration] = useState('60');
  const [intensity, setIntensity] = useState(5);
  const [saving, setSaving] = useState(false);

  const isBatter = ['Batsman', 'All-Rounder', 'Wicket-Keeper'].includes(position);

  const handleSave = async () => {
    if (isDemo) {
      showAlert('Preview Mode', 'Join a real academy with your code to log sessions.');
      return;
    }
    setSaving(true);
    const { error } = await academyService.logTraining({
      user_id: userId,
      academy_id: academyId,
      log_date: new Date().toISOString().split('T')[0],
      session_type: sessionType,
      duration_minutes: parseInt(duration) || 60,
      intensity,
      ...(isBatter && balls ? { balls_faced: parseInt(balls) } : {}),
      ...(!isBatter && balls ? { balls_bowled: parseInt(balls) } : {}),
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setBalls(''); setDuration('60'); setIntensity(5); setSessionType('Nets');
    onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={ql.overlay} onPress={onClose} />
        <View style={ql.sheet}>
          <View style={ql.handle} />
          <Text style={ql.title}>Log Training</Text>
          <Text style={ql.subtitle}>Tap, type, done — under 10 seconds</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 2 }}>
              {QUICK_TYPES.map(t => (
                <Pressable
                  key={t.label}
                  style={[ql.typeChip, sessionType === t.label && ql.typeChipActive]}
                  onPress={() => setSessionType(t.label)}
                >
                  <MaterialIcons name={t.icon as any} size={16} color={sessionType === t.label ? colors.textLight : colors.textSecondary} />
                  <Text style={[ql.typeLabel, sessionType === t.label && ql.typeLabelActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={ql.label}>Duration (min)</Text>
          <View style={ql.durationRow}>
            {['30', '45', '60', '90', '120'].map(d => (
              <Pressable key={d} style={[ql.durChip, duration === d && ql.durChipActive]} onPress={() => setDuration(d)}>
                <Text style={[ql.durText, duration === d && ql.durTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={ql.label}>{isBatter ? 'Balls Faced' : 'Balls Bowled'} (optional)</Text>
          <TextInput
            style={ql.input}
            value={balls}
            onChangeText={setBalls}
            keyboardType="number-pad"
            placeholder="e.g. 60"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={ql.label}>Intensity: <Text style={{ color: getIntensityColor(intensity), fontWeight: '800' }}>{intensity}/10</Text></Text>
          <IntensityPicker value={intensity} onChange={setIntensity} />

          <Pressable style={[ql.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave}>
            {saving ? <ActivityIndicator color={colors.textLight} /> : (
              <><MaterialIcons name="check" size={20} color={colors.textLight} /><Text style={ql.saveBtnText}>Save Session</Text></>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ql = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  label: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.sm },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '700' },
  typeLabelActive: { color: colors.textLight },
  durationRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  durChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  durChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '700' },
  durTextActive: { color: colors.textLight },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, ...typography.body, color: colors.text, marginBottom: spacing.xs },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md + 2, borderRadius: borderRadius.lg, marginTop: spacing.lg },
  saveBtnText: { ...typography.body, color: colors.textLight, fontWeight: '800', fontSize: 16 },
});

// ─── Join Screen ─────────────────────────────────────────────────────────────
function JoinScreen({ onJoined, onPreview }: { onJoined: () => void; onPreview: (role: 'player' | 'coach') => void }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [position, setPosition] = useState('Batsman');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!user) return;
    if (!code.trim()) { showAlert('Error', 'Please enter your academy code'); return; }
    if (!displayName.trim()) { showAlert('Error', 'Please enter your name'); return; }
    setLoading(true);
    const { data, error } = await academyService.joinAcademy(code.trim(), user.id, displayName.trim(), position, '');
    setLoading(false);
    if (error) { showAlert('Invalid Code', error); return; }
    const role = data!.role === 'coach' ? 'Coach' : 'Player';
    showAlert('Joined!', `Welcome to ${data!.academy.name} as ${role}.`);
    onJoined();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={js.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={js.hero}>
          <View style={js.heroIcon}>
            <MaterialIcons name="shield" size={44} color={colors.primary} />
          </View>
          <Text style={js.heroTitle}>Join Your Academy</Text>
          <Text style={js.heroSub}>
            Enter the code provided by your administrator. Coaches and players each receive a unique code.
          </Text>
        </View>

        {/* Code Input */}
        <View style={js.card}>
          <Text style={js.label}>Academy Code</Text>
          <TextInput
            style={js.codeInput}
            value={code}
            onChangeText={v => setCode(v.toUpperCase())}
            placeholder="e.g. ABC123"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            maxLength={6}
          />
          <Text style={js.hint}>6-character code provided by your academy administrator</Text>
        </View>

        <View style={js.card}>
          <Text style={js.label}>Your Name</Text>
          <TextInput
            style={js.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Jamie Smith"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={js.label}>Position</Text>
          <View style={js.posGrid}>
            {POSITIONS.map(p => (
              <Pressable key={p} style={[js.posChip, position === p && js.posChipActive]} onPress={() => setPosition(p)}>
                <Text style={[js.posText, position === p && js.posTextActive]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={[js.joinBtn, loading && { opacity: 0.6 }]} onPress={handleJoin}>
          {loading ? <ActivityIndicator color={colors.textLight} /> : (
            <><MaterialIcons name="login" size={20} color={colors.textLight} /><Text style={js.joinBtnText}>Join Academy</Text></>
          )}
        </Pressable>

        {/* Divider */}
        <View style={js.divRow}>
          <View style={js.divLine} />
          <Text style={js.divText}>PREVIEW FEATURES</Text>
          <View style={js.divLine} />
        </View>

        {/* Preview buttons */}
        <View style={js.previewRow}>
          <Pressable style={js.previewCard} onPress={() => onPreview('player')}>
            <MaterialIcons name="person" size={26} color={colors.primary} />
            <Text style={js.previewTitle}>Player View</Text>
            <Text style={js.previewSub}>See player dashboard, training log, stats</Text>
          </Pressable>
          <Pressable style={[js.previewCard, { borderColor: colors.warning + '60' }]} onPress={() => onPreview('coach')}>
            <MaterialIcons name="school" size={26} color={colors.warning} />
            <Text style={[js.previewTitle, { color: colors.warning }]}>Coach View</Text>
            <Text style={js.previewSub}>See squad dashboard, analytics, attendance</Text>
          </Pressable>
        </View>

        {/* Info row */}
        <View style={js.infoRow}>
          <MaterialIcons name="info-outline" size={16} color={colors.textSecondary} />
          <Text style={js.infoText}>Academy mode is an additional layer — all your drills, journal, and training tools stay fully accessible.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const js = StyleSheet.create({
  scroll: { padding: spacing.md, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  heroIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  heroTitle: { ...typography.h2, color: colors.text, fontWeight: '800', textAlign: 'center' },
  heroSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  label: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.xs },
  codeInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 2,
    borderColor: colors.primary + '60', paddingHorizontal: spacing.md, paddingVertical: spacing.md + 2,
    fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: 8,
  },
  hint: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    ...typography.body, color: colors.text, marginBottom: spacing.sm,
  },
  posGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  posChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  posChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  posText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  posTextActive: { color: colors.textLight },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md + 4, borderRadius: borderRadius.xl, marginBottom: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  joinBtnText: { ...typography.h4, color: colors.textLight, fontWeight: '800' },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divText: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', letterSpacing: 1 },
  previewRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  previewCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md,
    alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.primary + '40',
  },
  previewTitle: { ...typography.bodySmall, color: colors.primary, fontWeight: '800' },
  previewSub: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },
});

// ─── Player Dashboard ────────────────────────────────────────────────────────
function PlayerDashboard({
  academy, member, logs, onRefresh, refreshing, onLogPress, onJoinMore, isDemo,
}: {
  academy: Academy; member: AcademyMember; logs: AcademyTrainingLog[];
  onRefresh: () => void; refreshing: boolean; onLogPress: () => void; onJoinMore: () => void;
  isDemo?: boolean;
}) {
  const router = useRouter();
  const weekLogs = logs.filter(l => {
    const d = new Date(l.log_date);
    const now = new Date();
    return (now.getTime() - d.getTime()) / 86400000 <= 7;
  });
  const totalBalls = weekLogs.reduce((a, l) => a + (l.balls_faced || l.balls_bowled || 0), 0);
  const avgIntensity = weekLogs.length > 0
    ? (weekLogs.reduce((a, l) => a + l.intensity, 0) / weekLogs.length).toFixed(1)
    : '—';
  const totalMins = weekLogs.reduce((a, l) => a + l.duration_minutes, 0);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {isDemo && <DemoBanner onExit={onJoinMore} />}

      <View style={{ padding: spacing.md }}>
        {/* Academy Banner */}
        <View style={pd.banner}>
          <View style={pd.bannerLeft}>
            <View style={pd.bannerIcon}>
              <MaterialIcons name="shield" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={pd.bannerAcademy} numberOfLines={1}>{academy.name}</Text>
              <View style={pd.bannerRoleRow}>
                <View style={pd.playerBadge}><Text style={pd.playerBadgeText}>Player</Text></View>
                <Text style={pd.bannerPos}>{member.position}</Text>
              </View>
            </View>
          </View>
          {!isDemo && (
            <Pressable onPress={onJoinMore} hitSlop={8} style={pd.addBtn}>
              <MaterialIcons name="vpn-key" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Big Log Button */}
        <Pressable style={pd.logBtn} onPress={onLogPress}>
          <MaterialIcons name="add-circle" size={28} color={colors.textLight} />
          <View>
            <Text style={pd.logBtnTitle}>Log Training</Text>
            <Text style={pd.logBtnSub}>Takes under 10 seconds</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.textLight} style={{ marginLeft: 'auto' as any }} />
        </Pressable>

        {/* This Week */}
        <View style={pd.card}>
          <Text style={pd.cardTitle}>This Week</Text>
          <View style={pd.statsRow}>
            <View style={pd.stat}>
              <Text style={pd.statVal}>{weekLogs.length}</Text>
              <Text style={pd.statLabel}>Sessions</Text>
            </View>
            <View style={pd.stat}>
              <Text style={pd.statVal}>{totalMins}</Text>
              <Text style={pd.statLabel}>Minutes</Text>
            </View>
            <View style={pd.stat}>
              <Text style={pd.statVal}>{totalBalls || '—'}</Text>
              <Text style={pd.statLabel}>Balls</Text>
            </View>
            <View style={pd.stat}>
              <Text style={[pd.statVal, { color: weekLogs.length > 0 ? getIntensityColor(parseFloat(avgIntensity as string)) : colors.text }]}>{avgIntensity}</Text>
              <Text style={pd.statLabel}>Avg Load</Text>
            </View>
          </View>
          <WeekBar logs={weekLogs} />
        </View>

        {/* Quick Actions */}
        <View style={pd.actionsRow}>
          <Pressable style={pd.actionCard} onPress={() => isDemo ? null : router.push({ pathname: '/academy-history', params: { academyId: academy.id } } as any)}>
            <MaterialIcons name="history" size={24} color={colors.warning} />
            <Text style={pd.actionLabel}>History</Text>
          </Pressable>
          <Pressable style={pd.actionCard} onPress={() => isDemo ? null : router.push({ pathname: '/academy-analytics', params: { academyId: academy.id } } as any)}>
            <MaterialIcons name="insights" size={24} color={colors.success} />
            <Text style={pd.actionLabel}>My Analytics</Text>
          </Pressable>
          <Pressable style={pd.actionCard} onPress={() => isDemo ? null : router.push({ pathname: '/academy-schedule', params: { academyId: academy.id } } as any)}>
            <MaterialIcons name="event" size={24} color={colors.mental} />
            <Text style={pd.actionLabel}>Schedule</Text>
          </Pressable>
        </View>

        {/* Recent Logs */}
        {logs.length > 0 && (
          <View style={pd.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={pd.cardTitle}>Recent Sessions</Text>
            </View>
            {logs.slice(0, 5).map(log => (
              <View key={log.id} style={pd.logRow}>
                <View style={[pd.logDot, { backgroundColor: getIntensityColor(log.intensity) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={pd.logType}>{log.session_type}</Text>
                  <Text style={pd.logMeta}>
                    {log.log_date} · {log.duration_minutes}min
                    {log.balls_faced ? ` · ${log.balls_faced} balls` : ''}
                    {log.balls_bowled ? ` · ${log.balls_bowled} bowled` : ''}
                  </Text>
                </View>
                <View style={[pd.loadBadge, { backgroundColor: getIntensityColor(log.intensity) + '20' }]}>
                  <Text style={[pd.loadText, { color: getIntensityColor(log.intensity) }]}>{log.intensity}/10</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const pd = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center' },
  bannerAcademy: { ...typography.body, color: colors.text, fontWeight: '800' },
  bannerRoleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  playerBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  playerBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '800' },
  bannerPos: { fontSize: 11, color: colors.textSecondary },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  logBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  logBtnTitle: { ...typography.h4, color: colors.textLight, fontWeight: '800' },
  logBtnSub: { fontSize: 12, color: colors.textLight, opacity: 0.8, marginTop: 2 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '800', marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', marginBottom: spacing.sm },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { ...typography.h3, color: colors.text, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border },
  actionLabel: { fontSize: 11, color: colors.text, fontWeight: '700', textAlign: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  logDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  logType: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
  logMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  loadBadge: { paddingHorizontal: spacing.xs + 2, paddingVertical: 3, borderRadius: borderRadius.sm },
  loadText: { fontSize: 11, fontWeight: '800' },
});

// ─── Coach Dashboard ──────────────────────────────────────────────────────────
function CoachDashboard({
  academy, member, onRefresh, refreshing, onJoinMore, isDemo,
}: {
  academy: Academy; member: AcademyMember;
  onRefresh: () => void; refreshing: boolean; onJoinMore: () => void;
  isDemo?: boolean;
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<AcademyMember[]>(isDemo ? [
    { id: 'p1', academy_id: 'demo', user_id: 'u1', role: 'player', position: 'Batsman', display_name: 'Alex Johnson', joined_at: '' },
    { id: 'p2', academy_id: 'demo', user_id: 'u2', role: 'player', position: 'Bowler', display_name: 'Sam Patel', joined_at: '' },
    { id: 'p3', academy_id: 'demo', user_id: 'u3', role: 'player', position: 'All-Rounder', display_name: 'Chris Williams', joined_at: '' },
    { id: 'p4', academy_id: 'demo', user_id: 'u4', role: 'player', position: 'Wicket-Keeper', display_name: 'Maya Singh', joined_at: '' },
  ] : []);
  const [allLogs, setAllLogs] = useState<Array<AcademyTrainingLog & { user_profiles: any }>>(
    isDemo ? [
      { ...DEMO_LOGS[0], user_id: 'u1', user_profiles: {} },
      { ...DEMO_LOGS[1], user_id: 'u1', user_profiles: {} },
      { ...DEMO_LOGS[2], user_id: 'u2', user_profiles: {} },
      { ...DEMO_LOGS[3], user_id: 'u3', user_profiles: {} },
    ] : []
  );
  const [loading, setLoading] = useState(!isDemo);

  const load = useCallback(async () => {
    if (isDemo) return;
    const [membRes, logsRes] = await Promise.all([
      academyService.getAcademyMembers(academy.id),
      academyService.getAcademyLogs(academy.id, 7),
    ]);
    setPlayers((membRes.data || []).filter(m => m.role === 'player'));
    setAllLogs(logsRes.data || []);
    setLoading(false);
  }, [academy.id, isDemo]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const getPlayerLogs = (userId: string) => allLogs.filter(l => l.user_id === userId);

  const alerts: string[] = [];
  players.forEach(p => {
    const pl = getPlayerLogs(p.user_id);
    const name = p.display_name || 'Player';
    if (pl.length === 0) alerts.push(`${name} has not trained this week`);
    else {
      const avgLoad = pl.reduce((a, l) => a + l.intensity, 0) / pl.length;
      if (avgLoad > 8) alerts.push(`${name} has a high training load (avg ${avgLoad.toFixed(1)}/10)`);
    }
  });

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { await load(); onRefresh(); }} tintColor={colors.primary} />}
    >
      {isDemo && <DemoBanner onExit={onJoinMore} />}

      <View style={{ padding: spacing.md }}>
        {/* Coach Banner */}
        <View style={cd.banner}>
          <View style={cd.bannerLeft}>
            <View style={cd.bannerIcon}>
              <MaterialIcons name="school" size={24} color={colors.warning} />
            </View>
            <View>
              <Text style={cd.bannerAcademy} numberOfLines={1}>{academy.name}</Text>
              <View style={cd.bannerRoleRow}>
                <View style={cd.coachBadge}><Text style={cd.coachBadgeText}>Coach</Text></View>
              </View>
            </View>
          </View>
          {!isDemo && (
            <Pressable onPress={onJoinMore} hitSlop={8} style={cd.addBtn}>
              <MaterialIcons name="vpn-key" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Alerts */}
        {alerts.length > 0 && (
          <View style={cd.alertsCard}>
            <View style={cd.alertsHeader}>
              <MaterialIcons name="warning" size={16} color={colors.warning} />
              <Text style={cd.alertsTitle}>{alerts.length} Alert{alerts.length > 1 ? 's' : ''}</Text>
            </View>
            {alerts.map((a, i) => (
              <View key={i} style={cd.alertRow}>
                <View style={cd.alertDot} />
                <Text style={cd.alertText}>{a}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Coach Actions */}
        <View style={cd.actionsRow}>
          <Pressable style={cd.actionCard} onPress={() => isDemo ? null : router.push({ pathname: '/academy-coach', params: { academyId: academy.id } } as any)}>
            <MaterialIcons name="people" size={26} color={colors.primary} />
            <Text style={cd.actionLabel}>Squad</Text>
          </Pressable>
          <Pressable style={cd.actionCard} onPress={() => isDemo ? null : router.push({ pathname: '/academy-attendance', params: { academyId: academy.id } } as any)}>
            <MaterialIcons name="fact-check" size={26} color={colors.success} />
            <Text style={cd.actionLabel}>Attendance</Text>
          </Pressable>
          <Pressable style={cd.actionCard} onPress={() => isDemo ? null : router.push({ pathname: '/academy-schedule', params: { academyId: academy.id, isCoach: 'true' } } as any)}>
            <MaterialIcons name="event-note" size={26} color={colors.warning} />
            <Text style={cd.actionLabel}>Sessions</Text>
          </Pressable>
          <Pressable style={cd.actionCard} onPress={() => isDemo ? null : router.push({ pathname: '/academy-coach', params: { academyId: academy.id, tab: 'analytics' } } as any)}>
            <MaterialIcons name="analytics" size={26} color={colors.mental} />
            <Text style={cd.actionLabel}>Analytics</Text>
          </Pressable>
        </View>

        {/* Squad Overview */}
        <View style={cd.card}>
          <View style={cd.cardHeader}>
            <Text style={cd.cardTitle}>Squad — This Week</Text>
            <Text style={cd.squadCount}>{players.length} players</Text>
          </View>
          {loading ? <ActivityIndicator color={colors.primary} /> : players.length === 0 ? (
            <View style={cd.emptySquad}>
              <MaterialIcons name="people-outline" size={32} color={colors.border} />
              <Text style={cd.emptyText}>Players will appear here once they join with their unique code</Text>
            </View>
          ) : (
            players.map(p => {
              const pl = getPlayerLogs(p.user_id);
              const name = p.display_name || 'Player';
              const avgLoad = pl.length > 0 ? pl.reduce((a, l) => a + l.intensity, 0) / pl.length : 0;
              const balls = pl.reduce((a, l) => a + (l.balls_faced || l.balls_bowled || 0), 0);
              return (
                <Pressable key={p.id} style={cd.playerRow} onPress={() => isDemo ? null : router.push({ pathname: '/academy-coach', params: { academyId: academy.id } } as any)}>
                  <View style={[cd.playerAvatar, { backgroundColor: pl.length > 0 ? colors.primary + '20' : colors.border + '40' }]}>
                    <Text style={[cd.playerInitial, { color: pl.length > 0 ? colors.primary : colors.textSecondary }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cd.playerName}>{name}</Text>
                    <Text style={cd.playerPos}>{p.position}</Text>
                  </View>
                  <View style={cd.playerStats}>
                    <Text style={[cd.playerSessions, { color: pl.length > 0 ? colors.primary : colors.textSecondary }]}>
                      {pl.length} {pl.length === 1 ? 'session' : 'sessions'}
                    </Text>
                    {balls > 0 && <Text style={cd.playerBalls}>{balls} balls</Text>}
                    {avgLoad > 0 && (
                      <View style={[cd.loadDot, { backgroundColor: getIntensityColor(avgLoad) }]}>
                        <Text style={cd.loadDotText}>{avgLoad.toFixed(0)}</Text>
                      </View>
                    )}
                  </View>
                  {!isDemo && <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />}
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const cd = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warning + '18', justifyContent: 'center', alignItems: 'center' },
  bannerAcademy: { ...typography.body, color: colors.text, fontWeight: '800' },
  bannerRoleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  coachBadge: { backgroundColor: colors.warning + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  coachBadgeText: { fontSize: 10, color: colors.warning, fontWeight: '800' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  alertsCard: { backgroundColor: colors.warning + '10', borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.warning + '40' },
  alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  alertsTitle: { ...typography.bodySmall, color: colors.warning, fontWeight: '800' },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginBottom: 4 },
  alertDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.warning, marginTop: 5, flexShrink: 0 },
  alertText: { fontSize: 12, color: colors.text, lineHeight: 16, flex: 1 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl, paddingVertical: spacing.md, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border },
  actionLabel: { fontSize: 10, color: colors.text, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '800' },
  squadCount: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  emptySquad: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  playerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  playerInitial: { fontSize: 16, fontWeight: '800' },
  playerName: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
  playerPos: { fontSize: 11, color: colors.textSecondary },
  playerStats: { alignItems: 'flex-end', gap: 2 },
  playerSessions: { fontSize: 11, fontWeight: '700' },
  playerBalls: { fontSize: 10, color: colors.textSecondary },
  loadDot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  loadDotText: { fontSize: 9, color: colors.textLight, fontWeight: '800' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AcademyScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [memberships, setMemberships] = useState<Array<{ academy: Academy; member: AcademyMember }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [logs, setLogs] = useState<AcademyTrainingLog[]>([]);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Demo/preview mode
  const [demoRole, setDemoRole] = useState<'player' | 'coach' | null>(null);

  // Join modal fields
  const [jCode, setJCode] = useState('');
  const [jName, setJName] = useState('');
  const [jPos, setJPos] = useState('Batsman');
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await academyService.getMyAcademies(user.id);
    setMemberships(data || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = memberships[selectedIdx] || null;

  const loadLogs = useCallback(async () => {
    if (!current || !user) return;
    const { data } = await academyService.getMyLogs(user.id, current.academy.id, 14);
    setLogs(data || []);
  }, [current?.academy.id, user]);

  useFocusEffect(useCallback(() => { loadLogs(); }, [loadLogs]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    await loadLogs();
    setRefreshing(false);
  };

  const handleJoinMore = async () => {
    if (!user) return;
    if (!jCode.trim()) { showAlert('Error', 'Please enter a code'); return; }
    if (!jName.trim()) { showAlert('Error', 'Please enter your name'); return; }
    setJoining(true);
    const { data, error } = await academyService.joinAcademy(jCode.trim(), user.id, jName.trim(), jPos, '');
    setJoining(false);
    if (error) { showAlert('Error', error); return; }
    setShowJoinModal(false);
    setJCode(''); setJName(''); setJPos('Batsman');
    setDemoRole(null);
    await load();
    showAlert('Joined!', `Welcome to ${data!.academy.name}!`);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}><Text style={s.headerTitle}>Academy</Text></View>
        <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  // Demo mode — show previews without a real academy
  if (memberships.length === 0 && demoRole) {
    const isCoachDemo = demoRole === 'coach';
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Academy</Text>
          <View style={s.demoBadge}>
            <MaterialIcons name="visibility" size={12} color={colors.warning} />
            <Text style={s.demoBadgeText}>Preview</Text>
          </View>
        </View>
        {isCoachDemo ? (
          <CoachDashboard
            academy={DEMO_ACADEMY}
            member={DEMO_COACH_MEMBER}
            onRefresh={() => {}}
            refreshing={false}
            onJoinMore={() => setDemoRole(null)}
            isDemo
          />
        ) : (
          <PlayerDashboard
            academy={DEMO_ACADEMY}
            member={DEMO_PLAYER_MEMBER}
            logs={DEMO_LOGS}
            onRefresh={() => {}}
            refreshing={false}
            onLogPress={() => setShowQuickLog(true)}
            onJoinMore={() => setDemoRole(null)}
            isDemo
          />
        )}
        <QuickLogSheet
          visible={showQuickLog}
          onClose={() => setShowQuickLog(false)}
          onSave={() => setShowQuickLog(false)}
          academyId="demo"
          userId=""
          position="Batsman"
          isDemo
        />
      </SafeAreaView>
    );
  }

  const isCoach = current?.member.role === 'coach';
  const playerPosition = current?.member.position || 'Batsman';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Academy</Text>
          {current && <Text style={s.headerSub}>{current.academy.name}</Text>}
        </View>
        {memberships.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.switcherScroll} contentContainerStyle={s.switcherContent}>
            {memberships.map((m, i) => (
              <Pressable key={m.academy.id} style={[s.switcherChip, selectedIdx === i && s.switcherChipActive]} onPress={() => setSelectedIdx(i)}>
                <Text style={[s.switcherText, selectedIdx === i && s.switcherTextActive]} numberOfLines={1}>{m.academy.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Content */}
      {memberships.length === 0 ? (
        <JoinScreen onJoined={load} onPreview={setDemoRole} />
      ) : isCoach ? (
        <CoachDashboard
          academy={current!.academy}
          member={current!.member}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onJoinMore={() => setShowJoinModal(true)}
        />
      ) : (
        <PlayerDashboard
          academy={current!.academy}
          member={current!.member}
          logs={logs}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onLogPress={() => setShowQuickLog(true)}
          onJoinMore={() => setShowJoinModal(true)}
        />
      )}

      {/* Quick Log Sheet (players only) */}
      {current && !isCoach && (
        <QuickLogSheet
          visible={showQuickLog}
          onClose={() => setShowQuickLog(false)}
          onSave={async () => {
            setShowQuickLog(false);
            await loadLogs();
            showAlert('Logged!', 'Training session recorded.');
          }}
          academyId={current.academy.id}
          userId={user?.id || ''}
          position={playerPosition}
        />
      )}

      {/* Join Another Academy Modal */}
      <Modal visible={showJoinModal} transparent animationType="slide" onRequestClose={() => setShowJoinModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Join Another Academy</Text>
            <Text style={s.modalSub}>Enter the code provided by your academy administrator</Text>
            <TextInput style={s.modalInput} value={jCode} onChangeText={v => setJCode(v.toUpperCase())} placeholder="Academy Code (6 chars)" placeholderTextColor={colors.textSecondary} autoCapitalize="characters" maxLength={6} />
            <TextInput style={s.modalInput} value={jName} onChangeText={setJName} placeholder="Your Name" placeholderTextColor={colors.textSecondary} />
            <Text style={s.modalLabel}>Position</Text>
            <View style={s.posGrid}>
              {POSITIONS.map(p => (
                <Pressable key={p} style={[s.posChip, jPos === p && s.posChipActive]} onPress={() => setJPos(p)}>
                  <Text style={[s.posText, jPos === p && s.posTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[s.joinBtn, joining && { opacity: 0.6 }]} onPress={handleJoinMore}>
              {joining ? <ActivityIndicator color={colors.textLight} /> : <Text style={s.joinBtnText}>Join Academy</Text>}
            </Pressable>
            <Pressable onPress={() => setShowJoinModal(false)} style={{ alignSelf: 'center', marginTop: spacing.md }}>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '800' },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  demoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning + '20', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  demoBadgeText: { fontSize: 11, color: colors.warning, fontWeight: '800' },
  switcherScroll: { maxHeight: 40, flexShrink: 1 },
  switcherContent: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: 4 },
  switcherChip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 5, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  switcherChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  switcherText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  switcherTextActive: { color: colors.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 48 },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center', marginBottom: spacing.xs },
  modalSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  modalInput: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text, marginBottom: spacing.sm },
  modalLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.xs },
  posGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  posChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  posChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  posText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  posTextActive: { color: colors.textLight },
  joinBtn: { backgroundColor: colors.primary, paddingVertical: spacing.md + 2, borderRadius: borderRadius.lg, alignItems: 'center' },
  joinBtnText: { ...typography.body, color: colors.textLight, fontWeight: '800', fontSize: 16 },
});
