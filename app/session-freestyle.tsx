import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { sessionService } from '@/services/sessionService';
import { progressService } from '@/services/progressService';
import { useAuth, useAlert } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type TrainingType = 'bowling_machine' | 'bowler_spinner' | 'bowler_fast' | 'side_arm' | 'over_arm' | 'under_arm';

const TRAINING_TYPES = [
  { id: 'bowling_machine' as TrainingType, label: 'Bowling Machine', icon: 'sports-cricket' },
  { id: 'bowler_spinner' as TrainingType, label: 'Bowler (Spinner)', icon: 'sports-cricket' },
  { id: 'bowler_fast' as TrainingType, label: 'Bowler (Fast)', icon: 'sports-cricket' },
  { id: 'side_arm' as TrainingType, label: 'Side-Arm Throws', icon: 'sports-cricket' },
  { id: 'over_arm' as TrainingType, label: 'Over-Arm Throws', icon: 'sports-cricket' },
  { id: 'under_arm' as TrainingType, label: 'Under-Arm Throws', icon: 'sports-cricket' },
];

const SESSION_TIPS = [
  '💧 Stay hydrated - take water breaks every 15 minutes',
  '🎯 Focus on quality over quantity',
  '🧘 Practice your pre-shot routine before each ball',
  '👁️ Visualize each delivery and your response',
  '⚡ Maintain high intensity but listen to your body',
  '📝 Mental rehearsal between deliveries is key',
  '🎪 Vary your practice - don\'t just groove one shot',
  '🔄 Reset after mistakes - champions have short memories',
];

export default function FreestyleSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  // Step management (1: Setup, 2: Active, 3: Ratings, 4: Summary)
  const [currentStep, setCurrentStep] = useState(1);

  // If a date was passed from the calendar, pre-fill it and switch to 'later' mode
  const prefilledDateStr = params.date as string | undefined;
  const getInitialScheduledDate = () => {
    if (prefilledDateStr) {
      const [y, m, d] = prefilledDateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  };

  // Session timing mode
  const [sessionMode, setSessionMode] = useState<'now' | 'later'>(prefilledDateStr ? 'later' : 'now');
  const [scheduledDate, setScheduledDate] = useState<Date>(getInitialScheduledDate());
  const [scheduledTime, setScheduledTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Step 1: Pre-session setup
  const [selectedTrainingTypes, setSelectedTrainingTypes] = useState<Set<TrainingType>>(new Set());
  const [focusArea, setFocusArea] = useState('');
  const [sessionGoal, setSessionGoal] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('60');

  // Step 2: Active session
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [ballsFacedLive, setBallsFacedLive] = useState(0);
  const [ballsFacedInput, setBallsFacedInput] = useState('0');
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const tipRotation = useRef<NodeJS.Timeout | null>(null);

  // Step 3: Post-session ratings — Batting Stats
  const [ballsFaced, setBallsFaced] = useState('');
  const [ballsMiddled, setBallsMiddled] = useState('');
  const [boundariesHit, setBoundariesHit] = useState('');
  // Technical
  const [shotExecution, setShotExecution] = useState(0);
  const [footwork, setFootwork] = useState(0);
  const [timing, setTiming] = useState(0);
  // Mental
  const [focus, setFocus] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [pressureHandling, setPressureHandling] = useState(0);
  // Physical
  const [energyLevel, setEnergyLevel] = useState(0);
  const [reactionSpeed, setReactionSpeed] = useState(0);
  // Tactical
  const [shotSelection, setShotSelection] = useState(0);
  const [gameAwareness, setGameAwareness] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');

  // Derived averages (used for XP and analytics)
  const physicalRating = energyLevel > 0 || reactionSpeed > 0
    ? Math.round(((energyLevel || 0) + (reactionSpeed || 0)) / (energyLevel > 0 && reactionSpeed > 0 ? 2 : 1))
    : 0;
  const mentalRating = focus > 0 || confidence > 0 || pressureHandling > 0
    ? Math.round(((focus || 0) + (confidence || 0) + (pressureHandling || 0)) / [focus, confidence, pressureHandling].filter(v => v > 0).length)
    : 0;
  const tacticalRating = shotSelection > 0 || gameAwareness > 0
    ? Math.round(((shotSelection || 0) + (gameAwareness || 0)) / (shotSelection > 0 && gameAwareness > 0 ? 2 : 1))
    : 0;
  const technicalRating = shotExecution > 0 || footwork > 0 || timing > 0
    ? Math.round(((shotExecution || 0) + (footwork || 0) + (timing || 0)) / [shotExecution, footwork, timing].filter(v => v > 0).length)
    : 0;

  // Step 4: Summary
  const [xpBreakdown, setXpBreakdown] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Timer effect for active session
  useEffect(() => {
    if (currentStep === 2 && sessionStartTime && !isPaused) {
      timerInterval.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      tipRotation.current = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % SESSION_TIPS.length);
      }, 15000);

      return () => {
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (tipRotation.current) clearInterval(tipRotation.current);
      };
    }

    if (isPaused) {
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (tipRotation.current) clearInterval(tipRotation.current);
    }
  }, [currentStep, sessionStartTime, isPaused]);

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTrainingType = (type: TrainingType) => {
    const newSet = new Set(selectedTrainingTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setSelectedTrainingTypes(newSet);
  };

  const handleStartSession = async () => {
    if (selectedTrainingTypes.size === 0) {
      showAlert('Error', 'Please select at least one training type');
      return;
    }
    if (sessionMode === 'later') {
      await handleScheduleForLater();
      return;
    }
    setSessionStartTime(new Date());
    setBallsFacedInput('0');
    setIsPaused(false);
    setCurrentStep(2);
  };

  const handleScheduleForLater = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in');
      return;
    }
    setSaving(true);
    const scheduledDateTime = new Date(
      scheduledDate.getFullYear(),
      scheduledDate.getMonth(),
      scheduledDate.getDate(),
      scheduledTime.getHours(),
      scheduledTime.getMinutes()
    );
    const trainingTypesText = Array.from(selectedTrainingTypes)
      .map(t => TRAINING_TYPES.find(tt => tt.id === t)?.label)
      .join(', ');
    let notes = `Training Types: ${trainingTypesText}\n`;
    if (focusArea) notes += `Focus Area: ${focusArea}\n`;
    if (sessionGoal) notes += `Session Goal: ${sessionGoal}`;
    const { data: session, error } = await sessionService.createSession({
      user_id: user.id,
      title: 'Freestyle Session',
      scheduled_date: scheduledDateTime.toISOString(),
      duration_minutes: parseInt(estimatedDuration),
      session_type: 'Freestyle',
      status: 'planned',
      notes,
    });
    setSaving(false);
    if (error) {
      showAlert('Error', error);
      return;
    }
    showAlert('Success', 'Session scheduled successfully');
    router.back();
  };

  const togglePause = () => setIsPaused(!isPaused);

  const handleBallsFacedInputChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setBallsFacedInput(numericValue);
    setBallsFacedLive(parseInt(numericValue) || 0);
  };

  const handleBallsFacedIncrement = () => {
    const newValue = ballsFacedLive + 1;
    setBallsFacedLive(newValue);
    setBallsFacedInput(newValue.toString());
  };

  const handleBallsFacedDecrement = () => {
    const newValue = Math.max(0, ballsFacedLive - 1);
    setBallsFacedLive(newValue);
    setBallsFacedInput(newValue.toString());
  };

  const handleEndSession = () => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (tipRotation.current) clearInterval(tipRotation.current);
    setBallsFaced(ballsFacedLive.toString());
    setCurrentStep(3);
  };

  const isStep3Valid = () => {
    // Need at least one rating from each pillar
    const hasTechnical = shotExecution > 0 || footwork > 0 || timing > 0;
    const hasMental = focus > 0 || confidence > 0 || pressureHandling > 0;
    const hasPhysical = energyLevel > 0 || reactionSpeed > 0;
    const hasTactical = shotSelection > 0 || gameAwareness > 0;
    return hasTechnical && hasMental && hasPhysical && hasTactical;
  };

  const handleCompleteSession = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in');
      return;
    }
    if (!isStep3Valid()) {
      showAlert('Incomplete', 'Please rate at least one metric in each pillar (Technical, Mental, Physical, Tactical)');
      return;
    }
    setSaving(true);
    const actualDuration = Math.floor(elapsedSeconds / 60);
    const trainingTypesText = Array.from(selectedTrainingTypes)
      .map(t => TRAINING_TYPES.find(tt => tt.id === t)?.label)
      .join(', ');

    const middlePct = ballsFaced && ballsMiddled && parseInt(ballsFaced) > 0
      ? Math.round((parseInt(ballsMiddled) / parseInt(ballsFaced)) * 100)
      : 0;

    let notes = `Training Types: ${trainingTypesText}\n`;
    if (focusArea) notes += `Focus Area: ${focusArea}\n`;
    if (sessionGoal) notes += `Session Goal: ${sessionGoal}\n`;
    notes += `\n--- Batting Stats ---\n`;
    if (ballsFaced) notes += `Balls Faced: ${ballsFaced}\n`;
    if (ballsMiddled) notes += `Balls Middled: ${ballsMiddled}\n`;
    if (middlePct > 0) notes += `Middle %: ${middlePct}\n`;
    if (boundariesHit) notes += `Boundaries Hit: ${boundariesHit}\n`;
    notes += `\n--- Technical ---\n`;
    notes += `Shot Execution: ${shotExecution}/5\n`;
    notes += `Footwork: ${footwork}/5\n`;
    notes += `Timing: ${timing}/5\n`;
    notes += `\n--- Mental ---\n`;
    notes += `Focus: ${focus}/5\n`;
    notes += `Confidence: ${confidence}/5\n`;
    notes += `Pressure Handling: ${pressureHandling}/5\n`;
    notes += `\n--- Physical ---\n`;
    notes += `Energy Level: ${energyLevel}/5\n`;
    notes += `Reaction Speed: ${reactionSpeed}/5\n`;
    notes += `\n--- Tactical ---\n`;
    notes += `Shot Selection: ${shotSelection}/5\n`;
    notes += `Game Awareness: ${gameAwareness}/5\n`;
    // Legacy fields for backwards-compatible analytics parsing
    notes += `\nPhysical: ${physicalRating}/5\n`;
    notes += `Mental: ${mentalRating}/5\n`;
    notes += `Tactical: ${tacticalRating}/5\n`;
    notes += `Technical: ${technicalRating}/5`;
    if (sessionNotes) notes += `\n\nNotes: ${sessionNotes}`;

    const { data: session, error } = await sessionService.createSession({
      user_id: user.id,
      title: 'Freestyle Session',
      scheduled_date: sessionStartTime?.toISOString() || new Date().toISOString(),
      duration_minutes: actualDuration,
      session_type: 'Freestyle',
      status: 'completed',
      notes,
    });
    if (error) {
      setSaving(false);
      showAlert('Error', error);
      return;
    }
    const avgRating = (physicalRating + mentalRating + tacticalRating + technicalRating) / 4;
    const { data: xpResult, error: xpError } = await progressService.awardDrillXP(
      user.id,
      'Physical',
      Math.round(avgRating),
      actualDuration
    );
    if (xpError || !xpResult) {
      setSaving(false);
      showAlert('Error', 'Failed to save progress');
      return;
    }
    setSaving(false);
    setXpBreakdown(xpResult.xpBreakdown);
    setCurrentStep(4);
  };

  const RatingStars = ({
    rating,
    onRate,
    label,
    sublabel,
    color,
  }: {
    rating: number;
    onRate: (rating: number) => void;
    label: string;
    sublabel?: string;
    color?: string;
  }) => (
    <View style={styles.ratingContainer}>
      <View style={styles.ratingLabelRow}>
        <Text style={styles.ratingLabel}>{label}</Text>
        {rating > 0 && (
          <View style={[styles.ratingValueBadge, { backgroundColor: (color || colors.tactical) + '20' }]}>
            <Text style={[styles.ratingValueText, { color: color || colors.tactical }]}>{rating}/5</Text>
          </View>
        )}
      </View>
      {sublabel && <Text style={styles.ratingSublabel}>{sublabel}</Text>}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onRate(star)} style={styles.starButton}>
            <MaterialIcons
              name={star <= rating ? 'star' : 'star-border'}
              size={30}
              color={star <= rating ? (color || colors.tactical) : colors.border}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  const renderStep1 = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.modeSelection}>
        <Text style={styles.stepTitle}>When do you want to train?</Text>
        <View style={styles.modeButtons}>
          <Pressable
            style={[styles.modeButton, sessionMode === 'now' && styles.modeButtonActive]}
            onPress={() => setSessionMode('now')}
          >
            <MaterialIcons name="play-arrow" size={24} color={sessionMode === 'now' ? colors.textLight : colors.primary} />
            <Text style={[styles.modeButtonText, sessionMode === 'now' && styles.modeButtonTextActive]}>Start Now</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, sessionMode === 'later' && styles.modeButtonActive]}
            onPress={() => setSessionMode('later')}
          >
            <MaterialIcons name="schedule" size={24} color={sessionMode === 'later' ? colors.textLight : colors.primary} />
            <Text style={[styles.modeButtonText, sessionMode === 'later' && styles.modeButtonTextActive]}>Schedule Later</Text>
          </Pressable>
        </View>
      </View>

      {sessionMode === 'later' && (
        <View style={styles.dateTimeSection}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Date</Text>
            {prefilledDateStr ? (
              <View style={[styles.dateTimeButton, { backgroundColor: colors.primary + '12' }]}>
                <MaterialIcons name="event" size={20} color={colors.primary} />
                <Text style={[styles.dateTimeButtonText, { color: colors.primary, fontWeight: '600' }]}>
                  {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
                <MaterialIcons name="lock" size={16} color={colors.primary} />
              </View>
            ) : (
              <Pressable style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
              </Pressable>
            )}
            {showDatePicker && !prefilledDateStr && (
              <DateTimePicker
                value={scheduledDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) setScheduledDate(selectedDate);
                }}
                minimumDate={new Date()}
              />
            )}
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Time</Text>
            <Pressable style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
              <MaterialIcons name="access-time" size={20} color={colors.primary} />
              <Text style={styles.dateTimeButtonText}>
                {scheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={scheduledTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowTimePicker(Platform.OS === 'ios');
                  if (selectedTime) setScheduledTime(selectedTime);
                }}
              />
            )}
          </View>
        </View>
      )}

      <Text style={styles.stepTitle}>What are you training with today?</Text>
      <Text style={styles.stepSubtitle}>Select all that apply</Text>

      <View style={styles.trainingTypesGrid}>
        {TRAINING_TYPES.map((type) => {
          const isSelected = selectedTrainingTypes.has(type.id);
          return (
            <Pressable
              key={type.id}
              style={[styles.trainingTypeCard, isSelected && styles.trainingTypeCardSelected]}
              onPress={() => toggleTrainingType(type.id)}
            >
              <View style={[styles.trainingTypeIcon, isSelected && styles.trainingTypeIconSelected]}>
                <MaterialIcons name={type.icon as any} size={32} color={isSelected ? colors.textLight : colors.primary} />
              </View>
              <Text style={[styles.trainingTypeLabel, isSelected && styles.trainingTypeLabelSelected]}>{type.label}</Text>
              {isSelected && (
                <View style={styles.checkMark}>
                  <MaterialIcons name="check-circle" size={24} color={colors.success} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.additionalFields}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Focus Area (Optional)</Text>
          <TextInput
            style={styles.input}
            value={focusArea}
            onChangeText={setFocusArea}
            placeholder="e.g., Cover drives, Pull shots"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Session Goal (Optional)</Text>
          <TextInput
            style={styles.input}
            value={sessionGoal}
            onChangeText={setSessionGoal}
            placeholder="e.g., Improve timing"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Estimated Duration</Text>
          <View style={styles.durationOptions}>
            {['15', '30', '45', '60', '90'].map((mins) => (
              <Pressable
                key={mins}
                style={[styles.durationOption, estimatedDuration === mins && styles.durationOptionSelected]}
                onPress={() => setEstimatedDuration(mins)}
              >
                <Text style={[styles.durationOptionText, estimatedDuration === mins && styles.durationOptionTextSelected]}>
                  {mins} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.activeSessionContent} showsVerticalScrollIndicator={false}>
      <View style={styles.timerSection}>
        <Text style={styles.timerLabel}>Session Time</Text>
        <Text style={styles.timerDisplay}>{formatElapsedTime(elapsedSeconds)}</Text>
        <Pressable style={styles.pauseButton} onPress={togglePause}>
          <MaterialIcons name={isPaused ? 'play-arrow' : 'pause'} size={24} color={colors.textLight} />
          <Text style={styles.pauseButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
      </View>

      <View style={styles.liveStatsSection}>
        <View style={styles.liveStatCard}>
          <MaterialIcons name="sports-cricket" size={32} color={colors.primary} />
          <TextInput
            style={styles.liveStatValue}
            value={ballsFacedInput}
            onChangeText={handleBallsFacedInputChange}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Text style={styles.liveStatLabel}>Balls Faced</Text>
          <View style={styles.liveStatButtons}>
            <Pressable style={styles.liveStatButton} onPress={handleBallsFacedDecrement}>
              <MaterialIcons name="remove" size={20} color={colors.textLight} />
            </Pressable>
            <Pressable style={styles.liveStatButton} onPress={handleBallsFacedIncrement}>
              <MaterialIcons name="add" size={20} color={colors.textLight} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.tipsSection}>
        <View style={styles.tipHeader}>
          <MaterialIcons name="lightbulb" size={20} color={colors.warning} />
          <Text style={styles.tipHeaderText}>Training Tip</Text>
        </View>
        <Text style={styles.tipText}>{SESSION_TIPS[currentTipIndex]}</Text>
      </View>

      <View style={styles.selectedTypesSection}>
        <Text style={styles.selectedTypesLabel}>Today's Training</Text>
        <View style={styles.selectedTypesRow}>
          {Array.from(selectedTrainingTypes).map((typeId) => {
            const type = TRAINING_TYPES.find(t => t.id === typeId);
            return (
              <View key={typeId} style={styles.selectedTypeBadge}>
                <MaterialIcons name={type?.icon as any} size={16} color={colors.primary} />
                <Text style={styles.selectedTypeBadgeText}>{type?.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.stepTitle}>Session Breakdown</Text>
      <Text style={styles.stepSubtitle}>Rate each area of your performance</Text>

      {/* Batting Stats */}
      <View style={styles.statsSectionCard}>
        <View style={styles.statsSectionHeader}>
          <MaterialIcons name="sports-cricket" size={20} color={colors.primary} />
          <Text style={styles.statsSectionTitle}>Batting Stats</Text>
        </View>
        <View style={styles.statsRow3}>
          <View style={styles.statInputBlock}>
            <Text style={styles.statInputLabel}>Balls Faced</Text>
            <TextInput
              style={styles.statInput}
              value={ballsFaced}
              onChangeText={setBallsFaced}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              textAlign="center"
            />
          </View>
          <View style={styles.statInputBlock}>
            <Text style={styles.statInputLabel}>Balls Middled</Text>
            <TextInput
              style={styles.statInput}
              value={ballsMiddled}
              onChangeText={setBallsMiddled}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              textAlign="center"
            />
          </View>
          <View style={styles.statInputBlock}>
            <Text style={styles.statInputLabel}>Boundaries</Text>
            <TextInput
              style={styles.statInput}
              value={boundariesHit}
              onChangeText={setBoundariesHit}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              textAlign="center"
            />
          </View>
        </View>
        {ballsFaced && ballsMiddled && parseInt(ballsFaced) > 0 && (
          <View style={styles.middlePctBadge}>
            <MaterialIcons name="gps-fixed" size={14} color={colors.success} />
            <Text style={styles.middlePctText}>
              Middle %: {Math.round((parseInt(ballsMiddled) / parseInt(ballsFaced)) * 100)}%
            </Text>
          </View>
        )}
      </View>

      {/* Technical */}
      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.technical }]}>
          <MaterialIcons name="sports-cricket" size={18} color={colors.technical} />
          <Text style={[styles.pillarSectionTitle, { color: colors.technical }]}>Technical</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={shotExecution} onRate={setShotExecution} label="Shot Execution" sublabel="How clean and correct was your technique?" color={colors.technical} />
        <RatingStars rating={footwork} onRate={setFootwork} label="Footwork" sublabel="Was your foot movement into position good?" color={colors.technical} />
        <RatingStars rating={timing} onRate={setTiming} label="Timing" sublabel="How well did you time the ball?" color={colors.technical} />
      </View>

      {/* Mental */}
      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.mental }]}>
          <MaterialIcons name="psychology" size={18} color={colors.mental} />
          <Text style={[styles.pillarSectionTitle, { color: colors.mental }]}>Mental</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={focus} onRate={setFocus} label="Focus & Concentration" sublabel="How well did you stay in the zone?" color={colors.mental} />
        <RatingStars rating={confidence} onRate={setConfidence} label="Confidence" sublabel="How confident did you feel at the crease?" color={colors.mental} />
        <RatingStars rating={pressureHandling} onRate={setPressureHandling} label="Pressure Handling" sublabel="How well did you manage pressure situations?" color={colors.mental} />
      </View>

      {/* Physical */}
      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.physical }]}>
          <MaterialIcons name="fitness-center" size={18} color={colors.physical} />
          <Text style={[styles.pillarSectionTitle, { color: colors.physical }]}>Physical</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={energyLevel} onRate={setEnergyLevel} label="Energy Level" sublabel="How energetic and fit did you feel?" color={colors.physical} />
        <RatingStars rating={reactionSpeed} onRate={setReactionSpeed} label="Reaction Speed" sublabel="How quickly did you pick up the ball?" color={colors.physical} />
      </View>

      {/* Tactical */}
      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.tactical }]}>
          <MaterialIcons name="lightbulb" size={18} color={colors.tactical} />
          <Text style={[styles.pillarSectionTitle, { color: colors.tactical }]}>Tactical</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={shotSelection} onRate={setShotSelection} label="Shot Selection" sublabel="Did you play the right shots at the right time?" color={colors.tactical} />
        <RatingStars rating={gameAwareness} onRate={setGameAwareness} label="Game Awareness" sublabel="How well did you read the game situation?" color={colors.tactical} />
      </View>

      {/* Session Notes */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Session Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={sessionNotes}
          onChangeText={setSessionNotes}
          multiline
          numberOfLines={4}
          placeholder="Any observations or key takeaways?"
          placeholderTextColor={colors.textSecondary}
          textAlignVertical="top"
        />
      </View>
    </ScrollView>
  );

  const renderStep4 = () => {
    const middlePct = ballsFaced && ballsMiddled && parseInt(ballsFaced) > 0
      ? Math.round((parseInt(ballsMiddled) / parseInt(ballsFaced)) * 100)
      : null;
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconContainer}>
            <MaterialIcons name="check-circle" size={80} color={colors.success} />
          </View>
          <Text style={styles.summaryTitle}>Session Complete!</Text>
          <Text style={styles.summarySubtitle}>Great work today</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatCard}>
            <MaterialIcons name="timer" size={22} color={colors.primary} />
            <Text style={styles.quickStatValue}>{Math.floor(elapsedSeconds / 60)}</Text>
            <Text style={styles.quickStatLabel}>Minutes</Text>
          </View>
          {ballsFaced ? (
            <View style={styles.quickStatCard}>
              <MaterialIcons name="sports-cricket" size={22} color={colors.technical} />
              <Text style={styles.quickStatValue}>{ballsFaced}</Text>
              <Text style={styles.quickStatLabel}>Balls Faced</Text>
            </View>
          ) : null}
          {middlePct !== null ? (
            <View style={styles.quickStatCard}>
              <MaterialIcons name="gps-fixed" size={22} color={colors.success} />
              <Text style={styles.quickStatValue}>{middlePct}%</Text>
              <Text style={styles.quickStatLabel}>Middle %</Text>
            </View>
          ) : null}
          {boundariesHit ? (
            <View style={styles.quickStatCard}>
              <MaterialIcons name="star" size={22} color={colors.warning} />
              <Text style={styles.quickStatValue}>{boundariesHit}</Text>
              <Text style={styles.quickStatLabel}>Boundaries</Text>
            </View>
          ) : null}
        </View>

        {/* Pillar Averages */}
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Performance Summary</Text>
          {[
            { label: 'Technical', value: technicalRating, color: colors.technical, icon: 'sports-cricket' as const },
            { label: 'Mental', value: mentalRating, color: colors.mental, icon: 'psychology' as const },
            { label: 'Physical', value: physicalRating, color: colors.physical, icon: 'fitness-center' as const },
            { label: 'Tactical', value: tacticalRating, color: colors.tactical, icon: 'lightbulb' as const },
          ].map(p => (
            <View key={p.label} style={styles.summaryPillarRow}>
              <MaterialIcons name={p.icon} size={18} color={p.color} />
              <Text style={styles.summaryLabel}>{p.label}</Text>
              <View style={styles.summaryBarBg}>
                <View style={[styles.summaryBar, { width: `${(p.value / 5) * 100}%`, backgroundColor: p.color }]} />
              </View>
              <Text style={[styles.summaryPillarVal, { color: p.color }]}>{p.value}/5</Text>
            </View>
          ))}
        </View>

        {/* XP Breakdown */}
        {xpBreakdown && (
          <View style={styles.xpSection}>
            <Text style={styles.xpSectionTitle}>XP Earned</Text>
            <View style={styles.xpBreakdown}>
              <View style={styles.xpItem}>
                <Text style={styles.xpItemLabel}>Session Completion</Text>
                <Text style={styles.xpItemValue}>+10 XP</Text>
              </View>
              {xpBreakdown.goodRatingBonus > 0 && (
                <View style={styles.xpItem}>
                  <Text style={styles.xpItemLabel}>Good Performance Rating</Text>
                  <Text style={styles.xpItemValue}>+{xpBreakdown.goodRatingBonus} XP</Text>
                </View>
              )}
              {xpBreakdown.consistencyBonus > 0 && (
                <View style={styles.xpItem}>
                  <Text style={styles.xpItemLabel}>Consistency Bonus</Text>
                  <Text style={styles.xpItemValue}>+{xpBreakdown.consistencyBonus} XP</Text>
                </View>
              )}
              {xpBreakdown.streakBonus > 0 && (
                <View style={styles.xpItem}>
                  <Text style={styles.xpItemLabel}>Streak Bonus</Text>
                  <Text style={styles.xpItemValue}>+{xpBreakdown.streakBonus} XP</Text>
                </View>
              )}
              <View style={styles.xpDivider} />
              <View style={styles.xpTotal}>
                <Text style={styles.xpTotalLabel}>Total XP Earned</Text>
                <Text style={styles.xpTotalValue}>+{xpBreakdown.totalXP} XP</Text>
              </View>
            </View>
            {xpBreakdown.levelUp && (
              <View style={styles.levelUpBanner}>
                <MaterialIcons name="star" size={24} color={colors.warning} />
                <Text style={styles.levelUpText}>Level Up! You are now {xpBreakdown.newLevel}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Setup Session';
      case 2: return 'Active Session';
      case 3: return 'Session Feedback';
      case 4: return 'Summary';
      default: return '';
    }
  };

  const getFooterButton = () => {
    switch (currentStep) {
      case 1:
        return (
          <Pressable
            style={[styles.saveButton, (selectedTrainingTypes.size === 0 || saving) && styles.saveButtonDisabled]}
            onPress={handleStartSession}
            disabled={selectedTrainingTypes.size === 0 || saving}
          >
            <MaterialIcons name={sessionMode === 'later' ? 'schedule' : 'play-arrow'} size={20} color={colors.textLight} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : sessionMode === 'later' ? 'Schedule Session' : 'Start Session'}
            </Text>
          </Pressable>
        );
      case 2:
        return (
          <Pressable style={styles.endButton} onPress={handleEndSession}>
            <MaterialIcons name="stop" size={20} color={colors.textLight} />
            <Text style={styles.saveButtonText}>End Session</Text>
          </Pressable>
        );
      case 3:
        return (
          <Pressable
            style={[styles.saveButton, (!isStep3Valid() || saving) && styles.saveButtonDisabled]}
            onPress={handleCompleteSession}
            disabled={!isStep3Valid() || saving}
          >
            <MaterialIcons name="check" size={20} color={colors.textLight} />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Complete Session'}</Text>
          </Pressable>
        );
      case 4:
        return (
          <View style={styles.footerRow}>
            <Pressable
              style={styles.analyticsButton}
              onPress={() => router.push({
                pathname: '/session-analytics' as any,
                params: {
                  physical: physicalRating,
                  mental: mentalRating,
                  tactical: tacticalRating,
                  technical: technicalRating,
                  balls: ballsFaced,
                  ballsMiddled: ballsMiddled,
                  boundaries: boundariesHit,
                  duration: Math.floor(elapsedSeconds / 60),
                  types: Array.from(selectedTrainingTypes).map(t => TRAINING_TYPES.find(tt => tt.id === t)?.label).join(','),
                  focus: focusArea,
                  goal: sessionGoal,
                  notes: sessionNotes,
                  shotExecution,
                  footwork,
                  timing,
                  focusRating: focus,
                  confidence,
                  pressureHandling,
                  energyLevel,
                  reactionSpeed,
                  shotSelection,
                  gameAwareness,
                }
              })}
            >
              <MaterialIcons name="analytics" size={20} color={colors.primary} />
              <Text style={styles.analyticsButtonText}>View Analytics</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={() => router.replace('/(tabs)' as any)}>
              <MaterialIcons name="home" size={20} color={colors.textLight} />
              <Text style={styles.saveButtonText}>Done</Text>
            </Pressable>
          </View>
        );
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => currentStep === 1 ? router.back() : setCurrentStep(Math.max(1, currentStep - 1))}
          style={styles.headerButton}
        >
          <MaterialIcons name={currentStep === 1 ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
          <Text style={styles.headerSubtitle}>Step {currentStep} of 4</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((step) => (
          <View key={step} style={[styles.progressSegment, step <= currentStep && styles.progressSegmentActive]} />
        ))}
      </View>

      {renderStepContent()}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {getFooterButton()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerButton: { padding: spacing.xs, width: 40 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '600' },
  headerSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  progressBar: {
    flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  progressSegment: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2 },
  progressSegmentActive: { backgroundColor: colors.primary },
  stepTitle: { ...typography.h2, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  stepSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },

  // Training type grid
  trainingTypesGrid: { gap: spacing.md, marginBottom: spacing.xl },
  trainingTypeCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    borderWidth: 2, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  trainingTypeCardSelected: { borderColor: colors.success, backgroundColor: colors.success + '10' },
  trainingTypeIcon: {
    width: 56, height: 56, borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center',
  },
  trainingTypeIconSelected: { backgroundColor: colors.success },
  trainingTypeLabel: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  trainingTypeLabelSelected: { color: colors.success },
  checkMark: { marginLeft: 'auto' },

  additionalFields: { gap: spacing.md },
  durationOptions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  durationOption: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  durationOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationOptionText: { ...typography.body, color: colors.text, fontWeight: '600' },
  durationOptionTextSelected: { color: colors.textLight },

  modeSelection: { marginBottom: spacing.xl },
  modeButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  modeButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
  },
  modeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeButtonText: { ...typography.body, color: colors.text, fontWeight: '600' },
  modeButtonTextActive: { color: colors.textLight },

  dateTimeSection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    gap: spacing.md, marginBottom: spacing.xl,
  },
  dateTimeButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  dateTimeButtonText: { ...typography.body, color: colors.text, flex: 1 },

  // Step 2
  activeSessionContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 2 },
  timerSection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  timerLabel: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  timerDisplay: { fontSize: 48, color: colors.primary, fontWeight: '700', textAlign: 'center' },
  pauseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, marginTop: spacing.md,
  },
  pauseButtonText: { ...typography.body, color: colors.textLight, fontWeight: '600' },
  liveStatsSection: { gap: spacing.md },
  liveStatCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    alignItems: 'center', gap: spacing.sm,
  },
  liveStatValue: {
    fontSize: 48, color: colors.text, fontWeight: '700', textAlign: 'center', minWidth: 100,
  },
  liveStatLabel: { ...typography.body, color: colors.textSecondary },
  liveStatButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  liveStatButton: {
    width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  tipsSection: {
    backgroundColor: '#FFF4E6', borderRadius: borderRadius.lg, padding: spacing.lg,
    borderLeftWidth: 4, borderLeftColor: colors.warning,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  tipHeaderText: { ...typography.body, color: colors.warning, fontWeight: '600' },
  tipText: { ...typography.body, color: colors.text, lineHeight: 22 },
  selectedTypesSection: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg },
  selectedTypesLabel: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '600' },
  selectedTypesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selectedTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primaryLight + '20', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.md,
  },
  selectedTypeBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  // Step 3 - Stats section
  statsSectionCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  statsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  statsSectionTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  statsRow3: { flexDirection: 'row', gap: spacing.sm },
  statInputBlock: { flex: 1, alignItems: 'center' },
  statInputLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs, textAlign: 'center' },
  statInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md, width: '100%', ...typography.h4, color: colors.text, fontWeight: '700',
    textAlign: 'center',
  },
  middlePctBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md,
    backgroundColor: colors.success + '15', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, alignSelf: 'flex-start',
  },
  middlePctText: { ...typography.body, color: colors.success, fontWeight: '700' },

  // Pillar section
  pillarSection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  pillarSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg,
    borderLeftWidth: 4, paddingLeft: spacing.sm,
  },
  pillarSectionTitle: { ...typography.h4, fontWeight: '700', flex: 1 },
  requiredNote: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },

  // Rating stars
  ratingContainer: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  ratingLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  ratingLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  ratingValueBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  ratingValueText: { ...typography.caption, fontWeight: '700' },
  ratingSublabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  starsRow: { flexDirection: 'row', gap: spacing.xs },
  starButton: { padding: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  required: { ...typography.body, color: colors.error, fontWeight: '600' },

  // Step 4 summary
  summaryHeader: { alignItems: 'center', paddingVertical: spacing.xl },
  summaryIconContainer: { marginBottom: spacing.md },
  summaryTitle: { ...typography.h1, color: colors.text, fontWeight: '700', marginBottom: spacing.xs },
  summarySubtitle: { ...typography.body, color: colors.textSecondary },
  quickStatsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' },
  quickStatCard: {
    flex: 1, minWidth: 70, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border,
  },
  quickStatValue: { ...typography.h3, color: colors.text, fontWeight: '800' },
  quickStatLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  summarySection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  summarySectionTitle: { ...typography.h4, color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  summaryPillarRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
  },
  summaryLabel: { ...typography.body, color: colors.text, fontWeight: '600', width: 70 },
  summaryBarBg: { flex: 1, height: 10, backgroundColor: colors.border, borderRadius: 5 },
  summaryBar: { height: 10, borderRadius: 5, minWidth: 4 },
  summaryPillarVal: { ...typography.bodySmall, fontWeight: '800', width: 32, textAlign: 'right' },

  xpSection: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  xpSectionTitle: { ...typography.h4, color: colors.text, fontWeight: '600', marginBottom: spacing.md },
  xpBreakdown: { gap: spacing.sm },
  xpItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  xpItemLabel: { ...typography.body, color: colors.textSecondary },
  xpItemValue: { ...typography.body, color: colors.success, fontWeight: '600' },
  xpDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  xpTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  xpTotalLabel: { ...typography.h4, color: colors.text, fontWeight: '600' },
  xpTotalValue: { ...typography.h4, color: colors.success, fontWeight: '700' },
  levelUpBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.warning + '20', padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.md,
  },
  levelUpText: { ...typography.body, color: colors.warning, fontWeight: '700' },
  endButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.error, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  formGroup: { marginBottom: spacing.lg },
  label: { ...typography.body, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text,
  },
  textArea: { minHeight: 100, paddingTop: spacing.md },
  ratingsSection: { gap: spacing.md },
  sectionTitle: { ...typography.h4, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },

  footer: {
    padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 8,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    flex: 1,
  },
  saveButtonDisabled: { backgroundColor: colors.border },
  saveButtonText: { ...typography.body, color: colors.textLight, fontWeight: '600' },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  analyticsButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.surface, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 2, borderColor: colors.primary,
  },
  analyticsButtonText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
