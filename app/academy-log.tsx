import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { academyService } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// ─── Session Type Config ──────────────────────────────────────────────────────
type SessionKind = 'Batting' | 'Bowling' | 'Fielding' | 'Keeping' | 'Fitness';

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
  suffix?: string;   // e.g. "runs", "reps"
}

const SESSION_CONFIGS: SessionConfig[] = [
  {
    kind: 'Batting',
    icon: 'sports-cricket',
    color: colors.technical,
    counter1Label: 'Balls Faced',
    counter1Sub: 'Total deliveries received',
    counter2Label: 'Balls Middled',
    counter2Sub: 'Clean, well-timed shots',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars' },
      { id: 'technique', text: 'How clean and correct was your technique?', type: 'stars' },
      { id: 'focus', text: 'How focused were you throughout?', type: 'stars' },
      { id: 'confidence', text: 'How confident did you feel at the crease?', type: 'stars' },
      { id: 'runs', text: 'How many runs did you score?', type: 'number', suffix: 'runs' },
    ],
  },
  {
    kind: 'Bowling',
    icon: 'sports-cricket',
    color: colors.physical,
    counter1Label: 'Balls Bowled',
    counter1Sub: 'Total deliveries sent down',
    counter2Label: 'Good Balls',
    counter2Sub: 'Balls in target zone / wicket-taking',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars' },
      { id: 'consistency', text: 'How consistent was your line and length?', type: 'stars' },
      { id: 'rhythm', text: 'How was your run-up rhythm and action?', type: 'stars' },
      { id: 'wickets', text: 'How many wickets / breakthroughs did you get?', type: 'number', suffix: 'wickets' },
      { id: 'variation', text: 'How effectively did you use variation?', type: 'stars' },
    ],
  },
  {
    kind: 'Fielding',
    icon: 'sports-handball',
    color: colors.tactical,
    counter1Label: 'Chances',
    counter1Sub: 'Total opportunities in the field',
    counter2Label: 'Clean Takes',
    counter2Sub: 'Successful catches / stops / throws',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars' },
      { id: 'concentration', text: 'How sharp was your concentration?', type: 'stars' },
      { id: 'agility', text: 'How was your agility and movement?', type: 'stars' },
      { id: 'runouts', text: 'How many run-outs were you involved in?', type: 'number', suffix: 'run-outs' },
      { id: 'confidence', text: 'How confident were you in your throwing?', type: 'stars' },
    ],
  },
  {
    kind: 'Keeping',
    icon: 'sports-handball',
    color: colors.mental,
    counter1Label: 'Chances',
    counter1Sub: 'Total balls coming to keeper',
    counter2Label: 'Dismissals',
    counter2Sub: 'Catches + stumpings completed',
    closingQuestions: [
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars' },
      { id: 'footwork', text: 'How was your footwork behind the stumps?', type: 'stars' },
      { id: 'communication', text: 'How was your communication with the bowlers?', type: 'stars' },
      { id: 'stumpings', text: 'How many stumping opportunities were there?', type: 'number', suffix: 'chances' },
      { id: 'confidence', text: 'How confident were you overall?', type: 'stars' },
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
      { id: 'body', text: 'How is your body feeling after the session?', type: 'stars' },
      { id: 'energy', text: 'How was your energy throughout?', type: 'stars' },
      { id: 'effort', text: 'Rate your effort and intensity today', type: 'stars' },
      { id: 'recovery', text: 'How was your recovery between sets?', type: 'stars' },
      { id: 'exercises', text: 'How many different exercises did you complete?', type: 'number', suffix: 'exercises' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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

function BigCounter({ label, sub, value, color, onInc, onDec }: {
  label: string; sub: string; value: number; color: string; onInc: () => void; onDec: () => void;
}) {
  return (
    <View style={bc.card}>
      <Text style={[bc.label, { color }]}>{label}</Text>
      <Text style={bc.sub}>{sub}</Text>
      <Text style={[bc.value, { color }]}>{value}</Text>
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
  label: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  sub: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  value: { fontSize: 72, fontWeight: '900', letterSpacing: -2, lineHeight: 80 },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  btn: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
});

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

  const academyId = params.academyId as string;
  const logDate = new Date().toISOString().split('T')[0];

  // ── Steps: 0=Pick Type, 1=Objectives, 2=Live, 3=Closing, 4=Summary
  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(0);

  // ── Step 0: Type Selection
  const [config, setConfig] = useState<SessionConfig | null>(null);

  // ── Step 1: Objectives
  const [objective1, setObjective1] = useState('');
  const [objective2, setObjective2] = useState('');

  // ── Step 2: Live
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [counter1, setCounter1] = useState(0);
  const [counter2, setCounter2] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step === 2 && !paused) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, paused]);

  // ── Step 3: Closing
  const [obj1Done, setObj1Done] = useState<boolean | null>(null);
  const [obj2Done, setObj2Done] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const updateAnswer = (id: string, val: number) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  // ── Save
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !config) return;
    setSaving(true);

    const noteParts: string[] = [];
    if (objective1.trim()) noteParts.push(`Objective 1: ${objective1.trim()} — ${obj1Done === true ? 'Completed ✓' : obj1Done === false ? 'Not completed ✗' : 'Not answered'}`);
    if (objective2.trim()) noteParts.push(`Objective 2: ${objective2.trim()} — ${obj2Done === true ? 'Completed ✓' : obj2Done === false ? 'Not completed ✗' : 'Not answered'}`);
    if (config.closingQuestions) {
      config.closingQuestions.forEach(q => {
        const a = answers[q.id];
        if (a !== undefined) {
          noteParts.push(`${q.text}: ${q.type === 'stars' ? `${a}/5 ★` : `${a}${q.suffix ? ' ' + q.suffix : ''}`}`);
        }
      });
    }

    const { error } = await academyService.logTraining({
      user_id: user.id,
      academy_id: academyId,
      log_date: logDate,
      session_type: config.kind,
      duration_minutes: Math.max(1, Math.floor(elapsed / 60)),
      intensity: answers['effort'] || answers['energy'] || answers['focus'] || answers['consistency'] || 5,
      balls_faced: config.kind === 'Batting' ? counter1 || undefined : undefined,
      balls_bowled: config.kind === 'Bowling' ? counter1 || undefined : undefined,
      catches: config.kind === 'Keeping' ? counter2 || undefined : config.kind === 'Fielding' ? counter2 || undefined : undefined,
      stumpings: config.kind === 'Keeping' ? (counter2 || undefined) : undefined,
      notes: noteParts.join('\n') || undefined,
    });

    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setStep(4);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 0 — Session Type Picker
  // ──────────────────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1 — Objectives
  // ──────────────────────────────────────────────────────────────────────────
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

          <View style={styles.objInputBlock}>
            <View style={[styles.objNum, { backgroundColor: config?.color || colors.primary }]}>
              <Text style={styles.objNumText}>1</Text>
            </View>
            <TextInput
              style={styles.objInput}
              value={objective1}
              onChangeText={setObjective1}
              placeholder="e.g. Improve my back-foot play against short balls"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.objInputBlock}>
            <View style={[styles.objNum, { backgroundColor: config?.color || colors.primary }]}>
              <Text style={styles.objNumText}>2</Text>
            </View>
            <TextInput
              style={styles.objInput}
              value={objective2}
              onChangeText={setObjective2}
              placeholder="e.g. Land 80% of deliveries in the good-length zone"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
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

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2 — Live Session
  // ──────────────────────────────────────────────────────────────────────────
  const renderLive = () => {
    const c = config!;
    const successRate = counter1 > 0 ? Math.round((counter2 / counter1) * 100) : 0;

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollPad, { gap: spacing.md }]} showsVerticalScrollIndicator={false}>
        {/* Timer Card */}
        <View style={[styles.timerCard, { borderTopColor: c.color }]}>
          <Text style={styles.timerLabel}>Session Timer</Text>
          <Text style={[styles.timerValue, { color: paused ? colors.warning : c.color }]}>{formatTime(elapsed)}</Text>
          <Text style={styles.timerKind}>{c.kind}</Text>
          <View style={styles.timerBtnRow}>
            <Pressable
              style={[styles.timerBtn, { backgroundColor: paused ? c.color : colors.warning }]}
              onPress={() => setPaused(p => !p)}
            >
              <MaterialIcons name={paused ? 'play-arrow' : 'pause'} size={22} color={colors.textLight} />
              <Text style={styles.timerBtnText}>{paused ? 'Resume' : 'Pause'}</Text>
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

        {/* Counters */}
        <View style={styles.countersRow}>
          <BigCounter
            label={c.counter1Label}
            sub={c.counter1Sub}
            value={counter1}
            color={c.color}
            onInc={() => setCounter1(v => v + 1)}
            onDec={() => setCounter1(v => Math.max(0, v - 1))}
          />
          <BigCounter
            label={c.counter2Label}
            sub={c.counter2Sub}
            value={counter2}
            color={c.color}
            onInc={() => setCounter2(v => Math.min(counter1 === 0 ? 9999 : counter1, v + 1))}
            onDec={() => setCounter2(v => Math.max(0, v - 1))}
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
              <View style={[styles.derivedBarFill, { width: `${successRate}%`, backgroundColor: successRate >= 60 ? colors.success : successRate >= 40 ? colors.warning : colors.error }]} />
            </View>
            <Text style={styles.derivedSub}>{counter2} {c.counter2Label.toLowerCase()} from {counter1} {c.counter1Label.toLowerCase()}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3 — Closing Questions
  // ──────────────────────────────────────────────────────────────────────────
  const renderClosing = () => {
    const c = config!;
    const allAnswered = obj1Done !== null && obj2Done !== null;

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
              { text: objective2, done: obj2Done, set: setObj2Done, num: '②' }].map((o, i) => (
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
            ))}
          </View>

          {/* Questions */}
          <View style={styles.closingCard}>
            <Text style={styles.closingCardTitle}>Reflection Questions</Text>
            {c.closingQuestions.map((q, i) => (
              <View key={q.id} style={[styles.questionRow, i < c.closingQuestions.length - 1 && styles.questionRowBorder]}>
                <Text style={styles.questionText}>{q.text}</Text>
                {q.type === 'stars' ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <StarRow
                      value={answers[q.id] || 0}
                      onChange={v => updateAnswer(q.id, v)}
                      color={q.id === 'body' ? colors.success : c.color}
                    />
                    {answers[q.id] > 0 && (
                      <Text style={[styles.starValueLabel, { color: q.id === 'body' ? colors.success : c.color }]}>
                        {answers[q.id]}/5 {['', '★', '★★', '★★★', '★★★★', '★★★★★'][answers[q.id]]}
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

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4 — Summary
  // ──────────────────────────────────────────────────────────────────────────
  const renderSummary = () => {
    const c = config!;
    const durationMins = Math.max(1, Math.floor(elapsed / 60));
    const successRate = counter1 > 0 ? Math.round((counter2 / counter1) * 100) : 0;

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.summaryHero, { backgroundColor: c.color + '12' }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: c.color + '25' }]}>
            <MaterialIcons name="check-circle" size={44} color={c.color} />
          </View>
          <Text style={[styles.heroTitle, { color: c.color }]}>Saved!</Text>
          <Text style={styles.heroSub}>{logDate} · {c.kind}</Text>
        </View>

        {/* Quick stats */}
        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStat}>
            <MaterialIcons name="timer" size={18} color={c.color} />
            <Text style={[styles.summaryStatVal, { color: c.color }]}>{durationMins}m</Text>
            <Text style={styles.summaryStatLabel}>Duration</Text>
          </View>
          <View style={styles.summaryStat}>
            <MaterialIcons name={c.icon as any} size={18} color={c.color} />
            <Text style={[styles.summaryStatVal, { color: c.color }]}>{counter1}</Text>
            <Text style={styles.summaryStatLabel}>{c.counter1Label}</Text>
          </View>
          <View style={styles.summaryStat}>
            <MaterialIcons name="check" size={18} color={c.color} />
            <Text style={[styles.summaryStatVal, { color: c.color }]}>{counter2}</Text>
            <Text style={styles.summaryStatLabel}>{c.counter2Label}</Text>
          </View>
          {counter1 > 0 && (
            <View style={styles.summaryStat}>
              <MaterialIcons name="percent" size={18} color={successRate >= 60 ? colors.success : colors.warning} />
              <Text style={[styles.summaryStatVal, { color: successRate >= 60 ? colors.success : colors.warning }]}>{successRate}%</Text>
              <Text style={styles.summaryStatLabel}>Success</Text>
            </View>
          )}
        </View>

        {/* Visual bar */}
        {counter1 > 0 && (
          <View style={styles.vizCard}>
            <View style={styles.vizHeaderRow}>
              <Text style={styles.vizTitle}>Performance Breakdown</Text>
              <Text style={[styles.vizPct, { color: successRate >= 60 ? colors.success : successRate >= 40 ? colors.warning : colors.error }]}>{successRate}%</Text>
            </View>
            <View style={styles.vizBarBg}>
              <View style={[styles.vizBarFill, { width: `${successRate}%`, backgroundColor: c.color }]} />
            </View>
            <View style={styles.vizLegend}>
              <View style={styles.vizLegendItem}>
                <View style={[styles.vizDot, { backgroundColor: c.color }]} />
                <Text style={styles.vizLegendText}>{c.counter2Label}: {counter2}</Text>
              </View>
              <View style={styles.vizLegendItem}>
                <View style={[styles.vizDot, { backgroundColor: colors.border }]} />
                <Text style={styles.vizLegendText}>Total {c.counter1Label}: {counter1}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Objectives outcome */}
        {(objective1.trim() || objective2.trim()) && (
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Objectives Review</Text>
            {objective1.trim() ? (
              <View style={styles.summaryObjRow}>
                <MaterialIcons name={obj1Done ? 'check-circle' : 'cancel'} size={18} color={obj1Done ? colors.success : colors.error} />
                <Text style={styles.summaryObjText}>{objective1}</Text>
                <Text style={[styles.summaryObjStatus, { color: obj1Done ? colors.success : obj1Done === false ? colors.error : colors.textSecondary }]}>
                  {obj1Done === true ? 'Done' : obj1Done === false ? 'Not done' : '—'}
                </Text>
              </View>
            ) : null}
            {objective2.trim() ? (
              <View style={styles.summaryObjRow}>
                <MaterialIcons name={obj2Done ? 'check-circle' : 'cancel'} size={18} color={obj2Done ? colors.success : colors.error} />
                <Text style={styles.summaryObjText}>{objective2}</Text>
                <Text style={[styles.summaryObjStatus, { color: obj2Done ? colors.success : obj2Done === false ? colors.error : colors.textSecondary }]}>
                  {obj2Done === true ? 'Done' : obj2Done === false ? 'Not done' : '—'}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Reflection summary */}
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

  // ─── Navigation logic ──────────────────────────────────────────────────────
  const STEP_TITLES = ['Session Type', 'Objectives', 'Live Session', 'Debrief', 'Summary'];
  const getNextLabel = () => {
    if (step === 0) return 'Set Objectives →';
    if (step === 1) return 'Start Session →';
    if (step === 2) return 'End Session';
    if (step === 3) return saving ? 'Saving...' : 'Save & View Summary';
    return 'Done';
  };
  const getNextColor = () => {
    if (step === 2) return paused ? colors.warning : colors.error;
    if (step === 4) return colors.success;
    return config?.color || colors.primary;
  };

  const handleNext = () => {
    if (step === 0) return; // handled by type card press
    if (step === 1) {
      if (!objective1.trim() && !objective2.trim()) {
        showAlert('Objectives', 'Please write at least one objective for your session.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (timerRef.current) clearInterval(timerRef.current);
      setStep(3);
    } else if (step === 3) {
      handleSave();
    } else {
      router.back();
    }
  };

  const handleBack = () => {
    if (step === 0) { router.back(); return; }
    if (step === 2) {
      showAlert('Leave Session?', 'Your timer and counters will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => { if (timerRef.current) clearInterval(timerRef.current); setStep(1); } },
      ]);
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
            name={step === 0 || step === 4 ? 'close' : step === 2 ? 'stop' : 'arrow-back'}
            size={24}
            color={step === 2 ? colors.error : colors.text}
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
        ) : <View style={{ width: 60 }} />}
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
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 60, justifyContent: 'flex-end' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 11, fontWeight: '800' },

  scroll: { flex: 1 },
  scrollPad: { padding: spacing.md, paddingBottom: 100 },

  heroBlock: { marginBottom: spacing.lg, gap: spacing.xs },
  heroIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs, alignSelf: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  // Type picker
  typeGrid: { gap: spacing.md },
  typeCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg,
    alignItems: 'center', borderWidth: 2, gap: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  typeIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  typeName: { fontSize: 20, fontWeight: '900' },
  typeSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

  // Objectives
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

  // Live
  timerCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderTopWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  timerLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  timerValue: { fontSize: 72, fontWeight: '900', letterSpacing: -2, lineHeight: 80 },
  timerKind: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  timerBtnRow: { flexDirection: 'row', marginTop: spacing.md },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md },
  timerBtnText: { fontSize: 15, color: colors.textLight, fontWeight: '700' },
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

  // Closing
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
  starValueLabel: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  numberInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  numberInput: { width: 80, borderWidth: 2, borderRadius: borderRadius.md, paddingVertical: spacing.sm, fontSize: 22, fontWeight: '800', color: colors.text, backgroundColor: colors.background, textAlign: 'center' },
  numberSuffix: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  // Summary
  summaryHero: { borderRadius: borderRadius.xl, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, gap: spacing.xs },
  summaryStatsRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'space-around' },
  summaryStat: { alignItems: 'center', gap: 4, flex: 1 },
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
