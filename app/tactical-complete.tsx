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
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { progressService } from '@/services/progressService';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import Slider from '@react-native-community/slider';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function TacticalCompleteScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams();
  const drillName = params.drillName as string || 'T20 Powerplay – Green Seaming Wicket';
  const drillId = params.drillId as string || '';
  const timeElapsed = params.timeElapsed ? parseInt(params.timeElapsed as string) : 0;

  // Tactical Performance
  const [fieldReading, setFieldReading] = useState(3);
  const [shotSelectionMatched, setShotSelectionMatched] = useState<'yes' | 'no' | null>(null);
  const [adaptedPlan, setAdaptedPlan] = useState(3);
  const [confidencePressure, setConfidencePressure] = useState(3);

  // General Feedback
  const [overallMood, setOverallMood] = useState(7);
  const [confidence, setConfidence] = useState(6);
  const [sessionNotes, setSessionNotes] = useState('');

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to save progress');
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

      // Save tactical performance feedback to tactical_drill_logs
      const { error: tacticalLogError } = await supabase.from('tactical_drill_logs').insert({
        user_id: user.id,
        drill_id: drillId || null,
        drill_name: drillName,
        time_elapsed: timeElapsed,
        field_reading: fieldReading,
        shot_selection_matched: shotSelectionMatched === 'yes',
        adapted_plan: adaptedPlan,
        confidence_pressure: confidencePressure,
        overall_mood: overallMood,
        confidence,
        session_notes: sessionNotes.trim() || null,
      });

      if (tacticalLogError) {
        console.error('Error saving tactical feedback:', tacticalLogError);
        // Continue even if log fails - don't block XP award
      }
      // Calculate performance rating from tactical metrics (1-10 scale)
      const performanceRating = Math.round(
        ((fieldReading / 5) * 10 + adaptedPlan / 5 * 10 + confidencePressure / 5 * 10) / 3
      );

      // Award XP using the new system
      const { data: xpResult, error: xpError } = await progressService.awardDrillXP(
        user.id,
        'Tactical',
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
            pillarPoints: progress.tactical_points.toString(),
            pillarName: 'Tactical',
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textLight} />
        </Pressable>
        <View style={styles.headerLeft}>
          <View style={styles.shieldIconContainer}>
            <MaterialIcons name="shield" size={32} color="#FF6F42" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Drill Complete!</Text>
            <Text style={styles.headerSubtitle}>{drillName}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <MaterialIcons name="close" size={28} color={colors.textLight} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Message */}
        <View style={styles.successBanner}>
          <Text style={styles.successText}>
            Tactical genius! Your cricket IQ just went up! 🎯
          </Text>
        </View>

        {/* Tactical Performance Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="shield" size={20} color="#FF8C42" />
            <Text style={styles.sectionTitle}>Tactical Performance</Text>
          </View>

          {/* Field Reading Ability */}
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Field reading ability (1-5)</Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={fieldReading}
                onValueChange={setFieldReading}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#4A5568"
                thumbTintColor="#FFFFFF"
              />
              <Text style={styles.sliderValue}>{fieldReading}</Text>
            </View>
          </View>

          {/* Shot Selections Matched */}
          <View style={styles.radioContainer}>
            <Text style={styles.radioLabel}>Shot selections matched situation?</Text>
            <View style={styles.radioGroup}>
              <Pressable
                style={styles.radioOption}
                onPress={() => setShotSelectionMatched('yes')}
              >
                <View style={styles.radioCircle}>
                  {shotSelectionMatched === 'yes' && <View style={styles.radioSelected} />}
                </View>
                <Text style={styles.radioText}>Yes</Text>
              </Pressable>
              <Pressable
                style={styles.radioOption}
                onPress={() => setShotSelectionMatched('no')}
              >
                <View style={styles.radioCircle}>
                  {shotSelectionMatched === 'no' && <View style={styles.radioSelected} />}
                </View>
                <Text style={styles.radioText}>No</Text>
              </Pressable>
            </View>
          </View>

          {/* Adapted Scoring Plan */}
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Adapted scoring plan? (1-5)</Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={adaptedPlan}
                onValueChange={setAdaptedPlan}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#4A5568"
                thumbTintColor="#FFFFFF"
              />
              <Text style={styles.sliderValue}>{adaptedPlan}</Text>
            </View>
          </View>

          {/* Confidence Under Pressure */}
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>
              Confidence under pressure (1-5) - Need 4+ for bonus!
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={confidencePressure}
                onValueChange={setConfidencePressure}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#4A5568"
                thumbTintColor="#FFFFFF"
              />
              <Text style={styles.sliderValue}>{confidencePressure}</Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Overall Mood & Confidence */}
        <View style={styles.dualSliderSection}>
          {/* Overall Mood */}
          <View style={styles.dualSliderItem}>
            <View style={styles.dualSliderHeader}>
              <MaterialIcons name="mood" size={20} color="#FFFFFF" />
              <Text style={styles.dualSliderLabel}>Overall Mood 😊</Text>
            </View>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.dualSlider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={overallMood}
                onValueChange={setOverallMood}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#4A5568"
                thumbTintColor="#FFFFFF"
              />
              <Text style={styles.sliderValue}>{overallMood}</Text>
            </View>
          </View>

          {/* Confidence */}
          <View style={styles.dualSliderItem}>
            <View style={styles.dualSliderHeader}>
              <MaterialIcons name="trending-up" size={20} color="#FFFFFF" />
              <Text style={styles.dualSliderLabel}>Confidence</Text>
            </View>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.dualSlider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={confidence}
                onValueChange={setConfidence}
                minimumTrackTintColor="#4A5568"
                maximumTrackTintColor="#4A5568"
                thumbTintColor="#FFFFFF"
              />
              <Text style={styles.sliderValue}>{confidence}</Text>
            </View>
          </View>
        </View>

        {/* Session Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Session Notes (Optional)</Text>
          <View style={styles.notesInputContainer}>
            <TextInput
              style={styles.notesInput}
              placeholder="What went well? What needs work?"
              placeholderTextColor="#718096"
              value={sessionNotes}
              onChangeText={setSessionNotes}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <View style={styles.notesIcon}>
              <MaterialIcons name="edit" size={24} color="#718096" />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
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
            <MaterialIcons name="save" size={24} color={colors.textLight} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save & Continue'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2C3E50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  shieldIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#3B5266',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 111, 66, 0.3)',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 22,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  successBanner: {
    backgroundColor: 'rgba(82, 183, 136, 0.2)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(82, 183, 136, 0.4)',
  },
  successText: {
    ...typography.body,
    color: '#7DDA9A',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: '#FF8C42',
    fontWeight: '600',
    fontSize: 18,
  },
  sliderContainer: {
    marginBottom: spacing.xl,
  },
  sliderLabel: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
    fontSize: 15,
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
    color: '#FFA94D',
    fontWeight: '700',
    fontSize: 24,
    minWidth: 40,
    textAlign: 'right',
  },
  radioContainer: {
    marginBottom: spacing.xl,
  },
  radioLabel: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
    fontSize: 15,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#718096',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#52B788',
  },
  radioText: {
    ...typography.body,
    color: colors.textLight,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: spacing.xl,
  },
  dualSliderSection: {
    marginBottom: spacing.xl,
  },
  dualSliderItem: {
    marginBottom: spacing.xl,
  },
  dualSliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dualSliderLabel: {
    ...typography.body,
    color: colors.textLight,
    fontSize: 15,
  },
  dualSlider: {
    flex: 1,
    height: 40,
  },
  notesSection: {
    marginTop: spacing.lg,
  },
  notesLabel: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
    fontSize: 15,
  },
  notesInputContainer: {
    position: 'relative',
  },
  notesInput: {
    backgroundColor: '#3B5266',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    color: colors.textLight,
    fontSize: 15,
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  notesIcon: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButtonPressable: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
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
});
