import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient, useAuth, useAlert } from '@/template';
import { progressService } from '@/services/progressService';
import { drillService } from '@/services/drillService';

export default function TechnicalCompleteScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const drillId = params.drillId as string;
  const drillName = params.drillName as string || 'Technical Drill';
  const timeElapsed = parseInt(params.timeElapsed as string) || 0;

  // Core Performance Metrics (1-10 scale)
  const [techniqueQuality, setTechniqueQuality] = useState(7);
  const [consistency, setConsistency] = useState(7);
  const [shotControl, setShotControl] = useState(7);
  const [timing, setTiming] = useState(7);

  // AI-Generated Questions
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiResponses, setAiResponses] = useState<string[]>(['', '', '']);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Additional Feedback
  const [reflectionNotes, setReflectionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (drillId) {
      generateAIQuestions();
    }
  }, [drillId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateAIQuestions = async () => {
    setLoadingQuestions(true);

    try {
      // Get drill details to generate context-specific questions
      const { data: drill } = await drillService.getDrillById(drillId);
      
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('ai-coach-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `You are a cricket batting coach. Generate exactly 3 specific, actionable reflection questions for a batsman who just completed this technical drill:

Drill Name: ${drillName}
Drill Type: ${drill?.subcategory || 'Technical Batting'}
Description: ${drill?.description || 'Batting technique drill'}

Requirements:
1. Each question should focus on a specific technical aspect (e.g., footwork, head position, bat swing, balance, follow-through)
2. Questions should help identify what went well and areas for improvement
3. Keep questions concise and focused (max 15 words each)
4. Make questions batting-specific and actionable
5. Return ONLY the 3 questions, numbered 1-3, with no additional text

Example format:
1. Was your front foot moving toward the ball on each shot?
2. Did you maintain a still head position throughout the swing?
3. Were you able to play late and close to your body?`
            }
          ]
        }
      });

      if (error || !data?.choices?.[0]?.message?.content) {
        console.error('AI question generation error:', error);
        // Fallback to generic questions
        setAiQuestions([
          'How well did you execute the key coaching points from this drill?',
          'What technical aspect felt most challenging during the session?',
          'Did you notice improvement compared to your previous attempts?'
        ]);
      } else {
        // Parse AI response to extract questions
        const aiResponse = data.choices[0].message.content;
        const questionMatches = aiResponse.match(/\d+\.\s*(.+)/g);
        
        if (questionMatches && questionMatches.length >= 3) {
          const parsedQuestions = questionMatches
            .slice(0, 3)
            .map((q: string) => q.replace(/^\d+\.\s*/, '').trim());
          setAiQuestions(parsedQuestions);
        } else {
          // Fallback if parsing fails
          setAiQuestions([
            'How well did you execute the key coaching points from this drill?',
            'What technical aspect felt most challenging during the session?',
            'Did you notice improvement compared to your previous attempts?'
          ]);
        }
      }
    } catch (err) {
      console.error('Question generation error:', err);
      // Fallback questions
      setAiQuestions([
        'How well did you execute the key coaching points from this drill?',
        'What technical aspect felt most challenging during the session?',
        'Did you notice improvement compared to your previous attempts?'
      ]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to save feedback');
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseClient();

      // Calculate overall performance rating (1-10 scale)
      const performanceRating = Math.round(
        (techniqueQuality + consistency + shotControl + timing) / 4
      );

      // Save technical drill log
      const { error } = await supabase.from('technical_drill_logs').insert({
        user_id: user.id,
        drill_id: drillId,
        drill_name: drillName,
        time_elapsed: timeElapsed,
        technique_quality: techniqueQuality,
        consistency: consistency,
        shot_control: shotControl,
        timing: timing,
        ai_question_1: aiQuestions[0] || null,
        ai_response_1: aiResponses[0]?.trim() || null,
        ai_question_2: aiQuestions[1] || null,
        ai_response_2: aiResponses[1]?.trim() || null,
        ai_question_3: aiQuestions[2] || null,
        ai_response_3: aiResponses[2]?.trim() || null,
        reflection_notes: reflectionNotes.trim() || null,
      });

      if (error) {
        console.error('Error saving technical feedback:', error);
        showAlert('Error', 'Failed to save feedback. Please try again.');
        setSaving(false);
        return;
      }

      // Ensure minimum 1 minute duration
      const durationMinutes = Math.max(1, Math.floor(timeElapsed / 60));

      // Award XP using the new system
      const { data: xpResult, error: xpError } = await progressService.awardDrillXP(
        user.id,
        'Technical',
        performanceRating,
        durationMinutes
      );

      if (xpError || !xpResult) {
        console.error('XP award error:', xpError);
        showAlert('Error', 'Failed to save feedback and progress.');
        setSaving(false);
        return;
      }

      const { progress, xpBreakdown } = xpResult;
      const totalXP = progressService.calculateTotalXP(progress);

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
            pillarPoints: progress.technical_points.toString(),
            pillarName: 'Technical',
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <LinearGradient
            colors={['#4A90E2', '#52B788']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkIconContainer}
          >
            <MaterialIcons name="sports-cricket" size={40} color={colors.textLight} />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Technical Drill Completed! 🏏</Text>
            <Text style={styles.headerSubtitle}>
              Excellent work! Your technique is getting sharper!
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
        {/* Performance Metrics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="bar-chart" size={22} color="#4A90E2" />
            <Text style={styles.sectionTitle}>Performance Metrics</Text>
          </View>
          <Text style={styles.scaleHint}>1 = poor/low  •  10 = excellent/high</Text>

          {/* Technique Quality */}
          <View style={styles.metricContainer}>
            <Text style={styles.metricLabel}>Technique Quality</Text>
            <Text style={styles.metricSubtext}>
              How well did you execute the proper form and mechanics?
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={techniqueQuality}
                onValueChange={setTechniqueQuality}
                minimumTrackTintColor="#4A90E2"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#4A90E2"
              />
              <Text style={[styles.sliderValue, { color: '#4A90E2' }]}>{techniqueQuality}</Text>
            </View>
          </View>

          {/* Consistency */}
          <View style={styles.metricContainer}>
            <Text style={styles.metricLabel}>Consistency</Text>
            <Text style={styles.metricSubtext}>
              How consistent were your repetitions throughout the drill?
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={consistency}
                onValueChange={setConsistency}
                minimumTrackTintColor="#52B788"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#52B788"
              />
              <Text style={[styles.sliderValue, { color: '#52B788' }]}>{consistency}</Text>
            </View>
          </View>

          {/* Shot Control */}
          <View style={styles.metricContainer}>
            <Text style={styles.metricLabel}>Shot Control</Text>
            <Text style={styles.metricSubtext}>
              How well did you control the direction and power of your shots?
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={shotControl}
                onValueChange={setShotControl}
                minimumTrackTintColor="#9C27B0"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#9C27B0"
              />
              <Text style={[styles.sliderValue, { color: '#9C27B0' }]}>{shotControl}</Text>
            </View>
          </View>

          {/* Timing */}
          <View style={styles.metricContainer}>
            <Text style={styles.metricLabel}>Timing</Text>
            <Text style={styles.metricSubtext}>
              How well did you time the ball and execute at the right moment?
            </Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                value={timing}
                onValueChange={setTiming}
                minimumTrackTintColor="#FF9800"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#FF9800"
              />
              <Text style={[styles.sliderValue, { color: '#FF9800' }]}>{timing}</Text>
            </View>
          </View>
        </View>

        {/* Drill-Specific Reflection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="lightbulb" size={22} color="#FF9800" />
            <Text style={styles.sectionTitle}>Drill-Specific Reflection</Text>
          </View>
          {loadingQuestions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Generating personalized questions...</Text>
            </View>
          ) : (
            aiQuestions.map((question, index) => (
              <View key={index} style={styles.aiQuestionContainer}>
                <Text style={styles.aiQuestionNumber}>Question {index + 1}</Text>
                <Text style={styles.aiQuestionText}>{question}</Text>
                <TextInput
                  style={styles.aiResponseInput}
                  placeholder="Your response..."
                  placeholderTextColor="#9E9E9E"
                  value={aiResponses[index]}
                  onChangeText={(text) => {
                    const newResponses = [...aiResponses];
                    newResponses[index] = text;
                    setAiResponses(newResponses);
                  }}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            ))
          )}
        </View>

        {/* Reflection Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Additional Notes (Optional)</Text>
          <Text style={styles.notesHint}>
            Any other observations, breakthroughs, or areas to work on?
          </Text>
          <TextInput
            style={styles.notesInput}
            placeholder="E.g., 'Struggled with balance on back foot shots' or 'Finally got the hang of playing late!'"
            placeholderTextColor="#9E9E9E"
            value={reflectionNotes}
            onChangeText={setReflectionNotes}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
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
            colors={['#4A90E2', '#52B788']}
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
    color: '#4A90E2',
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
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    fontSize: 18,
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
  metricContainer: {
    marginBottom: spacing.lg,
  },
  metricLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 4,
  },
  metricSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.md,
    lineHeight: 18,
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
    fontWeight: '700',
    fontSize: 24,
    minWidth: 40,
    textAlign: 'right',
  },
  aiSubtext: {
    ...typography.caption,
    color: '#FF9800',
    fontSize: 13,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  aiQuestionContainer: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  aiQuestionNumber: {
    ...typography.caption,
    color: '#FF9800',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  aiQuestionText: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  aiResponseInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  notesSection: {
    marginBottom: spacing.lg,
  },
  notesLabel: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
    fontSize: 15,
    fontWeight: '600',
  },
  notesHint: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: 15,
    minHeight: 120,
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
