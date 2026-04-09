import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { academyService } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AIQuestion { question: string; answer: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_TYPES = [
  { id: 'Nets — Batting', label: 'Nets — Batting', icon: 'sports-cricket', color: colors.technical },
  { id: 'Nets — Bowling', label: 'Nets — Bowling', icon: 'sports-cricket', color: colors.physical },
  { id: 'Nets — Mixed', label: 'Nets — Mixed', icon: 'sports-cricket', color: colors.primary },
  { id: 'Match Practice', label: 'Match Practice', icon: 'emoji-events', color: colors.warning },
  { id: 'Fielding Drills', label: 'Fielding Drills', icon: 'sports-handball', color: colors.tactical },
  { id: 'Fitness / Conditioning', label: 'Fitness', icon: 'fitness-center', color: colors.mental },
  { id: 'Team Training', label: 'Team Training', icon: 'people', color: colors.success },
  { id: 'Individual Training', label: 'Individual', icon: 'person', color: colors.textSecondary },
];

const INTENSITY_DATA: Record<number, { label: string; color: string }> = {
  1: { label: 'Very Light', color: '#4CAF50' }, 2: { label: 'Light', color: '#66BB6A' },
  3: { label: 'Easy', color: '#8BC34A' }, 4: { label: 'Moderate', color: '#FFC107' },
  5: { label: 'Steady', color: '#FFB300' }, 6: { label: 'Challenging', color: '#FF9800' },
  7: { label: 'Hard', color: '#F44336' }, 8: { label: 'Very Hard', color: '#E53935' },
  9: { label: 'Intense', color: '#C62828' }, 10: { label: 'Maximum', color: '#B71C1C' },
};

const TIPS: Record<string, string[]> = {
  Batsman: [
    'Watch the ball all the way onto the bat.',
    'Reset your mental state after every delivery.',
    'Back foot or front foot — decide early.',
    'Stay balanced through your shot. Head still!',
  ],
  Bowler: [
    'Focus on landing in your target zone consistently.',
    'Control your run-up length and rhythm.',
    'Vary your pace — keep the batter guessing.',
    'Follow through fully for maximum pace.',
  ],
  default: [
    'Stay focused. Quality over quantity.',
    'Communicate with your teammates.',
    'Visualise before every action.',
    'Champions embrace the grind.',
  ],
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={pb.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[pb.seg, i < step ? pb.done : i === step ? pb.active : pb.idle]} />
      ))}
    </View>
  );
}
const pb = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  idle: { backgroundColor: colors.border },
  active: { backgroundColor: colors.primary },
  done: { backgroundColor: colors.primary + '80' },
});

function CounterButton({
  icon, value, label, color, onInc, onDec, note,
}: {
  icon: string; value: number; label: string; color: string;
  onInc: () => void; onDec: () => void; note?: string;
}) {
  return (
    <View style={ctr.card}>
      <View style={[ctr.iconWrap, { backgroundColor: color + '20' }]}>
        <MaterialIcons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[ctr.label, { color }]}>{label}</Text>
      <Text style={ctr.value}>{value}</Text>
      {note ? <Text style={ctr.note}>{note}</Text> : null}
      <View style={ctr.btnRow}>
        <Pressable style={[ctr.btn, { backgroundColor: colors.error + '20' }]} onPress={onDec} hitSlop={4}>
          <MaterialIcons name="remove" size={22} color={colors.error} />
        </Pressable>
        <Pressable style={[ctr.btn, { backgroundColor: color }]} onPress={onInc} hitSlop={4}>
          <MaterialIcons name="add" size={22} color={colors.textLight} />
        </Pressable>
      </View>
    </View>
  );
}
const ctr = StyleSheet.create({
  card: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '800', textAlign: 'center', letterSpacing: 0.3 },
  value: { fontSize: 48, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  note: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  btn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={{ height: 8, flex: 1, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4, minWidth: value > 0 ? 8 : 0 }} />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AcademyLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const academyId = params.academyId as string;
  const position = (params.position as string) || 'Batsman';

  const isBatter = ['Batsman', 'All-Rounder', 'Wicket-Keeper'].includes(position);
  const isBowler = ['Bowler', 'All-Rounder'].includes(position);
  const isFielder = ['Fielder', 'All-Rounder', 'Wicket-Keeper'].includes(position);
  const isKeeper = position === 'Wicket-Keeper';

  const TOTAL_STEPS = 4;
  const [step, setStep] = useState(0); // 0=Setup 1=Live 2=Reflect 3=Summary

  // ── Step 0: Setup ──────────────────────────────────────────────────────────
  const [sessionType, setSessionType] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [logDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Step 1: Live counters ──────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [tipIdx, setTipIdx] = useState(0);
  const tipList = TIPS[position] || TIPS.default;

  // Batting
  const [ballsFaced, setBallsFaced] = useState(0);
  const [runsScored, setRunsScored] = useState(0);
  const [ballsMiddled, setBallsMiddled] = useState(0);
  // Bowling
  const [ballsBowled, setBallsBowled] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [runsConceded, setRunsConceded] = useState(0);
  // Fielding
  const [catches, setCatches] = useState(0);
  const [runOuts, setRunOuts] = useState(0);
  const [stumpings, setStumpings] = useState(0);

  // Timer
  useEffect(() => {
    if (running && !paused) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, paused]);

  // Tip rotation
  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setTipIdx(i => (i + 1) % tipList.length), 18000);
    return () => clearInterval(t);
  }, [running, paused]);

  const startSession = () => {
    setRunning(true);
    setPaused(false);
  };

  const endSession = () => {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setStep(2);
    loadAIQuestions();
  };

  // ── Step 2: AI reflection ──────────────────────────────────────────────────
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const loadAIQuestions = async () => {
    setAiLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('academy-ai-questions', {
        body: {
          mode: 'questions',
          position,
          sessionType,
          stats: {
            duration_minutes: Math.max(1, Math.floor(elapsed / 60)),
            intensity,
            balls_faced: ballsFaced || undefined,
            runs_scored: runsScored || undefined,
            balls_middled: ballsMiddled || undefined,
            balls_bowled: ballsBowled || undefined,
            wickets: wickets || undefined,
            runs_conceded: runsConceded || undefined,
            catches: catches || undefined,
            run_outs: runOuts || undefined,
            stumpings: stumpings || undefined,
          },
        },
      });
      if (!error && data?.questions) {
        setQuestions((data.questions as string[]).map(q => ({ question: q, answer: '' })));
      } else {
        setQuestions(getFallbackQuestions(position).map(q => ({ question: q, answer: '' })));
      }
    } catch {
      setQuestions(getFallbackQuestions(position).map(q => ({ question: q, answer: '' })));
    }
    setAiLoading(false);
  };

  const updateAnswer = (idx: number, answer: string) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, answer } : q));
  };

  // ── Step 3 / Save ──────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const answersText = questions.filter(q => q.answer.trim())
      .map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n');
    const finalNotes = [notes.trim(), answersText].filter(Boolean).join('\n\n');

    const { error } = await academyService.logTraining({
      user_id: user.id,
      academy_id: academyId,
      log_date: logDate,
      session_type: sessionType,
      duration_minutes: Math.max(1, Math.floor(elapsed / 60)),
      intensity,
      balls_faced: ballsFaced || undefined,
      runs_scored: runsScored || undefined,
      balls_bowled: ballsBowled || undefined,
      wickets: wickets || undefined,
      runs_conceded: runsConceded || undefined,
      catches: catches || undefined,
      run_outs: runOuts || undefined,
      stumpings: stumpings || undefined,
      notes: finalNotes || undefined,
    });

    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    router.back();
  };

  // ── Derived calcs ──────────────────────────────────────────────────────────
  const strikeRate = ballsFaced > 0 ? Math.round((runsScored / ballsFaced) * 100) : 0;
  const middlePct = ballsFaced > 0 ? Math.round((ballsMiddled / ballsFaced) * 100) : 0;
  const oversBowled = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`;
  const economy = ballsBowled > 0 ? (runsConceded / (ballsBowled / 6)).toFixed(1) : '—';

  const intensityInfo = INTENSITY_DATA[intensity];

  // ──────────────────────────────────────────────────────────────────────────
  // Step 0 — Setup
  // ──────────────────────────────────────────────────────────────────────────
  const renderSetup = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHero}>
        <View style={[styles.heroIconCircle, { backgroundColor: colors.primary + '20' }]}>
          <MaterialIcons name="sports-cricket" size={36} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Start Training Log</Text>
        <Text style={styles.heroSub}>
          Logging as <Text style={{ fontWeight: '800', color: colors.primary }}>{position}</Text>
        </Text>
      </View>

      {/* Session Type */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>What type of session?</Text>
        <View style={styles.sessionTypeGrid}>
          {SESSION_TYPES.map(t => {
            const active = sessionType === t.id;
            return (
              <Pressable key={t.id} style={[styles.typeCard, active && { borderColor: t.color, backgroundColor: t.color + '12' }]} onPress={() => setSessionType(t.id)}>
                <View style={[styles.typeIconWrap, { backgroundColor: active ? t.color : colors.border + '60' }]}>
                  <MaterialIcons name={t.icon as any} size={20} color={active ? colors.textLight : colors.textSecondary} />
                </View>
                <Text style={[styles.typeLabel, active && { color: t.color, fontWeight: '800' }]} numberOfLines={2}>{t.label}</Text>
                {active && <MaterialIcons name="check-circle" size={16} color={t.color} style={styles.typeCheck} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Intensity */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>Planned Intensity</Text>
          <View style={[styles.intensityBadge, { backgroundColor: intensityInfo.color + '20' }]}>
            <Text style={[styles.intensityBadgeText, { color: intensityInfo.color }]}>{intensity}/10 · {intensityInfo.label}</Text>
          </View>
        </View>
        <View style={styles.intensityTrack}>
          <View style={[styles.intensityFill, { width: `${intensity * 10}%`, backgroundColor: intensityInfo.color }]} />
        </View>
        <View style={styles.intensityBtnRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
            const active = intensity === n;
            const info = INTENSITY_DATA[n];
            return (
              <Pressable key={n} onPress={() => setIntensity(n)}
                style={[styles.intBtn, active && { backgroundColor: info.color, borderColor: info.color }]}>
                <Text style={[styles.intBtnText, active && { color: colors.textLight }]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Position-specific hint */}
      <View style={styles.hintCard}>
        <MaterialIcons name="info-outline" size={18} color={colors.primary} />
        <Text style={styles.hintText}>
          {isBatter && 'Track balls faced, runs, and middle percentage live during training.'}
          {isBowler && !isBatter && 'Track balls bowled, wickets, and economy rate live.'}
          {isFielder && !isBatter && !isBowler && 'Track catches, run outs, and stumpings in real time.'}
          {!isBatter && !isBowler && !isFielder && 'Track your key metrics during the session.'}
        </Text>
      </View>
    </ScrollView>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1 — Live Session
  // ──────────────────────────────────────────────────────────────────────────
  const renderLive = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { gap: spacing.md }]} showsVerticalScrollIndicator={false}>
      {/* Timer */}
      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>Session Time</Text>
        <Text style={styles.timerValue}>{formatTime(elapsed)}</Text>
        <Text style={styles.timerType}>{sessionType}</Text>
        <View style={styles.timerBtns}>
          <Pressable style={[styles.timerBtn, { backgroundColor: paused ? colors.primary : colors.warning }]}
            onPress={() => setPaused(p => !p)}>
            <MaterialIcons name={paused ? 'play-arrow' : 'pause'} size={22} color={colors.textLight} />
            <Text style={styles.timerBtnText}>{paused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
        </View>
        {paused && (
          <View style={styles.pausedBanner}>
            <MaterialIcons name="pause-circle-filled" size={16} color={colors.warning} />
            <Text style={styles.pausedText}>Session paused — timer stopped</Text>
          </View>
        )}
      </View>

      {/* Batting counters */}
      {isBatter && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: colors.technical }]} />
            <Text style={[styles.sectionTitle, { color: colors.technical }]}>Batting</Text>
          </View>
          <View style={styles.countersGrid}>
            <CounterButton icon="sports-cricket" value={ballsFaced} label="BALLS FACED" color={colors.technical}
              onInc={() => setBallsFaced(v => v + 1)} onDec={() => setBallsFaced(v => Math.max(0, v - 1))} />
            <CounterButton icon="trending-up" value={runsScored} label="RUNS SCORED" color={colors.success}
              onInc={() => setRunsScored(v => v + 1)} onDec={() => setRunsScored(v => Math.max(0, v - 1))} />
          </View>
          <View style={styles.countersGrid}>
            <CounterButton icon="gps-fixed" value={ballsMiddled} label="BALLS MIDDLED" color={colors.primary}
              note={ballsFaced > 0 ? `${middlePct}% middle rate` : undefined}
              onInc={() => setBallsMiddled(v => Math.min(ballsFaced, v + 1))} onDec={() => setBallsMiddled(v => Math.max(0, v - 1))} />
          </View>
          {ballsFaced > 0 && (
            <View style={styles.derivedRow}>
              {strikeRate > 0 && (
                <View style={styles.derivedChip}>
                  <Text style={styles.derivedLabel}>Strike Rate</Text>
                  <Text style={[styles.derivedVal, { color: strikeRate > 100 ? colors.success : strikeRate > 60 ? colors.warning : colors.error }]}>{strikeRate}</Text>
                </View>
              )}
              {middlePct > 0 && (
                <View style={styles.derivedChip}>
                  <Text style={styles.derivedLabel}>Middle %</Text>
                  <Text style={[styles.derivedVal, { color: middlePct > 60 ? colors.success : middlePct > 40 ? colors.warning : colors.error }]}>{middlePct}%</Text>
                </View>
              )}
              {runsScored > 0 && ballsFaced > 0 && (
                <View style={styles.derivedChip}>
                  <Text style={styles.derivedLabel}>Avg Run/Ball</Text>
                  <Text style={[styles.derivedVal, { color: colors.primary }]}>{(runsScored / ballsFaced).toFixed(2)}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Bowling counters */}
      {isBowler && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: colors.physical }]} />
            <Text style={[styles.sectionTitle, { color: colors.physical }]}>Bowling</Text>
          </View>
          <View style={styles.countersGrid}>
            <CounterButton icon="sports-cricket" value={ballsBowled} label="BALLS BOWLED" color={colors.physical}
              note={`${oversBowled} overs`}
              onInc={() => setBallsBowled(v => v + 1)} onDec={() => setBallsBowled(v => Math.max(0, v - 1))} />
            <CounterButton icon="star" value={wickets} label="WICKETS" color={colors.warning}
              onInc={() => setWickets(v => v + 1)} onDec={() => setWickets(v => Math.max(0, v - 1))} />
          </View>
          <View style={styles.countersGrid}>
            <CounterButton icon="trending-down" value={runsConceded} label="RUNS CONCEDED" color={colors.error}
              note={ballsBowled > 0 ? `Eco ${economy}` : undefined}
              onInc={() => setRunsConceded(v => v + 1)} onDec={() => setRunsConceded(v => Math.max(0, v - 1))} />
          </View>
          {ballsBowled > 0 && (
            <View style={styles.derivedRow}>
              <View style={styles.derivedChip}>
                <Text style={styles.derivedLabel}>Overs</Text>
                <Text style={[styles.derivedVal, { color: colors.physical }]}>{oversBowled}</Text>
              </View>
              {wickets > 0 && (
                <View style={styles.derivedChip}>
                  <Text style={styles.derivedLabel}>Wickets</Text>
                  <Text style={[styles.derivedVal, { color: colors.warning }]}>{wickets}</Text>
                </View>
              )}
              {runsConceded > 0 && ballsBowled > 0 && (
                <View style={styles.derivedChip}>
                  <Text style={styles.derivedLabel}>Economy</Text>
                  <Text style={[styles.derivedVal, { color: parseFloat(economy) < 6 ? colors.success : parseFloat(economy) < 9 ? colors.warning : colors.error }]}>{economy}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Fielding counters */}
      {(isFielder || isKeeper) && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: colors.tactical }]} />
            <Text style={[styles.sectionTitle, { color: colors.tactical }]}>Fielding{isKeeper ? ' & Keeping' : ''}</Text>
          </View>
          <View style={styles.countersGrid}>
            <CounterButton icon="sports-handball" value={catches} label="CATCHES" color={colors.tactical}
              onInc={() => setCatches(v => v + 1)} onDec={() => setCatches(v => Math.max(0, v - 1))} />
            <CounterButton icon="flash-on" value={runOuts} label="RUN OUTS" color={colors.warning}
              onInc={() => setRunOuts(v => v + 1)} onDec={() => setRunOuts(v => Math.max(0, v - 1))} />
          </View>
          {isKeeper && (
            <View style={styles.countersGrid}>
              <CounterButton icon="location-on" value={stumpings} label="STUMPINGS" color={colors.mental}
                onInc={() => setStumpings(v => v + 1)} onDec={() => setStumpings(v => Math.max(0, v - 1))} />
            </View>
          )}
        </View>
      )}

      {/* Live tip */}
      <View style={styles.tipCard}>
        <MaterialIcons name="lightbulb" size={18} color={colors.warning} />
        <Text style={styles.tipText}>{tipList[tipIdx]}</Text>
      </View>
    </ScrollView>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2 — AI Reflection Questions
  // ──────────────────────────────────────────────────────────────────────────
  const renderReflect = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepHero}>
        <View style={[styles.heroIconCircle, { backgroundColor: colors.primary + '20' }]}>
          <MaterialIcons name="psychology" size={36} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Coaching Reflection</Text>
        <Text style={styles.heroSub}>AI questions personalised to your session</Text>
      </View>

      {aiLoading ? (
        <View style={styles.aiLoadCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.aiLoadText}>Generating your coaching questions...</Text>
        </View>
      ) : (
        <>
          {questions.map((q, idx) => (
            <View key={idx} style={styles.questionCard}>
              <View style={styles.qHeaderRow}>
                <View style={styles.qNumCircle}><Text style={styles.qNum}>{idx + 1}</Text></View>
                <Text style={styles.qText}>{q.question}</Text>
              </View>
              <TextInput
                style={styles.answerInput}
                value={q.answer}
                onChangeText={v => updateAnswer(idx, v)}
                placeholder="Type your answer here..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ))}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Any other notes?</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else to record..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </>
      )}
    </ScrollView>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3 — Summary + Graphics
  // ──────────────────────────────────────────────────────────────────────────
  const renderSummary = () => {
    const durationMins = Math.max(1, Math.floor(elapsed / 60));
    const intInfo = INTENSITY_DATA[intensity];

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.stepHero, { paddingBottom: spacing.sm }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: colors.success + '20' }]}>
            <MaterialIcons name="check-circle" size={40} color={colors.success} />
          </View>
          <Text style={styles.heroTitle}>Session Complete!</Text>
          <Text style={styles.heroSub}>{logDate} · {position}</Text>
        </View>

        {/* Quick stat row */}
        <View style={styles.quickStatRow}>
          <View style={styles.quickStat}>
            <MaterialIcons name="timer" size={20} color={colors.primary} />
            <Text style={styles.quickStatVal}>{durationMins}m</Text>
            <Text style={styles.quickStatLabel}>Duration</Text>
          </View>
          <View style={styles.quickStat}>
            <MaterialIcons name="flash-on" size={20} color={intInfo.color} />
            <Text style={[styles.quickStatVal, { color: intInfo.color }]}>{intensity}/10</Text>
            <Text style={styles.quickStatLabel}>Intensity</Text>
          </View>
          <View style={styles.quickStat}>
            <MaterialIcons name="event" size={20} color={colors.textSecondary} />
            <Text style={styles.quickStatVal}>{sessionType.split(' — ')[0] || sessionType}</Text>
            <Text style={styles.quickStatLabel}>Type</Text>
          </View>
        </View>

        {/* Batting performance card */}
        {isBatter && ballsFaced > 0 && (
          <View style={[styles.perfCard, { borderLeftColor: colors.technical }]}>
            <View style={styles.perfHeader}>
              <MaterialIcons name="sports-cricket" size={18} color={colors.technical} />
              <Text style={[styles.perfTitle, { color: colors.technical }]}>Batting Performance</Text>
            </View>

            {/* Big stats */}
            <View style={styles.bigStatRow}>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatVal, { color: colors.technical }]}>{ballsFaced}</Text>
                <Text style={styles.bigStatLabel}>Balls Faced</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatVal, { color: colors.success }]}>{runsScored}</Text>
                <Text style={styles.bigStatLabel}>Runs Scored</Text>
              </View>
              {strikeRate > 0 && (
                <View style={styles.bigStat}>
                  <Text style={[styles.bigStatVal, { color: strikeRate > 100 ? colors.success : strikeRate > 60 ? colors.warning : colors.error }]}>{strikeRate}</Text>
                  <Text style={styles.bigStatLabel}>Strike Rate</Text>
                </View>
              )}
            </View>

            {/* Middle % progress bar */}
            {ballsMiddled > 0 && (
              <View style={styles.metricBarRow}>
                <View style={styles.metricBarLabel}>
                  <MaterialIcons name="gps-fixed" size={13} color={colors.primary} />
                  <Text style={styles.metricBarLabelText}>Middle %</Text>
                </View>
                <MiniBar value={middlePct} max={100} color={middlePct > 60 ? colors.success : middlePct > 40 ? colors.warning : colors.error} />
                <Text style={[styles.metricBarVal, { color: middlePct > 60 ? colors.success : middlePct > 40 ? colors.warning : colors.error }]}>{middlePct}%</Text>
              </View>
            )}

            {/* Mini bar chart — visual breakdown */}
            <View style={styles.vizRow}>
              {ballsFaced > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: '100%', backgroundColor: colors.technical + '80' }]} /><Text style={styles.vizLabel}>Faced</Text><Text style={styles.vizNum}>{ballsFaced}</Text></View>}
              {runsScored > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: `${Math.min((runsScored / (ballsFaced * 1.5)) * 100, 100)}%`, backgroundColor: colors.success }]} /><Text style={styles.vizLabel}>Runs</Text><Text style={styles.vizNum}>{runsScored}</Text></View>}
              {ballsMiddled > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: `${middlePct}%`, backgroundColor: colors.primary }]} /><Text style={styles.vizLabel}>Middled</Text><Text style={styles.vizNum}>{ballsMiddled}</Text></View>}
            </View>
          </View>
        )}

        {/* Bowling performance card */}
        {isBowler && ballsBowled > 0 && (
          <View style={[styles.perfCard, { borderLeftColor: colors.physical }]}>
            <View style={styles.perfHeader}>
              <MaterialIcons name="sports-cricket" size={18} color={colors.physical} />
              <Text style={[styles.perfTitle, { color: colors.physical }]}>Bowling Performance</Text>
            </View>
            <View style={styles.bigStatRow}>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatVal, { color: colors.physical }]}>{oversBowled}</Text>
                <Text style={styles.bigStatLabel}>Overs</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatVal, { color: colors.warning }]}>{wickets}</Text>
                <Text style={styles.bigStatLabel}>Wickets</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatVal, { color: parseFloat(economy) < 6 ? colors.success : parseFloat(economy) < 9 ? colors.warning : colors.error }]}>{economy}</Text>
                <Text style={styles.bigStatLabel}>Economy</Text>
              </View>
            </View>
            {runsConceded > 0 && (
              <View style={styles.metricBarRow}>
                <View style={styles.metricBarLabel}>
                  <MaterialIcons name="trending-down" size={13} color={colors.error} />
                  <Text style={styles.metricBarLabelText}>Economy</Text>
                </View>
                <MiniBar value={Math.min(parseFloat(economy), 12)} max={12} color={parseFloat(economy) < 6 ? colors.success : parseFloat(economy) < 9 ? colors.warning : colors.error} />
                <Text style={[styles.metricBarVal, { color: parseFloat(economy) < 6 ? colors.success : colors.error }]}>{economy}</Text>
              </View>
            )}
            <View style={styles.vizRow}>
              {ballsBowled > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: '100%', backgroundColor: colors.physical + '80' }]} /><Text style={styles.vizLabel}>Bowled</Text><Text style={styles.vizNum}>{ballsBowled}</Text></View>}
              {wickets > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: `${Math.min((wickets / (ballsBowled / 6)) * 30, 100)}%`, backgroundColor: colors.warning }]} /><Text style={styles.vizLabel}>Wkts</Text><Text style={styles.vizNum}>{wickets}</Text></View>}
              {runsConceded > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: `${Math.min((runsConceded / (ballsBowled * 2)) * 100, 100)}%`, backgroundColor: colors.error + '90' }]} /><Text style={styles.vizLabel}>Runs</Text><Text style={styles.vizNum}>{runsConceded}</Text></View>}
            </View>
          </View>
        )}

        {/* Fielding card */}
        {(isFielder || isKeeper) && (catches > 0 || runOuts > 0 || stumpings > 0) && (
          <View style={[styles.perfCard, { borderLeftColor: colors.tactical }]}>
            <View style={styles.perfHeader}>
              <MaterialIcons name="sports-handball" size={18} color={colors.tactical} />
              <Text style={[styles.perfTitle, { color: colors.tactical }]}>Fielding{isKeeper ? ' & Keeping' : ''}</Text>
            </View>
            <View style={styles.bigStatRow}>
              {catches > 0 && <View style={styles.bigStat}><Text style={[styles.bigStatVal, { color: colors.tactical }]}>{catches}</Text><Text style={styles.bigStatLabel}>Catches</Text></View>}
              {runOuts > 0 && <View style={styles.bigStat}><Text style={[styles.bigStatVal, { color: colors.warning }]}>{runOuts}</Text><Text style={styles.bigStatLabel}>Run Outs</Text></View>}
              {stumpings > 0 && <View style={styles.bigStat}><Text style={[styles.bigStatVal, { color: colors.mental }]}>{stumpings}</Text><Text style={styles.bigStatLabel}>Stumpings</Text></View>}
            </View>
            <View style={styles.vizRow}>
              {catches > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: '100%', backgroundColor: colors.tactical }]} /><Text style={styles.vizLabel}>Catches</Text><Text style={styles.vizNum}>{catches}</Text></View>}
              {runOuts > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: `${Math.min((runOuts / Math.max(catches, 1)) * 100, 100)}%`, backgroundColor: colors.warning }]} /><Text style={styles.vizLabel}>Run Outs</Text><Text style={styles.vizNum}>{runOuts}</Text></View>}
              {stumpings > 0 && <View style={styles.vizBar}><View style={[styles.vizFill, { height: `${Math.min((stumpings / Math.max(catches, 1)) * 100, 100)}%`, backgroundColor: colors.mental }]} /><Text style={styles.vizLabel}>Stumpings</Text><Text style={styles.vizNum}>{stumpings}</Text></View>}
            </View>
          </View>
        )}

        {/* Intensity visual */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Session Intensity</Text>
            <View style={[styles.intensityBadge, { backgroundColor: intInfo.color + '20' }]}>
              <Text style={[styles.intensityBadgeText, { color: intInfo.color }]}>{intensity}/10 · {intInfo.label}</Text>
            </View>
          </View>
          <View style={styles.intensityTrack}>
            <View style={[styles.intensityFill, { width: `${intensity * 10}%`, backgroundColor: intInfo.color }]} />
          </View>
          <View style={styles.intensityScale}>
            <Text style={styles.intensityScaleLabel}>Light</Text>
            <Text style={styles.intensityScaleLabel}>Moderate</Text>
            <Text style={styles.intensityScaleLabel}>Maximum</Text>
          </View>
        </View>

        {/* Reflection preview */}
        {questions.filter(q => q.answer.trim()).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Coach's Reflection</Text>
            {questions.filter(q => q.answer.trim()).map((q, i) => (
              <View key={i} style={styles.reflectRow}>
                <Text style={styles.reflectQ} numberOfLines={2}>{q.question}</Text>
                <Text style={styles.reflectA}>{q.answer}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ─── Navigation ────────────────────────────────────────────────────────────
  const goNext = () => {
    if (step === 0) {
      if (!sessionType) { showAlert('Required', 'Please select a session type'); return; }
      setStep(1);
      startSession();
    } else if (step === 1) {
      endSession();
    } else if (step === 2) {
      setStep(3);
    } else {
      handleSave();
    }
  };

  const goBack = () => {
    if (step === 0) { router.back(); return; }
    if (step === 1) { showAlert('Leave Session?', 'Your session data will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { setRunning(false); router.back(); } },
    ]); return; }
    setStep(s => s - 1);
  };

  const STEP_TITLES = ['Session Setup', 'Live Training', 'Coach Reflection', 'Summary'];
  const CTAs = ['Start Session', 'End Session', 'Review Summary', saving ? 'Saving...' : 'Save Training Log'];

  const footerColor = step === 1
    ? paused ? colors.warning : colors.error
    : step === 3 ? colors.success : colors.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.headerBtn} hitSlop={8}>
          <MaterialIcons name={step === 0 ? 'close' : step === 1 ? 'stop' : 'arrow-back'} size={24} color={step === 1 ? colors.error : colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{STEP_TITLES[step]}</Text>
          <Text style={styles.headerSub}>Step {step + 1} of {TOTAL_STEPS}</Text>
        </View>
        {step === 1 ? (
          <View style={styles.headerLiveChip}>
            <View style={[styles.liveDot, { backgroundColor: paused ? colors.warning : colors.error }]} />
            <Text style={[styles.liveText, { color: paused ? colors.warning : colors.error }]}>{paused ? 'PAUSED' : 'LIVE'}</Text>
          </View>
        ) : <View style={{ width: 60 }} />}
      </View>

      <ProgressBar step={step} total={TOTAL_STEPS} />

      {step === 0 && renderSetup()}
      {step === 1 && renderLive()}
      {step === 2 && renderReflect()}
      {step === 3 && renderSummary()}

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.md) }]}>
        {step === 2 && !aiLoading && (
          <Pressable style={styles.skipBtn} onPress={() => setStep(3)}>
            <Text style={styles.skipText}>Skip reflection</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.ctaBtn, { backgroundColor: footerColor }, saving && styles.ctaDisabled]}
          onPress={goNext}
        >
          {saving ? (
            <ActivityIndicator color={colors.textLight} />
          ) : (
            <>
              <MaterialIcons
                name={step === 0 ? 'play-arrow' : step === 1 ? 'stop' : step === 2 ? 'navigate-next' : 'check-circle'}
                size={22}
                color={colors.textLight}
              />
              <Text style={styles.ctaBtnText}>{CTAs[step]}</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function getFallbackQuestions(position: string): string[] {
  if (position === 'Bowler') return [
    'How consistent was your line and length today?', 'Did you vary your pace and trajectory effectively?',
    'How did you respond when batters played you well?', 'How was your physical stamina during the session?',
  ];
  if (position === 'Fielder') return [
    'How sharp was your concentration throughout?', 'Were you proactive in your positioning and movement?',
    'How confident were you in your throwing and catching?', 'How did you mentally handle any errors?',
  ];
  if (position === 'Wicket-Keeper') return [
    'How consistent was your footwork behind the stumps?', 'Did you read the bowlers well and anticipate deliveries?',
    'How confident were you in your catching and stumping attempts?', 'How was your communication with fielders?',
  ];
  return [
    'How well did you judge which balls to attack vs defend?', 'Describe your footwork and balance at the crease today.',
    'How did you handle difficult deliveries or pressure moments?', 'What specific technical aspect did you focus on improving?',
  ];
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  headerLiveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 60, justifyContent: 'flex-end' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: '800' },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 100 },

  stepHero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  heroIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  heroTitle: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center' },
  heroSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },

  sessionTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    width: '47%', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', gap: 6, position: 'relative',
    minHeight: 88,
  },
  typeIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  typeLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  typeCheck: { position: 'absolute', top: 6, right: 6 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  intensityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  intensityBadgeText: { fontSize: 12, fontWeight: '800' },
  intensityTrack: { height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden', marginBottom: spacing.sm },
  intensityFill: { height: '100%', borderRadius: 6, minWidth: 12 },
  intensityBtnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  intBtn: { width: 29, height: 29, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  intBtnText: { fontSize: 11, fontWeight: '800', color: colors.text },
  intensityScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  intensityScaleLabel: { fontSize: 9, color: colors.textSecondary },

  hintCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primary + '10', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '30', marginBottom: spacing.md },
  hintText: { flex: 1, ...typography.bodySmall, color: colors.primary, lineHeight: 18 },

  // Live session
  timerCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  timerLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  timerValue: { fontSize: 64, fontWeight: '900', color: colors.text, letterSpacing: -2, lineHeight: 72 },
  timerType: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  timerBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  timerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.md },
  timerBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
  pausedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: colors.warning + '15', borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  pausedText: { fontSize: 12, color: colors.warning, fontWeight: '600' },

  sectionBlock: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { ...typography.body, fontWeight: '800' },
  countersGrid: { flexDirection: 'row', gap: spacing.sm },
  derivedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border + '50' },
  derivedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.background, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  derivedLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  derivedVal: { fontSize: 13, fontWeight: '900' },

  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: '#FFF4E6', borderRadius: borderRadius.md, padding: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.warning },
  tipText: { flex: 1, ...typography.bodySmall, color: colors.text, lineHeight: 20 },

  // Reflect step
  aiLoadCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: 40, alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  aiLoadText: { ...typography.body, color: colors.text, fontWeight: '600' },
  questionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary },
  qHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  qNumCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  qNum: { fontSize: 12, fontWeight: '800', color: colors.textLight },
  qText: { flex: 1, ...typography.body, color: colors.text, fontWeight: '600', lineHeight: 22 },
  answerInput: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, ...typography.bodySmall, color: colors.text, minHeight: 80, lineHeight: 20 },
  notesInput: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, ...typography.bodySmall, color: colors.text, minHeight: 72, lineHeight: 20 },

  // Summary step
  quickStatRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  quickStat: { flex: 1, alignItems: 'center', gap: 3 },
  quickStatVal: { ...typography.h4, color: colors.text, fontWeight: '900' },
  quickStatLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  perfCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4 },
  perfHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  perfTitle: { ...typography.body, fontWeight: '800' },
  bigStatRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  bigStat: { alignItems: 'center', gap: 3 },
  bigStatVal: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  bigStatLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '500', textAlign: 'center' },

  metricBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  metricBarLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 80 },
  metricBarLabelText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  metricBarVal: { fontSize: 12, fontWeight: '800', width: 36, textAlign: 'right' },

  vizRow: { flexDirection: 'row', height: 100, gap: spacing.sm, alignItems: 'flex-end', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border + '40' },
  vizBar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%' },
  vizFill: { width: '70%', borderRadius: 4, minHeight: 6 },
  vizLabel: { fontSize: 9, color: colors.textSecondary, textAlign: 'center' },
  vizNum: { fontSize: 11, fontWeight: '800', color: colors.text },

  reflectRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  reflectQ: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', fontWeight: '600', marginBottom: 3 },
  reflectA: { fontSize: 13, color: colors.text, lineHeight: 18 },

  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.xs },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: borderRadius.md },
  ctaDisabled: { opacity: 0.6 },
  ctaBtnText: { ...typography.body, color: colors.textLight, fontWeight: '800', fontSize: 17 },
  skipBtn: { alignItems: 'center', paddingVertical: 4 },
  skipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
});
