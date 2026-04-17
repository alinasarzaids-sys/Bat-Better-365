import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

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

interface EditForm {
  ballsFaced: string;
  ballsMiddled: string;
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
  sessionNotes: string;
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

function buildNotesString(session: FreestyleSession, form: EditForm): string {
  const trainingTypesText = (session.trainingTypes || []).join(', ');
  const middlePct = form.ballsFaced && form.ballsMiddled && parseInt(form.ballsFaced) > 0
    ? Math.round((parseInt(form.ballsMiddled) / parseInt(form.ballsFaced)) * 100) : 0;

  const physicalRating = avgOfNums([form.energyLevel, form.reactionSpeed]);
  const mentalRating = avgOfNums([form.focus, form.confidence, form.pressureHandling]);
  const tacticalRating = avgOfNums([form.shotSelection, form.gameAwareness]);
  const technicalRating = avgOfNums([form.shotExecution, form.footwork, form.timing]);

  let notes = `Training Types: ${trainingTypesText}\n`;
  notes += `\n--- Batting Stats ---\n`;
  if (form.ballsFaced) notes += `Balls Faced: ${form.ballsFaced}\n`;
  if (form.ballsMiddled) notes += `Balls Middled: ${form.ballsMiddled}\n`;
  if (middlePct > 0) notes += `Middle %: ${middlePct}\n`;
  notes += `\n--- Technical ---\n`;
  notes += `Shot Execution: ${form.shotExecution}/5\n`;
  notes += `Footwork: ${form.footwork}/5\n`;
  notes += `Timing: ${form.timing}/5\n`;
  notes += `\n--- Mental ---\n`;
  notes += `Focus: ${form.focus}/5\n`;
  notes += `Confidence: ${form.confidence}/5\n`;
  notes += `Pressure Handling: ${form.pressureHandling}/5\n`;
  notes += `\n--- Physical ---\n`;
  notes += `Energy Level: ${form.energyLevel}/5\n`;
  notes += `Reaction Speed: ${form.reactionSpeed}/5\n`;
  notes += `\n--- Tactical ---\n`;
  notes += `Shot Selection: ${form.shotSelection}/5\n`;
  notes += `Game Awareness: ${form.gameAwareness}/5\n`;
  notes += `\nPhysical: ${physicalRating}/5\n`;
  notes += `Mental: ${mentalRating}/5\n`;
  notes += `Tactical: ${tacticalRating}/5\n`;
  notes += `Technical: ${technicalRating}/5`;
  if (form.sessionNotes) notes += `\n\nNotes: ${form.sessionNotes}`;
  return notes;
}

function avgOfNums(vals: number[]): number {
  const valid = vals.filter(v => v > 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
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

const METRIC_DESCRIPTIONS: Record<string, string> = {
  'Shot Execution': 'How clean & correct your technique was',
  'Footwork': 'Foot movement & positioning into the ball',
  'Timing': 'How well you timed the ball off the bat',
  'Focus': 'Concentration & staying in the zone',
  'Confidence': 'Overall confidence at the crease',
  'Pressure Handling': 'Managing pressure & high-stakes moments',
  'Energy Level': 'Physical energy & fitness during session',
  'Reaction Speed': 'How quickly you picked up the ball',
  'Shot Selection': 'Choosing the right shot at the right time',
  'Game Awareness': 'Reading the game situation & field',
};

function MetricBar({ label, value, max = 5, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) * 100 : 0;
  const desc = METRIC_DESCRIPTIONS[label];
  return (
    <View style={barStyles.wrapper}>
      <View style={barStyles.labelCol}>
        <Text style={barStyles.label} numberOfLines={1}>{label}</Text>
        {desc ? <Text style={barStyles.desc} numberOfLines={2}>{desc}</Text> : null}
      </View>
      <View style={barStyles.trackCol}>
        <View style={barStyles.track}>
          <View style={[barStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[barStyles.val, { color }]}>{value > 0 ? `${value}/5` : '—'}</Text>
    </View>
  );
}
const barStyles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  labelCol: { width: 120, marginRight: spacing.sm },
  label: { ...typography.caption, color: colors.text, fontWeight: '700', fontSize: 13 },
  desc: { fontSize: 10, color: colors.textSecondary, lineHeight: 13, marginTop: 1 },
  trackCol: { flex: 1, justifyContent: 'center' },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 4 },
  fill: { height: 8, borderRadius: 4, minWidth: 4 },
  val: { ...typography.caption, fontWeight: '800', width: 38, textAlign: 'right', fontSize: 13, marginLeft: 4 },
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

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditSessionModal({
  session,
  visible,
  onClose,
  onSaved,
}: {
  session: FreestyleSession | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: FreestyleSession) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    ballsFaced: '', ballsMiddled: '',
    shotExecution: 0, footwork: 0, timing: 0,
    focus: 0, confidence: 0, pressureHandling: 0,
    energyLevel: 0, reactionSpeed: 0,
    shotSelection: 0, gameAwareness: 0,
    sessionNotes: '',
  });
  const [saving, setSaving] = useState(false);

  // Populate form when session changes
  React.useEffect(() => {
    if (!session) return;
    setForm({
      ballsFaced: session.ballsFaced ? String(session.ballsFaced) : '',
      ballsMiddled: session.ballsMiddled ? String(session.ballsMiddled) : '',
      shotExecution: session.shotExecution || 0,
      footwork: session.footwork || 0,
      timing: session.timing || 0,
      focus: session.focus || 0,
      confidence: session.confidence || 0,
      pressureHandling: session.pressureHandling || 0,
      energyLevel: session.energyLevel || 0,
      reactionSpeed: session.reactionSpeed || 0,
      shotSelection: session.shotSelection || 0,
      gameAwareness: session.gameAwareness || 0,
      sessionNotes: session.sessionNotes || '',
    });
  }, [session]);

  const setRating = (field: keyof EditForm, val: number) =>
    setForm(f => ({ ...f, [field]: val }));

  const middlePct = form.ballsFaced && form.ballsMiddled && parseInt(form.ballsFaced) > 0
    ? Math.round((parseInt(form.ballsMiddled) / parseInt(form.ballsFaced)) * 100) : null;

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    const supabase = getSupabaseClient();
    const newNotes = buildNotesString(session, form);
    const { error } = await supabase
      .from('sessions')
      .update({ notes: newNotes })
      .eq('id', session.id);
    setSaving(false);
    if (error) return;
    const updatedSession: FreestyleSession = {
      ...session,
      notes: newNotes,
      ...parseSessionNotes(newNotes),
    };
    onSaved(updatedSession);
    onClose();
  };

  const StarRow = ({
    label, sublabel, field, color,
  }: { label: string; sublabel: string; field: keyof EditForm; color: string }) => {
    const val = form[field] as number;
    return (
      <View style={editStyles.ratingRow}>
        <View style={editStyles.ratingLabels}>
          <Text style={editStyles.ratingLabel}>{label}</Text>
          <Text style={editStyles.ratingSub}>{sublabel}</Text>
        </View>
        <View style={editStyles.starsRow}>
          {[1, 2, 3, 4, 5].map(s => (
            <Pressable key={s} onPress={() => setRating(field, s)} hitSlop={6}>
              <MaterialIcons name={s <= val ? 'star' : 'star-border'} size={28} color={s <= val ? color : colors.border} />
            </Pressable>
          ))}
          {val > 0 && (
            <Text style={[editStyles.ratingVal, { color }]}>{val}/5</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={editStyles.overlay}>
        <View style={editStyles.sheet}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Handle bar */}
          <View style={editStyles.handle} />

          {/* Header */}
          <View style={editStyles.header}>
            <Pressable onPress={onClose} style={editStyles.headerBtn}>
              <MaterialIcons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={editStyles.headerTitle}>Edit Session</Text>
            <Pressable
              onPress={handleSave}
              style={[editStyles.saveBtn, saving && { opacity: 0.6 }]}
            >
              {saving
                ? <ActivityIndicator size="small" color={colors.textLight} />
                : <Text style={editStyles.saveBtnText}>Save</Text>}
            </Pressable>
          </View>

          <ScrollView
            style={editStyles.scroll}
            contentContainerStyle={editStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Batting Stats */}
            <View style={editStyles.section}>
              <View style={editStyles.sectionHeader}>
                <MaterialIcons name="sports-cricket" size={16} color={colors.primary} />
                <Text style={editStyles.sectionTitle}>Batting Stats</Text>
              </View>
              <View style={editStyles.statsRow}>
                <View style={editStyles.statBlock}>
                  <Text style={editStyles.statLabel}>Balls Faced</Text>
                  <TextInput
                    style={editStyles.statInput}
                    value={form.ballsFaced}
                    onChangeText={v => setForm(f => ({ ...f, ballsFaced: v.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={editStyles.statBlock}>
                  <Text style={editStyles.statLabel}>Balls Middled</Text>
                  <TextInput
                    style={editStyles.statInput}
                    value={form.ballsMiddled}
                    onChangeText={v => setForm(f => ({ ...f, ballsMiddled: v.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
              {middlePct !== null && (
                <View style={editStyles.middleBadge}>
                  <MaterialIcons name="gps-fixed" size={13} color={colors.success} />
                  <Text style={editStyles.middleBadgeText}>Middle %: {middlePct}%</Text>
                </View>
              )}
            </View>

            {/* Technical */}
            <View style={editStyles.section}>
              <View style={editStyles.sectionHeader}>
                <MaterialIcons name="sports-cricket" size={16} color={colors.technical} />
                <Text style={[editStyles.sectionTitle, { color: colors.technical }]}>Technical</Text>
              </View>
              <StarRow label="Shot Execution" sublabel="How clean & correct was your technique?" field="shotExecution" color={colors.technical} />
              <StarRow label="Footwork" sublabel="Foot movement & positioning into the ball" field="footwork" color={colors.technical} />
              <StarRow label="Timing" sublabel="How well you timed the ball off the bat" field="timing" color={colors.technical} />
            </View>

            {/* Mental */}
            <View style={editStyles.section}>
              <View style={editStyles.sectionHeader}>
                <MaterialIcons name="psychology" size={16} color={colors.mental} />
                <Text style={[editStyles.sectionTitle, { color: colors.mental }]}>Mental</Text>
              </View>
              <StarRow label="Focus" sublabel="Concentration & staying in the zone" field="focus" color={colors.mental} />
              <StarRow label="Confidence" sublabel="Overall confidence at the crease" field="confidence" color={colors.mental} />
              <StarRow label="Pressure Handling" sublabel="Managing pressure & high-stakes moments" field="pressureHandling" color={colors.mental} />
            </View>

            {/* Physical */}
            <View style={editStyles.section}>
              <View style={editStyles.sectionHeader}>
                <MaterialIcons name="fitness-center" size={16} color={colors.physical} />
                <Text style={[editStyles.sectionTitle, { color: colors.physical }]}>Physical</Text>
              </View>
              <StarRow label="Energy Level" sublabel="Physical energy & fitness during session" field="energyLevel" color={colors.physical} />
              <StarRow label="Reaction Speed" sublabel="How quickly you picked up the ball" field="reactionSpeed" color={colors.physical} />
            </View>

            {/* Tactical */}
            <View style={editStyles.section}>
              <View style={editStyles.sectionHeader}>
                <MaterialIcons name="lightbulb" size={16} color={colors.tactical} />
                <Text style={[editStyles.sectionTitle, { color: colors.tactical }]}>Tactical</Text>
              </View>
              <StarRow label="Shot Selection" sublabel="Choosing the right shot at the right time" field="shotSelection" color={colors.tactical} />
              <StarRow label="Game Awareness" sublabel="Reading the game situation & field" field="gameAwareness" color={colors.tactical} />
            </View>

            {/* Notes */}
            <View style={editStyles.section}>
              <Text style={editStyles.sectionTitle}>Session Notes</Text>
              <TextInput
                style={editStyles.notesInput}
                value={form.sessionNotes}
                onChangeText={v => setForm(f => ({ ...f, sessionNotes: v }))}
                multiline
                numberOfLines={4}
                placeholder="Any observations or key takeaways..."
                placeholderTextColor={colors.textSecondary}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', minHeight: 420,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  saveBtn: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.md, minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { ...typography.bodySmall, color: colors.textLight, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 40 },
  section: {
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  sectionTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBlock: { flex: 1 },
  statLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs, textAlign: 'center' },
  statInput: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.border, paddingVertical: spacing.md,
    ...typography.h4, color: colors.text, fontWeight: '700', textAlign: 'center',
  },
  middleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm,
    backgroundColor: colors.success + '15', paddingHorizontal: spacing.sm,
    paddingVertical: 5, borderRadius: borderRadius.sm, alignSelf: 'flex-start',
  },
  middleBadgeText: { ...typography.caption, color: colors.success, fontWeight: '700' },
  ratingRow: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  ratingLabels: { marginBottom: spacing.sm },
  ratingLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  ratingSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingVal: { ...typography.caption, fontWeight: '800', marginLeft: spacing.sm },
  notesInput: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, ...typography.body, color: colors.text,
    minHeight: 90, marginTop: spacing.sm,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FreestyleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'latest' | 'history' | 'trends'>('latest');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<FreestyleSession | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // ── PROMO DEMO DATA ───────────────────────────────────────────────────────
    const DEMO_SESSIONS: FreestyleSession[] = [
      {
        id: 'demo-1', title: 'Freestyle Session', scheduled_date: '2026-04-17T06:00:00Z',
        completed_at: '2026-04-17T08:15:00Z', duration_minutes: 75, status: 'completed',
        notes: '', trainingTypes: ['Batting', 'Footwork'],
        ballsFaced: 180, ballsMiddled: 134, middlePercent: 74, boundariesHit: 18,
        shotExecution: 5, footwork: 4, timing: 5,
        focus: 5, confidence: 4, pressureHandling: 4,
        energyLevel: 5, reactionSpeed: 4,
        shotSelection: 4, gameAwareness: 5,
        sessionNotes: 'Best session this month. Timing was on point throughout. Cover drives felt natural.',
      },
      {
        id: 'demo-2', title: 'Freestyle Session', scheduled_date: '2026-04-15T06:00:00Z',
        completed_at: '2026-04-15T07:45:00Z', duration_minutes: 60, status: 'completed',
        notes: '', trainingTypes: ['Batting', 'Defence'],
        ballsFaced: 150, ballsMiddled: 102, middlePercent: 68, boundariesHit: 11,
        shotExecution: 4, footwork: 4, timing: 4,
        focus: 4, confidence: 4, pressureHandling: 3,
        energyLevel: 4, reactionSpeed: 4,
        shotSelection: 4, gameAwareness: 4,
        sessionNotes: 'Good session. Defence was solid. Need to work on pressure situations.',
      },
      {
        id: 'demo-3', title: 'Freestyle Session', scheduled_date: '2026-04-13T06:00:00Z',
        completed_at: '2026-04-13T07:30:00Z', duration_minutes: 55, status: 'completed',
        notes: '', trainingTypes: ['Batting'],
        ballsFaced: 120, ballsMiddled: 78, middlePercent: 65, boundariesHit: 9,
        shotExecution: 4, footwork: 3, timing: 4,
        focus: 3, confidence: 3, pressureHandling: 3,
        energyLevel: 3, reactionSpeed: 4,
        shotSelection: 3, gameAwareness: 3,
        sessionNotes: 'Footwork needs attention. Kept falling over to off side.',
      },
      {
        id: 'demo-4', title: 'Freestyle Session', scheduled_date: '2026-04-11T06:00:00Z',
        completed_at: '2026-04-11T08:00:00Z', duration_minutes: 70, status: 'completed',
        notes: '', trainingTypes: ['Batting', 'Pulling'],
        ballsFaced: 160, ballsMiddled: 115, middlePercent: 72, boundariesHit: 14,
        shotExecution: 4, footwork: 4, timing: 4,
        focus: 4, confidence: 5, pressureHandling: 4,
        energyLevel: 4, reactionSpeed: 5,
        shotSelection: 4, gameAwareness: 4,
        sessionNotes: 'Pull shot clicking nicely. Reaction speed felt sharp today.',
      },
      {
        id: 'demo-5', title: 'Freestyle Session', scheduled_date: '2026-04-09T06:00:00Z',
        completed_at: '2026-04-09T07:15:00Z', duration_minutes: 50, status: 'completed',
        notes: '', trainingTypes: ['Batting'],
        ballsFaced: 100, ballsMiddled: 62, middlePercent: 62, boundariesHit: 7,
        shotExecution: 3, footwork: 3, timing: 3,
        focus: 4, confidence: 3, pressureHandling: 3,
        energyLevel: 3, reactionSpeed: 3,
        shotSelection: 3, gameAwareness: 3,
        sessionNotes: 'Below par. Tired from match day. Short session.',
      },
      {
        id: 'demo-6', title: 'Freestyle Session', scheduled_date: '2026-04-07T06:00:00Z',
        completed_at: '2026-04-07T07:50:00Z', duration_minutes: 65, status: 'completed',
        notes: '', trainingTypes: ['Batting', 'Sweep shots'],
        ballsFaced: 140, ballsMiddled: 98, middlePercent: 70, boundariesHit: 12,
        shotExecution: 4, footwork: 4, timing: 4,
        focus: 4, confidence: 4, pressureHandling: 4,
        energyLevel: 4, reactionSpeed: 4,
        shotSelection: 5, gameAwareness: 4,
        sessionNotes: 'Sweep shots were excellent. Game awareness improving.',
      },
      {
        id: 'demo-7', title: 'Freestyle Session', scheduled_date: '2026-04-05T06:00:00Z',
        completed_at: '2026-04-05T08:05:00Z', duration_minutes: 80, status: 'completed',
        notes: '', trainingTypes: ['Batting', 'Running between wickets'],
        ballsFaced: 200, ballsMiddled: 148, middlePercent: 74, boundariesHit: 20,
        shotExecution: 5, footwork: 4, timing: 4,
        focus: 5, confidence: 5, pressureHandling: 5,
        energyLevel: 5, reactionSpeed: 4,
        shotSelection: 4, gameAwareness: 5,
        sessionNotes: 'Excellent session — peak confidence and focus. 200 balls faced personal best.',
      },
      {
        id: 'demo-8', title: 'Freestyle Session', scheduled_date: '2026-04-03T06:00:00Z',
        completed_at: '2026-04-03T07:20:00Z', duration_minutes: 50, status: 'completed',
        notes: '', trainingTypes: ['Defence'],
        ballsFaced: 90, ballsMiddled: 55, middlePercent: 61, boundariesHit: 4,
        shotExecution: 3, footwork: 3, timing: 3,
        focus: 3, confidence: 3, pressureHandling: 2,
        energyLevel: 3, reactionSpeed: 3,
        shotSelection: 3, gameAwareness: 3,
        sessionNotes: 'Pressure handling struggled under short-pitch bowling drill.',
      },
      {
        id: 'demo-9', title: 'Freestyle Session', scheduled_date: '2026-04-01T06:00:00Z',
        completed_at: '2026-04-01T07:45:00Z', duration_minutes: 60, status: 'completed',
        notes: '', trainingTypes: ['Batting', 'Timing drills'],
        ballsFaced: 130, ballsMiddled: 90, middlePercent: 69, boundariesHit: 10,
        shotExecution: 4, footwork: 4, timing: 5,
        focus: 4, confidence: 4, pressureHandling: 3,
        energyLevel: 4, reactionSpeed: 4,
        shotSelection: 4, gameAwareness: 4,
        sessionNotes: 'Timing felt electric today. On-drive was the best shot of the session.',
      },
      {
        id: 'demo-10', title: 'Freestyle Session', scheduled_date: '2026-03-29T06:00:00Z',
        completed_at: '2026-03-29T07:30:00Z', duration_minutes: 55, status: 'completed',
        notes: '', trainingTypes: ['Batting'],
        ballsFaced: 110, ballsMiddled: 71, middlePercent: 65, boundariesHit: 8,
        shotExecution: 3, footwork: 4, timing: 3,
        focus: 4, confidence: 3, pressureHandling: 3,
        energyLevel: 4, reactionSpeed: 3,
        shotSelection: 3, gameAwareness: 3,
        sessionNotes: 'First session of the month. Getting back into rhythm.',
      },
    ];
    setSessions(DEMO_SESSIONS);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadSessions(); }, [loadSessions]));

  const handleSessionSaved = (updated: FreestyleSession) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

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

      {/* Tab description banner */}
      <View style={styles.tabInfoBanner}>
        <MaterialIcons
          name={activeTab === 'latest' ? 'info-outline' : activeTab === 'history' ? 'history' : 'show-chart'}
          size={14}
          color={colors.primary}
        />
        <Text style={styles.tabInfoText}>
          {activeTab === 'latest'
            ? 'Your most recent session breakdown — 10 metrics self-rated 1–5 immediately after each session'
            : activeTab === 'history'
            ? 'All completed freestyle sessions — tap a card to expand, then tap Edit to correct your data'
            : 'Long-term performance patterns across all sessions — averages and per-session bar charts for every metric'}
        </Text>
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
                  <Text style={styles.cardSubtitle}>Based on your self-rated metrics from this session</Text>
                  {(
                    [latest?.shotExecution, latest?.footwork, latest?.timing,
                     latest?.focus, latest?.confidence, latest?.pressureHandling,
                     latest?.energyLevel, latest?.reactionSpeed,
                     latest?.shotSelection, latest?.gameAwareness].every(v => !v || v === 0)
                  ) && (
                    <View style={[styles.analysisBlock, { backgroundColor: colors.background, borderLeftColor: colors.border }]}>
                      <View style={styles.analysisHeader}>
                        <MaterialIcons name="info-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.analysisTitle, { color: colors.textSecondary }]}>No detailed metrics recorded</Text>
                      </View>
                      <Text style={styles.analysisText}>This session was logged before per-metric tracking was introduced. Complete a new freestyle session to see your strengths and areas for improvement.</Text>
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
                <Text style={styles.sectionLabel}>{sessions.length} sessions recorded — tap a card to expand</Text>
                {sessions.map((s, idx) => {
                  const sessionKey = s.id || String(idx);
                  const isExpanded = expandedSessionId === sessionKey;
                  const tech = avgOf([s.shotExecution, s.footwork, s.timing]) || s.technicalRating || 0;
                  const ment = avgOf([s.focus, s.confidence, s.pressureHandling]) || s.mentalRating || 0;
                  const phys = avgOf([s.energyLevel, s.reactionSpeed]) || s.physicalRating || 0;
                  const tact = avgOf([s.shotSelection, s.gameAwareness]) || s.tacticalRating || 0;
                  const overall = avgOf([tech, ment, phys, tact]);
                  const perf = getPerformanceLabel(overall);
                  const mPct = s.middlePercent || (s.ballsFaced && s.ballsMiddled && (s.ballsFaced || 0) > 0
                    ? Math.round(((s.ballsMiddled || 0) / (s.ballsFaced || 1)) * 100) : null);
                  const allMetrics = [
                    { label: 'Shot Execution', value: s.shotExecution || 0, color: colors.technical, group: 'Technical' },
                    { label: 'Footwork', value: s.footwork || 0, color: colors.technical, group: 'Technical' },
                    { label: 'Timing', value: s.timing || 0, color: colors.technical, group: 'Technical' },
                    { label: 'Focus', value: s.focus || 0, color: colors.mental, group: 'Mental' },
                    { label: 'Confidence', value: s.confidence || 0, color: colors.mental, group: 'Mental' },
                    { label: 'Pressure Handling', value: s.pressureHandling || 0, color: colors.mental, group: 'Mental' },
                    { label: 'Energy Level', value: s.energyLevel || 0, color: colors.physical, group: 'Physical' },
                    { label: 'Reaction Speed', value: s.reactionSpeed || 0, color: colors.physical, group: 'Physical' },
                    { label: 'Shot Selection', value: s.shotSelection || 0, color: colors.tactical, group: 'Tactical' },
                    { label: 'Game Awareness', value: s.gameAwareness || 0, color: colors.tactical, group: 'Tactical' },
                  ];
                  const hasDetailedMetrics = allMetrics.some(m => m.value > 0);
                  return (
                    <Pressable
                      key={sessionKey}
                      style={[styles.historyCard, isExpanded && styles.historyCardExpanded]}
                      onPress={() => setExpandedSessionId(isExpanded ? null : sessionKey)}
                    >
                      {/* Card header row */}
                      <View style={styles.historyTop}>
                        <View style={styles.historyLeft}>
                          <Text style={styles.historyDate}>{formatDate(s.completed_at || s.scheduled_date)}</Text>
                          <View style={styles.historyMeta}>
                            {(s.duration_minutes || 0) > 0 && (
                              <View style={styles.metaChip}>
                                <MaterialIcons name="timer" size={11} color={colors.textSecondary} />
                                <Text style={styles.metaChipText}>{s.duration_minutes} min</Text>
                              </View>
                            )}
                            {(s.ballsFaced || 0) > 0 && (
                              <View style={styles.metaChip}>
                                <MaterialIcons name="sports-cricket" size={11} color={colors.textSecondary} />
                                <Text style={styles.metaChipText}>{s.ballsFaced} balls</Text>
                              </View>
                            )}
                            {mPct !== null && (
                              <View style={[styles.metaChip, { backgroundColor: colors.success + '15' }]}>
                                <MaterialIcons name="gps-fixed" size={11} color={colors.success} />
                                <Text style={[styles.metaChipText, { color: colors.success, fontWeight: '700' }]}>{mPct}% mid</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.historyRight}>
                          <View style={[styles.badgeSmall, { backgroundColor: perf.color + '20' }]}>
                            <Text style={[styles.badgeSmallText, { color: perf.color }]}>{perf.label}</Text>
                          </View>
                          <Text style={[styles.historyAvg, { color: perf.color }]}>{overall > 0 ? overall.toFixed(1) : '—'}<Text style={styles.historyAvgMax}>/5</Text></Text>
                        </View>
                        <MaterialIcons
                          name={isExpanded ? 'expand-less' : 'expand-more'}
                          size={20}
                          color={colors.textSecondary}
                          style={{ marginLeft: 4 }}
                        />
                      </View>

                      {/* Compact metric chips (collapsed) */}
                      {!isExpanded && hasDetailedMetrics && (
                        <View style={styles.historyMetrics}>
                          {allMetrics.filter(m => m.value > 0).map(m => (
                            <View key={m.label} style={styles.historyMetricChip}>
                              <Text style={[styles.historyMetricLabel, { color: m.color }]}>
                                {m.label === 'Shot Execution' ? 'Shot Exec' :
                                 m.label === 'Pressure Handling' ? 'Pressure' :
                                 m.label === 'Energy Level' ? 'Energy' :
                                 m.label === 'Reaction Speed' ? 'Reaction' :
                                 m.label === 'Shot Selection' ? 'Shot Sel.' :
                                 m.label === 'Game Awareness' ? 'Game IQ' : m.label}
                              </Text>
                              <Text style={[styles.historyMetricVal, { color: m.color }]}>{m.value}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Expanded full breakdown */}
                      {isExpanded && (
                        <View style={styles.expandedContent}>
                          {/* Edit button */}
                          <Pressable
                            style={styles.editBtn}
                            onPress={(e) => { e.stopPropagation(); setEditingSession(s); }}
                          >
                            <MaterialIcons name="edit" size={15} color={colors.primary} />
                            <Text style={styles.editBtnText}>Edit Session Data</Text>
                          </Pressable>

                          {/* Pillar summary row */}
                          <View style={styles.expandedPillarRow}>
                            {[
                              { label: 'Technical', value: tech, color: colors.technical },
                              { label: 'Mental', value: ment, color: colors.mental },
                              { label: 'Physical', value: phys, color: colors.physical },
                              { label: 'Tactical', value: tact, color: colors.tactical },
                            ].map(p => (
                              <View key={p.label} style={styles.expandedPillarCard}>
                                <Text style={[styles.expandedPillarVal, { color: p.color }]}>{p.value > 0 ? p.value.toFixed(1) : '—'}</Text>
                                <Text style={styles.expandedPillarLabel}>{p.label}</Text>
                              </View>
                            ))}
                          </View>
                          {/* Detailed metric bars grouped by pillar */}
                          {(['Technical', 'Mental', 'Physical', 'Tactical'] as const).map(group => {
                            const groupMetrics = allMetrics.filter(m => m.group === group && m.value > 0);
                            if (!groupMetrics.length) return null;
                            const groupColor = groupMetrics[0].color;
                            return (
                              <View key={group} style={styles.expandedGroup}>
                                <Text style={[styles.expandedGroupTitle, { color: groupColor }]}>{group}</Text>
                                {groupMetrics.map(m => (
                                  <View key={m.label} style={styles.expandedMetricRow}>
                                    <Text style={styles.expandedMetricLabel}>{m.label}</Text>
                                    <View style={styles.expandedTrack}>
                                      <View style={[styles.expandedFill, { width: `${(m.value / 5) * 100}%`, backgroundColor: m.color }]} />
                                    </View>
                                    <Text style={[styles.expandedMetricVal, { color: m.color }]}>{m.value}/5</Text>
                                  </View>
                                ))}
                              </View>
                            );
                          })}
                          {s.sessionNotes ? (
                            <View style={styles.expandedNotes}>
                              <Text style={styles.expandedNotesLabel}>Notes</Text>
                              <Text style={styles.expandedNotesText}>{s.sessionNotes}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </Pressable>
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

      {/* Edit Modal */}
      <EditSessionModal
        session={editingSession}
        visible={editingSession !== null}
        onClose={() => setEditingSession(null)}
        onSaved={handleSessionSaved}
      />
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

  tabInfoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    backgroundColor: colors.primary + '10', paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabInfoText: { fontSize: 11, color: colors.textSecondary, flex: 1, lineHeight: 15 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 48 },

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

  pillarGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  pillarCard: {
    flex: 1, minWidth: '44%', backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border,
    borderTopWidth: 3, overflow: 'visible',
  },
  pillarScore: { fontSize: 24, fontWeight: '800' },
  pillarLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  analysisBlock: { borderRadius: borderRadius.md, padding: spacing.md, borderLeftWidth: 3 },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  analysisTitle: { ...typography.bodySmall, fontWeight: '700' },
  analysisBullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  analysisText: { ...typography.bodySmall, color: colors.text, flex: 1 },

  sectionLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.md },
  historyCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  historyCardExpanded: { borderColor: colors.primary + '50', borderWidth: 1.5 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 0 },
  historyLeft: { flex: 1 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyDate: { ...typography.body, color: colors.text, fontWeight: '700', marginBottom: 4 },
  historyMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: colors.border,
  },
  metaChipText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  historyAvg: { fontSize: 22, color: colors.text, fontWeight: '800', lineHeight: 26 },
  historyAvgMax: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  middlePctChip: { ...typography.caption, color: colors.success, fontWeight: '700' },
  ballsFacedChip: { ...typography.caption, color: colors.textSecondary },
  historyMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  historyMetricChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3,
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border,
  },
  historyMetricLabel: { fontSize: 10, fontWeight: '600' },
  historyMetricVal: { fontSize: 11, fontWeight: '800' },

  // Expanded session
  expandedContent: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', marginBottom: spacing.md,
    backgroundColor: colors.primary + '15', paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.primary + '40',
  },
  editBtnText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  expandedPillarRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  expandedPillarCard: {
    flex: 1, alignItems: 'center', backgroundColor: colors.background,
    borderRadius: borderRadius.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  expandedPillarVal: { fontSize: 18, fontWeight: '800' },
  expandedPillarLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  expandedGroup: { marginBottom: spacing.md },
  expandedGroupTitle: { ...typography.bodySmall, fontWeight: '700', marginBottom: spacing.sm },
  expandedMetricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8 },
  expandedMetricLabel: { ...typography.caption, color: colors.text, fontWeight: '500', width: 110 },
  expandedTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3 },
  expandedFill: { height: 6, borderRadius: 3, minWidth: 4 },
  expandedMetricVal: { ...typography.caption, fontWeight: '800', width: 30, textAlign: 'right' },
  expandedNotes: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs,
  },
  expandedNotesLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  expandedNotesText: { ...typography.caption, color: colors.text, lineHeight: 16 },

  careerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  careerStat: { flex: 1, minWidth: '28%', alignItems: 'center', gap: 4 },
  careerVal: { ...typography.h3, fontWeight: '800', color: colors.text },
  careerLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
});
