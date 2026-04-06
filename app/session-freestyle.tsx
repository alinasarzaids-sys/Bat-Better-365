import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { sessionService } from '@/services/sessionService';
import { progressService } from '@/services/progressService';
import { useAuth, useAlert } from '@/template';
import { useActiveSession } from '@/hooks/useActiveSession';
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
  '🎪 Vary your practice — don\'t just groove one shot',
  '🔄 Reset after mistakes - champions have short memories',
];

function formatElapsedTime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function FreestyleSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const session = useActiveSession();
  const tipRotation = useRef<NodeJS.Timeout | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = React.useState(0);

  // Pre-fill date from calendar params if provided (only on first mount when not active)
  const prefilledDateStr = params.date as string | undefined;
  useEffect(() => {
    if (prefilledDateStr && !session.isActive) {
      const [y, m, d] = prefilledDateStr.split('-').map(Number);
      session.setScheduledDate(new Date(y, m - 1, d));
      session.setSessionMode('later');
    }
  }, [prefilledDateStr]);

  // Tip rotation only while step 2 is active and visible
  useEffect(() => {
    if (session.currentStep === 2 && !session.isPaused) {
      tipRotation.current = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % SESSION_TIPS.length);
      }, 15000);
    } else {
      if (tipRotation.current) clearInterval(tipRotation.current);
    }
    return () => { if (tipRotation.current) clearInterval(tipRotation.current); };
  }, [session.currentStep, session.isPaused]);

  // Derived averages
  const physicalRating = session.energyLevel > 0 || session.reactionSpeed > 0
    ? Math.round(((session.energyLevel || 0) + (session.reactionSpeed || 0)) / ([session.energyLevel, session.reactionSpeed].filter(v => v > 0).length))
    : 0;
  const mentalRating = session.focus > 0 || session.confidence > 0 || session.pressureHandling > 0
    ? Math.round(((session.focus || 0) + (session.confidence || 0) + (session.pressureHandling || 0)) / [session.focus, session.confidence, session.pressureHandling].filter(v => v > 0).length)
    : 0;
  const tacticalRating = session.shotSelection > 0 || session.gameAwareness > 0
    ? Math.round(((session.shotSelection || 0) + (session.gameAwareness || 0)) / ([session.shotSelection, session.gameAwareness].filter(v => v > 0).length))
    : 0;
  const technicalRating = session.shotExecution > 0 || session.footwork > 0 || session.timing > 0
    ? Math.round(((session.shotExecution || 0) + (session.footwork || 0) + (session.timing || 0)) / [session.shotExecution, session.footwork, session.timing].filter(v => v > 0).length)
    : 0;

  const toggleTrainingType = (type: TrainingType) => {
    const newSet = new Set(session.selectedTrainingTypes);
    if (newSet.has(type)) newSet.delete(type);
    else newSet.add(type);
    session.setSelectedTrainingTypes(newSet);
  };

  const handleStartSession = async () => {
    if (session.selectedTrainingTypes.size === 0) {
      showAlert('Error', 'Please select at least one training type');
      return;
    }
    if (session.sessionMode === 'later') {
      await handleScheduleForLater();
      return;
    }
    session.startActiveSession(new Date());
  };

  const handleScheduleForLater = async () => {
    if (!user) { showAlert('Error', 'You must be logged in'); return; }
    session.setSaving(true);
    const scheduledDateTime = new Date(
      session.scheduledDate.getFullYear(), session.scheduledDate.getMonth(), session.scheduledDate.getDate(),
      session.scheduledTime.getHours(), session.scheduledTime.getMinutes()
    );
    const trainingTypesText = Array.from(session.selectedTrainingTypes)
      .map(t => TRAINING_TYPES.find(tt => tt.id === t)?.label).join(', ');
    let notes = `Training Types: ${trainingTypesText}\n`;
    if (session.focusArea) notes += `Focus Area: ${session.focusArea}\n`;
    if (session.sessionGoal) notes += `Session Goal: ${session.sessionGoal}`;
    const { error } = await sessionService.createSession({
      user_id: user.id, title: 'Freestyle Session',
      scheduled_date: scheduledDateTime.toISOString(),
      duration_minutes: parseInt(session.estimatedDuration),
      session_type: 'Freestyle', status: 'planned', notes,
    });
    session.setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Success', 'Session scheduled successfully');
    session.resetSession();
    router.back();
  };

  const handleMinimize = () => {
    session.minimizeSession();
    router.back();
  };

  const handleEndSession = () => {
    if (tipRotation.current) clearInterval(tipRotation.current);
    session.setBallsFaced(session.ballsFacedLive.toString());
    session.endActiveSession();
  };

  const isStep3Valid = () => {
    const hasTechnical = session.shotExecution > 0 || session.footwork > 0 || session.timing > 0;
    const hasMental = session.focus > 0 || session.confidence > 0 || session.pressureHandling > 0;
    const hasPhysical = session.energyLevel > 0 || session.reactionSpeed > 0;
    const hasTactical = session.shotSelection > 0 || session.gameAwareness > 0;
    return hasTechnical && hasMental && hasPhysical && hasTactical;
  };

  const handleCompleteSession = async () => {
    if (!user) { showAlert('Error', 'You must be logged in'); return; }
    if (!isStep3Valid()) {
      showAlert('Incomplete', 'Please rate at least one metric in each pillar (Technical, Mental, Physical, Tactical)');
      return;
    }
    session.setSaving(true);
    const actualDuration = Math.floor(session.elapsedSeconds / 60);
    const trainingTypesText = Array.from(session.selectedTrainingTypes)
      .map(t => TRAINING_TYPES.find(tt => tt.id === t)?.label).join(', ');
    const middlePct = session.ballsFaced && session.ballsMiddled && parseInt(session.ballsFaced) > 0
      ? Math.round((parseInt(session.ballsMiddled) / parseInt(session.ballsFaced)) * 100) : 0;

    let notes = `Training Types: ${trainingTypesText}\n`;
    if (session.focusArea) notes += `Focus Area: ${session.focusArea}\n`;
    if (session.sessionGoal) notes += `Session Goal: ${session.sessionGoal}\n`;
    notes += `\n--- Batting Stats ---\n`;
    if (session.ballsFaced) notes += `Balls Faced: ${session.ballsFaced}\n`;
    if (session.ballsMiddled) notes += `Balls Middled: ${session.ballsMiddled}\n`;
    if (middlePct > 0) notes += `Middle %: ${middlePct}\n`;
    notes += `\n--- Technical ---\n`;
    notes += `Shot Execution: ${session.shotExecution}/5\nFootwork: ${session.footwork}/5\nTiming: ${session.timing}/5\n`;
    notes += `\n--- Mental ---\n`;
    notes += `Focus: ${session.focus}/5\nConfidence: ${session.confidence}/5\nPressure Handling: ${session.pressureHandling}/5\n`;
    notes += `\n--- Physical ---\n`;
    notes += `Energy Level: ${session.energyLevel}/5\nReaction Speed: ${session.reactionSpeed}/5\n`;
    notes += `\n--- Tactical ---\n`;
    notes += `Shot Selection: ${session.shotSelection}/5\nGame Awareness: ${session.gameAwareness}/5\n`;
    notes += `\nPhysical: ${physicalRating}/5\nMental: ${mentalRating}/5\nTactical: ${tacticalRating}/5\nTechnical: ${technicalRating}/5`;
    if (session.sessionNotes) notes += `\n\nNotes: ${session.sessionNotes}`;

    const { error } = await sessionService.createSession({
      user_id: user.id, title: 'Freestyle Session',
      scheduled_date: session.sessionStartTime?.toISOString() || new Date().toISOString(),
      duration_minutes: actualDuration, session_type: 'Freestyle', status: 'completed', notes,
    });
    if (error) { session.setSaving(false); showAlert('Error', error); return; }

    const avgRating = (physicalRating + mentalRating + tacticalRating + technicalRating) / 4;
    const { data: xpResult, error: xpError } = await progressService.awardDrillXP(user.id, 'Physical', Math.round(avgRating), actualDuration);
    if (xpError || !xpResult) { session.setSaving(false); showAlert('Error', 'Failed to save progress'); return; }

    session.setSaving(false);
    session.setXpBreakdown(xpResult.xpBreakdown);
    session.setCurrentStep(4);
  };

  const RatingStars = ({
    rating, onRate, label, sublabel, color,
  }: { rating: number; onRate: (r: number) => void; label: string; sublabel?: string; color?: string }) => (
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
        {[1, 2, 3, 4, 5].map(star => (
          <Pressable key={star} onPress={() => onRate(star)} style={styles.starButton}>
            <MaterialIcons name={star <= rating ? 'star' : 'star-border'} size={30} color={star <= rating ? (color || colors.tactical) : colors.border} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  // ─── Step renders ───────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.modeSelection}>
        <Text style={styles.stepTitle}>When do you want to train?</Text>
        <View style={styles.modeButtons}>
          <Pressable style={[styles.modeButton, session.sessionMode === 'now' && styles.modeButtonActive]} onPress={() => session.setSessionMode('now')}>
            <MaterialIcons name="play-arrow" size={24} color={session.sessionMode === 'now' ? colors.textLight : colors.primary} />
            <Text style={[styles.modeButtonText, session.sessionMode === 'now' && styles.modeButtonTextActive]}>Start Now</Text>
          </Pressable>
          <Pressable style={[styles.modeButton, session.sessionMode === 'later' && styles.modeButtonActive]} onPress={() => session.setSessionMode('later')}>
            <MaterialIcons name="schedule" size={24} color={session.sessionMode === 'later' ? colors.textLight : colors.primary} />
            <Text style={[styles.modeButtonText, session.sessionMode === 'later' && styles.modeButtonTextActive]}>Schedule Later</Text>
          </Pressable>
        </View>
      </View>

      {session.sessionMode === 'later' && (
        <View style={styles.dateTimeSection}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Date</Text>
            {prefilledDateStr ? (
              <View style={[styles.dateTimeButton, { backgroundColor: colors.primary + '12' }]}>
                <MaterialIcons name="event" size={20} color={colors.primary} />
                <Text style={[styles.dateTimeButtonText, { color: colors.primary, fontWeight: '600' }]}>
                  {session.scheduledDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
                <MaterialIcons name="lock" size={16} color={colors.primary} />
              </View>
            ) : (
              <Pressable style={styles.dateTimeButton} onPress={() => {}}>
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <Text style={styles.dateTimeButtonText}>
                  {session.scheduledDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
              </Pressable>
            )}
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Time</Text>
            <Pressable style={styles.dateTimeButton}>
              <MaterialIcons name="access-time" size={20} color={colors.primary} />
              <Text style={styles.dateTimeButtonText}>
                {session.scheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.stepTitle}>What are you training with today?</Text>
      <Text style={styles.stepSubtitle}>Select all that apply</Text>
      <View style={styles.trainingTypesGrid}>
        {TRAINING_TYPES.map(type => {
          const isSelected = session.selectedTrainingTypes.has(type.id);
          return (
            <Pressable key={type.id} style={[styles.trainingTypeCard, isSelected && styles.trainingTypeCardSelected]} onPress={() => toggleTrainingType(type.id)}>
              <View style={[styles.trainingTypeIcon, isSelected && styles.trainingTypeIconSelected]}>
                <MaterialIcons name={type.icon as any} size={32} color={isSelected ? colors.textLight : colors.primary} />
              </View>
              <Text style={[styles.trainingTypeLabel, isSelected && styles.trainingTypeLabelSelected]}>{type.label}</Text>
              {isSelected && <View style={styles.checkMark}><MaterialIcons name="check-circle" size={24} color={colors.success} /></View>}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.additionalFields}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Focus Area (Optional)</Text>
          <TextInput style={styles.input} value={session.focusArea} onChangeText={session.setFocusArea} placeholder="e.g., Cover drives, Pull shots" placeholderTextColor={colors.textSecondary} />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Session Goal (Optional)</Text>
          <TextInput style={styles.input} value={session.sessionGoal} onChangeText={session.setSessionGoal} placeholder="e.g., Improve timing" placeholderTextColor={colors.textSecondary} />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Estimated Duration</Text>
          <View style={styles.durationOptions}>
            {['15', '30', '45', '60', '90'].map(mins => (
              <Pressable key={mins} style={[styles.durationOption, session.estimatedDuration === mins && styles.durationOptionSelected]} onPress={() => session.setEstimatedDuration(mins)}>
                <Text style={[styles.durationOptionText, session.estimatedDuration === mins && styles.durationOptionTextSelected]}>{mins} min</Text>
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
        <Text style={styles.timerDisplay}>{formatElapsedTime(session.elapsedSeconds)}</Text>
        <View style={styles.timerButtonRow}>
          <Pressable style={styles.pauseButton} onPress={() => session.setIsPaused(!session.isPaused)}>
            <MaterialIcons name={session.isPaused ? 'play-arrow' : 'pause'} size={24} color={colors.textLight} />
            <Text style={styles.pauseButtonText}>{session.isPaused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
          <Pressable style={styles.minimizeButton} onPress={handleMinimize}>
            <MaterialIcons name="minimize" size={20} color={colors.primary} />
            <Text style={styles.minimizeButtonText}>Minimise</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.liveStatsSection}>
        <View style={styles.liveStatCard}>
          <MaterialIcons name="sports-cricket" size={32} color={colors.primary} />
          <TextInput
            style={styles.liveStatValue}
            value={session.ballsFacedInput}
            onChangeText={v => {
              const n = v.replace(/[^0-9]/g, '');
              session.setBallsFacedInput(n);
              session.setBallsFacedLive(parseInt(n) || 0);
            }}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Text style={styles.liveStatLabel}>Balls Faced</Text>
          <View style={styles.liveStatButtons}>
            <Pressable style={styles.liveStatButton} onPress={() => {
              const n = Math.max(0, session.ballsFacedLive - 1);
              session.setBallsFacedLive(n);
              session.setBallsFacedInput(n.toString());
            }}>
              <MaterialIcons name="remove" size={20} color={colors.textLight} />
            </Pressable>
            <Pressable style={styles.liveStatButton} onPress={() => {
              const n = session.ballsFacedLive + 1;
              session.setBallsFacedLive(n);
              session.setBallsFacedInput(n.toString());
            }}>
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
          {Array.from(session.selectedTrainingTypes).map(typeId => {
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

      <View style={styles.statsSectionCard}>
        <View style={styles.statsSectionHeader}>
          <MaterialIcons name="sports-cricket" size={20} color={colors.primary} />
          <Text style={styles.statsSectionTitle}>Batting Stats</Text>
        </View>
        <View style={styles.statsRow3}>
          <View style={styles.statInputBlock}>
            <Text style={styles.statInputLabel}>Balls Faced</Text>
            <TextInput style={styles.statInput} value={session.ballsFaced} onChangeText={session.setBallsFaced} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
          </View>
          <View style={styles.statInputBlock}>
            <Text style={styles.statInputLabel}>Balls Middled</Text>
            <TextInput style={styles.statInput} value={session.ballsMiddled} onChangeText={session.setBallsMiddled} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
          </View>
        </View>
        {session.ballsFaced && session.ballsMiddled && parseInt(session.ballsFaced) > 0 && (
          <View style={styles.middlePctBadge}>
            <MaterialIcons name="gps-fixed" size={14} color={colors.success} />
            <Text style={styles.middlePctText}>Middle %: {Math.round((parseInt(session.ballsMiddled) / parseInt(session.ballsFaced)) * 100)}%</Text>
          </View>
        )}
      </View>

      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.technical }]}>
          <MaterialIcons name="sports-cricket" size={18} color={colors.technical} />
          <Text style={[styles.pillarSectionTitle, { color: colors.technical }]}>Technical</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={session.shotExecution} onRate={session.setShotExecution} label="Shot Execution" sublabel="How clean and correct was your technique?" color={colors.technical} />
        <RatingStars rating={session.footwork} onRate={session.setFootwork} label="Footwork" sublabel="Was your foot movement into position good?" color={colors.technical} />
        <RatingStars rating={session.timing} onRate={session.setTiming} label="Timing" sublabel="How well did you time the ball?" color={colors.technical} />
      </View>

      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.mental }]}>
          <MaterialIcons name="psychology" size={18} color={colors.mental} />
          <Text style={[styles.pillarSectionTitle, { color: colors.mental }]}>Mental</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={session.focus} onRate={session.setFocus} label="Focus & Concentration" sublabel="How well did you stay in the zone?" color={colors.mental} />
        <RatingStars rating={session.confidence} onRate={session.setConfidence} label="Confidence" sublabel="How confident did you feel at the crease?" color={colors.mental} />
        <RatingStars rating={session.pressureHandling} onRate={session.setPressureHandling} label="Pressure Handling" sublabel="How well did you manage pressure situations?" color={colors.mental} />
      </View>

      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.physical }]}>
          <MaterialIcons name="fitness-center" size={18} color={colors.physical} />
          <Text style={[styles.pillarSectionTitle, { color: colors.physical }]}>Physical</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={session.energyLevel} onRate={session.setEnergyLevel} label="Energy Level" sublabel="How energetic and fit did you feel?" color={colors.physical} />
        <RatingStars rating={session.reactionSpeed} onRate={session.setReactionSpeed} label="Reaction Speed" sublabel="How quickly did you pick up the ball?" color={colors.physical} />
      </View>

      <View style={styles.pillarSection}>
        <View style={[styles.pillarSectionHeader, { borderLeftColor: colors.tactical }]}>
          <MaterialIcons name="lightbulb" size={18} color={colors.tactical} />
          <Text style={[styles.pillarSectionTitle, { color: colors.tactical }]}>Tactical</Text>
          <Text style={styles.requiredNote}>* at least one required</Text>
        </View>
        <RatingStars rating={session.shotSelection} onRate={session.setShotSelection} label="Shot Selection" sublabel="Did you play the right shots at the right time?" color={colors.tactical} />
        <RatingStars rating={session.gameAwareness} onRate={session.setGameAwareness} label="Game Awareness" sublabel="How well did you read the game situation?" color={colors.tactical} />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Session Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={session.sessionNotes}
          onChangeText={session.setSessionNotes}
          multiline numberOfLines={4}
          placeholder="Any observations or key takeaways?"
          placeholderTextColor={colors.textSecondary}
          textAlignVertical="top"
        />
      </View>
    </ScrollView>
  );

  const renderStep4 = () => {
    const middlePct = session.ballsFaced && session.ballsMiddled && parseInt(session.ballsFaced) > 0
      ? Math.round((parseInt(session.ballsMiddled) / parseInt(session.ballsFaced)) * 100) : null;
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryIconContainer}>
            <MaterialIcons name="check-circle" size={80} color={colors.success} />
          </View>
          <Text style={styles.summaryTitle}>Session Complete!</Text>
          <Text style={styles.summarySubtitle}>Great work today</Text>
        </View>
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatCard}>
            <MaterialIcons name="timer" size={22} color={colors.primary} />
            <Text style={styles.quickStatValue}>{Math.floor(session.elapsedSeconds / 60)}</Text>
            <Text style={styles.quickStatLabel}>Minutes</Text>
          </View>
          {session.ballsFaced ? (
            <View style={styles.quickStatCard}>
              <MaterialIcons name="sports-cricket" size={22} color={colors.technical} />
              <Text style={styles.quickStatValue}>{session.ballsFaced}</Text>
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
        </View>

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

        {session.xpBreakdown && (
          <View style={styles.xpSection}>
            <Text style={styles.xpSectionTitle}>XP Earned</Text>
            <View style={styles.xpBreakdown}>
              <View style={styles.xpItem}><Text style={styles.xpItemLabel}>Session Completion</Text><Text style={styles.xpItemValue}>+10 XP</Text></View>
              {session.xpBreakdown.goodRatingBonus > 0 && <View style={styles.xpItem}><Text style={styles.xpItemLabel}>Good Performance Rating</Text><Text style={styles.xpItemValue}>+{session.xpBreakdown.goodRatingBonus} XP</Text></View>}
              {session.xpBreakdown.consistencyBonus > 0 && <View style={styles.xpItem}><Text style={styles.xpItemLabel}>Consistency Bonus</Text><Text style={styles.xpItemValue}>+{session.xpBreakdown.consistencyBonus} XP</Text></View>}
              {session.xpBreakdown.streakBonus > 0 && <View style={styles.xpItem}><Text style={styles.xpItemLabel}>Streak Bonus</Text><Text style={styles.xpItemValue}>+{session.xpBreakdown.streakBonus} XP</Text></View>}
              <View style={styles.xpDivider} />
              <View style={styles.xpTotal}><Text style={styles.xpTotalLabel}>Total XP Earned</Text><Text style={styles.xpTotalValue}>+{session.xpBreakdown.totalXP} XP</Text></View>
            </View>
            {session.xpBreakdown.levelUp && (
              <View style={styles.levelUpBanner}>
                <MaterialIcons name="star" size={24} color={colors.warning} />
                <Text style={styles.levelUpText}>Level Up! You are now {session.xpBreakdown.newLevel}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  const getStepTitle = () => {
    switch (session.currentStep) {
      case 1: return 'Setup Session';
      case 2: return 'Active Session';
      case 3: return 'Session Feedback';
      case 4: return 'Summary';
      default: return '';
    }
  };

  const getFooterButton = () => {
    switch (session.currentStep) {
      case 1:
        return (
          <Pressable
            style={[styles.saveButton, (session.selectedTrainingTypes.size === 0 || session.saving) && styles.saveButtonDisabled]}
            onPress={handleStartSession}
          >
            <MaterialIcons name={session.sessionMode === 'later' ? 'schedule' : 'play-arrow'} size={20} color={colors.textLight} />
            <Text style={styles.saveButtonText}>
              {session.saving ? 'Saving...' : session.sessionMode === 'later' ? 'Schedule Session' : 'Start Session'}
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
            style={[styles.saveButton, (!isStep3Valid() || session.saving) && styles.saveButtonDisabled]}
            onPress={handleCompleteSession}
          >
            <MaterialIcons name="check" size={20} color={colors.textLight} />
            <Text style={styles.saveButtonText}>{session.saving ? 'Saving...' : 'Complete Session'}</Text>
          </Pressable>
        );
      case 4:
        return (
          <View style={styles.footerRow}>
            <Pressable
              style={styles.analyticsButton}
              onPress={() => {
                session.resetSession();
                router.replace('/(tabs)/analytics' as any);
              }}
            >
              <MaterialIcons name="analytics" size={20} color={colors.primary} />
              <Text style={styles.analyticsButtonText}>View Analytics</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={() => { session.resetSession(); router.replace('/(tabs)' as any); }}>
              <MaterialIcons name="home" size={20} color={colors.textLight} />
              <Text style={styles.saveButtonText}>Done</Text>
            </Pressable>
          </View>
        );
      default: return null;
    }
  };

  const handleBack = () => {
    if (session.currentStep === 1) {
      session.resetSession();
      router.back();
    } else if (session.currentStep === 2) {
      handleMinimize();
    } else {
      session.setCurrentStep(Math.max(1, session.currentStep - 1));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <MaterialIcons name={session.currentStep === 2 ? 'minimize' : session.currentStep === 1 ? 'close' : 'arrow-back'} size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
          <Text style={styles.headerSubtitle}>Step {session.currentStep} of 4</Text>
        </View>
        {session.currentStep === 2 ? (
          <Pressable onPress={handleMinimize} style={[styles.headerButton, styles.headerMinimizeBtn]}>
            <MaterialIcons name="open-in-new" size={20} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map(step => (
          <View key={step} style={[styles.progressSegment, step <= session.currentStep && styles.progressSegmentActive]} />
        ))}
      </View>

      {session.currentStep === 1 && renderStep1()}
      {session.currentStep === 2 && renderStep2()}
      {session.currentStep === 3 && renderStep3()}
      {session.currentStep === 4 && renderStep4()}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) }]}>
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
  headerMinimizeBtn: { alignItems: 'flex-end' },
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
  timerButtonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'center' },
  pauseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, flex: 1,
  },
  pauseButtonText: { ...typography.body, color: colors.textLight, fontWeight: '600' },
  minimizeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primary + '15', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.primary,
  },
  minimizeButtonText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  liveStatsSection: { gap: spacing.md },
  liveStatCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    alignItems: 'center', gap: spacing.sm,
  },
  liveStatValue: { fontSize: 48, color: colors.text, fontWeight: '700', textAlign: 'center', minWidth: 100 },
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

  // Step 3
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
    paddingVertical: spacing.md, width: '100%', ...typography.h4, color: colors.text, fontWeight: '700', textAlign: 'center',
  },
  middlePctBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md,
    backgroundColor: colors.success + '15', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, alignSelf: 'flex-start',
  },
  middlePctText: { ...typography.body, color: colors.success, fontWeight: '700' },
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
  ratingContainer: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  ratingLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  ratingLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  ratingValueBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  ratingValueText: { ...typography.caption, fontWeight: '700' },
  ratingSublabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  starsRow: { flexDirection: 'row', gap: spacing.xs },
  starButton: { padding: spacing.xs },

  // Step 4
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
  summaryPillarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
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
  footer: {
    padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 8,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    flex: 1, minHeight: 52,
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
