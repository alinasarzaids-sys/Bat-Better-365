import React, { useState, useCallback } from 'react';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Field dimensions
const FIELD_SIZE = Math.min(SCREEN_WIDTH - spacing.md * 2, 400);
const FIELD_RADIUS = FIELD_SIZE / 2;
const INNER_CIRCLE_RADIUS = FIELD_RADIUS * 0.43; // 30-yard circle
const FIELDER_SIZE = 32;
const FIELDER_HALF = FIELDER_SIZE / 2;

interface Scenario {
  target: string;
  currentScore: string;
  wickets: string;
  ballsRemaining: string;
}

interface FielderPosition {
  id: number;
  label: string;
  shortLabel: string;
  color: string;
  x: number; // relative to field center (-1 to 1)
  y: number; // relative to field center (-1 to 1)
  isFixed?: boolean;
}

// Default fielder positions (normalized -1 to 1 relative to field center)
// These represent a typical off-side heavy field
const DEFAULT_POSITIONS: Omit<FielderPosition, 'x' | 'y'>[] = [
  { id: 0, label: 'Bowler', shortLabel: 'B', color: '#E53935', isFixed: false },
  { id: 1, label: 'Wicketkeeper', shortLabel: 'WK', color: '#1565C0', isFixed: false },
  { id: 2, label: 'Slip', shortLabel: 'SL', color: '#2E7D32', isFixed: false },
  { id: 3, label: 'Point', shortLabel: 'PT', color: '#2E7D32', isFixed: false },
  { id: 4, label: 'Cover', shortLabel: 'CV', color: '#2E7D32', isFixed: false },
  { id: 5, label: 'Mid-Off', shortLabel: 'MO', color: '#2E7D32', isFixed: false },
  { id: 6, label: 'Mid-On', shortLabel: 'MN', color: '#2E7D32', isFixed: false },
  { id: 7, label: 'Square Leg', shortLabel: 'SQ', color: '#2E7D32', isFixed: false },
  { id: 8, label: 'Fine Leg', shortLabel: 'FL', color: '#2E7D32', isFixed: false },
  { id: 9, label: 'Deep Cover', shortLabel: 'DC', color: '#2E7D32', isFixed: false },
  { id: 10, label: 'Long On', shortLabel: 'LO', color: '#2E7D32', isFixed: false },
];

const INITIAL_XY: [number, number][] = [
  [0, -0.15],       // Bowler (top of pitch)
  [0.12, 0.2],      // Wicketkeeper (behind stumps)
  [0.18, 0.28],     // Slip
  [0.55, 0.1],      // Point
  [0.55, -0.28],    // Cover
  [0.22, -0.55],    // Mid-Off
  [-0.22, -0.55],   // Mid-On
  [-0.55, 0.1],     // Square Leg
  [-0.28, 0.72],    // Fine Leg
  [0.72, -0.45],    // Deep Cover
  [-0.5, -0.72],    // Long On
];

function getInitialFielders(): FielderPosition[] {
  return DEFAULT_POSITIONS.map((f, i) => ({
    ...f,
    x: INITIAL_XY[i][0],
    y: INITIAL_XY[i][1],
  }));
}

// Convert normalized coords to pixel position (top-left of fielder)
function toPixel(normalized: number, fieldRadius: number): number {
  return fieldRadius + normalized * fieldRadius - FIELDER_HALF;
}

// Convert pixel position back to normalized
function toNormalized(pixel: number, fieldRadius: number): number {
  return (pixel + FIELDER_HALF - fieldRadius) / fieldRadius;
}

// Clamp fielder inside boundary circle
function clampToField(nx: number, ny: number): [number, number] {
  const dist = Math.sqrt(nx * nx + ny * ny);
  if (dist > 0.93) {
    const scale = 0.93 / dist;
    return [nx * scale, ny * scale];
  }
  return [nx, ny];
}

// ─── Draggable Fielder Component ──────────────────────────────────────────────
interface DraggableFielderProps {
  fielder: FielderPosition;
  fieldRadius: number;
  onPositionChange: (id: number, nx: number, ny: number) => void;
}

function DraggableFielder({ fielder, fieldRadius, onPositionChange }: DraggableFielderProps) {
  const translateX = useSharedValue(toPixel(fielder.x, fieldRadius));
  const translateY = useSharedValue(toPixel(fielder.y, fieldRadius));
  const scale = useSharedValue(1);
  const isActive = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const updatePosition = useCallback(
    (nx: number, ny: number) => {
      onPositionChange(fielder.id, nx, ny);
    },
    [fielder.id, onPositionChange]
  );

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.25);
      isActive.value = true;
    })
    .onUpdate((e) => {
      const newPx = startX.value + e.translationX;
      const newPy = startY.value + e.translationY;
      const nx = (newPx + FIELDER_HALF - fieldRadius) / fieldRadius;
      const ny = (newPy + FIELDER_HALF - fieldRadius) / fieldRadius;
      const dist = Math.sqrt(nx * nx + ny * ny);
      let cnx = nx;
      let cny = ny;
      if (dist > 0.93) {
        const s = 0.93 / dist;
        cnx = nx * s;
        cny = ny * s;
      }
      translateX.value = fieldRadius + cnx * fieldRadius - FIELDER_HALF;
      translateY.value = fieldRadius + cny * fieldRadius - FIELDER_HALF;
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      isActive.value = false;
      const nx = (translateX.value + FIELDER_HALF - fieldRadius) / fieldRadius;
      const ny = (translateY.value + FIELDER_HALF - fieldRadius) / fieldRadius;
      runOnJS(updatePosition)(nx, ny);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: isActive.value ? 99 : 1,
    shadowOpacity: isActive.value ? 0.4 : 0.15,
    elevation: isActive.value ? 12 : 4,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.fielder,
          {
            backgroundColor: fielder.color,
            position: 'absolute',
            top: 0,
            left: 0,
          },
          animatedStyle,
        ]}
      >
        <Text style={styles.fielderLabel}>{fielder.shortLabel}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Scenario Bar ──────────────────────────────────────────────────────────────
interface ScenarioBarProps {
  scenario: Scenario;
}

function ScenarioBar({ scenario }: ScenarioBarProps) {
  const target = parseInt(scenario.target) || 0;
  const current = parseInt(scenario.currentScore) || 0;
  const wickets = parseInt(scenario.wickets) || 0;
  const balls = parseInt(scenario.ballsRemaining) || 0;
  const runsRequired = Math.max(0, target - current);
  const wicketsInHand = Math.max(0, 10 - wickets);
  const oversRemaining = (balls / 6).toFixed(1);

  const items = [
    { label: 'Target', value: target > 0 ? String(target) : '—', color: colors.warning },
    { label: 'Req.', value: runsRequired > 0 ? String(runsRequired) : '—', color: '#E53935' },
    { label: 'Balls Left', value: balls > 0 ? String(balls) : '—', color: colors.primary },
    { label: 'Wkts', value: wicketsInHand > 0 ? String(wicketsInHand) : '—', color: '#2E7D32' },
  ];

  return (
    <View style={styles.scenarioBar}>
      {items.map((item, i) => (
        <View key={i} style={styles.scenarioItem}>
          <Text style={[styles.scenarioValue, { color: item.color }]}>{item.value}</Text>
          <Text style={styles.scenarioLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── 2D Cricket Oval ─────────────────────────────────────────────────────────
function CricketOval({ fieldSize }: { fieldSize: number }) {
  const r = fieldSize / 2;
  const innerR = INNER_CIRCLE_RADIUS;
  const pitchW = fieldSize * 0.07;
  const pitchH = fieldSize * 0.28;

  return (
    <View style={{ width: fieldSize, height: fieldSize, position: 'absolute' }}>
      {/* Outfield */}
      <View
        style={{
          position: 'absolute',
          width: fieldSize,
          height: fieldSize,
          borderRadius: r,
          backgroundColor: '#3A7D44',
        }}
      />
      {/* Boundary ring */}
      <View
        style={{
          position: 'absolute',
          width: fieldSize - 8,
          height: fieldSize - 8,
          borderRadius: (fieldSize - 8) / 2,
          borderWidth: 2,
          borderColor: '#fff',
          top: 4,
          left: 4,
        }}
      />
      {/* Inner circle (30-yard) */}
      <View
        style={{
          position: 'absolute',
          width: innerR * 2,
          height: innerR * 2,
          borderRadius: innerR,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.5)',
          borderStyle: 'dashed',
          top: r - innerR,
          left: r - innerR,
        }}
      />
      {/* Pitch */}
      <View
        style={{
          position: 'absolute',
          width: pitchW,
          height: pitchH,
          backgroundColor: '#C8A96E',
          borderRadius: 4,
          top: r - pitchH / 2,
          left: r - pitchW / 2,
          borderWidth: 1,
          borderColor: '#A08050',
        }}
      />
      {/* Crease lines */}
      <View
        style={{
          position: 'absolute',
          width: pitchW + 10,
          height: 1.5,
          backgroundColor: '#fff',
          top: r - pitchH / 2 + pitchH * 0.18,
          left: r - (pitchW + 10) / 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: pitchW + 10,
          height: 1.5,
          backgroundColor: '#fff',
          top: r - pitchH / 2 + pitchH * 0.82,
          left: r - (pitchW + 10) / 2,
        }}
      />
      {/* Stumps top */}
      <View style={{ position: 'absolute', flexDirection: 'row', gap: 3, top: r - pitchH / 2 + 4, left: r - 6 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ width: 3, height: 10, backgroundColor: '#fff', borderRadius: 1 }} />
        ))}
      </View>
      {/* Stumps bottom */}
      <View style={{ position: 'absolute', flexDirection: 'row', gap: 3, top: r + pitchH / 2 - 14, left: r - 6 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ width: 3, height: 10, backgroundColor: '#fff', borderRadius: 1 }} />
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function FieldSetterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fielders, setFielders] = useState<FielderPosition[]>(getInitialFielders());
  const [scenario, setScenario] = useState<Scenario>({
    target: '',
    currentScore: '',
    wickets: '',
    ballsRemaining: '',
  });
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [draftScenario, setDraftScenario] = useState<Scenario>(scenario);
  const [showFielderList, setShowFielderList] = useState(false);
  const [selectedFielder, setSelectedFielder] = useState<FielderPosition | null>(null);

  // Use a fixed field size based on screen width
  const fieldSize = FIELD_SIZE;
  const fieldRadius = fieldSize / 2;

  const handlePositionChange = useCallback((id: number, nx: number, ny: number) => {
    setFielders(prev =>
      prev.map(f => (f.id === id ? { ...f, x: nx, y: ny } : f))
    );
  }, []);

  const handleResetField = () => {
    const initial = getInitialFielders();
    setFielders(initial);
  };

  const handleSaveScenario = () => {
    setScenario(draftScenario);
    setShowScenarioModal(false);
  };

  const hasScenario =
    scenario.target || scenario.currentScore || scenario.wickets || scenario.ballsRemaining;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Scenario Builder</Text>
            <Text style={styles.headerSub}>Drag fielders to position</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => {
                setDraftScenario(scenario);
                setShowScenarioModal(true);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="edit" size={20} color={colors.primary} />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={handleResetField} hitSlop={8}>
              <MaterialIcons name="refresh" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Scenario Bar */}
        {hasScenario ? (
          <ScenarioBar scenario={scenario} />
        ) : (
          <Pressable
            style={styles.scenarioPrompt}
            onPress={() => {
              setDraftScenario(scenario);
              setShowScenarioModal(true);
            }}
          >
            <MaterialIcons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.scenarioPromptText}>Tap to set match scenario</Text>
          </Pressable>
        )}

        {/* Field + Fielders */}
        <ScrollView
          contentContainerStyle={styles.fieldWrapper}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.fieldContainer,
              { width: fieldSize, height: fieldSize },
            ]}
          >
            <CricketOval fieldSize={fieldSize} />

            {/* Draggable Fielders */}
            {fielders.map(fielder => (
              <DraggableFielder
                key={fielder.id}
                fielder={fielder}
                fieldRadius={fieldRadius}
                onPositionChange={handlePositionChange}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom Legend */}
        <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
              <Text style={styles.legendText}>Bowler</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1565C0' }]} />
              <Text style={styles.legendText}>Wicketkeeper</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2E7D32' }]} />
              <Text style={styles.legendText}>Fielders (drag to move)</Text>
            </View>
          </View>
          <Pressable
            style={styles.fielderListBtn}
            onPress={() => setShowFielderList(true)}
          >
            <MaterialIcons name="list" size={16} color={colors.primary} />
            <Text style={styles.fielderListBtnText}>View All Positions</Text>
          </Pressable>
        </View>

        {/* ── Scenario Modal ── */}
        <Modal
          visible={showScenarioModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowScenarioModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.scenarioModalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Match Scenario</Text>
                <Pressable onPress={() => setShowScenarioModal(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalDesc}>
                  Set the match situation to display the required runs, balls, and wickets in hand.
                </Text>

                {/* Row 1 */}
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Target Score</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 185"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={draftScenario.target}
                      onChangeText={v => setDraftScenario(d => ({ ...d, target: v }))}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Current Score</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 120"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={draftScenario.currentScore}
                      onChangeText={v => setDraftScenario(d => ({ ...d, currentScore: v }))}
                    />
                  </View>
                </View>

                {/* Row 2 */}
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Wickets Fallen</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 4"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={draftScenario.wickets}
                      onChangeText={v => setDraftScenario(d => ({ ...d, wickets: v }))}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Balls Remaining</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 36"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={draftScenario.ballsRemaining}
                      onChangeText={v => setDraftScenario(d => ({ ...d, ballsRemaining: v }))}
                    />
                  </View>
                </View>

                <Pressable style={styles.saveBtn} onPress={handleSaveScenario}>
                  <Text style={styles.saveBtnText}>Apply Scenario</Text>
                </Pressable>

                {hasScenario && (
                  <Pressable
                    style={styles.clearBtn}
                    onPress={() => {
                      setScenario({ target: '', currentScore: '', wickets: '', ballsRemaining: '' });
                      setDraftScenario({ target: '', currentScore: '', wickets: '', ballsRemaining: '' });
                      setShowScenarioModal(false);
                    }}
                  >
                    <Text style={styles.clearBtnText}>Clear Scenario</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Fielder List Modal ── */}
        <Modal
          visible={showFielderList}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFielderList(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.scenarioModalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Field Positions</Text>
                <Pressable onPress={() => setShowFielderList(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {fielders.map(f => (
                  <View key={f.id} style={styles.fielderRow}>
                    <View style={[styles.fielderColorDot, { backgroundColor: f.color }]}>
                      <Text style={styles.fielderDotLabel}>{f.shortLabel}</Text>
                    </View>
                    <Text style={styles.fielderRowName}>{f.label}</Text>
                    <Text style={styles.fielderRowCoord}>
                      {(f.x >= 0 ? '+' : '') + f.x.toFixed(2)}, {(f.y >= 0 ? '+' : '') + f.y.toFixed(2)}
                    </Text>
                  </View>
                ))}
                <View style={{ height: spacing.xl }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A2A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  // Scenario bar
  scenarioBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  scenarioItem: {
    flex: 1,
    alignItems: 'center',
  },
  scenarioValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scenarioLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    fontWeight: '500',
  },
  scenarioPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  scenarioPromptText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  // Field
  fieldWrapper: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
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
  // Fielder node
  fielder: {
    width: FIELDER_SIZE,
    height: FIELDER_SIZE,
    borderRadius: FIELDER_HALF,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  fielderLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  // Bottom panel
  bottomPanel: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  legendText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  fielderListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  fielderListBtnText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  scenarioModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  clearBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Fielder list
  fielderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
    gap: spacing.md,
  },
  fielderColorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fielderDotLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
  },
  fielderRowName: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  fielderRowCoord: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
