import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { academyService } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SessionStats {
  sessionType: string;
  duration: string;
  intensity: number;
  logDate: string;
  // Batting
  ballsFaced: string;
  runsScored: string;
  // Bowling
  ballsBowled: string;
  wickets: string;
  runsConceded: string;
  // Fielding
  catches: string;
  runOuts: string;
  stumpings: string;
}

interface AIQuestion {
  question: string;
  answer: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SESSION_TYPES = [
  'Nets — Batting', 'Nets — Bowling', 'Nets — Mixed',
  'Match Practice', 'Fielding Drills', 'Fitness / Conditioning',
  'Skill Work', 'Team Training', 'Individual Training',
];

const INTENSITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Very Light', color: colors.success },
  2: { label: 'Light', color: colors.success },
  3: { label: 'Easy', color: colors.success },
  4: { label: 'Moderate', color: colors.warning },
  5: { label: 'Steady', color: colors.warning },
  6: { label: 'Challenging', color: colors.warning },
  7: { label: 'Hard', color: colors.error },
  8: { label: 'Very Hard', color: colors.error },
  9: { label: 'Intense', color: colors.error },
  10: { label: 'Maximum', color: colors.error },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[stepStyles.dot, i < current && stepStyles.dotDone, i === current && stepStyles.dotActive]} />
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.primary + '60', width: 24 },
  dotActive: { backgroundColor: colors.primary, width: 24 },
});

function StatInput({
  label, value, onChange, icon, iconColor, suffix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  icon: string; iconColor: string; suffix?: string;
}) {
  return (
    <View style={statStyles.block}>
      <View style={statStyles.iconRow}>
        <MaterialIcons name={icon as any} size={16} color={iconColor} />
        <Text style={[statStyles.label, { color: iconColor }]}>{label}</Text>
      </View>
      <View style={statStyles.inputRow}>
        <TextInput
          style={statStyles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textSecondary}
          textAlign="center"
          maxLength={4}
        />
        {suffix ? <Text style={statStyles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  block: { flex: 1, alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '700' },
  inputRow: { alignItems: 'center' },
  input: {
    width: 72, height: 56, borderRadius: borderRadius.md,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    fontSize: 22, fontWeight: '800', color: colors.text,
  },
  suffix: { fontSize: 10, color: colors.textSecondary, marginTop: 3 },
});

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

  const TOTAL_STEPS = 4; // setup → stats → AI questions → summary
  const [step, setStep] = useState(0);

  // Step 0 — Session setup
  const [sessionType, setSessionType] = useState('');
  const [duration, setDuration] = useState('60');
  const [intensity, setIntensity] = useState(5);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 1 — Stats
  const [stats, setStats] = useState<SessionStats>({
    sessionType: '', duration: '60', intensity: 5, logDate: new Date().toISOString().split('T')[0],
    ballsFaced: '', runsScored: '', ballsBowled: '', wickets: '', runsConceded: '',
    catches: '', runOuts: '', stumpings: '',
  });

  // Step 2 — AI Questions
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [notes, setNotes] = useState('');

  // Step 3 — Summary / Save
  const [saving, setSaving] = useState(false);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = async () => {
    if (step === 0) {
      if (!sessionType) { showAlert('Required', 'Please select a session type'); return; }
      if (!duration || parseInt(duration) < 1) { showAlert('Required', 'Please enter session duration'); return; }
      setStep(1);
    } else if (step === 1) {
      setStep(2);
      await loadAIQuestions();
    } else if (step === 2) {
      setStep(3);
    } else {
      await handleSave();
    }
  };

  const goBack = () => {
    if (step === 0) router.back();
    else setStep(s => s - 1);
  };

  // ── AI Question Generation ─────────────────────────────────────────────────
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
            duration_minutes: parseInt(duration),
            intensity,
            session_type: sessionType,
            balls_faced: stats.ballsFaced ? parseInt(stats.ballsFaced) : undefined,
            runs_scored: stats.runsScored ? parseInt(stats.runsScored) : undefined,
            balls_bowled: stats.ballsBowled ? parseInt(stats.ballsBowled) : undefined,
            wickets: stats.wickets ? parseInt(stats.wickets) : undefined,
            runs_conceded: stats.runsConceded ? parseInt(stats.runsConceded) : undefined,
            catches: stats.catches ? parseInt(stats.catches) : undefined,
            run_outs: stats.runOuts ? parseInt(stats.runOuts) : undefined,
            stumpings: stats.stumpings ? parseInt(stats.stumpings) : undefined,
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

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // Build notes from AI answers
    const answersText = questions
      .filter(q => q.answer.trim())
      .map(q => `Q: ${q.question}\nA: ${q.answer}`)
      .join('\n\n');
    const finalNotes = [notes.trim(), answersText].filter(Boolean).join('\n\n');

    const { error } = await academyService.logTraining({
      user_id: user.id,
      academy_id: academyId,
      log_date: logDate,
      session_type: sessionType,
      duration_minutes: parseInt(duration),
      intensity,
      balls_faced: stats.ballsFaced ? parseInt(stats.ballsFaced) : undefined,
      runs_scored: stats.runsScored ? parseInt(stats.runsScored) : undefined,
      balls_bowled: stats.ballsBowled ? parseInt(stats.ballsBowled) : undefined,
      wickets: stats.wickets ? parseInt(stats.wickets) : undefined,
      runs_conceded: stats.runsConceded ? parseInt(stats.runsConceded) : undefined,
      catches: stats.catches ? parseInt(stats.catches) : undefined,
      run_outs: stats.runOuts ? parseInt(stats.runOuts) : undefined,
      stumpings: stats.stumpings ? parseInt(stats.stumpings) : undefined,
      notes: finalNotes || undefined,
    });

    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    router.back();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  const intensityInfo = INTENSITY_LABELS[intensity];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name={step === 0 ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>
            {step === 0 ? 'Session Setup' : step === 1 ? 'Your Stats' : step === 2 ? 'Reflection' : 'Summary'}
          </Text>
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── STEP 0: Session Setup ─────────────────────────────────────── */}
          {step === 0 && (
            <>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>What did you train today?</Text>
                <Text style={styles.stepSubtitle}>Set up the basics of your session</Text>
              </View>

              {/* Date */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Session Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={logDate}
                  onChangeText={setLogDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Session Type */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Session Type</Text>
                <View style={styles.chipGrid}>
                  {SESSION_TYPES.map(t => (
                    <Pressable
                      key={t}
                      style={[styles.chip, sessionType === t && styles.chipActive]}
                      onPress={() => setSessionType(t)}
                    >
                      <Text style={[styles.chipText, sessionType === t && styles.chipTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Duration */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Duration (minutes)</Text>
                <View style={styles.durationRow}>
                  {['30', '45', '60', '90', '120'].map(d => (
                    <Pressable
                      key={d}
                      style={[styles.durationBtn, duration === d && styles.durationBtnActive]}
                      onPress={() => setDuration(d)}
                    >
                      <Text style={[styles.durationBtnText, duration === d && { color: colors.textLight }]}>{d}</Text>
                    </Pressable>
                  ))}
                  <TextInput
                    style={[styles.durationCustom, !['30', '45', '60', '90', '120'].includes(duration) && styles.durationCustomActive]}
                    value={['30', '45', '60', '90', '120'].includes(duration) ? '' : duration}
                    onChangeText={setDuration}
                    placeholder="Other"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              </View>

              {/* Intensity */}
              <View style={styles.card}>
                <View style={styles.intensityHeader}>
                  <Text style={styles.cardLabel}>Training Intensity</Text>
                  <View style={[styles.intensityBadge, { backgroundColor: intensityInfo.color + '20' }]}>
                    <Text style={[styles.intensityBadgeText, { color: intensityInfo.color }]}>
                      {intensity}/10 · {intensityInfo.label}
                    </Text>
                  </View>
                </View>
                <View style={[styles.intensityTrack, { backgroundColor: intensityInfo.color + '20' }]}>
                  <View style={[styles.intensityFill, { width: `${intensity * 10}%`, backgroundColor: intensityInfo.color }]} />
                </View>
                <View style={styles.intensityBtns}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                    const active = intensity === n;
                    return (
                      <Pressable
                        key={n}
                        style={[styles.intensityBtn, active && { backgroundColor: INTENSITY_LABELS[n].color }]}
                        onPress={() => setIntensity(n)}
                      >
                        <Text style={[styles.intensityBtnText, active && { color: colors.textLight }]}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* ── STEP 1: Position-specific Stats ──────────────────────────── */}
          {step === 1 && (
            <>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>How did the numbers look?</Text>
                <Text style={styles.stepSubtitle}>
                  Log your {position} stats from today's {sessionType}
                </Text>
              </View>

              {/* Batting */}
              {isBatter && (
                <View style={styles.card}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.pillIcon, { backgroundColor: colors.technical + '25' }]}>
                      <MaterialIcons name="sports-cricket" size={16} color={colors.technical} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.technical }]}>Batting</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <StatInput label="Balls Faced" value={stats.ballsFaced} onChange={v => setStats(p => ({ ...p, ballsFaced: v }))} icon="sports-cricket" iconColor={colors.technical} />
                    <StatInput label="Runs Scored" value={stats.runsScored} onChange={v => setStats(p => ({ ...p, runsScored: v }))} icon="trending-up" iconColor={colors.success} />
                  </View>
                  {stats.ballsFaced && stats.runsScored && parseInt(stats.ballsFaced) > 0 ? (
                    <View style={styles.calcBadge}>
                      <MaterialIcons name="calculate" size={14} color={colors.technical} />
                      <Text style={[styles.calcText, { color: colors.technical }]}>
                        Strike Rate: {Math.round((parseInt(stats.runsScored) / parseInt(stats.ballsFaced)) * 100)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Bowling */}
              {isBowler && (
                <View style={styles.card}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.pillIcon, { backgroundColor: colors.physical + '25' }]}>
                      <MaterialIcons name="sports-cricket" size={16} color={colors.physical} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.physical }]}>Bowling</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <StatInput label="Balls Bowled" value={stats.ballsBowled} onChange={v => setStats(p => ({ ...p, ballsBowled: v }))} icon="sports-cricket" iconColor={colors.physical} />
                    <StatInput label="Wickets" value={stats.wickets} onChange={v => setStats(p => ({ ...p, wickets: v }))} icon="star" iconColor={colors.warning} />
                    <StatInput label="Runs Given" value={stats.runsConceded} onChange={v => setStats(p => ({ ...p, runsConceded: v }))} icon="trending-down" iconColor={colors.error} />
                  </View>
                  {stats.ballsBowled && parseInt(stats.ballsBowled) > 0 ? (
                    <View style={styles.calcBadge}>
                      <MaterialIcons name="calculate" size={14} color={colors.physical} />
                      <Text style={[styles.calcText, { color: colors.physical }]}>
                        {Math.floor(parseInt(stats.ballsBowled) / 6)}.{parseInt(stats.ballsBowled) % 6} overs
                        {stats.wickets ? ` · ${stats.wickets} wkt` : ''}
                        {stats.runsConceded && parseInt(stats.ballsBowled) > 0
                          ? ` · Eco ${(parseInt(stats.runsConceded) / (parseInt(stats.ballsBowled) / 6)).toFixed(1)}`
                          : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Fielding / Keeping */}
              {(isFielder || isKeeper) && (
                <View style={styles.card}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.pillIcon, { backgroundColor: colors.tactical + '25' }]}>
                      <MaterialIcons name="sports-handball" size={16} color={colors.tactical} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.tactical }]}>Fielding {isKeeper ? '& Keeping' : ''}</Text>
                  </View>
                  <View style={styles.statsRow}>
                    <StatInput label="Catches" value={stats.catches} onChange={v => setStats(p => ({ ...p, catches: v }))} icon="sports-handball" iconColor={colors.tactical} />
                    <StatInput label="Run Outs" value={stats.runOuts} onChange={v => setStats(p => ({ ...p, runOuts: v }))} icon="flash-on" iconColor={colors.warning} />
                    {isKeeper && (
                      <StatInput label="Stumpings" value={stats.stumpings} onChange={v => setStats(p => ({ ...p, stumpings: v }))} icon="location-on" iconColor={colors.mental} />
                    )}
                  </View>
                </View>
              )}

              {/* Session summary recap */}
              <View style={styles.recapCard}>
                <MaterialIcons name="event" size={16} color={colors.textSecondary} />
                <Text style={styles.recapText}>{sessionType} · {duration}min · Intensity {intensity}/10</Text>
              </View>
            </>
          )}

          {/* ── STEP 2: AI Coaching Questions ─────────────────────────────── */}
          {step === 2 && (
            <>
              <View style={styles.stepHeader}>
                <View style={styles.aiHeaderIcon}>
                  <MaterialIcons name="psychology" size={28} color={colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Coach's Reflection</Text>
                <Text style={styles.stepSubtitle}>
                  AI-generated questions based on your {position} session. Answer as much or little as you like.
                </Text>
              </View>

              {aiLoading ? (
                <View style={styles.aiLoadingCard}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.aiLoadingText}>Generating coaching questions...</Text>
                  <Text style={styles.aiLoadingSubtext}>Analysing your {position} stats</Text>
                </View>
              ) : (
                <>
                  {questions.map((q, idx) => (
                    <View key={idx} style={styles.questionCard}>
                      <View style={styles.questionHeader}>
                        <View style={styles.questionNumCircle}>
                          <Text style={styles.questionNum}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.questionText}>{q.question}</Text>
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

                  {/* Extra notes */}
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>Additional Notes (Optional)</Text>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Anything else you want to record about today's session..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </>
              )}
            </>
          )}

          {/* ── STEP 3: Summary ───────────────────────────────────────────── */}
          {step === 3 && (
            <>
              <View style={styles.stepHeader}>
                <View style={[styles.summaryIcon, { backgroundColor: colors.success + '20' }]}>
                  <MaterialIcons name="check-circle" size={40} color={colors.success} />
                </View>
                <Text style={styles.stepTitle}>Session Summary</Text>
                <Text style={styles.stepSubtitle}>Review your training log before saving</Text>
              </View>

              {/* Session info */}
              <View style={styles.summaryCard}>
                <Text style={styles.summarySectionTitle}>Session Info</Text>
                <SummaryRow icon="event" label="Date" value={logDate} />
                <SummaryRow icon="sports" label="Type" value={sessionType} />
                <SummaryRow icon="timer" label="Duration" value={`${duration} minutes`} />
                <SummaryRow icon="flash-on" label="Intensity" value={`${intensity}/10 — ${intensityInfo.label}`} valueColor={intensityInfo.color} />
              </View>

              {/* Stats */}
              {(isBatter && (stats.ballsFaced || stats.runsScored)) ? (
                <View style={[styles.summaryCard, { borderLeftColor: colors.technical }]}>
                  <Text style={[styles.summarySectionTitle, { color: colors.technical }]}>Batting Stats</Text>
                  {stats.ballsFaced ? <SummaryRow icon="sports-cricket" label="Balls Faced" value={stats.ballsFaced} /> : null}
                  {stats.runsScored ? <SummaryRow icon="trending-up" label="Runs Scored" value={stats.runsScored} /> : null}
                  {stats.ballsFaced && stats.runsScored && parseInt(stats.ballsFaced) > 0 ? (
                    <SummaryRow icon="calculate" label="Strike Rate" value={String(Math.round((parseInt(stats.runsScored) / parseInt(stats.ballsFaced)) * 100))} />
                  ) : null}
                </View>
              ) : null}

              {(isBowler && (stats.ballsBowled || stats.wickets)) ? (
                <View style={[styles.summaryCard, { borderLeftColor: colors.physical }]}>
                  <Text style={[styles.summarySectionTitle, { color: colors.physical }]}>Bowling Stats</Text>
                  {stats.ballsBowled ? <SummaryRow icon="sports-cricket" label="Overs" value={`${Math.floor(parseInt(stats.ballsBowled) / 6)}.${parseInt(stats.ballsBowled) % 6}`} /> : null}
                  {stats.wickets ? <SummaryRow icon="star" label="Wickets" value={stats.wickets} /> : null}
                  {stats.runsConceded ? <SummaryRow icon="trending-down" label="Runs Conceded" value={stats.runsConceded} /> : null}
                </View>
              ) : null}

              {(isFielder && (stats.catches || stats.runOuts || stats.stumpings)) ? (
                <View style={[styles.summaryCard, { borderLeftColor: colors.tactical }]}>
                  <Text style={[styles.summarySectionTitle, { color: colors.tactical }]}>Fielding Stats</Text>
                  {stats.catches ? <SummaryRow icon="sports-handball" label="Catches" value={stats.catches} /> : null}
                  {stats.runOuts ? <SummaryRow icon="flash-on" label="Run Outs" value={stats.runOuts} /> : null}
                  {stats.stumpings ? <SummaryRow icon="location-on" label="Stumpings" value={stats.stumpings} /> : null}
                </View>
              ) : null}

              {/* Answered questions */}
              {questions.filter(q => q.answer.trim()).length > 0 ? (
                <View style={styles.summaryCard}>
                  <Text style={styles.summarySectionTitle}>Coach's Reflection</Text>
                  {questions.filter(q => q.answer.trim()).map((q, i) => (
                    <View key={i} style={styles.answerPreview}>
                      <Text style={styles.answerPreviewQ} numberOfLines={2}>{q.question}</Text>
                      <Text style={styles.answerPreviewA} numberOfLines={3}>{q.answer}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.md) }]}>
        <Pressable
          style={[styles.nextBtn, (saving || (step === 2 && aiLoading)) && styles.nextBtnDisabled]}
          onPress={goNext}
        >
          {saving ? (
            <ActivityIndicator color={colors.textLight} />
          ) : (
            <>
              <Text style={styles.nextBtnText}>
                {step === 0 ? 'Continue to Stats →'
                  : step === 1 ? 'Continue to Reflection →'
                  : step === 2 ? 'Review & Save →'
                  : 'Save Training Log'}
              </Text>
              {step === 3 && <MaterialIcons name="check-circle" size={20} color={colors.textLight} />}
            </>
          )}
        </Pressable>
        {step > 0 && (
          <Pressable style={styles.skipBtn} onPress={() => step === 2 ? setStep(3) : goNext()}>
            {step === 2 && !aiLoading ? <Text style={styles.skipText}>Skip reflection</Text> : null}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <View style={summaryRowStyles.row}>
      <MaterialIcons name={icon as any} size={15} color={colors.textSecondary} style={{ marginTop: 1 }} />
      <Text style={summaryRowStyles.label}>{label}</Text>
      <Text style={[summaryRowStyles.value, valueColor ? { color: valueColor, fontWeight: '700' } : {}]} numberOfLines={1}>{value}</Text>
    </View>
  );
}
const summaryRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  label: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  value: { fontSize: 13, color: colors.text, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
});

function getFallbackQuestions(position: string): string[] {
  if (position === 'Bowler') {
    return [
      'How was your line and length control today?',
      'Did you vary your pace and trajectory effectively?',
      'How did you handle batters who were playing you well?',
      'How was your physical stamina and run-up consistency?',
    ];
  }
  if (position === 'Fielder') {
    return [
      'How sharp was your concentration during drills?',
      'Were you proactive in your ground coverage and positioning?',
      'How confident were you in your throwing and catching?',
      'How did you handle any errors mentally during the session?',
    ];
  }
  if (position === 'Wicket-Keeper') {
    return [
      'How consistent was your footwork behind the stumps?',
      'Did you read the bowlers well and anticipate deliveries?',
      'How confident were you in your catching and stumping attempts?',
      'How did you communicate with the fielders around you?',
    ];
  }
  return [
    'How well did you judge which balls to attack vs defend?',
    'Describe your footwork and balance at the crease today.',
    'How did you handle any difficult deliveries or pressure moments?',
    'What specific technical aspect did you focus on improving?',
  ];
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingTop: spacing.sm, paddingBottom: 4,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.body, color: colors.text, fontWeight: '700', textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 100 },

  stepHeader: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.xs },
  stepTitle: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center' },
  stepSubtitle: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  aiHeaderIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  summaryIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },

  dateInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    ...typography.body, color: colors.text,
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },

  durationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  durationBtn: { width: 52, height: 44, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  durationBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  durationCustom: {
    flex: 1, minWidth: 60, height: 44, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: spacing.sm, textAlign: 'center', ...typography.body, color: colors.text,
  },
  durationCustomActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },

  intensityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  intensityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  intensityBadgeText: { fontSize: 12, fontWeight: '800' },
  intensityTrack: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: spacing.sm },
  intensityFill: { height: '100%', borderRadius: 5 },
  intensityBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  intensityBtnText: { fontSize: 11, fontWeight: '700', color: colors.text },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pillIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { ...typography.body, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  calcBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.background, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5, alignSelf: 'flex-start' },
  calcText: { fontSize: 12, fontWeight: '700' },

  recapCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  recapText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  aiLoadingCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  aiLoadingText: { ...typography.body, color: colors.text, fontWeight: '700' },
  aiLoadingSubtext: { ...typography.caption, color: colors.textSecondary },

  questionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.primary },
  questionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  questionNumCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  questionNum: { fontSize: 12, fontWeight: '800', color: colors.textLight },
  questionText: { flex: 1, ...typography.body, color: colors.text, fontWeight: '600', lineHeight: 22 },
  answerInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...typography.bodySmall, color: colors.text, minHeight: 80, lineHeight: 20,
  },
  notesInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...typography.bodySmall, color: colors.text, minHeight: 72, lineHeight: 20,
  },

  summaryCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary },
  summarySectionTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  answerPreview: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  answerPreviewQ: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 3, fontStyle: 'italic' },
  answerPreviewA: { fontSize: 13, color: colors.text, lineHeight: 18 },

  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.xs },
  nextBtn: { backgroundColor: colors.primary, paddingVertical: spacing.md + 2, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { ...typography.body, color: colors.textLight, fontWeight: '800', fontSize: 16 },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  skipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
});
