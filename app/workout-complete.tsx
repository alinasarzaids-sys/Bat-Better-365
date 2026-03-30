import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { progressService } from '@/services/progressService';
import { sessionService } from '@/services/sessionService';
import { useAuth, useAlert, getSupabaseClient } from '@/template';

type DifficultyLevel = 'Easy' | 'Moderate' | 'Hard';

export default function WorkoutCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  // Workout stats from params
  const [totalSets, setTotalSets] = useState(parseInt(params.totalSets as string) || 0);
  const [totalReps, setTotalReps] = useState(parseInt(params.totalReps as string) || 0);
  const [totalWeight, setTotalWeight] = useState(parseFloat(params.totalWeight as string) || 0);
  const [sessionTime, setSessionTime] = useState((params.sessionTime as string) || '0:00');
  const [estimatedCalories, setEstimatedCalories] = useState(parseInt(params.estimatedCalories as string) || 0);
  const [drillName, setDrillName] = useState((params.drillName as string) || 'Physical Training');
  const drillId = params.drillId as string || '';
  const timeElapsed = parseInt(params.timeElapsed as string) || 0;

  // Feedback state
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Moderate');
  const [energyLevel, setEnergyLevel] = useState(3);
  const [fatigueLevel, setFatigueLevel] = useState(2);
  const [mood, setMood] = useState(7);
  const [confidence, setConfidence] = useState(6);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Update stats from route params when they change
    if (params.totalSets) setTotalSets(parseInt(params.totalSets as string));
    if (params.totalReps) setTotalReps(parseInt(params.totalReps as string));
    if (params.totalWeight) setTotalWeight(parseFloat(params.totalWeight as string));
    if (params.sessionTime) setSessionTime(params.sessionTime as string);
    if (params.estimatedCalories) setEstimatedCalories(parseInt(params.estimatedCalories as string));
    if (params.drillName) setDrillName(params.drillName as string);
  }, [params]);

  const handleSaveAndContinue = async () => {
    if (!user) {
      showAlert('Error', 'Please log in to save your session');
      return;
    }

    // Calculate session duration in minutes from sessionTime (format: "M:SS")
    const [minutes, seconds] = sessionTime.split(':').map(Number);
    const totalMinutes = minutes + Math.floor(seconds / 60);

    // Validate minimum session duration
    if (totalMinutes < 1) {
      showAlert(
        'Session Too Short',
        'Please train for at least 1 minute before saving your progress. This session was only ' + sessionTime + '.'
      );
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseClient();

      // Save workout performance feedback to workout_drill_logs
      const { error: drillLogError } = await supabase.from('workout_drill_logs').insert({
        user_id: user.id,
        drill_id: drillId || null,
        drill_name: drillName,
        time_elapsed: timeElapsed || (totalMinutes * 60),
        technique_quality: energyLevel,
        consistency: null,
        shot_control: null,
        timing: null,
        focus_level: null,
        confidence_level: confidence,
        reflection_notes: notes.trim() || null,
      });

      if (drillLogError) {
        console.error('Error saving workout feedback:', drillLogError);
        // Continue even if log fails - don't block XP award
      }

      // Create session record
      const sessionData = {
        user_id: user.id,
        title: drillName,
        scheduled_date: new Date().toISOString(),
        duration_minutes: totalMinutes,
        session_type: 'Structured',
        status: 'completed',
        notes: notes || `Sets: ${totalSets}, Reps: ${totalReps}, Weight: ${totalWeight}kg`,
        completed_at: new Date().toISOString(),
      };

      const { data: session, error: sessionError } = await sessionService.createSession(sessionData);

      if (sessionError || !session) {
        throw new Error(sessionError || 'Failed to create session');
      }

      // Save session log with performance feedback
      const logData = {
        session_id: session.id,
        user_id: user.id,
        mood: mood,
        energy: energyLevel,
        confidence: confidence,
        performance_rating: Math.round((energyLevel + mood + confidence) / 3),
        notes: notes || '',
      };

      const { error: sessionLogError } = await progressService.createSessionLog(logData);
      if (sessionLogError) {
        console.error('Session log error:', sessionLogError);
      }

      // Calculate performance rating from sliders
      const performanceRating = Math.round((energyLevel + mood + confidence) / 3);

      // Award XP using the new system
      const { data: xpResult, error: xpError } = await progressService.awardDrillXP(
        user.id,
        'Physical',
        performanceRating,
        totalMinutes
      );

      if (xpError || !xpResult) {
        console.error('XP award error:', xpError);
        setSaving(false);
        showAlert(
          'Save Failed',
          xpError || 'Unable to save your progress. Please check your internet connection and try again.'
        );
        return;
      }

      const { progress, xpBreakdown } = xpResult;
      const totalXP = progressService.calculateTotalXP(progress);

      setSaving(false);

      // Navigate to success screen with XP breakdown
      router.replace({
        pathname: '/session-success',
        params: {
          xpEarned: xpBreakdown.totalXP.toString(),
          baseXP: xpBreakdown.baseXP.toString(),
          ratingBonus: xpBreakdown.ratingBonus.toString(),
          consistencyBonus: xpBreakdown.consistencyBonus.toString(),
          streakBonus: xpBreakdown.streakBonus.toString(),
          totalXp: totalXP.toString(),
          pillarPoints: progress.physical_points.toString(),
          pillarName: 'Physical',
          drillsCompleted: '1',
          minutesTrained: totalMinutes.toString(),
          newLevel: progress.skill_level,
        },
      } as any);
    } catch (error) {
      setSaving(false);
      showAlert('Error', error instanceof Error ? error.message : 'Failed to save session');
    }
  };

  const handleSkipAndReturn = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Workout Complete</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trophy Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="emoji-events" size={64} color={colors.textLight} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Workout Complete! 💪</Text>
        <Text style={styles.subtitle}>Beast mode activated! Your body just got stronger!</Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardBlue]}>
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>Total Sets</Text>
          </View>
          <View style={[styles.statCard, styles.statCardGreen]}>
            <Text style={styles.statValue}>{totalReps}</Text>
            <Text style={styles.statLabel}>Total Reps</Text>
          </View>
          <View style={[styles.statCard, styles.statCardPurple]}>
            <Text style={styles.statValue}>{totalWeight}</Text>
            <Text style={styles.statLabel}>Total Weight (kg)</Text>
          </View>
          <View style={[styles.statCard, styles.statCardOrange]}>
            <Text style={styles.statValue}>{sessionTime}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        </View>

        {/* Calories Section */}
        <View style={styles.caloriesCard}>
          <Text style={styles.caloriesIcon}>🔥</Text>
          <Text style={styles.caloriesValue}>{estimatedCalories} cal</Text>
          <Text style={styles.caloriesLabel}>Estimated Calories Burned</Text>
        </View>

        {/* Physical Performance Feedback */}
        <View style={styles.feedbackSection}>
          <View style={styles.feedbackHeader}>
            <MaterialIcons name="fitness-center" size={24} color={colors.success} />
            <Text style={styles.feedbackTitle}>Physical Performance Feedback</Text>
          </View>

          {/* Difficulty Selection */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>How challenging was today's session?</Text>
            <View style={styles.difficultyButtons}>
              <Pressable
                style={[
                  styles.difficultyButton,
                  difficulty === 'Easy' && styles.difficultyButtonActive,
                ]}
                onPress={() => setDifficulty('Easy')}
              >
                <Text
                  style={[
                    styles.difficultyButtonText,
                    difficulty === 'Easy' && styles.difficultyButtonTextActive,
                  ]}
                >
                  Easy
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.difficultyButton,
                  difficulty === 'Moderate' && styles.difficultyButtonActive,
                ]}
                onPress={() => setDifficulty('Moderate')}
              >
                <Text
                  style={[
                    styles.difficultyButtonText,
                    difficulty === 'Moderate' && styles.difficultyButtonTextActive,
                  ]}
                >
                  Moderate
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.difficultyButton,
                  difficulty === 'Hard' && styles.difficultyButtonActive,
                ]}
                onPress={() => setDifficulty('Hard')}
              >
                <Text
                  style={[
                    styles.difficultyButtonText,
                    difficulty === 'Hard' && styles.difficultyButtonTextActive,
                  ]}
                >
                  Hard
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Energy Level Slider */}
          <View style={styles.questionSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.questionLabel}>Energy level during drill (1-5)</Text>
              <Text style={styles.sliderValue}>{energyLevel}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={5}
              step={1}
              value={energyLevel}
              onValueChange={setEnergyLevel}
              minimumTrackTintColor="#000000"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#FFFFFF"
            />
          </View>

          {/* Fatigue Level Slider */}
          <View style={styles.questionSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.questionLabel}>Soreness/Fatigue level (1-5)</Text>
              <Text style={styles.sliderValue}>{fatigueLevel}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={5}
              step={1}
              value={fatigueLevel}
              onValueChange={setFatigueLevel}
              minimumTrackTintColor="#000000"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#FFFFFF"
            />
          </View>

          {/* Mood Slider */}
          <View style={styles.questionSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.questionLabel}>Overall Mood (1-10)</Text>
              <Text style={styles.sliderValue}>{mood}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={mood}
              onValueChange={setMood}
              minimumTrackTintColor="#000000"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#FFFFFF"
            />
          </View>

          {/* Confidence Slider */}
          <View style={styles.questionSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.questionLabel}>Confidence (1-10)</Text>
              <Text style={styles.sliderValue}>{confidence}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={confidence}
              onValueChange={setConfidence}
              minimumTrackTintColor="#000000"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#FFFFFF"
            />
          </View>

          {/* Session Notes */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>Session Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did you feel? Any improvements or challenges?"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveAndContinue}
          disabled={saving}
        >
          <MaterialIcons name="check-circle" size={24} color={colors.textLight} />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save & Continue'}
          </Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={handleSkipAndReturn}>
          <Text style={styles.skipButtonText}>Skip & Return</Text>
        </Pressable>
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
  backButton: {
    padding: spacing.xs,
    width: 40,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl * 3,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #4CAF50 0%, #2196F3 100%)',
    backgroundColor: colors.success,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  statCardBlue: {
    backgroundColor: '#E3F2FD',
  },
  statCardGreen: {
    backgroundColor: '#E8F5E9',
  },
  statCardPurple: {
    backgroundColor: '#F3E5F5',
  },
  statCardOrange: {
    backgroundColor: '#FFF3E0',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  caloriesCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  caloriesIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  caloriesValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: spacing.xs,
  },
  caloriesLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  feedbackSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  feedbackTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  questionSection: {
    gap: spacing.md,
  },
  questionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  difficultyButtonActive: {
    backgroundColor: '#212121',
    borderColor: '#212121',
  },
  difficultyButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  difficultyButtonTextActive: {
    color: colors.textLight,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B35',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 100,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    background: 'linear-gradient(90deg, #4CAF50 0%, #2196F3 100%)',
    backgroundColor: colors.success,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 18,
  },
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
});
