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

  // Step 3: Post-session ratings
  const [ballsFaced, setBallsFaced] = useState('');
  const [physicalRating, setPhysicalRating] = useState(0);
  const [mentalRating, setMentalRating] = useState(0);
  const [tacticalRating, setTacticalRating] = useState(0);
  const [technicalRating, setTechnicalRating] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');

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
      }, 15000); // Rotate tips every 15 seconds

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

    // If scheduling for later, save as planned session
    if (sessionMode === 'later') {
      await handleScheduleForLater();
      return;
    }

    // Otherwise, start session now
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

    // Combine date and time
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

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleBallsFacedInputChange = (text: string) => {
    // Only allow numbers
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
    // Balls faced is now optional
    if (physicalRating === 0) return false;
    if (mentalRating === 0) return false;
    if (tacticalRating === 0) return false;
    if (technicalRating === 0) return false;
    return true;
  };

  const handleCompleteSession = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in');
      return;
    }

    if (!isStep3Valid()) {
      showAlert('Error', 'Please complete all required fields');
      return;
    }

    setSaving(true);

    const actualDuration = Math.floor(elapsedSeconds / 60);
    const trainingTypesText = Array.from(selectedTrainingTypes)
      .map(t => TRAINING_TYPES.find(tt => tt.id === t)?.label)
      .join(', ');

    // Build session notes
    let notes = `Training Types: ${trainingTypesText}\n`;
    if (focusArea) notes += `Focus Area: ${focusArea}\n`;
    if (sessionGoal) notes += `Session Goal: ${sessionGoal}\n`;
    notes += `\n--- Session Data ---\n`;
    if (ballsFaced) notes += `Balls Faced: ${ballsFaced}\n`;
    notes += `Physical: ${physicalRating}/5\n`;
    notes += `Mental: ${mentalRating}/5\n`;
    notes += `Tactical: ${tacticalRating}/5\n`;
    notes += `Technical: ${technicalRating}/5`;
    if (sessionNotes) notes += `\n\nNotes: ${sessionNotes}`;

    // Create session
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

    // Calculate performance rating from all ratings
    const avgRating = (physicalRating + mentalRating + tacticalRating + technicalRating) / 4;

    // Award XP using the new system
    const { data: xpResult, error: xpError } = await progressService.awardDrillXP(
      user.id,
      'Physical', // Default pillar for freestyle sessions
      Math.round(avgRating),
      actualDuration
    );

    if (xpError || !xpResult) {
      console.error('XP award error:', xpError);
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
    label
  }: {
    rating: number;
    onRate: (rating: number) => void;
    label: string;
  }) => (
    <View style={styles.ratingContainer}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => onRate(star)}
            style={styles.starButton}
          >
            <MaterialIcons
              name={star <= rating ? 'star' : 'star-border'}
              size={32}
              color={star <= rating ? colors.tactical : colors.border}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  const renderStep1 = () => (

    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Session Mode Selection */}
      <View style={styles.modeSelection}>
        <Text style={styles.stepTitle}>When do you want to train?</Text>
        <View style={styles.modeButtons}>
          <Pressable
            style={[
              styles.modeButton,
              sessionMode === 'now' && styles.modeButtonActive,
            ]}
            onPress={() => setSessionMode('now')}
          >
            <MaterialIcons
              name="play-arrow"
              size={24}
              color={sessionMode === 'now' ? colors.textLight : colors.primary}
            />
            <Text
              style={[
                styles.modeButtonText,
                sessionMode === 'now' && styles.modeButtonTextActive,
              ]}
            >
              Start Now
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeButton,
              sessionMode === 'later' && styles.modeButtonActive,
            ]}
            onPress={() => setSessionMode('later')}
          >
            <MaterialIcons
              name="schedule"
              size={24}
              color={sessionMode === 'later' ? colors.textLight : colors.primary}
            />
            <Text
              style={[
                styles.modeButtonText,
                sessionMode === 'later' && styles.modeButtonTextActive,
              ]}
            >
              Schedule Later
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Date/Time Pickers - Only show when scheduling for later */}
      {sessionMode === 'later' && (
        <View style={styles.dateTimeSection}>
          {/* Date row: locked if came from calendar, editable otherwise */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Date</Text>
            {prefilledDateStr ? (
              // Locked date from calendar tap
              <View style={[styles.dateTimeButton, { backgroundColor: colors.primary + '12' }]}>
                <MaterialIcons name="event" size={20} color={colors.primary} />
                <Text style={[styles.dateTimeButtonText, { color: colors.primary, fontWeight: '600' }]}>
                  {scheduledDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <MaterialIcons name="lock" size={16} color={colors.primary} />
              </View>
            ) : (
              <Pressable
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {scheduledDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
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
            <Pressable
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <MaterialIcons name="access-time" size={20} color={colors.primary} />
              <Text style={styles.dateTimeButtonText}>
                {scheduledTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
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
                <MaterialIcons
                  name={type.icon as any}
                  size={32}
                  color={isSelected ? colors.textLight : colors.primary}
                />
              </View>
              <Text style={[styles.trainingTypeLabel, isSelected && styles.trainingTypeLabelSelected]}>
                {type.label}
              </Text>
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
                style={[
                  styles.durationOption,
                  estimatedDuration === mins && styles.durationOptionSelected,
                ]}
                onPress={() => setEstimatedDuration(mins)}
              >
                <Text
                  style={[
                    styles.durationOptionText,
                    estimatedDuration === mins && styles.durationOptionTextSelected,
                  ]}
                >
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
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.activeSessionContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Timer Display */}
      <View style={styles.timerSection}>
        <Text style={styles.timerLabel}>Session Time</Text>
        <Text style={styles.timerDisplay}>{formatElapsedTime(elapsedSeconds)}</Text>
        <Pressable style={styles.pauseButton} onPress={togglePause}>
          <MaterialIcons 
            name={isPaused ? 'play-arrow' : 'pause'} 
            size={24} 
            color={colors.textLight} 
          />
          <Text style={styles.pauseButtonText}>
            {isPaused ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>
      </View>

      {/* Live Stats */}
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
            <Pressable
              style={styles.liveStatButton}
              onPress={handleBallsFacedDecrement}
            >
              <MaterialIcons name="remove" size={20} color={colors.textLight} />
            </Pressable>
            <Pressable
              style={styles.liveStatButton}
              onPress={handleBallsFacedIncrement}
            >
              <MaterialIcons name="add" size={20} color={colors.textLight} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Rotating Tips */}
      <View style={styles.tipsSection}>
        <View style={styles.tipHeader}>
          <MaterialIcons name="lightbulb" size={20} color={colors.warning} />
          <Text style={styles.tipHeaderText}>Training Tip</Text>
        </View>
        <Text style={styles.tipText}>{SESSION_TIPS[currentTipIndex]}</Text>
      </View>

      {/* Training Types Selected */}
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
      <Text style={styles.stepTitle}>How did your session go?</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Balls Faced (Optional)</Text>
        <TextInput
          style={styles.input}
          value={ballsFaced}
          onChangeText={setBallsFaced}
          keyboardType="number-pad"
          placeholder="e.g., 100"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.ratingsSection}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionTitle}>Rate Your Performance</Text>
          <Text style={styles.required}>*</Text>
        </View>

        <RatingStars
          rating={physicalRating}
          onRate={setPhysicalRating}
          label="How were you physically?"
        />

        <RatingStars
          rating={mentalRating}
          onRate={setMentalRating}
          label="How were you mentally?"
        />

        <RatingStars
          rating={tacticalRating}
          onRate={setTacticalRating}
          label="How were you tactically?"
        />

        <RatingStars
          rating={technicalRating}
          onRate={setTechnicalRating}
          label="How were you technically?"
        />
      </View>

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

  const renderStep4 = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryIconContainer}>
          <MaterialIcons name="check-circle" size={80} color={colors.success} />
        </View>
        <Text style={styles.summaryTitle}>Session Complete!</Text>
        <Text style={styles.summarySubtitle}>Great work today</Text>
      </View>

      {/* Session Summary */}
      <View style={styles.summarySection}>
        <Text style={styles.summarySectionTitle}>Session Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Duration:</Text>
          <Text style={styles.summaryValue}>{Math.floor(elapsedSeconds / 60)} minutes</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Balls Faced:</Text>
          <Text style={styles.summaryValue}>{ballsFaced}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Training Types:</Text>
          <Text style={styles.summaryValue}>
            {Array.from(selectedTrainingTypes)
              .map(t => TRAINING_TYPES.find(tt => tt.id === t)?.label)
              .join(', ')}
          </Text>
        </View>
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
              <Text style={styles.levelUpText}>
                Level Up! You're now {xpBreakdown.newLevel}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

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
            style={[
              styles.saveButton,
              (selectedTrainingTypes.size === 0 || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleStartSession}
            disabled={selectedTrainingTypes.size === 0 || saving}
          >
            <MaterialIcons
              name={sessionMode === 'later' ? 'schedule' : 'play-arrow'}
              size={20}
              color={colors.textLight}
            />
            <Text style={styles.saveButtonText}>
              {saving
                ? 'Saving...'
                : sessionMode === 'later'
                ? 'Schedule Session'
                : 'Start Session'}
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
            style={[
              styles.saveButton,
              (!isStep3Valid() || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleCompleteSession}
            disabled={!isStep3Valid() || saving}
          >
            <MaterialIcons name="check" size={20} color={colors.textLight} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Complete Session'}
            </Text>
          </Pressable>
        );
      case 4:
        return (
          <Pressable style={styles.saveButton} onPress={() => router.replace('/(tabs)')as any}>
            <MaterialIcons name="home" size={20} color={colors.textLight} />
            <Text style={styles.saveButtonText}>Done</Text>
          </Pressable>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
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

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.progressSegment,
              step <= currentStep && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      {/* Step Content */}
      {renderStepContent()}

      {/* Footer Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {getFooterButton()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: spacing.xs,
    width: 40,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  trainingTypesGrid: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  trainingTypeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trainingTypeCardSelected: {
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
  },
  trainingTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainingTypeIconSelected: {
    backgroundColor: colors.success,
  },
  trainingTypeLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  trainingTypeLabelSelected: {
    color: colors.success,
  },
  checkMark: {
    marginLeft: 'auto',
  },
  additionalFields: {
    gap: spacing.md,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  durationOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationOptionText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  durationOptionTextSelected: {
    color: colors.textLight,
  },
  modeSelection: {
    marginBottom: spacing.xl,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: colors.textLight,
  },
  dateTimeSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dateTimeButtonText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  activeSessionContent: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  timerSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timerLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  timerDisplay: {
    ...typography.h1,
    fontSize: 48,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  pauseButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  liveStatsSection: {
    gap: spacing.md,
  },
  liveStatCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveStatValue: {
    ...typography.h1,
    fontSize: 48,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 100,
    paddingVertical: spacing.xs,
  },
  liveStatLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  liveStatButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  liveStatButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsSection: {
    backgroundColor: '#FFF4E6',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipHeaderText: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '600',
  },
  tipText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  selectedTypesSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  selectedTypesLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  selectedTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectedTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  selectedTypeBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  summaryHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  summaryIconContainer: {
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.h1,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  summarySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summarySection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summarySectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  xpSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  xpSectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  xpBreakdown: {
    gap: spacing.sm,
  },
  xpItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  xpItemLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  xpItemValue: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  xpDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  xpTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  xpTotalLabel: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  xpTotalValue: {
    ...typography.h4,
    color: colors.success,
    fontWeight: '700',
  },
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning + '20',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  levelUpText: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '700',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },

  ratingsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  ratingContainer: {
    gap: spacing.xs,
  },
  ratingLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  required: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  starButton: {
    padding: spacing.xs,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: colors.border,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: colors.textSecondary,
  },
});
