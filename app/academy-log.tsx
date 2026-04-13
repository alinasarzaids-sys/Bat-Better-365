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

interface SessionConfig {
  kind: SessionKind;
  icon: string;
  color: string;
  counter1Label: string;
  counter1Sub: string;
  counter2Label: string;
  counter2Sub: string;
  closingQuestions: ClosingQuestion[];
}

interface ClosingQuestion {
  id: string;
  text: string;
  type: 'stars' | 'number';
  suffix?: string;
  hint?: string;  // e.g. scale description shown below the question
}

const SESSION_CONFIGS: SessionConfig[] = [
  {
    kind: 'Batting',
    icon: 'sports-cricket',
    color: colors.technical,
    counter1Label: 'Balls Faced',
    counter1Sub: 'Total deliveries received',
    counter2Label: 'Successful Shots',
    counter2Sub: 'Clean, well-timed contact',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars', hint: '1★ Body really sore  ·  5★ Feeling great' },
      { id: 'technique', text: 'How clean and correct was your technique?', type: 'stars' },
      { id: 'focus', text: 'How focused were you throughout?', type: 'stars' },
      { id: 'confidence', text: 'How confident did you feel?', type: 'stars' },
    ],
  },
  {
    kind: 'Bowling',
    icon: 'sports-cricket',
    color: colors.physical,
    counter1Label: 'Balls Bowled',
    counter1Sub: 'Total deliveries sent down',
    counter2Label: 'Good Balls',
    counter2Sub: 'On target / wicket-taking deliveries',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars', hint: '1★ Body really sore  ·  5★ Feeling great' },
      { id: 'rhythm', text: 'How was your run-up rhythm and action?', type: 'stars' },
      { id: 'confidence', text: 'How confident did you feel while bowling?', type: 'stars' },
      { id: 'focus', text: 'How focused were you throughout the session?', type: 'stars' },
    ],
  },
  {
    kind: 'Fielding',
    icon: 'sports-handball',
    color: colors.tactical,
    counter1Label: 'Chances',
    counter1Sub: 'Total opportunities in the field',
    counter2Label: 'Clean Takes',
    counter2Sub: 'Catches / stops / throws completed',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars', hint: '1★ Body really sore  ·  5★ Feeling great' },
      { id: 'confidence', text: 'How confident were you in the field?', type: 'stars' },
      { id: 'focus', text: 'How focused were you throughout?', type: 'stars' },
    ],
  },
  {
    kind: 'Fitness',
    icon: 'fitness-center',
    color: colors.success,
    counter1Label: 'Sets Done',
    counter1Sub: 'Total sets completed',
    counter2Label: 'Reps Done',
    counter2Sub: 'Total repetitions completed',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars', hint: '1★ Body really sore  ·  5★ Feeling great' },
      { id: 'energy', text: 'How was your energy throughout?', type: 'stars' },
      { id: 'effort', text: 'Rate your effort and intensity today', type: 'stars' },
      { id: 'recovery', text: 'How was your recovery between sets?', type: 'stars' },
      { id: 'exercises', text: 'How many different exercises did you complete?', type: 'number', suffix: 'exercises' },
    ],
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
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, alignItems: 'center', gap: spacing.xs, borderWidth: 1.5, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  label: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' },
  sub: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  valueWrap: { alignItems: 'center' },
  value: { fontSize: 68, fontWeight: '900', letterSpacing: -2, lineHeight: 76, textAlign: 'center', minWidth: 80 },
  editHint: { position: 'absolute', right: -18, bottom: 10, backgroundColor: colors.background, borderRadius: 8, padding: 3 },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  btn: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
});

// ─── Star Row ─────────────────────────────────────────────────────────────────
function StarRow({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={4}>
          <MaterialIcons name={n <= value ? 'star' : 'star-border'} size={34} color={n <= value ? color : colors.border} />
        </Pressable>
      ))}
    </View>
  );
}

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
  const logDate = new Date().toISOString().split('T')[0];

  // ── Steps: 0=Pick Type, 1=Objectives, 2=Live, 3=Closing, 4=Summary
  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(0);

  // ── Step 0: Type
  const [config, setConfig] = useState<SessionConfig | null>(null);

  // ── Step 1: Objectives
  const [objective1, setObjective1] = useState('');
  const [objective2, setObjective2] = useState('');

  // ── Step 2: Live (synced from context when minimized)
  const [counter1, setCounter1] = useState(0);
  const [counter2, setCounter2] = useState(0);

  // Paused state from context (so it persists when minimized)
  const paused = academySession.isActive ? academySession.isPaused : false;

  // Use the elapsed time from context (keeps ticking even when minimized)
  const elapsed = academySession.isActive ? academySession.elapsedSeconds : 0;

  // ── Restore from context if resuming ──────────────────────────────────────
  useEffect(() => {
    if (isResuming && academySession.isActive && academySession.kind) {
      const cfg = SESSION_CONFIGS.find(c => c.kind === academySession.kind) || null;
      setConfig(cfg);
      setObjective1(academySession.objective1);
      setObjective2(academySession.objective2);
      setCounter1(academySession.counter1);
      setCounter2(academySession.counter2);
      setStep(academySession.step);
      setObj1Done(academySession.obj1Done);
      setObj2Done(academySession.obj2Done);
      setAnswers(academySession.answers);
      maximizeAcademySession();
    }
  }, [isResuming]);

  // ── Step 3: Closing
  const [obj1Done, setObj1Done] = useState<boolean | null>(null);
  const [obj2Done, setObj2Done] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const updateAnswer = (id: string, val: number) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  // ── Save ────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !config) return;
    setSaving(true);

    const noteParts: string[] = [];
    if (objective1.trim()) noteParts.push(`Objective 1: ${objective1.trim()} — ${obj1Done === true ? 'Completed' : obj1Done === false ? 'Not completed' : 'Not answered'}`);
    if (objective2.trim()) noteParts.push(`Objective 2: ${objective2.trim()} — ${obj2Done === true ? 'Completed' : obj2Done === false ? 'Not completed' : 'Not answered'}`);
    config.closingQuestions.forEach(q => {
      const a = answers[q.id];
      if (a !== undefined) {
        noteParts.push(`${q.text}: ${q.type === 'stars' ? `${a}/5` : `${a}${q.suffix ? ' ' + q.suffix : ''}`}`);
      }
    });

    const { error } = await academyService.logTraining({
      user_id: user.id,
      academy_id: academyId,
      log_date: logDate,
      session_type: config.kind,
      duration_minutes: Math.max(1, Math.floor(elapsed / 60)),
      intensity: answers['effort'] || answers['energy'] || answers['focus'] || answers['consistency'] || 5,
      balls_faced: config.kind === 'Batting' ? counter1 || undefined : undefined,
      runs_scored: config.kind === 'Batting' ? counter2 || undefined : undefined,
      balls_bowled: config.kind === 'Bowling' ? counter1 || undefined : undefined,
      wickets: config.kind === 'Bowling' ? counter2 || undefined : undefined,
      catches: config.kind === 'Fielding' ? counter2 || undefined : undefined,
      run_outs: config.kind === 'Fielding' ? counter1 || undefined : undefined,
      fitness_exercises: config.kind === 'Fitness' ? (answers['exercises'] || undefined) : undefined,
      fitness_sets: config.kind === 'Fitness' ? counter1 || undefined : undefined,
      fitness_reps: config.kind === 'Fitness' ? counter2 || undefined : undefined,
      notes: noteParts.join('\n') || undefined,
    });

    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    endAcademySession();
    setStep(4);
  };

  // ── Minimize ────────────────────────────────────────────────────────────────
  const handleMinimize = () => {
    minimizeAcademySession(step, counter1, counter2, obj1Done, obj2Done, answers);
    router.back();
  };

  // ─── Step 0 — Session Type Picker ──────────────────────────────────────────
  const renderTypePicker = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroTitle}>What are you training today?</Text>
        <Text style={styles.heroSub}>Select a session type to begin</Text>
      </View>
      <View style={styles.typeGrid}>
        {SESSION_CONFIGS.map(c => (
          <Pressable
            key={c.kind}
            style={({ pressed }) => [styles.typeCard, { borderColor: c.color }, pressed && { opacity: 0.8 }]}
            onPress={() => { setConfig(c); setStep(1); }}
          >
            <View style={[styles.typeIconCircle, { backgroundColor: c.color + '20' }]}>
              <MaterialIcons name={c.icon as any} size={36} color={c.color} />
            </View>
            <Text style={[styles.typeName, { color: c.color }]}>{c.kind}</Text>
            <Text style={styles.typeSub}>{c.counter1Label} + {c.counter2Label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  // ─── Step 1 — Objectives ───────────────────────────────────────────────────
  const renderObjectives = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroBlock, { alignItems: 'center' }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: (config?.color || colors.primary) + '20' }]}>
            <MaterialIcons name={config?.icon as any} size={36} color={config?.color || colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{config?.kind} Session</Text>
          <Text style={styles.heroSub}>Set 2 clear objectives before you start</Text>
        </View>

        <View style={styles.objectivesCard}>
          <View style={styles.objHeader}>
            <MaterialIcons name="flag" size={20} color={config?.color || colors.primary} />
            <Text style={[styles.objHeaderText, { color: config?.color || colors.primary }]}>Session Objectives</Text>
          </View>
          <Text style={styles.objHelp}>What are you specifically trying to achieve today?</Text>

          {[{ val: objective1, set: setObjective1, ph: 'e.g. Improve my back-foot play against short balls' },
            { val: objective2, set: setObjective2, ph: 'e.g. Land 80% of deliveries in the good-length zone' }].map((o, i) => (
            <View key={i} style={styles.objInputBlock}>
              <View style={[styles.objNum, { backgroundColor: config?.color || colors.primary }]}>
                <Text style={styles.objNumText}>{i + 1}</Text>
              </View>
              <TextInput
                style={styles.objInput}
                value={o.val}
                onChangeText={o.set}
                placeholder={o.ph}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            You will see these objectives again at the end of the session and be asked if you completed them.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── Step 2 — Live Session ─────────────────────────────────────────────────
  const renderLive = () => {
    const c = config!;
    const successRate = counter1 > 0 ? Math.round((counter2 / counter1) * 100) : 0;

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollPad, { gap: spacing.md }]} showsVerticalScrollIndicator={false}>
        {/* Timer Card */}
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
            <Pressable
              style={styles.minimiseBtn}
              onPress={handleMinimize}
            >
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

        {/* Objectives reminder */}
        {(objective1.trim() || objective2.trim()) && (
          <View style={[styles.objReminderCard, { borderLeftColor: c.color }]}>
            <Text style={[styles.objReminderTitle, { color: c.color }]}>Today's Objectives</Text>
            {objective1.trim() ? <Text style={styles.objReminderItem}>① {objective1}</Text> : null}
            {objective2.trim() ? <Text style={styles.objReminderItem}>② {objective2}</Text> : null}
          </View>
        )}

        {/* Counters — editable by tapping the number */}
        <View style={styles.countersRow}>
          <BigCounter
            label={c.counter1Label}
            sub={c.counter1Sub}
            value={counter1}
            color={c.color}
            onInc={() => setCounter1(v => v + 1)}
            onDec={() => setCounter1(v => Math.max(0, v - 1))}
            onEdit={(n) => setCounter1(n)}
          />
          <BigCounter
            label={c.counter2Label}
            sub={c.counter2Sub}
            value={counter2}
            color={c.color}
            onInc={() => setCounter2(v => v + 1)}
            onDec={() => setCounter2(v => Math.max(0, v - 1))}
            onEdit={(n) => setCounter2(n)}
          />
        </View>

        {/* Live derived stat */}
        {counter1 > 0 && (
          <View style={[styles.derivedCard, { borderColor: c.color + '40' }]}>
            <View style={styles.derivedRow}>
              <Text style={styles.derivedLabel}>Success Rate</Text>
              <Text style={[styles.derivedVal, { color: successRate >= 60 ? colors.success : successRate >= 40 ? colors.warning : colors.error }]}>
                {successRate}%
              </Text>
            </View>
            <View style={styles.derivedBarBg}>
              <View style={[styles.derivedBarFill, { width: `${successRate}%` as any, backgroundColor: successRate >= 60 ? colors.success : successRate >= 40 ? colors.warning : colors.error }]} />
            </View>
            <Text style={styles.derivedSub}>{counter2} {c.counter2Label.toLowerCase()} from {counter1} {c.counter1Label.toLowerCase()}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ─── Step 3 — Closing Questions ────────────────────────────────────────────
  const renderClosing = () => {
    const c = config!;
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

          {/* Objectives check */}
          <View style={styles.closingCard}>
            <Text style={styles.closingCardTitle}>Did you complete your objectives?</Text>
            {[{ text: objective1, done: obj1Done, set: setObj1Done, num: '①' },
              { text: objective2, done: obj2Done, set: setObj2Done, num: '②' }].map((o, i) =>
              o.text.trim() ? (
                <View key={i} style={styles.objCheckRow}>
                  <View style={styles.objCheckContent}>
                    <Text style={styles.objCheckNum}>{o.num}</Text>
                    <Text style={styles.objCheckText}>{o.text}</Text>
                  </View>
                  <View style={styles.objCheckBtns}>
                    <Pressable
                      style={[styles.checkBtn, o.done === true && { backgroundColor: colors.success, borderColor: colors.success }]}
                      onPress={() => o.set(true)}
                    >
                      <MaterialIcons name="check" size={18} color={o.done === true ? colors.textLight : colors.success} />
                      <Text style={[styles.checkBtnText, { color: o.done === true ? colors.textLight : colors.success }]}>Yes</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.checkBtn, o.done === false && { backgroundColor: colors.error, borderColor: colors.error }]}
                      onPress={() => o.set(false)}
                    >
                      <MaterialIcons name="close" size={18} color={o.done === false ? colors.textLight : colors.error} />
                      <Text style={[styles.checkBtnText, { color: o.done === false ? colors.textLight : colors.error }]}>No</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null
            )}
          </View>

          {/* Reflection questions */}
          <View style={styles.closingCard}>
            <Text style={styles.closingCardTitle}>Reflection Questions</Text>
            {c.closingQuestions.map((q, i) => (
              <View key={q.id} style={[styles.questionRow, i < c.closingQuestions.length - 1 && styles.questionRowBorder]}>
                <Text style={styles.questionText}>{q.text}</Text>
                {q.hint ? (
                  <Text style={styles.questionHint}>{q.hint}</Text>
                ) : null}
                {q.type === 'stars' ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <StarRow
                      value={answers[q.id] || 0}
                      onChange={v => updateAnswer(q.id, v)}
                      color={q.id === 'body' ? colors.success : c.color}
                    />
                    {answers[q.id] > 0 && (
                      <Text style={[styles.starValueLabel, { color: q.id === 'body' ? colors.success : c.color }]}>
                        {answers[q.id]}/5
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.numberInputRow}>
                    <TextInput
                      style={[styles.numberInput, { borderColor: c.color }]}
                      value={answers[q.id] !== undefined ? String(answers[q.id]) : ''}
                      onChangeText={v => updateAnswer(q.id, parseInt(v.replace(/[^0-9]/g, '')) || 0)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      textAlign="center"
                    />
                    {q.suffix ? <Text style={styles.numberSuffix}>{q.suffix}</Text> : null}
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
    const successRate = counter1 > 0 ? Math.round((counter2 / counter1) * 100) : 0;

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryHero, { backgroundColor: c.color + '12' }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: c.color + '25' }]}>
            <MaterialIcons name="check-circle" size={44} color={c.color} />
          </View>
          <Text style={[styles.heroTitle, { color: c.color }]}>Saved!</Text>
          <Text style={styles.heroSub}>{logDate} · {c.kind}</Text>
        </View>

        <View style={styles.summaryStatsRow}>
          {[
            { icon: 'timer', val: `${durationMins}m`, label: 'Duration' },
            { icon: c.icon, val: String(counter1), label: c.counter1Label },
            { icon: 'check', val: String(counter2), label: c.counter2Label },
            ...(counter1 > 0 ? [{ icon: 'percent', val: `${successRate}%`, label: 'Success' }] : []),
          ].map((s, i) => (
            <View key={i} style={styles.summaryStat}>
              <MaterialIcons name={s.icon as any} size={18} color={c.color} />
              <Text style={[styles.summaryStatVal, { color: c.color }]}>{s.val}</Text>
              <Text style={styles.summaryStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {counter1 > 0 && (
          <View style={styles.vizCard}>
            <View style={styles.vizHeaderRow}>
              <Text style={styles.vizTitle}>Performance Breakdown</Text>
              <Text style={[styles.vizPct, { color: successRate >= 60 ? colors.success : successRate >= 40 ? colors.warning : colors.error }]}>{successRate}%</Text>
            </View>
            <View style={styles.vizBarBg}>
              <View style={[styles.vizBarFill, { width: `${successRate}%` as any, backgroundColor: c.color }]} />
            </View>
            <View style={styles.vizLegend}>
              <View style={styles.vizLegendItem}>
                <View style={[styles.vizDot, { backgroundColor: c.color }]} />
                <Text style={styles.vizLegendText}>{c.counter2Label}: {counter2}</Text>
              </View>
              <View style={styles.vizLegendItem}>
                <View style={[styles.vizDot, { backgroundColor: colors.border }]} />
                <Text style={styles.vizLegendText}>Total: {counter1}</Text>
              </View>
            </View>
          </View>
        )}

        {(objective1.trim() || objective2.trim()) && (
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Objectives Review</Text>
            {[{ text: objective1, done: obj1Done }, { text: objective2, done: obj2Done }].map((o, i) =>
              o.text.trim() ? (
                <View key={i} style={styles.summaryObjRow}>
                  <MaterialIcons name={o.done ? 'check-circle' : 'cancel'} size={18} color={o.done ? colors.success : colors.error} />
                  <Text style={styles.summaryObjText}>{o.text}</Text>
                  <Text style={[styles.summaryObjStatus, { color: o.done ? colors.success : o.done === false ? colors.error : colors.textSecondary }]}>
                    {o.done === true ? 'Done' : o.done === false ? 'Not done' : '—'}
                  </Text>
                </View>
              ) : null
            )}
          </View>
        )}

        {c.closingQuestions.some(q => answers[q.id] !== undefined) && (
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Reflection Summary</Text>
            {c.closingQuestions.map(q => {
              const a = answers[q.id];
              if (a === undefined) return null;
              return (
                <View key={q.id} style={styles.reflectRow}>
                  <Text style={styles.reflectQ} numberOfLines={2}>{q.text}</Text>
                  <Text style={[styles.reflectA, { color: c.color }]}>
                    {q.type === 'stars' ? `${a}/5 ★` : `${a}${q.suffix ? ' ' + q.suffix : ''}`}
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
  const STEP_TITLES = ['Session Type', 'Objectives', 'Live Session', 'Debrief', 'Summary'];

  const getNextLabel = () => {
    if (step === 1) return 'Start Session →';
    if (step === 2) return 'End Session';
    if (step === 3) return saving ? 'Saving...' : 'Save & Summary';
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
      if (!objective1.trim() && !objective2.trim()) {
        showAlert('Objectives', 'Please write at least one objective.');
        return;
      }
      // Start academy session in context (timer begins)
      startAcademySession(config!.kind, config!.color, objective1, objective2, academyId);
      setStep(2);
    } else if (step === 2) {
      // Sync counters to context before ending
      minimizeAcademySession(3, counter1, counter2, obj1Done, obj2Done, answers);
      // Then move to step 3 (not actually minimizing, just syncing state)
      maximizeAcademySession();
      setStep(3);
    } else if (step === 3) {
      handleSave();
    } else if (step === 4) {
      router.back();
    }
  };

  const handleBack = () => {
    if (step === 0) { router.back(); return; }
    if (step === 2) {
      // Back during live session = minimize
      handleMinimize();
      return;
    }
    if (step === 4) { router.back(); return; }
    setStep(s => s - 1);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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
      {step === 1 && renderObjectives()}
      {step === 2 && renderLive()}
      {step === 3 && renderClosing()}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  scrollPad: { padding: spacing.md, paddingBottom: 100 },

  heroBlock: { marginBottom: spacing.lg, gap: spacing.xs },
  heroIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs, alignSelf: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  typeGrid: { gap: spacing.md },
  typeCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg,
    alignItems: 'center', borderWidth: 2, gap: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  typeIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  typeName: { fontSize: 20, fontWeight: '900' },
  typeSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  objectivesCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, gap: spacing.md },
  objHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  objHeaderText: { fontSize: 16, fontWeight: '800' },
  objHelp: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  objInputBlock: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  objNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  objNumText: { fontSize: 13, fontWeight: '900', color: colors.textLight },
  objInput: {
    flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border, padding: spacing.sm,
    fontSize: 14, color: colors.text, lineHeight: 20, minHeight: 60,
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

  countersRow: { flexDirection: 'row', gap: spacing.md },

  derivedCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1.5, gap: spacing.sm },
  derivedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  derivedLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  derivedVal: { fontSize: 22, fontWeight: '900' },
  derivedBarBg: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' },
  derivedBarFill: { height: '100%', borderRadius: 5, minWidth: 8 },
  derivedSub: { fontSize: 11, color: colors.textSecondary },

  closingCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, gap: spacing.md },
  closingCardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  objCheckRow: { gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  objCheckContent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  objCheckNum: { fontSize: 16, fontWeight: '800', color: colors.textSecondary },
  objCheckText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  objCheckBtns: { flexDirection: 'row', gap: spacing.sm },
  checkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  checkBtnText: { fontSize: 13, fontWeight: '800' },

  questionRow: { paddingBottom: spacing.md, gap: spacing.sm },
  questionRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border + '60', marginBottom: spacing.sm },
  questionText: { fontSize: 14, color: colors.text, fontWeight: '600', lineHeight: 20 },
  questionHint: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2, lineHeight: 15 },
  starValueLabel: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  numberInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  numberInput: { width: 80, borderWidth: 2, borderRadius: borderRadius.md, paddingVertical: spacing.sm, fontSize: 22, fontWeight: '800', color: colors.text, backgroundColor: colors.background, textAlign: 'center' },
  numberSuffix: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  summaryHero: { borderRadius: borderRadius.xl, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, gap: spacing.xs },
  summaryStatsRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-around', flexWrap: 'wrap', gap: spacing.sm },
  summaryStat: { alignItems: 'center', gap: 4, minWidth: 60 },
  summaryStatVal: { fontSize: 20, fontWeight: '900' },
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

  reflectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
  reflectQ: { flex: 1, fontSize: 12, color: colors.textSecondary, paddingRight: spacing.sm },
  reflectA: { fontSize: 13, fontWeight: '800' },

  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: borderRadius.md },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 17, fontWeight: '800', color: colors.textLight },
});
