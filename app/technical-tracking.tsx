import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { drillService } from '@/services/drillService';
import { Drill } from '@/types';
import { YouTubePlayer } from '@/components/ui/YouTubePlayer';

const { width } = Dimensions.get('window');

export default function TechnicalTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const drillId = params.id as string;

  const [drill, setDrill] = useState<Drill | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Use global drill session timer so it ticks while minimized
  const timeElapsed = drillSession.isActive && drillSession.drillId === drillId
    ? drillSession.elapsedSeconds
    : 0;

  // Technical tracking metrics
  const [ballsFaced, setBallsFaced] = useState(0);
  const [successfulShots, setSuccessfulShots] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadDrill();
  }, [drillId]);

  useEffect(() => {
    let interval: any;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const loadDrill = async () => {
    if (!drillId) return;
    const { data } = await drillService.getDrillById(drillId);
    if (data) {
      setDrill(data);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleFinish = () => {
    setIsRunning(false);
    // Navigate to technical completion with tracking data
    router.push({
      pathname: '/technical-complete',
      params: {
        drillId: drillId,
        drillName: drill?.name || 'Technical Drill',
        timeElapsed: timeElapsed.toString(),
        ballsFaced: ballsFaced.toString(),
        successfulShots: successfulShots.toString(),
        notes: notes,
      },
    } as any);
  };

  const incrementBalls = () => {
    setBallsFaced((prev) => prev + 1);
  };

  const decrementBalls = () => {
    setBallsFaced((prev) => Math.max(0, prev - 1));
  };

  const incrementSuccessful = () => {
    setSuccessfulShots((prev) => Math.min(ballsFaced, prev + 1));
  };

  const decrementSuccessful = () => {
    setSuccessfulShots((prev) => Math.max(0, prev - 1));
  };

  const handleBallsFacedChange = (text: string) => {
    const num = parseInt(text) || 0;
    setBallsFaced(Math.max(0, num));
  };

  const handleSuccessfulShotsChange = (text: string) => {
    const num = parseInt(text) || 0;
    setSuccessfulShots(Math.max(0, Math.min(ballsFaced, num)));
  };

  const successRate = ballsFaced > 0 ? Math.round((successfulShots / ballsFaced) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Technical Drill Tracking</Text>
            <Text style={styles.headerSubtitle}>{drill?.name || 'Loading...'}</Text>
          </View>
        </View>
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Session Time</Text>
          <Text style={styles.timerValue}>{formatTime(timeElapsed)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Drill Video or Illustration */}
        {drill?.video_url ? (
          <View style={styles.videoContainer}>
            <YouTubePlayer 
              videoId={drill.video_url.includes('youtube.com') || drill.video_url.includes('youtu.be') 
                ? drill.video_url.split('v=')[1]?.split('&')[0] || drill.video_url.split('/').pop()?.split('?')[0] || ''
                : drill.video_url
              } 
              height={220}
            />
          </View>
        ) : (
          <View style={styles.illustrationContainer}>
            <MaterialIcons name="sports-cricket" size={120} color={colors.primary + '40'} />
            <Text style={styles.illustrationText}>
              {drill?.subcategory || 'Batting Technique'}
            </Text>
          </View>
        )}

        {/* Tracking Card */}
        <View style={styles.trackingCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="sports-cricket" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>{drill?.name || 'Technical Drill'}</Text>
          </View>

          {/* Balls Faced Counter */}
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Balls Faced</Text>
            <View style={styles.counterContainer}>
              <Pressable style={styles.counterButton} onPress={decrementBalls}>
                <MaterialIcons name="remove" size={24} color={colors.text} />
              </Pressable>
              <TextInput
                style={styles.counterValueInput}
                value={ballsFaced.toString()}
                onChangeText={handleBallsFacedChange}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
              <Pressable style={styles.counterButton} onPress={incrementBalls}>
                <MaterialIcons name="add" size={24} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Successful Shots Counter */}
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Successful Shots</Text>
            <View style={styles.counterContainer}>
              <Pressable style={styles.counterButton} onPress={decrementSuccessful}>
                <MaterialIcons name="remove" size={24} color={colors.text} />
              </Pressable>
              <TextInput
                style={styles.counterValueInput}
                value={successfulShots.toString()}
                onChangeText={handleSuccessfulShotsChange}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
              <Pressable style={styles.counterButton} onPress={incrementSuccessful}>
                <MaterialIcons name="add" size={24} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Success Rate Display */}
          <View style={styles.successRateContainer}>
            <Text style={styles.successRateLabel}>Success Rate</Text>
            <View style={styles.successRateBar}>
              <View
                style={[
                  styles.successRateFill,
                  {
                    width: `${successRate}%`,
                    backgroundColor:
                      successRate >= 70
                        ? colors.success
                        : successRate >= 50
                        ? colors.warning
                        : colors.error,
                  },
                ]}
              />
              <Text style={styles.successRateText}>{successRate}%</Text>
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g., 'Struggled with timing on off-side drives' or 'Improved balance on back foot shots'"
              placeholderTextColor={colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <Pressable
          style={styles.pauseButton}
          onPress={handlePause}
        >
          <MaterialIcons
            name={isPaused ? 'play-arrow' : 'pause'}
            size={24}
            color={colors.text}
          />
          <Text style={styles.pauseButtonText}>
            {isPaused ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.finishButton}
          onPress={handleFinish}
        >
          <MaterialIcons name="check-circle" size={24} color={colors.textLight} />
          <Text style={styles.finishButtonText}>Finish Session</Text>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
    fontSize: 18,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  timerContainer: {
    alignItems: 'flex-end',
  },
  timerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  timerValue: {
    ...typography.h1,
    color: colors.warning,
    fontWeight: '700',
    fontSize: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  videoContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  illustrationContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl * 2,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  illustrationText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  trackingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  metricRow: {
    marginBottom: spacing.xl,
  },
  metricLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
    fontSize: 16,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  counterButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterValueInput: {
    ...typography.h1,
    color: colors.text,
    fontWeight: '700',
    fontSize: 48,
    flex: 1,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  successRateContainer: {
    marginBottom: spacing.xl,
  },
  successRateLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
    fontSize: 16,
  },
  successRateBar: {
    height: 48,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successRateFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: borderRadius.md,
  },
  successRateText: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    fontSize: 20,
    zIndex: 10,
  },
  notesSection: {
    marginTop: spacing.md,
  },
  notesLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
    fontSize: 16,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    color: colors.text,
    minHeight: 100,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pauseButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  finishButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
  },
  finishButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 18,
  },
});
