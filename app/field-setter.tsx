import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FIELD_SIZE = Math.min(SCREEN_WIDTH - spacing.md * 2, 380);
const FIELD_RADIUS = FIELD_SIZE / 2;
const INNER_CIRCLE_RADIUS = FIELD_RADIUS * 0.43;
const FIELDER_SIZE = 34;
const FIELDER_HALF = FIELDER_SIZE / 2;

interface FielderPosition {
  id: number;
  label: string;
  shortLabel: string;
  color: string;
  x: number;
  y: number;
}

const DEFAULT_POSITIONS: Omit<FielderPosition, 'x' | 'y'>[] = [
  { id: 0,  label: 'Bowler',       shortLabel: 'B',  color: '#E53935' },
  { id: 1,  label: 'Wicketkeeper', shortLabel: 'WK', color: '#1565C0' },
  { id: 2,  label: 'Slip',         shortLabel: 'SL', color: '#2E7D32' },
  { id: 3,  label: 'Point',        shortLabel: 'PT', color: '#2E7D32' },
  { id: 4,  label: 'Cover',        shortLabel: 'CV', color: '#2E7D32' },
  { id: 5,  label: 'Mid-Off',      shortLabel: 'MO', color: '#2E7D32' },
  { id: 6,  label: 'Mid-On',       shortLabel: 'MN', color: '#2E7D32' },
  { id: 7,  label: 'Square Leg',   shortLabel: 'SQ', color: '#2E7D32' },
  { id: 8,  label: 'Fine Leg',     shortLabel: 'FL', color: '#2E7D32' },
  { id: 9,  label: 'Deep Cover',   shortLabel: 'DC', color: '#2E7D32' },
  { id: 10, label: 'Long On',      shortLabel: 'LO', color: '#2E7D32' },
];

const INITIAL_XY: [number, number][] = [
  [ 0.00,  0.32],
  [ 0.05, -0.22],
  [ 0.50,  0.80],
  [ 0.50,  0.28],
  [ 0.82,  0.08],
  [-0.28, -0.62],
  [-0.38, -0.26],
  [-0.38,  0.45],
  [-0.35,  0.82],
  [ 0.52, -0.62],
  [-0.88,  0.05],
];

function getInitialFielders(): FielderPosition[] {
  return DEFAULT_POSITIONS.map((f, i) => ({
    ...f,
    x: INITIAL_XY[i][0],
    y: INITIAL_XY[i][1],
  }));
}

// ─── Draggable Fielder ───────────────────────────────────────────────────────
interface DraggableFielderProps {
  fielder: FielderPosition;
  fieldRadius: number;
  onPositionChange: (id: number, nx: number, ny: number) => void;
  onTap: (fielder: FielderPosition) => void;
}

function DraggableFielder({ fielder, fieldRadius, onPositionChange, onTap }: DraggableFielderProps) {
  const translateX = useSharedValue(fieldRadius + fielder.x * fieldRadius - FIELDER_HALF);
  const translateY = useSharedValue(fieldRadius + fielder.y * fieldRadius - FIELDER_HALF);
  const scale = useSharedValue(1);
  const isActive = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const didMove = useSharedValue(false);

  const updatePosition = useCallback(
    (nx: number, ny: number) => onPositionChange(fielder.id, nx, ny),
    [fielder.id, onPositionChange]
  );
  const handleTap = useCallback(() => onTap(fielder), [fielder, onTap]);

  const panGesture = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.3);
      isActive.value = true;
      didMove.value = false;
    })
    .onUpdate((e) => {
      didMove.value = true;
      const newPx = startX.value + e.translationX;
      const newPy = startY.value + e.translationY;
      const nx = (newPx + FIELDER_HALF - fieldRadius) / fieldRadius;
      const ny = (newPy + FIELDER_HALF - fieldRadius) / fieldRadius;
      const dist = Math.sqrt(nx * nx + ny * ny);
      let cnx = nx; let cny = ny;
      if (dist > 0.93) { const s = 0.93 / dist; cnx = nx * s; cny = ny * s; }
      translateX.value = fieldRadius + cnx * fieldRadius - FIELDER_HALF;
      translateY.value = fieldRadius + cny * fieldRadius - FIELDER_HALF;
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      isActive.value = false;
      const nx = (translateX.value + FIELDER_HALF - fieldRadius) / fieldRadius;
      const ny = (translateY.value + FIELDER_HALF - fieldRadius) / fieldRadius;
      if (didMove.value) runOnJS(updatePosition)(nx, ny);
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => { runOnJS(handleTap)(); });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: isActive.value ? 99 : 1,
    elevation: isActive.value ? 14 : 4,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.fielder,
          { backgroundColor: fielder.color, position: 'absolute', top: 0, left: 0 },
          animatedStyle,
        ]}
      >
        <Text style={styles.fielderLabel} numberOfLines={1}>{fielder.shortLabel}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Stepper Cell (compact, single row) ─────────────────────────────────────
interface StepperCellProps {
  value: string | number;
  label: string;
  valueColor: string;
  onIncrement: () => void;
  onDecrement: () => void;
  isAuto?: boolean;
}

function StepperCell({ value, label, valueColor, onIncrement, onDecrement, isAuto }: StepperCellProps) {
  return (
    <View style={scStyles.cell}>
      {!isAuto && (
        <Pressable style={scStyles.arrowBtn} onPress={onIncrement} hitSlop={6}>
          <Text style={scStyles.arrow}>▲</Text>
        </Pressable>
      )}
      <Text
        style={[scStyles.value, { color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={scStyles.label} numberOfLines={2}>{label}</Text>
      {!isAuto && (
        <Pressable style={scStyles.arrowBtn} onPress={onDecrement} hitSlop={6}>
          <Text style={scStyles.arrow}>▼</Text>
        </Pressable>
      )}
      {isAuto && <View style={{ height: 28 }} />}
    </View>
  );
}

const scStyles = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginHorizontal: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  arrowBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  arrow: {
    fontSize: 11,
    color: '#bbb',
    lineHeight: 14,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  label: {
    fontSize: 10,
    color: '#888',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 2,
  },
});

// ─── Rating Row ───────────────────────────────────────────────────────────────
function RatingRow({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color }}>{value}/10</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={{
              flex: 1, height: 28, borderRadius: 5,
              backgroundColor: n <= value ? color : '#eee',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '700', color: n <= value ? '#fff' : '#bbb' }}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Cricket Oval ────────────────────────────────────────────────────────────
function CricketOval({ fieldSize }: { fieldSize: number }) {
  const r = fieldSize / 2;
  const innerR = INNER_CIRCLE_RADIUS;
  const pitchW = fieldSize * 0.07;
  const pitchH = fieldSize * 0.28;
  return (
    <View style={{ width: fieldSize, height: fieldSize, position: 'absolute' }}>
      <View style={{ position: 'absolute', width: fieldSize, height: fieldSize, borderRadius: r, backgroundColor: '#3A7D44' }} />
      <View style={{ position: 'absolute', width: fieldSize - 8, height: fieldSize - 8, borderRadius: (fieldSize - 8) / 2, borderWidth: 2, borderColor: '#fff', top: 4, left: 4 }} />
      <View style={{ position: 'absolute', width: innerR * 2, height: innerR * 2, borderRadius: innerR, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed', top: r - innerR, left: r - innerR }} />
      <View style={{ position: 'absolute', width: pitchW, height: pitchH, backgroundColor: '#C8A96E', borderRadius: 4, top: r - pitchH / 2, left: r - pitchW / 2, borderWidth: 1, borderColor: '#A08050' }} />
      <View style={{ position: 'absolute', width: pitchW + 10, height: 1.5, backgroundColor: '#fff', top: r - pitchH / 2 + pitchH * 0.18, left: r - (pitchW + 10) / 2 }} />
      <View style={{ position: 'absolute', width: pitchW + 10, height: 1.5, backgroundColor: '#fff', top: r - pitchH / 2 + pitchH * 0.82, left: r - (pitchW + 10) / 2 }} />
      <View style={{ position: 'absolute', flexDirection: 'row', gap: 3, top: r - pitchH / 2 + 4, left: r - 6 }}>
        {[0,1,2].map(i => <View key={i} style={{ width: 3, height: 10, backgroundColor: '#fff', borderRadius: 1 }} />)}
      </View>
      <View style={{ position: 'absolute', flexDirection: 'row', gap: 3, top: r + pitchH / 2 - 14, left: r - 6 }}>
        {[0,1,2].map(i => <View key={i} style={{ width: 3, height: 10, backgroundColor: '#fff', borderRadius: 1 }} />)}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FieldSetterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // resetKey forces DraggableFielder remount on reset
  const [resetKey, setResetKey] = useState(0);
  const [fielders, setFielders] = useState<FielderPosition[]>(getInitialFielders());
  const [editingFielder, setEditingFielder] = useState<FielderPosition | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editShort, setEditShort] = useState('');

  // Match situation
  const [runsNeeded, setRunsNeeded] = useState(25);
  const [ballsLeft, setBallsLeft] = useState(15);
  const [wickets, setWickets] = useState(9);
  const reqRR = ballsLeft > 0 ? ((runsNeeded * 6) / ballsLeft).toFixed(1) : '—';

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Save Session state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Questionnaire fields
  const [qBallsFaced, setQBallsFaced] = useState('');
  const [qRunsScored, setQRunsScored] = useState('');
  const [qFieldReading, setQFieldReading] = useState(5);
  const [qShotSelection, setQShotSelection] = useState<boolean | null>(null);
  const [qAdaptedPlan, setQAdaptedPlan] = useState(5);
  const [qConfidence, setQConfidence] = useState(5);
  const [qOverallMood, setQOverallMood] = useState(5);
  const [qNotes, setQNotes] = useState('');

  // Fielder callbacks
  const handlePositionChange = useCallback((id: number, nx: number, ny: number) => {
    setFielders(prev => prev.map(f => f.id === id ? { ...f, x: nx, y: ny } : f));
  }, []);

  const handleFielderTap = useCallback((fielder: FielderPosition) => {
    setEditingFielder(fielder);
    setEditLabel(fielder.label);
    setEditShort(fielder.shortLabel);
  }, []);

  const handleSaveFielderName = () => {
    if (!editingFielder) return;
    const newShort = editShort.trim().toUpperCase().slice(0, 3) || editingFielder.shortLabel;
    const newLabel = editLabel.trim() || editingFielder.label;
    setFielders(prev => prev.map(f =>
      f.id === editingFielder.id ? { ...f, label: newLabel, shortLabel: newShort } : f
    ));
    setEditingFielder(null);
  };

  // Reset - increment resetKey to force DraggableFielder remount
  const handleResetField = () => {
    const fresh = getInitialFielders();
    setFielders(fresh);
    setResetKey(k => k + 1);
  };

  const handleSaveSession = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const balls = parseInt(qBallsFaced) || 0;
      const runs = parseInt(qRunsScored) || 0;
      const notesStr = `Balls Faced: ${balls} | Runs Scored: ${runs}${qNotes ? ' | ' + qNotes : ''}`;
      await supabase.from('tactical_drill_logs').insert({
        user_id: user.id,
        drill_name: 'Scenario Builder',
        time_elapsed: elapsed,
        field_reading: qFieldReading,
        shot_selection_matched: qShotSelection ?? false,
        adapted_plan: qAdaptedPlan,
        confidence_pressure: qConfidence,
        overall_mood: qOverallMood,
        confidence: qConfidence,
        session_notes: notesStr,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setShowSaveModal(false);
        setSaveSuccess(false);
        // Reset questionnaire
        setQBallsFaced('');
        setQRunsScored('');
        setQFieldReading(5);
        setQShotSelection(null);
        setQAdaptedPlan(5);
        setQConfidence(5);
        setQOverallMood(5);
        setQNotes('');
        setTimerRunning(false);
        setElapsed(0);
      }, 1500);
    } catch (_) {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const fieldSize = FIELD_SIZE;
  const fieldRadius = fieldSize / 2;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Scenario Builder</Text>
            <Text style={styles.headerSub}>Drag fielders · Tap to rename</Text>
          </View>
          <Pressable style={styles.headerBtn} onPress={handleResetField} hitSlop={8}>
            <MaterialIcons name="refresh" size={22} color="#fff" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 16, 32) }}>
          {/* Field */}
          <View style={styles.fieldWrapper}>
            <View style={[styles.fieldContainer, { width: fieldSize, height: fieldSize }]}>
              <CricketOval fieldSize={fieldSize} />
              {fielders.map(fielder => (
                <DraggableFielder
                  key={`${fielder.id}-${resetKey}`}
                  fielder={fielder}
                  fieldRadius={fieldRadius}
                  onPositionChange={handlePositionChange}
                  onTap={handleFielderTap}
                />
              ))}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            {[
              { color: '#E53935', label: 'Bowler' },
              { color: '#1565C0', label: 'Wicketkeeper' },
              { color: '#2E7D32', label: 'Fielders' },
            ].map(item => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Match Situation */}
          <View style={styles.matchCard}>
            <View style={styles.matchCardHeader}>
              <View style={styles.matchCardDot} />
              <Text style={styles.matchCardTitle}>Match Situation</Text>
            </View>
            <View style={styles.stepperRow}>
              <StepperCell
                value={runsNeeded}
                label={'runs needed'}
                valueColor="#E53935"
                onIncrement={() => setRunsNeeded(v => v + 1)}
                onDecrement={() => setRunsNeeded(v => Math.max(0, v - 1))}
              />
              <StepperCell
                value={ballsLeft}
                label={'balls left'}
                valueColor="#1565C0"
                onIncrement={() => setBallsLeft(v => v + 1)}
                onDecrement={() => setBallsLeft(v => Math.max(0, v - 1))}
              />
              <StepperCell
                value={wickets}
                label={'wickets'}
                valueColor="#2E7D32"
                onIncrement={() => setWickets(v => Math.min(10, v + 1))}
                onDecrement={() => setWickets(v => Math.max(0, v - 1))}
              />
              <StepperCell
                value={reqRR}
                label={'req. RR'}
                valueColor="#7B2FBE"
                onIncrement={() => {}}
                onDecrement={() => {}}
                isAuto
              />
            </View>
          </View>

          {/* Timer */}
          <View style={styles.timerCard}>
            <Text style={styles.timerDisplay}>{formatTime(elapsed)}</Text>
            <View style={styles.timerBar}>
              <View style={styles.timerBarTrack}>
                <View style={[styles.timerBarFill, { width: `${Math.min(100, (elapsed / 1200) * 100)}%` }]} />
              </View>
            </View>
            <Text style={styles.timerHint}>
              {timerRunning ? 'Scenario in progress' : elapsed > 0 ? 'Scenario paused' : 'Press Start to begin'}
            </Text>
          </View>

          {/* Start / Pause */}
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              if (timerRunning) {
                setTimerRunning(false);
              } else if (elapsed > 0) {
                setTimerRunning(true);
              } else {
                setElapsed(0);
                setTimerRunning(true);
              }
            }}
          >
            <MaterialIcons name={timerRunning ? 'pause' : 'play-arrow'} size={24} color="#fff" />
            <Text style={styles.startBtnText}>
              {timerRunning ? 'Pause Scenario' : elapsed > 0 ? 'Resume Scenario' : 'Start Scenario'}
            </Text>
          </Pressable>

          {elapsed > 0 && !timerRunning && (
            <Pressable
              style={styles.saveSessionBtn}
              onPress={() => setShowSaveModal(true)}
            >
              <MaterialIcons name="save" size={20} color="#fff" />
              <Text style={styles.saveSessionText}>Save Session</Text>
            </Pressable>
          )}

          {elapsed > 0 && (
            <Pressable
              style={styles.resetTimerBtn}
              onPress={() => { setTimerRunning(false); setElapsed(0); }}
            >
              <Text style={styles.resetTimerText}>Reset Timer</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* ── Edit Fielder Name Modal ── */}
        <Modal
          visible={!!editingFielder}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingFielder(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.editModal}>
              <View style={styles.modalHandle} />
              <Text style={styles.editModalTitle}>Edit Fielder Name</Text>
              <Text style={styles.editModalSub}>Changes position label on the field</Text>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="e.g. Long Off"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                selectTextOnFocus
              />
              <Text style={styles.inputLabel}>Short Label (max 3 chars)</Text>
              <TextInput
                style={styles.textInput}
                value={editShort}
                onChangeText={v => setEditShort(v.toUpperCase().slice(0, 3))}
                placeholder="e.g. LO"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                maxLength={3}
              />
              <View style={styles.editModalBtns}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditingFielder(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSaveFielderName}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Save Session Questionnaire Modal ── */}
        <Modal
          visible={showSaveModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSaveModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.saveModal}>
              <View style={styles.modalHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={styles.editModalTitle}>Save Session</Text>
                <Pressable onPress={() => setShowSaveModal(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.editModalSub}>Duration: {formatTime(elapsed)} · Log your performance</Text>

              {saveSuccess ? (
                <View style={styles.successBox}>
                  <MaterialIcons name="check-circle" size={48} color={colors.success} />
                  <Text style={styles.successText}>Session Saved!</Text>
                  <Text style={styles.successSub}>View in Analytics → Tactical</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                  {/* Balls & Runs */}
                  <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Balls Faced</Text>
                      <TextInput
                        style={styles.textInput}
                        value={qBallsFaced}
                        onChangeText={setQBallsFaced}
                        keyboardType="numeric"
                        placeholder="e.g. 18"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Runs Scored</Text>
                      <TextInput
                        style={styles.textInput}
                        value={qRunsScored}
                        onChangeText={setQRunsScored}
                        keyboardType="numeric"
                        placeholder="e.g. 24"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>

                  <RatingRow
                    label="Field Reading"
                    value={qFieldReading}
                    onChange={setQFieldReading}
                    color="#2196F3"
                  />
                  <RatingRow
                    label="Adapted to Plan"
                    value={qAdaptedPlan}
                    onChange={setQAdaptedPlan}
                    color="#FF9800"
                  />
                  <RatingRow
                    label="Confidence Under Pressure"
                    value={qConfidence}
                    onChange={setQConfidence}
                    color="#9C27B0"
                  />
                  <RatingRow
                    label="Overall Mood"
                    value={qOverallMood}
                    onChange={setQOverallMood}
                    color="#4CAF50"
                  />

                  {/* Shot selection */}
                  <Text style={[styles.inputLabel, { marginBottom: 8 }]}>Shot Selection Matched Plan?</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                    {[true, false].map(opt => (
                      <Pressable
                        key={String(opt)}
                        onPress={() => setQShotSelection(opt)}
                        style={[
                          styles.boolBtn,
                          qShotSelection === opt && { backgroundColor: opt ? colors.success : colors.error, borderColor: opt ? colors.success : colors.error },
                        ]}
                      >
                        <Text style={[styles.boolBtnText, qShotSelection === opt && { color: '#fff' }]}>
                          {opt ? 'Yes' : 'No'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Session Notes (optional)</Text>
                  <TextInput
                    style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
                    value={qNotes}
                    onChangeText={setQNotes}
                    placeholder="What worked? What to improve?"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                  />

                  <Pressable
                    style={[styles.saveBtn, { marginTop: spacing.sm, paddingVertical: 16 }]}
                    onPress={handleSaveSession}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={[styles.saveBtnText, { fontSize: 16 }]}>Save & Close</Text>
                    )}
                  </Pressable>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2A1A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  headerBtn: {
    width: 38, height: 38, borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  fieldWrapper: { alignItems: 'center', paddingVertical: spacing.md },
  fieldContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: FIELD_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  fielder: {
    width: FIELDER_SIZE, height: FIELDER_SIZE,
    borderRadius: FIELDER_HALF,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2, borderColor: '#fff',
  },
  fielderLabel: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  legendText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  matchCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  matchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  matchCardDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: '#FF9800',
  },
  matchCardTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  stepperRow: { flexDirection: 'row' },

  timerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  timerDisplay: {
    fontSize: 56, fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  timerBar: { width: '100%', marginBottom: spacing.sm },
  timerBarTrack: { height: 4, backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' },
  timerBarFill: { height: '100%', backgroundColor: '#FF6B35', borderRadius: 2 },
  timerHint: { fontSize: 12, color: '#aaa', fontWeight: '500' },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#E84C3D',
    borderRadius: 14,
    marginHorizontal: spacing.md,
    paddingVertical: 18,
    shadowColor: '#E84C3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: spacing.sm,
  },
  startBtnText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  saveSessionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    marginHorizontal: spacing.md,
    paddingVertical: 15,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: spacing.sm,
  },
  saveSessionText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  resetTimerBtn: {
    alignItems: 'center', paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
  },
  resetTimerText: { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xl * 2,
  },
  saveModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  editModalTitle: { ...typography.h3, color: colors.text, marginBottom: 4 },
  editModalSub: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.lg },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: 16, color: colors.text,
    backgroundColor: colors.background, fontWeight: '600', marginBottom: spacing.md,
  },
  editModalBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  saveBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  boolBtn: {
    flex: 1, paddingVertical: 12, borderRadius: borderRadius.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  boolBtnText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },

  successBox: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  successText: { fontSize: 22, fontWeight: '800', color: colors.success, marginTop: spacing.md },
  successSub: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});
