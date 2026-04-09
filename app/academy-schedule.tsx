import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Modal, TextInput, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, AcademySession } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// ─── Training Plan Block ──────────────────────────────────────────────────────
interface PlanBlock {
  id: string;
  startTime: string;    // "07:15"
  endTime: string;      // "07:45"
  activities: string[]; // ["Batting", "Bowling"] — multi-select
  notes: string;        // notes + drills go here
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function now12() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDateReadable(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatTime12(time: string) {
  try {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  } catch { return time; }
}

function parsePlanBlocks(notes?: string): PlanBlock[] {
  if (!notes) return [];
  try {
    const start = notes.indexOf('PLAN_BLOCKS:');
    if (start === -1) return [];
    const json = notes.slice(start + 12);
    const blocks = JSON.parse(json);
    // Backward compat: convert old single `activity` string to array
    return blocks.map((b: any) => ({
      ...b,
      activities: Array.isArray(b.activities)
        ? b.activities
        : b.activity ? [b.activity] : [],
    }));
  } catch { return []; }
}

function parseObjectives(notes?: string): string[] {
  if (!notes) return [];
  try {
    const start = notes.indexOf('OBJECTIVES:');
    if (start === -1) return [];
    const end = notes.indexOf('PLAN_BLOCKS:');
    const slice = end === -1 ? notes.slice(start + 11) : notes.slice(start + 11, end);
    return JSON.parse(slice.trim().split('\n')[0]);
  } catch { return []; }
}

function parseCoachNotes(notes?: string): string {
  if (!notes) return '';
  const markers = ['OBJECTIVES:', 'PLAN_BLOCKS:'];
  let result = notes;
  for (const m of markers) {
    const idx = result.indexOf(m);
    if (idx !== -1) result = result.slice(0, idx);
  }
  return result.trim();
}

function buildNotes(coachNotes: string, objectives: string[], planBlocks: PlanBlock[]): string {
  let out = '';
  if (coachNotes.trim()) out += coachNotes.trim() + '\n';
  if (objectives.filter(Boolean).length) out += `OBJECTIVES:${JSON.stringify(objectives.filter(Boolean))}\n`;
  if (planBlocks.length) out += `PLAN_BLOCKS:${JSON.stringify(planBlocks)}`;
  return out;
}

// ─── Activity Pill Options ────────────────────────────────────────────────────
const ACTIVITIES = ['Batting', 'Bowling', 'Fielding', 'Keeping', 'Fitness', 'Warm-up', 'Cool-down', 'Team Talk', 'Match Sim'];
const SESSION_TYPES = ['Training', 'Match', 'Fitness', 'Fielding', 'Batting', 'Bowling'];

const TYPE_COLORS: Record<string, string> = {
  Training: colors.primary, Match: colors.error, Fitness: colors.physical,
  Fielding: colors.tactical, Batting: colors.technical, Bowling: colors.physical,
};

// ─── Plan Block Builder ───────────────────────────────────────────────────────
function PlanBlockEditor({ blocks, onChange, sessionColor }: {
  blocks: PlanBlock[];
  onChange: (b: PlanBlock[]) => void;
  sessionColor: string;
}) {
  const addBlock = () => {
    const last = blocks[blocks.length - 1];
    const startT = last ? last.endTime : now12();
    const [h, m] = startT.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, h, m + 30);
    const endT = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
    onChange([...blocks, { id: Date.now().toString(), startTime: startT, endTime: endT, activities: ['Batting'], notes: '' }]);
  };

  const updateField = (id: string, field: 'startTime' | 'endTime' | 'notes', value: string) =>
    onChange(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));

  // Multi-select toggle for activities
  const toggleActivity = (id: string, activity: string) =>
    onChange(blocks.map(b => {
      if (b.id !== id) return b;
      const has = b.activities.includes(activity);
      const next = has
        ? b.activities.filter(a => a !== activity)
        : [...b.activities, activity];
      return { ...b, activities: next.length ? next : [activity] };
    }));

  const remove = (id: string) => onChange(blocks.filter(b => b.id !== id));

  // Auto-fill time field with current time if empty
  const handleTimeFocus = (id: string, field: 'startTime' | 'endTime', current: string) => {
    if (!current || current === '00:00') {
      updateField(id, field, now12());
    }
  };

  return (
    <View style={pb.wrapper}>
      {blocks.map((block, idx) => (
        <View key={block.id} style={[pb.block, { borderLeftColor: sessionColor }]}>
          <View style={pb.blockHeader}>
            <Text style={[pb.blockNum, { color: sessionColor }]}>Block {idx + 1}</Text>
            <Pressable onPress={() => remove(block.id)} hitSlop={6}>
              <MaterialIcons name="remove-circle-outline" size={20} color={colors.error} />
            </Pressable>
          </View>

          {/* Time row */}
          <View style={pb.timeRow}>
            <View style={pb.timeField}>
              <Text style={pb.timeLabel}>Start</Text>
              <TextInput
                style={pb.timeInput}
                value={block.startTime}
                onChangeText={v => updateField(block.id, 'startTime', v)}
                onFocus={() => handleTimeFocus(block.id, 'startTime', block.startTime)}
                placeholder={now12()}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <MaterialIcons name="arrow-forward" size={16} color={colors.textSecondary} style={{ marginTop: 20 }} />
            <View style={pb.timeField}>
              <Text style={pb.timeLabel}>End</Text>
              <TextInput
                style={pb.timeInput}
                value={block.endTime}
                onChangeText={v => updateField(block.id, 'endTime', v)}
                onFocus={() => handleTimeFocus(block.id, 'endTime', block.endTime)}
                placeholder={now12()}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          {/* Activities — multi-select */}
          <Text style={[pb.timeLabel, { marginTop: 6, marginBottom: 4 }]}>Activities (tap to select multiple)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {ACTIVITIES.map(a => {
                const selected = block.activities.includes(a);
                return (
                  <Pressable
                    key={a}
                    style={[pb.activityChip, selected && { backgroundColor: sessionColor, borderColor: sessionColor }]}
                    onPress={() => toggleActivity(block.id, a)}
                  >
                    <Text style={[pb.activityChipText, selected && { color: colors.textLight }]}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Block notes — drills go here */}
          <TextInput
            style={pb.blockNotes}
            value={block.notes}
            onChangeText={v => updateField(block.id, 'notes', v)}
            placeholder="Notes & drills e.g. Short-arm jab drill, focus on drive shots"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>
      ))}
      <Pressable style={[pb.addBlockBtn, { borderColor: sessionColor }]} onPress={addBlock}>
        <MaterialIcons name="add-circle" size={18} color={sessionColor} />
        <Text style={[pb.addBlockText, { color: sessionColor }]}>Add Training Block</Text>
      </Pressable>
    </View>
  );
}

const pb = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  block: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderLeftWidth: 3, padding: spacing.sm, gap: spacing.xs },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockNum: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  timeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  timeField: { minWidth: 64 },
  timeLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  timeInput: { backgroundColor: colors.surface, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: colors.text, fontWeight: '700', textAlign: 'center', width: 64 },
  activityChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  activityChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  blockNotes: { backgroundColor: colors.surface, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6, fontSize: 13, color: colors.text, minHeight: 36, marginTop: 4 },
  addBlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: borderRadius.md, borderStyle: 'dashed', paddingVertical: 10 },
  addBlockText: { fontSize: 13, fontWeight: '700' },
});

// ─── Session Card (with full plan details for players) ────────────────────────
function SessionCard({ s, isCoach, academyId, today, router }: {
  s: AcademySession; isCoach: boolean; academyId: string; today: string; router: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = TYPE_COLORS[s.session_type] || colors.primary;
  const isToday = s.session_date === today;
  const isPast = s.session_date < today;

  const planBlocks = parsePlanBlocks(s.notes);
  const objectives = parseObjectives(s.notes);
  const coachNotes = parseCoachNotes(s.notes);
  const hasPlan = planBlocks.length > 0 || objectives.length > 0 || !!coachNotes;

  const getActivitiesLabel = (b: PlanBlock) =>
    (b.activities && b.activities.length > 0 ? b.activities : ['Training']).join(' + ');

  return (
    <Pressable
      style={[styles.sessionCard, isToday && styles.sessionCardToday]}
      onPress={() => setExpanded(e => !e)}
    >
      <View style={[styles.sessionStripe, { backgroundColor: color }]} />
      <View style={styles.sessionContent}>
        <View style={styles.sessionTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.sessionTitleRow}>
              <Text style={styles.sessionTitle}>{s.title}</Text>
              {isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>}
            </View>
            <Text style={styles.sessionMeta}>
              {formatDateReadable(s.session_date)} · {formatTime12(s.session_time)}
              {s.location ? ` · ${s.location}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{s.session_type}</Text>
            </View>
            <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={colors.textSecondary} />
          </View>
        </View>

        {/* Collapsed preview — activity chips */}
        {!expanded && planBlocks.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {planBlocks.map(b => (
                <View key={b.id} style={[styles.blockPreviewChip, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                  <Text style={[styles.blockPreviewTime, { color }]}>{formatTime12(b.startTime)}</Text>
                  <Text style={[styles.blockPreviewActivity, { color }]}>{getActivitiesLabel(b)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Expanded view — full training plan */}
        {expanded && hasPlan && (
          <View style={styles.planContainer}>
            {/* Objectives first */}
            {objectives.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <MaterialIcons name="flag" size={14} color={colors.warning} />
                  <Text style={[styles.planSectionTitle, { color: colors.warning }]}>Session Objectives</Text>
                </View>
                {objectives.map((o, i) => (
                  <View key={i} style={styles.objRow}>
                    <View style={[styles.objNum, { backgroundColor: colors.warning }]}>
                      <Text style={styles.objNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.objText}>{o}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Training Plan Blocks */}
            {planBlocks.length > 0 && (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <MaterialIcons name="schedule" size={14} color={color} />
                  <Text style={[styles.planSectionTitle, { color }]}>Training Plan</Text>
                </View>
                {planBlocks.map((b, i) => (
                  <View key={b.id} style={[styles.planBlockRow, i < planBlocks.length - 1 && styles.planBlockRowBorder]}>
                    <View style={[styles.planBlockTimeCol, { backgroundColor: color + '12' }]}>
                      <Text style={[styles.planBlockTime, { color }]}>{formatTime12(b.startTime)}</Text>
                      <Text style={styles.planBlockArrow}>↓</Text>
                      <Text style={[styles.planBlockTime, { color }]}>{formatTime12(b.endTime)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planBlockActivity}>{getActivitiesLabel(b)}</Text>
                      {b.notes ? <Text style={styles.planBlockNotes}>{b.notes}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Coach Notes */}
            {coachNotes ? (
              <View style={styles.planSection}>
                <View style={styles.planSectionHeader}>
                  <MaterialIcons name="notes" size={14} color={colors.textSecondary} />
                  <Text style={[styles.planSectionTitle, { color: colors.textSecondary }]}>Coach Notes</Text>
                </View>
                <Text style={styles.coachNoteText}>{coachNotes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {!expanded && !hasPlan && s.notes && (
          <Text style={styles.sessionNotes} numberOfLines={2}>{parseCoachNotes(s.notes)}</Text>
        )}

        {isCoach && !isPast && (
          <Pressable style={styles.markAttendanceBtn} onPress={() => router.push({ pathname: '/academy-attendance', params: { academyId } } as any)}>
            <MaterialIcons name="fact-check" size={14} color={colors.primary} />
            <Text style={styles.markAttendanceText}>Mark Attendance</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AcademyScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const academyId = params.academyId as string;
  const isCoach = params.isCoach === 'true';

  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state — auto-filled
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(todayStr());
  const [newTime, setNewTime] = useState(now12());
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState('Training');
  const [newNotes, setNewNotes] = useState('');
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [objectives, setObjectives] = useState<string[]>(['', '']);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await academyService.getAcademySessions(academyId);
    setSessions(data || []);
    setLoading(false);
  }, [academyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resetForm = () => {
    setNewTitle(''); setNewDate(todayStr()); setNewTime(now12());
    setNewLocation(''); setNewType('Training'); setNewNotes('');
    setPlanBlocks([]); setObjectives(['', '']);
  };

  const openModal = () => {
    resetForm();
    setNewDate(todayStr());
    setNewTime(now12()); // refresh to current time on open
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!newTitle.trim()) { showAlert('Error', 'Please enter a session title'); return; }
    setCreating(true);
    const combinedNotes = buildNotes(newNotes, objectives, planBlocks);
    const { error } = await academyService.createSession({
      academy_id: academyId, title: newTitle.trim(), session_date: newDate,
      session_time: newTime, location: newLocation.trim() || undefined,
      session_type: newType, notes: combinedNotes || undefined, created_by: user.id,
    });
    setCreating(false);
    if (error) { showAlert('Error', error); return; }
    setShowCreateModal(false);
    resetForm();
    await load();
    showAlert('Session Created', 'Players can now see this session and training plan.');
  };

  const today = todayStr();
  const upcoming = sessions.filter(s => s.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date));
  const past = sessions.filter(s => s.session_date < today).sort((a, b) => b.session_date.localeCompare(a.session_date));
  const sessionColor = TYPE_COLORS[newType] || colors.primary;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Schedule</Text>
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
        <Text style={styles.headerTitle}>Schedule</Text>
        {isCoach ? (
          <Pressable style={styles.addBtn} onPress={openModal}>
            <MaterialIcons name="add" size={22} color={colors.primary} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {upcoming.length === 0 && past.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-note" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>No sessions scheduled</Text>
            <Text style={styles.emptySubtitle}>
              {isCoach ? 'Create a session to get started' : 'Your coach will schedule sessions here'}
            </Text>
            {isCoach && (
              <Pressable style={styles.createBtn} onPress={openModal}>
                <MaterialIcons name="add-circle" size={20} color={colors.textLight} />
                <Text style={styles.createBtnText}>Create Session</Text>
              </Pressable>
            )}
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Upcoming ({upcoming.length}) · Tap to see plan</Text>
            {upcoming.map(s => <SessionCard key={s.id} s={s} isCoach={isCoach} academyId={academyId} today={today} router={router} />)}
          </>
        )}
        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Past Sessions</Text>
            {past.map(s => <SessionCard key={s.id} s={s} isCoach={isCoach} academyId={academyId} today={today} router={router} />)}
          </>
        )}
      </ScrollView>

      {/* ── Create Session Modal ─────────────────────────────────────────────── */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <View style={modal.header}>
              <Text style={modal.headerTitle}>Plan Session</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={modal.closeBtn}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView contentContainerStyle={modal.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                {/* ── Session Details ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="event" size={16} color={colors.primary} />
                    <Text style={modal.sectionTitle}>Session Details</Text>
                  </View>

                  <Text style={modal.label}>Session Title *</Text>
                  <TextInput style={modal.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Tuesday Nets" placeholderTextColor={colors.textSecondary} />

                  <View style={modal.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={modal.label}>Date</Text>
                      <TextInput style={modal.input} value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={modal.label}>Time (auto-filled)</Text>
                      <TextInput style={modal.input} value={newTime} onChangeText={setNewTime} placeholder={now12()} placeholderTextColor={colors.textSecondary} />
                    </View>
                  </View>

                  <Text style={modal.label}>Location (Optional)</Text>
                  <TextInput style={modal.input} value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Main Oval" placeholderTextColor={colors.textSecondary} />

                  <Text style={modal.label}>Session Type</Text>
                  <View style={modal.chipRow}>
                    {SESSION_TYPES.map(t => (
                      <Pressable key={t} style={[modal.chip, newType === t && { backgroundColor: TYPE_COLORS[t] || colors.primary, borderColor: TYPE_COLORS[t] || colors.primary }]} onPress={() => setNewType(t)}>
                        <Text style={[modal.chipText, newType === t && modal.chipTextActive]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* ── Session Objectives — ABOVE Training Plan ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="flag" size={16} color={colors.warning} />
                    <Text style={[modal.sectionTitle, { color: colors.warning }]}>Session Objectives</Text>
                  </View>
                  {objectives.map((obj, i) => (
                    <View key={i} style={modal.objRow}>
                      <View style={[modal.objNum, { backgroundColor: colors.warning }]}>
                        <Text style={modal.objNumText}>{i + 1}</Text>
                      </View>
                      <TextInput
                        style={[modal.input, { flex: 1 }]}
                        value={obj}
                        onChangeText={v => { const arr = [...objectives]; arr[i] = v; setObjectives(arr); }}
                        placeholder={`Objective ${i + 1}…`}
                        placeholderTextColor={colors.textSecondary}
                      />
                      {i === objectives.length - 1 && (
                        <Pressable onPress={() => setObjectives(o => [...o, ''])} hitSlop={6}>
                          <MaterialIcons name="add-circle" size={22} color={colors.warning} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>

                {/* ── Training Plan Blocks ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="schedule" size={16} color={sessionColor} />
                    <Text style={[modal.sectionTitle, { color: sessionColor }]}>Training Plan</Text>
                    <Text style={modal.sectionHint}>Visible to players · add drills in block notes</Text>
                  </View>
                  <PlanBlockEditor blocks={planBlocks} onChange={setPlanBlocks} sessionColor={sessionColor} />
                </View>

                {/* ── Coach Notes ── */}
                <View style={modal.sectionBlock}>
                  <View style={modal.sectionHeader}>
                    <MaterialIcons name="notes" size={16} color={colors.textSecondary} />
                    <Text style={modal.sectionTitle}>Coach Notes (Optional)</Text>
                  </View>
                  <TextInput
                    style={[modal.input, { minHeight: 64, textAlignVertical: 'top' }]}
                    value={newNotes}
                    onChangeText={setNewNotes}
                    multiline
                    placeholder="Anything else players should know…"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <Pressable style={[modal.submitBtn, { backgroundColor: sessionColor }, creating && { opacity: 0.6 }]} onPress={handleCreate}>
                  {creating ? <ActivityIndicator color={colors.textLight} /> : (
                    <>
                      <MaterialIcons name="event" size={18} color={colors.textLight} />
                      <Text style={modal.submitBtnText}>Create Session</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', flex: 0 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 40, gap: spacing.sm },
  sectionBlock: { backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  sectionHint: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginLeft: 4, flex: 1 },
  label: { fontSize: 12, color: colors.text, fontWeight: '600', marginBottom: 3 },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  objRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 5 },
  objNum: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  objNumText: { fontSize: 11, fontWeight: '900', color: colors.textLight },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.sm },
  submitBtnText: { fontSize: 16, color: colors.textLight, fontWeight: '700' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700', flex: 1 },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  sessionCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sessionCardToday: { borderColor: colors.primary + '80', borderWidth: 2 },
  sessionStripe: { width: 5 },
  sessionContent: { flex: 1, padding: spacing.md },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  sessionTitle: { fontSize: 15, color: colors.text, fontWeight: '700' },
  todayBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: borderRadius.sm },
  todayBadgeText: { fontSize: 9, color: colors.textLight, fontWeight: '800' },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  sessionNotes: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 16 },
  markAttendanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: colors.primary + '15', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
  markAttendanceText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  blockPreviewChip: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, alignItems: 'center' },
  blockPreviewTime: { fontSize: 9, fontWeight: '700' },
  blockPreviewActivity: { fontSize: 11, fontWeight: '800', marginTop: 1 },
  planContainer: { marginTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  planSection: { gap: spacing.xs },
  planSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  planSectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  planBlockRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center' },
  planBlockRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
  planBlockTimeCol: { borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, alignItems: 'center', minWidth: 70 },
  planBlockTime: { fontSize: 11, fontWeight: '800' },
  planBlockArrow: { fontSize: 10, color: colors.textSecondary },
  planBlockActivity: { fontSize: 14, fontWeight: '700', color: colors.text },
  planBlockNotes: { fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginTop: 2 },
  objRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  objNum: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2 },
  objNumText: { fontSize: 11, fontWeight: '900', color: colors.textLight },
  objText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  coachNoteText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { fontSize: 16, color: colors.text, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md },
  createBtnText: { fontSize: 14, color: colors.textLight, fontWeight: '700' },
});
