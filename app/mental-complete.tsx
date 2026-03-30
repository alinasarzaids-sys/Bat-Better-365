import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient, useAuth, useAlert } from '@/template';
import { progressService } from '@/services/progressService';

const { width } = Dimensions.get('window');

type MoodEmoji = '😃' | '😔' | '😟' | '😠' | '😐';

export default function MentalCompleteScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const drillName = params.drillName as string || 'Mental Training Drill';
  const drillId = params.drillId as string;
  const timeElapsed = parseInt(params.timeElapsed as string) || 0;

  // 3-Key Question System (1-5 scale)
  const [adherence, setAdherence] = useState(3);
  const [adherenceNote, setAdherenceNote] = useState('');
  const [engagement, setEngagement] = useState(3);
  const [engagementNote, setEngagementNote] = useState('');
  const [integration, setIntegration] = useState(3);
  const [integrationNote, setIntegrationNote] = useState('');

  // Mood & Confidence
  const [moodSnapshot, setMoodSnapshot] = useState<MoodEmoji>('😃');
  const [confidenceLevel, setConfidenceLevel] = useState(3);

  // Reflection
  const [reflectionNotes, setReflectionNotes] = useState('');

  const [saving, setSaving] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to save feedback');
      return;
    }

    // Validate minimum session duration (1 minute)
    const durationMinutes = Math.floor(timeElapsed / 60);
    if (durationMinutes < 1) {
      showAlert(
        'Session Too Short',
        'Please train for at least 1 minute before saving your progress. This session was only ' + formatTime(timeElapsed) + '.'
      );
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseClient();

      // Save mental performance feedback
      const { error } = await supabase.from('mental_drill_logs').insert({
        user_id: user.id,
        drill_id: drillId,
        drill_name: drillName,
        time_elapsed: timeElapsed,
        adherence,
        adherence_note: adherenceNote.trim() || null,
        engagement,
        engagement_note: engagementNote.trim() || null,
        integration,
        integration_note: integrationNote.trim() || null,
        mood_snapshot: moodSnapshot,
        confidence_level: confidenceLevel,
        reflection_notes: reflectionNotes.trim() || null,
      });

      if (error) {
        console.error('Error saving mental feedback:', error);
        showAlert('Error', 'Failed to save feedback. Please try again.');
        setSaving(false);
        return;
      }

      // Calculate performance rating from the 3 key metrics (1-5 scale)
      const performanceRating = Math.round(
        ((adherence / 5) * 10 + (engagement / 5) * 10 + (integration / 5) * 10) / 3
      );

      // Award XP using the new system
      const { data: xpResult, error: xpError } = await progressService.awardDrillXP(
        user.id,
        'Mental',
        performanceRating,
        durationMinutes
      );

      if (xpError || !xpResult) {
        console.error('XP award error:', xpError);
        showAlert(
          'Save Failed',
          xpError || 'Unable to save your progress. Please check your internet connection and try again.'
        );
        setSaving(false);
        return;
      }

      const { progress, xpBreakdown } = xpResult;
      const totalXP = progressService.calculateTotalXP(progress);

      // Small delay for UX
      setTimeout(() => {
        setSaving(false);
        // Navigate to success screen with XP breakdown
        router.push({
          pathname: '/session-success',
          params: {
            xpEarned: xpBreakdown.totalXP.toString(),
            baseXP: xpBreakdown.baseXP.toString(),
            ratingBonus: xpBreakdown.ratingBonus.toString(),
            consistencyBonus: xpBreakdown.consistencyBonus.toString(),
            streakBonus: xpBreakdown.streakBonus.toString(),
            totalXp: totalXP.toString(),
            pillarPoints: progress.mental_points.toString(),
            pillarName: 'Mental',
            drillsCompleted: '1',
            minutesTrained: durationMinutes.toString(),
            newLevel: progress.skill_level,
          },
        } as any);
      }, 500);
    } catch (err) {
      console.error('Save error:', err);
      showAlert('Error', 'An unexpected error occurred.');
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.back();
  };

  const moods: MoodEmoji[] = ['😃', '😔', '😟', '😠', '😐'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <LinearGradient
            colors={['#52B788', '#4A90E2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkIconContainer}
          >
            <MaterialIcons name="check-circle" size={40} color={colors.textLight} />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Drill Completed! 🎉</Text>
            <Text style={styles.headerSubtitle}>
              Mental warrior! You're training your mind like a champion!
            </Text>
          </View>
        </View>
        <Text style={styles.timeSpent}>Time spent: {formatTime(timeElapsed)}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Inspirational Quote */}
        <View style={styles.quoteContainer}>
          <Text style={styles.quoteText}>
            "The mind is the limit. As long as the mind can envision the fact that you can do something, you can do it."
          </Text>
        </View>

        {/* Mental Performance Feedback - All 5 Questions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="psychology" size={22} color="#9C27B0" />
            <Text style={styles.sectionTitle}>Mental Performance Feedback</Text>
          </View>
          <Text style={styles.scaleHint}>1 = low/poor  •  5 = high/excellent</Text>

          {/* 1. Adherence */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionNumber}>1. Adherence</Text>
            <Text style={styles.questionText}>
              Did I complete the drill precisely as instructed, without rushing or skipping steps?
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={adherence}
                onValueChange={setAdherence}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#4A90E2"
              />
              <Text style={[styles.sliderValue, { color: '#4A90E2' }]}>{adherence}</Text>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Optional note (e.g., 'Skipped Step 3 due to rush')"
              placeholderTextColor="#9E9E9E"
              value={adherenceNote}
              onChangeText={setAdherenceNote}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* 2. Engagement */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionNumber}>2. Engagement</Text>
            <Text style={styles.questionText}>
              How deeply did I feel the mental state I was trying to create (e.g., calm, composed, focused, instinctive)?
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={engagement}
                onValueChange={setEngagement}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#52B788"
              />
              <Text style={[styles.sliderValue, { color: '#52B788' }]}>{engagement}</Text>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Optional note (e.g., 'Hard to feel success on Step 4')"
              placeholderTextColor="#9E9E9E"
              value={engagementNote}
              onChangeText={setEngagementNote}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* 3. Integration/Impact */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionNumber}>3. Integration/Impact</Text>
            <Text style={styles.questionText}>
              How effectively did the drill connect to the purpose? (e.g., Did the drill make me more aware or ready?)
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={integration}
                onValueChange={setIntegration}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#9C27B0"
              />
              <Text style={[styles.sliderValue, { color: '#9C27B0' }]}>{integration}</Text>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Optional note (e.g., 'Felt less tight during net after breathing routine')"
              placeholderTextColor="#9E9E9E"
              value={integrationNote}
              onChangeText={setIntegrationNote}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* 4. Confidence Level */}
          <View style={styles.questionContainer}>
            <Text style={styles.questionNumber}>4. Confidence</Text>
            <Text style={styles.questionText}>
              How confident do you feel after completing this drill?
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={confidenceLevel}
                onValueChange={setConfidenceLevel}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#FF9800"
              />
              <Text style={[styles.sliderValue, { color: '#FF9800' }]}>{confidenceLevel}</Text>
            </View>
          </View>

          {/* 5. Mood Snapshot */}
          <View style={styles.questionContainerLast}>
            <Text style={styles.questionNumber}>5. Mood Snapshot</Text>
            <Text style={styles.questionText}>
              How are you feeling right now?
            </Text>
            <View style={styles.moodGrid}>
              {moods.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.moodButton,
                    moodSnapshot === emoji && styles.moodButtonSelected,
                  ]}
                  onPress={() => setMoodSnapshot(emoji)}
                >
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Reflection Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Reflection Notes (Optional)</Text>
          <View style={styles.notesInputContainer}>
            <TextInput
              style={styles.notesInput}
              placeholder="What did you learn? How did you feel during the drill?"
              placeholderTextColor="#9E9E9E"
              value={reflectionNotes}
              onChangeText={setReflectionNotes}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Pressable
          style={styles.saveButtonPressable}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={['#52B788', '#4A90E2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButton}
          >
            <MaterialIcons name="check-circle" size={24} color={colors.textLight} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save & Continue'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip & Return</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  checkIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    fontSize: 22,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...typography.body,
    color: '#9C27B0',
    fontSize: 14,
    lineHeight: 20,
  },
  timeSpent: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 3,
  },
  quoteContainer: {
    backgroundColor: '#F3E5F5',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  quoteText: {
    ...typography.body,
    color: '#6A1B9A',
    fontStyle: 'italic',
    lineHeight: 24,
    fontSize: 15,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    ...typography.h4,
    color: '#9C27B0',
    fontWeight: '600',
    fontSize: 18,
  },
  sliderContainer: {
    marginBottom: spacing.xl,
  },
  sliderLabel: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 15,
    fontWeight: '500',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    ...typography.h3,
    color: '#9C27B0',
    fontWeight: '700',
    fontSize: 24,
    minWidth: 40,
    textAlign: 'right',
  },

  scaleHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: '#F5F5F5',
    borderRadius: borderRadius.sm,
  },
  questionContainer: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  questionContainerLast: {
    marginBottom: 0,
  },
  questionNumber: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  questionText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  noteInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: spacing.sm,
  },


  moodGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moodButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodButtonSelected: {
    borderColor: '#9C27B0',
    backgroundColor: '#F3E5F5',
  },
  moodEmoji: {
    fontSize: 32,
  },

  notesSection: {
    marginBottom: spacing.lg,
  },
  notesLabel: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
    fontSize: 15,
    fontWeight: '500',
  },
  notesInputContainer: {
    position: 'relative',
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: 15,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: colors.surface,
  },
  saveButtonPressable: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
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
    color: colors.textSecondary,
    fontSize: 16,
  },
});
