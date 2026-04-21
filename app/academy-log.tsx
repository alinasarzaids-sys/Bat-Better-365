import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useActiveSession } from '@/hooks/useActiveSession';

// ─── Session Type Config ──────────────────────────────────────────────────────
type SessionKind = 'Batting' | 'Bowling' | 'Fielding' | 'Fitness';

interface CounterDef {
  label: string;
  sub: string;
}

interface SessionConfig {
  kind: SessionKind;
  icon: string;
  color: string;
  counters: CounterDef[];   // 0, 2 or 3 counters depending on session type
}

const SESSION_CONFIGS: SessionConfig[] = [
  {
    kind: 'Batting',
    icon: 'sports-cricket',
    color: colors.technical,
    counters: [
      { label: 'Balls Faced', sub: 'Total deliveries received' },
      { label: 'Quality Contacts', sub: 'Middle of the bat' },
      { label: 'Times Beaten', sub: 'Beaten or dismissed' },
    ],
  },
  {
    kind: 'Bowling',
    icon: 'sports-cricket',
    color: colors.physical,
    counters: [
      { label: 'Balls Bowled', sub: 'Total deliveries sent down' },
      { label: 'Balls on Target', sub: 'Good length & line' },
      { label: 'Extras', sub: 'Wides & no-balls' },
    ],
  },
  {
    kind: 'Fielding',
    icon: 'sports-handball',
    color: colors.tactical,
    counters: [
      { label: 'Chances', sub: 'Total opportunities in the field' },
      { label: 'Clean Takes', sub: 'Catches / stops / throws completed' },
    ],
  },
  {
    kind: 'Fitness',
    icon: 'fitness-center',
    color: colors.success,
    counters: [],  // No counters — timer only
  },
];

// ─── Standard 3-Question Post-Session Reflection ──────────────────────────────
// Applies to every session type
const REFLECTION_QUESTIONS = [
  {
    id: 'rpe',
    label: 'Physical',
    text: 'Session Intensity (RPE)?',
    hint: 'Rate of Perceived Exertion  ·  1 = Very easy  ·  10 = Maximum effort',
    type: 'rpe' as const,   // 1–10 horizontal picker
  },
  {
    id: 'focus',
    label: 'Mental',
    text: 'Focus & Concentration?',
    hint: '1★ Completely distracted  ·  5★ Fully in the zone',
    type: 'stars' as const,
  },
  {
    id: 'objective_execution',
    label: 'Technical',
    text: 'Objective Execution?',
    hint: 'How well did you execute the objective you set before this session?',
    type: 'stars' as const,
  },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Progress Dots ────────────────────────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={pd.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[pd.seg, i < step ? pd.done : i === step ? pd.active : pd.idle]} />
      ))}
    </View>
  );
}
const pd = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  idle: { backgroundColor: colors.border },
  active: { backgroundColor: colors.primary },
  done: { backgroundColor: colors.primary + '60' },
});

// ─── Big Counter ──────────────────────────────────────────────────────────────
function BigCounter({ label, sub, value, color, onInc, onDec, onEdit }: {
  label: string; sub: string; value: number; color: string;
  onInc: () => void; onDec: () => void; onEdit: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(value));

  useEffect(() => {
    if (!editing) setInputVal(String(value));
  }, [value, editing]);

  return (
    <View style={bc.card}>
      <Text style={[bc.label, { color }]}>{label}</Text>
      <Text style={bc.sub}>{sub}</Text>

      <Pressable onPress={() => { setEditing(true); setInputVal(String(value)); }} style={bc.valueWrap}>
        {editing ? (
          <TextInput
            style={[bc.value, { color, borderBottomWidth: 2, borderBottomColor: color }]}
            value={inputVal}
            onChangeText={setInputVal}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            onBlur={() => {
              const n = parseInt(inputVal.replace(/[^0-9]/g, '')) || 0;
              onEdit(n);
              setEditing(false);
            }}
            onSubmitEditing={() => {
              const n = parseInt(inputVal.replace(/[^0-9]/g, '')) || 0;
              onEdit(n);
              setEditing(false);
            }}
          />
        ) : (
          <Text style={[bc.value, { color }]}>{value}</Text>
        )}
        {!editing && (
          <View style={bc.editHint}>
            <MaterialIcons name="edit" size={12} color={colors.textSecondary} />
          </View>
        )}
      </Pressable>

      <View style={bc.btnRow}>
        <Pressable style={[bc.btn, { backgroundColor: colors.error + '20' }]} onPress={onDec} hitSlop={6}>
          <MaterialIcons name="remove" size={28} color={colors.error} />
        </Pressable>
        <Pressable style={[bc.btn, { backgroundColor: color }]} onPress={onInc} hitSlop={6}>
          <MaterialIcons name="add" size={28} color={colors.textLight} />
        </Pressable>
      </View>
    </View>
  );
}
const bc = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, alignItems: 'center', gap: spacing.xs, borderWidth: 1.5, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' },
  sub: { fontSize: 9, color: colors.textSecondary, textAlign: 'center', lineHeight: 12 },
  valueWrap: { alignItems: 'center' },
  value: { fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 64, textAlign: 'center', minWidth: 70 },
  editHint: { position: 'absolute', right: -18, bottom: 8, backgroundColor: colors.background, borderRadius: 8, padding: 3 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
});

// ─── Star Row ─────────────────────────────────────────────────────────────────
function StarRow({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={4}>
          <MaterialIcons name={n <= value ? 'star' : 'star-border'} size={36} color={n <= value ? color : colors.border} />
        </Pressable>
      ))}
    </View>
  );
}

// ─── RPE Picker (1–10) ────────────────────────────────────────────────────────
function RPEPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const rpeColors: Record<number, string> = {
    1: '#4CAF50', 2: '#66BB6A', 3: '#8BC34A', 4: '#CDDC39',
    5: '#FFEB3B', 6: '#FFC107', 7: '#FF9800', 8: '#FF5722', 9: '#F44336', 10: '#B71C1C',
  };
  const rpeLabel: Record<number, string> = {
    1: 'Very easy', 2: 'Easy', 3: 'Light', 4: 'Moderate', 5: 'Somewhat hard',
    6: 'Hard', 7: 'Very hard', 8: 'Very very hard', 9: 'Max effort', 10: 'All out',
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
          const selected = n === value;
          const c = rpeColors[n];
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[rpe.btn, { borderColor: c, backgroundColor: selected ? c : c + '18' }]}
            >
              <Text style={[rpe.btnNum, { color: selected ? '#fff' : c }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      {value > 0 && (
        <View style={[rpe.labelChip, { backgroundColor: rpeColors[value] + '20' }]}>
          <View style={[rpe.labelDot, { backgroundColor: rpeColors[value] }]} />
          <Text style={[rpe.labelText, { color: rpeColors[value] }]}>{value}/10 — {rpeLabel[value]}</Text>
        </View>
      )}
    </View>
  );
}
const rpe = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  btnNum: { fontSize: 15, fontWeight: '900' },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  labelDot: { width: 8, height: 8, borderRadius: 4 },
  labelText: { fontSize: 12, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AcademyLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const {
    academySession,
    startAcademySession,
    minimizeAcademySession,
    maximizeAcademySession,
    updateAcademySessionStep,
    setAcademyIsPaused,
    endAcademySession,
  } = useActiveSession();

  const academyId = params.academyId as string;
  const isResuming = params.resume === '1';
  const isAcademyMember = params.isAcademyMember !== 'false';
  const availableConfigs = isAcademyMember
    ? SESSION_CONFIGS
    : SESSION_CONFIGS.filter(c => c.kind === 'Batting' || c.kind === 'Fitness');
  const logDate = new Date().toISOString().split('T')[0];

  // ── Steps: 0=Pick Type, 1=Objective, 2=Live, 3=Closing, 4=Summary
  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(0);

  const [config, setConfig] = useState<SessionConfig | null>(null);

  // ── Step 1: Single Objective
  const [objective, setObjective] = useState('');

  // ── Step 2: Live counters (up to 3)
  const [counters, setCounters] = useState<number[]>([0, 0, 0]);

  const paused = academySession.isActive ? academySession.isPaused : false;
  const elapsed = academySession.isActive ? academySession.elapsedSeconds : 0;

  // ── Step 3: Reflection
  const [objectiveDone, setObjectiveDone] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const updateAnswer = (id: string, val: number) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  // ── Restore when resuming ─────────────────────────────────────────────────
  useEffect(() => {
    if (isResuming && academySession.isActive && academySession.kind) {
      const cfg = SESSION_CONFIGS.find(c => c.kind === academySession.kind) || null;
      setConfig(cfg);
      setObjective(academySession.objective);
      setCounters(academySession.counters);
      setStep(academySession.step);
      setObjectiveDone(academySession.objectiveDone);
      setAnswers(academySession.answers);
      maximizeAcademySession();
    }
  }, [isResuming]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !config) return;
    setSaving(true);

    const noteParts: string[] = [];
    if (objective.trim()) {
      noteParts.push(`Objective: ${objective.trim()} — ${objectiveDone === true ? 'Achieved' : objectiveDone === false ? 'Not achieved' : 'Not reviewed'}`);
    }
    const rpe = answers['rpe'];
    const focus = answers['focus'];
    const objExec = answers['objective_execution'];
    if (rpe !== undefined) noteParts.push(`RPE (Intensity): ${rpe}/10`);
    if (focus !== undefined) noteParts.push(`Focus & Concentration: ${focus}/5`);
    if (objExec !== undefined) noteParts.push(`Objective Execution: ${objExec}/5`);

    const [c1, c2, c3] = counters;

    const { error } = await academyService.logTraining({
      user_id: user.id,
      academy_id: academyId,
      log_date: logDate,
      session_type: config.kind,
      duration_minutes: Math.max(1, Math.floor(elapsed / 60)),
      intensity: rpe || 5,
      // Batting: c1=balls faced, c2=quality contacts, c3=times beaten
      balls_faced: config.kind === 'Batting' ? (c1 || undefined) : undefined,
      runs_scored: config.kind === 'Batting' ? (c2 || undefined) : undefined,  // quality contacts stored in runs_scored
      // Bowling: c1=balls bowled, c2=balls on target, c3=extras
      balls_bowled: config.kind === 'Bowling' ? (c1 || undefined) : undefined,
      wickets: config.kind === 'Bowling' ? (c2 || undefined) : undefined,        // on-target stored in wickets
      runs_conceded: config.kind === 'Bowling' ? (c3 || undefined) : undefined,  // extras in runs_conceded
      // Fielding: c1=chances, c2=clean takes
      run_outs: config.kind === 'Fielding' ? (c1 || undefined) : undefined,
      catches: config.kind === 'Fielding' ? (c2 || undefined) : undefined,
      // Ratings
      technical_rating: objExec || undefined,
      effort_rating: rpe || undefined,
      fitness_rating: focus || undefined,
      notes: noteParts.join('\n') || undefined,
    });

    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    endAcademySession();
    setStep(4);
  };

  // ── Minimize ────────────────────────────────────────────────────────────────
  const handleMinimize = () => {
    minimizeAcademySession(step, counters, objectiveDone, answers);
    router.back();
  };

  // ─── Step 0 — Session Type Picker ──────────────────────────────────────────
  const renderTypePicker = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroTitle}>What are you training today?</Text>
        <Text style={styles.heroSub}>Select a session type to begin</Text>
      </View>
      {!isAcademyMember && (
        <View style={styles.unlockBanner}>
          <MaterialIcons name="shield" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.unlockTitle}>Academy Exclusive</Text>
            <Text style={styles.unlockSub}>
              Bowling and Fielding tracking are unlocked when you join an academy with a coach code.
            </Text>
          </View>
        </View>
      )}
      <View style={styles.typeGrid}>
        {availableConfigs.map(c => (
          <Pressable
            key={c.kind}
            style={({ pressed }) => [styles.typeCard, { borderColor: c.color }, pressed && { opacity: 0.8 }]}
            onPress={() => { setConfig(c); setCounters([0, 0, 0]); setStep(1); }}
          >
            <View style={[styles.typeIconCircle, { backgroundColor: c.color + '20' }]}>
              <MaterialIcons name={c.icon as any} size={36} color={c.color} />
            </View>
            <Text style={[styles.typeName, { color: c.color }]}>{c.kind}</Text>
            <Text style={styles.typeSub}>
              {c.counters.length === 0
                ? 'Timer-based session'
                : c.counters.map(ct => ct.label).join(' · ')}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  // ─── Step 1 — Single Objective ────────────────────────────────────────────
  const renderObjective = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroBlock, { alignItems: 'center' }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: (config?.color || colors.primary) + '20' }]}>
            <MaterialIcons name={config?.icon as any} size={36} color={config?.color || colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{config?.kind} Session</Text>
          <Text style={styles.heroSub}>Set one clear objective for this session</Text>
        </View>

        <View style={styles.objectiveCard}>
          <View style={styles.objHeader}>
            <MaterialIcons name="flag" size={20} color={config?.color || colors.primary} />
            <Text style={[styles.objHeaderText, { color: config?.color || colors.primary }]}>Session Objective</Text>
          </View>
          <Text style={styles.objHelp}>Elite training is about deep focus. What one thing will you work on today?</Text>

          <View style={styles.objInputBlock}>
            <View style={[styles.objNum, { backgroundColor: config?.color || colors.primary }]}>
              <MaterialIcons name="track-changes" size={14} color={colors.textLight} />
            </View>
            <TextInput
              style={styles.objInput}
              value={objective}
              onChangeText={setObjective}
              placeholder="e.g. Weight transfer on the front foot"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            You will be asked whether you achieved this objective at the end of the session. The cleaner the focus, the better the data.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── Step 2 — Live Session ─────────────────────────────────────────────────
  const renderLive = () => {
    const c = config!;
    const hasCounters = c.counters.length > 0;
    const c1 = counters[0], c2 = counters[1], c3 = counters[2];
    // Batting / Bowling accuracy = c2 / c1
    const accuracyRate = c1 > 0 && c.counters.length >= 2 ? Math.round((c2 / c1) * 100) : null;

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollPad, { gap: spacing.md }]} showsVerticalScrollIndicator={false}>
        {/* Timer */}
        <View style={[styles.timerCard, { borderTopColor: c.color }]}>
          <Text style={styles.timerLabel}>SESSION TIMER</Text>
          <Text style={[styles.timerValue, { color: paused ? colors.warning : c.color }]}>{formatTime(elapsed)}</Text>
          <Text style={styles.timerKind}>{c.kind}</Text>
          <View style={styles.timerBtnRow}>
            <Pressable
              style={[styles.timerBtn, { backgroundColor: paused ? c.color : colors.warning, flex: 1 }]}
              onPress={() => setAcademyIsPaused(!paused)}
            >
              <MaterialIcons name={paused ? 'play-arrow' : 'pause'} size={22} color={colors.textLight} />
              <Text style={styles.timerBtnText}>{paused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
            <Pressable style={styles.minimiseBtn} onPress={handleMinimize}>
              <MaterialIcons name="minimize" size={20} color={colors.primary} />
              <Text style={styles.minimiseBtnText}>Minimise</Text>
            </Pressable>
          </View>
          {paused && (
            <View style={styles.pauseBanner}>
              <MaterialIcons name="pause-circle-outline" size={14} color={colors.warning} />
              <Text style={styles.pauseText}>Timer paused</Text>
            </View>
          )}
        </View>

        {/* Objective reminder */}
        {objective.trim() ? (
          <View style={[styles.objReminderCard, { borderLeftColor: c.color }]}>
            <Text style={[styles.objReminderTitle, { color: c.color }]}>Today's Objective</Text>
            <Text style={styles.objReminderItem}>{objective}</Text>
          </View>
        ) : null}

        {/* Fitness: no counters — motivational card */}
        {!hasCounters && (
          <View style={[styles.fitnessCard, { borderColor: c.color + '40' }]}>
            <MaterialIcons name="fitness-center" size={36} color={c.color} />
            <Text style={[styles.fitnessTitle, { color: c.color }]}>Keep pushing!</Text>
            <Text style={styles.fitnessSub}>Your effort and duration are being recorded. Complete the debrief when you're done.</Text>
          </View>
        )}

        {/* 2-counter layout (Fielding) */}
        {hasCounters && c.counters.length === 2 && (
          <View style={styles.countersRow}>
            {c.counters.map((ct, i) => (
              <BigCounter
                key={i}
                label={ct.label}
                sub={ct.sub}
                value={counters[i]}
                color={c.color}
                onInc={() => setCounters(prev => { const n = [...prev]; n[i]++; return n; })}
                onDec={() => setCounters(prev => { const n = [...prev]; n[i] = Math.max(0, n[i] - 1); return n; })}
                onEdit={(v) => setCounters(prev => { const n = [...prev]; n[i] = v; return n; })}
              />
            ))}
          </View>
        )}

        {/* 3-counter layout (Batting / Bowling) */}
        {hasCounters && c.counters.length >= 3 && (
          <View style={{ gap: spacing.sm }}>
            {/* Top 2 counters side by side */}
            <View style={styles.countersRow}>
              {c.counters.slice(0, 2).map((ct, i) => (
                <BigCounter
                  key={i}
                  label={ct.label}
                  sub={ct.sub}
                  value={counters[i]}
                  color={i === 1 ? c.color : colors.textSecondary}
                  onInc={() => setCounters(prev => { const n = [...prev]; n[i]++; return n; })}
                  onDec={() => setCounters(prev => { const n = [...prev]; n[i] = Math.max(0, n[i] - 1); return n; })}
                  onEdit={(v) => setCounters(prev => { const n = [...prev]; n[i] = v; return n; })}
                />
              ))}
            </View>
            {/* 3rd counter — smaller, full width */}
            <Pressable
              style={[styles.counter3Row, { borderColor: colors.error + '40' }]}
              onPress={() => {}}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.counter3Label, { color: colors.error }]}>{c.counters[2].label}</Text>
                <Text style={styles.counter3Sub}>{c.counters[2].sub}</Text>
              </View>
              <View style={styles.counter3Controls}>
                <Pressable
                  style={[styles.counter3Btn, { backgroundColor: colors.border }]}
                  onPress={() => setCounters(prev => { const n = [...prev]; n[2] = Math.max(0, n[2] - 1); return n; })}
                  hitSlop={8}
                >
                  <MaterialIcons name="remove" size={18} color={colors.text} />
                </Pressable>
                <Text style={[styles.counter3Val, { color: colors.error }]}>{counters[2]}</Text>
                <Pressable
                  style={[styles.counter3Btn, { backgroundColor: colors.error }]}
                  onPress={() => setCounters(prev => { const n = [...prev]; n[2]++; return n; })}
                  hitSlop={8}
                >
                  <MaterialIcons name="add" size={18} color={colors.textLight} />
                </Pressable>
              </View>
            </Pressable>
          </View>
        )}

        {/* Live accuracy stat */}
        {accuracyRate !== null && (
          <View style={[styles.derivedCard, { borderColor: c.color + '40' }]}>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Accuracy Rate</Text>
              <Text style={[styles.derivedVal, { color: accuracyRate >= 60 ? colors.success : accuracyRate >= 40 ? colors.warning : colors.error }]}>
                {accuracyRate}%
              </Text>
            </View>
            <View style={styles.derivedBarBg}>
              <View style={[styles.derivedBarFill, { width: `${accuracyRate}%` as any, backgroundColor: accuracyRate >= 60 ? colors.success : accuracyRate >= 40 ? colors.warning : colors.error }]} />
            </View>
            <Text style={styles.derivedSub}>{c2} {c.counters[1].label.toLowerCase()} from {c1} {c.counters[0].label.toLowerCase()}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ─── Step 3 — Debrief ──────────────────────────────────────────────────────
  const renderDebrief = () => {
    const c = config!;
    const [c1, c2] = counters;
    const hasCounters = c.counters.length > 0;
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.heroBlock, { alignItems: 'center' }]}>
            <View style={[styles.heroIconCircle, { backgroundColor: c.color + '20' }]}>
              <MaterialIcons name="assignment-turned-in" size={36} color={c.color} />
            </View>
            <Text style={styles.heroTitle}>Session Debrief</Text>
            <Text style={styles.heroSub}>{formatTime(elapsed)} · {c.kind}</Text>
          </View>

          {/* Objective check */}
          {objective.trim() ? (
            <View style={styles.closingCard}>
              <Text style={styles.closingCardTitle}>Did you achieve your objective?</Text>
              <View style={[styles.objCheckContent, { marginBottom: spacing.sm }]}>
                <MaterialIcons name="track-changes" size={16} color={c.color} />
                <Text style={styles.objCheckText}>{objective}</Text>
              </View>
              <View style={styles.objCheckBtns}>
                <Pressable
                  style={[styles.checkBtn, { flex: 1 }, objectiveDone === true && { backgroundColor: colors.success, borderColor: colors.success }]}
                  onPress={() => setObjectiveDone(true)}
                >
                  <MaterialIcons name="check" size={20} color={objectiveDone === true ? colors.textLight : colors.success} />
                  <Text style={[styles.checkBtnText, { color: objectiveDone === true ? colors.textLight : colors.success }]}>Yes, achieved it</Text>
                </Pressable>
                <Pressable
                  style={[styles.checkBtn, { flex: 1 }, objectiveDone === false && { backgroundColor: colors.error, borderColor: colors.error }]}
                  onPress={() => setObjectiveDone(false)}
                >
                  <MaterialIcons name="close" size={20} color={objectiveDone === false ? colors.textLight : colors.error} />
                  <Text style={[styles.checkBtnText, { color: objectiveDone === false ? colors.textLight : colors.error }]}>Not this time</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* 3 Science-backed Reflection Questions */}
          <View style={styles.closingCard}>
            <Text style={styles.closingCardTitle}>Performance Reflection</Text>
            <Text style={styles.closingCardSub}>3 questions · Physical · Mental · Technical</Text>
            {REFLECTION_QUESTIONS.map((q, i) => (
              <View key={q.id} style={[styles.questionRow, i < REFLECTION_QUESTIONS.length - 1 && styles.questionRowBorder]}>
                <View style={styles.questionMeta}>
                  <View style={[styles.pillTag, {
                    backgroundColor: q.id === 'rpe' ? colors.error + '20' : q.id === 'focus' ? colors.primary + '20' : (config?.color || colors.success) + '20'
                  }]}>
                    <Text style={[styles.pillTagText, {
                      color: q.id === 'rpe' ? colors.error : q.id === 'focus' ? colors.primary : config?.color || colors.success
                    }]}>{q.label}</Text>
                  </View>
                  <Text style={styles.questionText}>{q.text}</Text>
                  <Text style={styles.questionHint}>{q.hint}</Text>
                </View>
                {q.type === 'rpe' ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <RPEPicker value={answers[q.id] || 0} onChange={v => updateAnswer(q.id, v)} />
                  </View>
                ) : (
                  <View style={{ marginTop: spacing.sm }}>
                    <StarRow
                      value={answers[q.id] || 0}
                      onChange={v => updateAnswer(q.id, v)}
                      color={q.id === 'focus' ? colors.primary : config?.color || colors.success}
                    />
                    {answers[q.id] > 0 && (
                      <Text style={[styles.starValueLabel, { color: q.id === 'focus' ? colors.primary : config?.color || colors.success }]}>
                        {answers[q.id]}/5 ★
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ─── Step 4 — Summary ──────────────────────────────────────────────────────
  const renderSummary = () => {
    const c = config!;
    const durationMins = Math.max(1, Math.floor(elapsed / 60));
    const [c1, c2] = counters;
    const hasCounters = c.counters.length > 0;
    const accuracyRate = c1 > 0 && c.counters.length >= 2 ? Math.round((c2 / c1) * 100) : null;

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryHero, { backgroundColor: c.color + '12' }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: c.color + '25' }]}>
            <MaterialIcons name="check-circle" size={44} color={c.color} />
          </View>
          <Text style={[styles.heroTitle, { color: c.color }]}>Saved!</Text>
          <Text style={styles.heroSub}>{logDate} · {c.kind}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStat}>
            <MaterialIcons name="timer" size={18} color={c.color} />
            <Text style={[styles.summaryStatVal, { color: c.color }]}>{durationMins}m</Text>
            <Text style={styles.summaryStatLabel}>Duration</Text>
          </View>
          {hasCounters && c.counters.map((ct, i) => (
            <View key={i} style={styles.summaryStat}>
              <MaterialIcons name={c.icon as any} size={18} color={i === 2 ? colors.error : c.color} />
              <Text style={[styles.summaryStatVal, { color: i === 2 ? colors.error : c.color }]}>{counters[i]}</Text>
              <Text style={styles.summaryStatLabel} numberOfLines={2}>{ct.label}</Text>
            </View>
          ))}
          {accuracyRate !== null && (
            <View style={styles.summaryStat}>
              <MaterialIcons name="percent" size={18} color={c.color} />
              <Text style={[styles.summaryStatVal, { color: c.color }]}>{accuracyRate}%</Text>
              <Text style={styles.summaryStatLabel}>Accuracy</Text>
            </View>
          )}
        </View>

        {/* Accuracy bar */}
        {accuracyRate !== null && (
          <View style={styles.vizCard}>
            <View style={styles.vizHeaderRow}>
              <Text style={styles.vizTitle}>Accuracy Breakdown</Text>
              <Text style={[styles.vizPct, { color: accuracyRate >= 60 ? colors.success : accuracyRate >= 40 ? colors.warning : colors.error }]}>{accuracyRate}%</Text>
            </View>
            <View style={styles.vizBarBg}>
              <View style={[styles.vizBarFill, { width: `${accuracyRate}%` as any, backgroundColor: c.color }]} />
            </View>
            <View style={styles.vizLegend}>
              <View style={styles.vizLegendItem}>
                <View style={[styles.vizDot, { backgroundColor: c.color }]} />
                <Text style={styles.vizLegendText}>{c.counters[1]?.label}: {c2}</Text>
              </View>
              <View style={styles.vizLegendItem}>
                <View style={[styles.vizDot, { backgroundColor: colors.border }]} />
                <Text style={styles.vizLegendText}>Total: {c1}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Objective result */}
        {objective.trim() ? (
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Objective</Text>
            <View style={styles.summaryObjRow}>
              <MaterialIcons
                name={objectiveDone === true ? 'check-circle' : objectiveDone === false ? 'cancel' : 'radio-button-unchecked'}
                size={18}
                color={objectiveDone === true ? colors.success : objectiveDone === false ? colors.error : colors.textSecondary}
              />
              <Text style={styles.summaryObjText}>{objective}</Text>
              <Text style={[styles.summaryObjStatus, { color: objectiveDone === true ? colors.success : objectiveDone === false ? colors.error : colors.textSecondary }]}>
                {objectiveDone === true ? 'Achieved' : objectiveDone === false ? 'Not achieved' : '—'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Reflection Summary */}
        {REFLECTION_QUESTIONS.some(q => answers[q.id] !== undefined) && (
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Performance Data</Text>
            {REFLECTION_QUESTIONS.map(q => {
              const a = answers[q.id];
              if (a === undefined) return null;
              const accentColor = q.id === 'rpe' ? colors.error : q.id === 'focus' ? colors.primary : config?.color || colors.success;
              return (
                <View key={q.id} style={styles.reflectRow}>
                  <View style={[styles.pillTag, { backgroundColor: accentColor + '20' }]}>
                    <Text style={[styles.pillTagText, { color: accentColor }]}>{q.label}</Text>
                  </View>
                  <Text style={styles.reflectQ} numberOfLines={1}>{q.text}</Text>
                  <Text style={[styles.reflectA, { color: accentColor }]}>
                    {q.type === 'rpe' ? `${a}/10` : `${a}/5 ★`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  // ─── Navigation ────────────────────────────────────────────────────────────
  const STEP_TITLES = ['Session Type', 'Objective', 'Live Session', 'Debrief', 'Summary'];

  const getNextLabel = () => {
    if (step === 1) return 'Start Session →';
    if (step === 2) return 'End Session';
    if (step === 3) return saving ? 'Saving...' : 'Save & View Summary';
    if (step === 4) return 'Done';
    return '';
  };

  const getNextColor = () => {
    if (step === 2) return colors.error;
    if (step === 4) return colors.success;
    return config?.color || colors.primary;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!objective.trim()) {
        showAlert('Objective required', 'Please set a focus objective before starting.');
        return;
      }
      startAcademySession(config!.kind, config!.color, objective, academyId);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      handleSave();
    } else if (step === 4) {
      router.back();
    }
  };

  const handleBack = () => {
    if (step === 0) { router.back(); return; }
    if (step === 2) { handleMinimize(); return; }
    if (step === 4) { router.back(); return; }
    setStep(s => s - 1);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={8}>
          <MaterialIcons
            name={step === 0 || step === 4 ? 'close' : step === 2 ? 'minimize' : 'arrow-back'}
            size={24}
            color={colors.text}
          />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{STEP_TITLES[step]}</Text>
          {config && step > 0 && <Text style={styles.headerSub}>{config.kind}</Text>}
        </View>
        {step === 2 ? (
          <View style={styles.liveChip}>
            <View style={[styles.liveDot, { backgroundColor: paused ? colors.warning : colors.error }]} />
            <Text style={[styles.liveLabel, { color: paused ? colors.warning : colors.error }]}>
              {paused ? 'PAUSED' : 'LIVE'}
            </Text>
          </View>
        ) : <View style={{ width: 64 }} />}
      </View>

      <ProgressDots step={step} total={TOTAL_STEPS} />

      {step === 0 && renderTypePicker()}
      {step === 1 && renderObjective()}
      {step === 2 && renderLive()}
      {step === 3 && renderDebrief()}
      {step === 4 && renderSummary()}

      {step > 0 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.md) }]}>
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: getNextColor() }, saving && styles.ctaDisabled]}
            onPress={handleNext}
          >
            {saving ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <>
                <MaterialIcons
                  name={step === 2 ? 'stop' : step === 4 ? 'home' : step === 3 ? 'save' : 'arrow-forward'}
                  size={22}
                  color={colors.textLight}
                />
                <Text style={styles.ctaText}>{getNextLabel()}</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 64, justifyContent: 'flex-end' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 11, fontWeight: '800' },

  scroll: { flex: 1 },
  scrollPad: { padding: spacing.md, paddingBottom: 110 },

  heroBlock: { marginBottom: spacing.lg, gap: spacing.xs },
  heroIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs, alignSelf: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  unlockBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '30', marginBottom: spacing.md,
  },
  unlockTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  unlockSub: { fontSize: 11, color: colors.textSecondary, lineHeight: 15, marginTop: 2 },

  typeGrid: { gap: spacing.md },
  typeCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg,
    alignItems: 'center', borderWidth: 2, gap: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  typeIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  typeName: { fontSize: 20, fontWeight: '900' },
  typeSub: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 15 },

  objectiveCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, gap: spacing.md },
  objHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  objHeaderText: { fontSize: 16, fontWeight: '800' },
  objHelp: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  objInputBlock: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  objNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  objInput: {
    flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border, padding: spacing.sm,
    fontSize: 14, color: colors.text, lineHeight: 20, minHeight: 70,
  },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primary + '10', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '30' },
  infoText: { flex: 1, fontSize: 13, color: colors.primary, lineHeight: 18 },

  timerCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderTopWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  timerLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  timerValue: { fontSize: 72, fontWeight: '900', letterSpacing: -2, lineHeight: 80 },
  timerKind: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  timerBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, width: '100%' },
  timerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  timerBtnText: { fontSize: 15, color: colors.textLight, fontWeight: '700' },
  minimiseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primary + '12',
  },
  minimiseBtnText: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  pauseBanner: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm, backgroundColor: colors.warning + '15', borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pauseText: { fontSize: 12, color: colors.warning, fontWeight: '600' },

  objReminderCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderLeftWidth: 4, borderWidth: 1, borderColor: colors.border, gap: 4 },
  objReminderTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  objReminderItem: { fontSize: 13, color: colors.text, lineHeight: 18 },

  fitnessCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, alignItems: 'center', borderWidth: 1.5, gap: spacing.md },
  fitnessTitle: { fontSize: 22, fontWeight: '900' },
  fitnessSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  countersRow: { flexDirection: 'row', gap: spacing.sm },

  counter3Row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1.5, gap: spacing.md,
  },
  counter3Label: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  counter3Sub: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  counter3Controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  counter3Btn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  counter3Val: { fontSize: 28, fontWeight: '900', minWidth: 36, textAlign: 'center' },

  derivedCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1.5, gap: spacing.sm },
  derivedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  derivedLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  derivedVal: { fontSize: 22, fontWeight: '900' },
  derivedBarBg: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' },
  derivedBarFill: { height: '100%', borderRadius: 5, minWidth: 8 },
  derivedSub: { fontSize: 11, color: colors.textSecondary },

  closingCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, gap: spacing.md },
  closingCardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  closingCardSub: { fontSize: 11, color: colors.textSecondary, marginTop: -spacing.sm },

  objCheckContent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  objCheckText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  objCheckBtns: { flexDirection: 'row', gap: spacing.sm },
  checkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  checkBtnText: { fontSize: 13, fontWeight: '800' },

  questionRow: { paddingBottom: spacing.md, gap: spacing.xs },
  questionRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border + '60', marginBottom: spacing.sm },
  questionMeta: { gap: 4 },
  questionText: { fontSize: 14, color: colors.text, fontWeight: '700', lineHeight: 20 },
  questionHint: { fontSize: 11, color: colors.textSecondary, lineHeight: 15 },
  pillTag: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 2 },
  pillTagText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  starValueLabel: { fontSize: 13, fontWeight: '800', marginTop: 6 },

  summaryHero: { borderRadius: borderRadius.xl, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, gap: spacing.xs },
  summaryStatsRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-around', flexWrap: 'wrap', gap: spacing.sm },
  summaryStat: { alignItems: 'center', gap: 4, minWidth: 55 },
  summaryStatVal: { fontSize: 18, fontWeight: '900' },
  summaryStatLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },

  vizCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  vizHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vizTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  vizPct: { fontSize: 20, fontWeight: '900' },
  vizBarBg: { height: 14, backgroundColor: colors.border, borderRadius: 7, overflow: 'hidden' },
  vizBarFill: { height: '100%', borderRadius: 7, minWidth: 8 },
  vizLegend: { flexDirection: 'row', gap: spacing.md },
  vizLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vizDot: { width: 10, height: 10, borderRadius: 5 },
  vizLegendText: { fontSize: 12, color: colors.textSecondary },

  summarySection: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  summarySectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  summaryObjRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  summaryObjText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  summaryObjStatus: { fontSize: 12, fontWeight: '800' },

  reflectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
  reflectQ: { flex: 1, fontSize: 12, color: colors.textSecondary },
  reflectA: { fontSize: 13, fontWeight: '900' },

  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: borderRadius.md },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.textLight },
});
