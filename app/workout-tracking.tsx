import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { drillService } from '@/services/drillService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Drill } from '@/types';

interface ExerciseSet {
  id: string;
  drillId: string;
  drillName: string;
  sets: string;
  reps: string;
  weight: string;
  isBodyweight: boolean;
  notes: string;
}

interface RestTimer {
  exerciseId: string;
  duration: number;
  remaining: number;
  isActive: boolean;
}

export default function WorkoutTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTime, setSessionTime] = useState(0);
  const [exercises, setExercises] = useState<ExerciseSet[]>([]);
  const [showDrillSelector, setShowDrillSelector] = useState(false);
  const [availableDrills, setAvailableDrills] = useState<Drill[]>([]);
  const [loadingDrills, setLoadingDrills] = useState(false);
  const [drillSearchQuery, setDrillSearchQuery] = useState('');
  const [activeTimer, setActiveTimer] = useState<RestTimer | null>(null);

  useEffect(() => {
    loadDrillDetails();
    loadPhysicalDrills();
  }, [params.id]);

  useEffect(() => {
    // Session timer
    const interval = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Rest timer countdown
    if (!activeTimer || !activeTimer.isActive) return;

    const interval = setInterval(() => {
      setActiveTimer((prev) => {
        if (!prev || prev.remaining <= 0) {
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  const loadDrillDetails = async () => {
    if (!params.id) return;
    
    const { data } = await drillService.getDrillById(params.id as string);
    if (data) {
      setDrill(data);
      // Add the initial drill as first exercise
      setExercises([{
        id: '1',
        drillId: data.id,
        drillName: data.name,
        sets: '3',
        reps: '10',
        weight: '0',
        isBodyweight: true,
        notes: '',
      }]);
    }
    setLoading(false);
  };

  const loadPhysicalDrills = async () => {
    setLoadingDrills(true);
    const { data } = await drillService.getDrillsByPillar('Physical');
    if (data) {
      setAvailableDrills(data);
    }
    setLoadingDrills(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateExercise = (id: string, field: keyof ExerciseSet, value: string | boolean) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  const addExercise = () => {
    setShowDrillSelector(true);
  };

  const handleSelectDrill = (selectedDrill: Drill) => {
    const newId = (exercises.length + 1).toString();
    setExercises((prev) => [
      ...prev,
      {
        id: newId,
        drillId: selectedDrill.id,
        drillName: selectedDrill.name,
        sets: '3',
        reps: '10',
        weight: '0',
        isBodyweight: true,
        notes: '',
      },
    ]);
    setShowDrillSelector(false);
    setDrillSearchQuery('');
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  };

  const handleFinishSession = () => {
    // Stop any active timer
    setActiveTimer(null);
    
    // Calculate actual workout statistics
    const totalSetsValue = exercises.reduce((sum, ex) => sum + (parseInt(ex.sets) || 0), 0);
    const totalRepsValue = exercises.reduce((sum, ex) => sum + (parseInt(ex.reps) || 0), 0);
    const totalWeightValue = exercises.reduce((sum, ex) => {
      const weight = parseFloat(ex.weight) || 0;
      const sets = parseInt(ex.sets) || 0;
      const reps = parseInt(ex.reps) || 0;
      // Total weight lifted = weight × sets × reps
      return sum + (weight * sets * reps);
    }, 0);
    
    // Format session time
    const mins = Math.floor(sessionTime / 60);
    const secs = sessionTime % 60;
    const formattedTime = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Calculate calories (rough estimate: ~5 cal per minute for strength training)
    const estimatedCalories = Math.round((sessionTime / 60) * 5);
    
    // Navigate to workout complete screen with actual stats
    router.push({
      pathname: '/workout-complete',
      params: {
        totalSets: totalSetsValue.toString(),
        totalReps: totalRepsValue.toString(),
        totalWeight: totalWeightValue.toFixed(1),
        sessionTime: formattedTime,
        estimatedCalories: estimatedCalories.toString(),
        drillName: drill?.name || 'Physical Training',
      }
    } as any);
  };

  const startRestTimer = (exerciseId: string, duration: number) => {
    setActiveTimer({
      exerciseId,
      duration,
      remaining: duration,
      isActive: true,
    });
  };

  const stopRestTimer = () => {
    setActiveTimer(null);
  };

  const formatTimerTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getImageUrl = (drill: Drill) => {
    if (!drill.instructions || typeof drill.instructions !== 'object') return null;
    return (drill.instructions as any).image_url || null;
  };

  const filteredDrills = availableDrills.filter((d) =>
    d.name.toLowerCase().includes(drillSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!drill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Drill not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Workout Tracking</Text>
          <Text style={styles.headerSubtitle}>{drill.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.sessionTimeLabel}>Session Time</Text>
          <Text style={styles.sessionTime}>{formatTime(sessionTime)}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Video/Photo Demonstration Area */}
        <View style={styles.mediaContainer}>
          {drill.video_url ? (
            <View style={styles.videoPlaceholder}>
              <MaterialIcons name="play-circle-filled" size={64} color={colors.textLight} />
              <Text style={styles.videoPlaceholderText}>Tap to play demonstration</Text>
            </View>
          ) : getImageUrl(drill) ? (
            <Image
              source={{ uri: getImageUrl(drill)! }}
              style={styles.drillImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialIcons name="fitness-center" size={64} color={colors.border} />
              <Text style={styles.photoPlaceholderText}>Exercise Demonstration</Text>
            </View>
          )}
        </View>

        {/* Exercise Sets */}
        {exercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            {/* Exercise Name Header */}
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.drillName}</Text>
              {exercises.length > 1 && (
                <Pressable
                  style={styles.removeExerciseButton}
                  onPress={() => removeExercise(exercise.id)}
                >
                  <MaterialIcons name="close" size={20} color={colors.error} />
                </Pressable>
              )}
            </View>

            {/* Sets, Reps, Weight Inputs */}
            <View style={styles.inputsRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sets</Text>
                <TextInput
                  style={styles.input}
                  value={exercise.sets}
                  onChangeText={(value) => updateExercise(exercise.id, 'sets', value)}
                  keyboardType="number-pad"
                  placeholder="3"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reps</Text>
                <TextInput
                  style={styles.input}
                  value={exercise.reps}
                  onChangeText={(value) => updateExercise(exercise.id, 'reps', value)}
                  keyboardType="number-pad"
                  placeholder="10"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <TextInput
                  style={[styles.input, exercise.isBodyweight && styles.inputDisabled]}
                  value={exercise.weight}
                  onChangeText={(value) => updateExercise(exercise.id, 'weight', value)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Bodyweight Checkbox and Rest Timer */}
            <View style={styles.optionsRow}>
              <Pressable
                style={styles.checkboxRow}
                onPress={() =>
                  updateExercise(exercise.id, 'isBodyweight', !exercise.isBodyweight)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    exercise.isBodyweight && styles.checkboxChecked,
                  ]}
                >
                  {exercise.isBodyweight && (
                    <MaterialIcons name="check" size={18} color={colors.textLight} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Bodyweight Exercise</Text>
              </Pressable>

              <View style={styles.timerButtons}>
                <Pressable 
                  style={[
                    styles.timerButton,
                    activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 60 && styles.timerButtonActive
                  ]}
                  onPress={() => {
                    if (activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 60) {
                      stopRestTimer();
                    } else {
                      startRestTimer(exercise.id, 60);
                    }
                  }}
                >
                  <MaterialIcons 
                    name="timer" 
                    size={18} 
                    color={activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 60 ? colors.textLight : colors.textSecondary} 
                  />
                  <Text style={[
                    styles.timerButtonText,
                    activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 60 && styles.timerButtonTextActive
                  ]}>
                    {activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 60 
                      ? formatTimerTime(activeTimer.remaining) 
                      : '60s'}
                  </Text>
                </Pressable>
                <Pressable 
                  style={[
                    styles.timerButton,
                    activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 90 && styles.timerButtonActive
                  ]}
                  onPress={() => {
                    if (activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 90) {
                      stopRestTimer();
                    } else {
                      startRestTimer(exercise.id, 90);
                    }
                  }}
                >
                  <Text style={[
                    styles.timerButtonText,
                    activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 90 && styles.timerButtonTextActive
                  ]}>
                    {activeTimer?.exerciseId === exercise.id && activeTimer?.duration === 90 
                      ? formatTimerTime(activeTimer.remaining) 
                      : '90s'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.notesContainer}>
              <TextInput
                style={styles.notesInput}
                value={exercise.notes}
                onChangeText={(value) => updateExercise(exercise.id, 'notes', value)}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
              />
            </View>
          </View>
        ))}

        {/* Add Exercise Button */}
        <Pressable style={styles.addExerciseButton} onPress={addExercise}>
          <MaterialIcons name="add" size={24} color={colors.textSecondary} />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </Pressable>
      </ScrollView>

      {/* Finish Session Button */}
      <View style={styles.footer}>
        <Pressable style={styles.finishButton} onPress={handleFinishSession}>
          <MaterialIcons name="check-circle" size={24} color={colors.textLight} />
          <Text style={styles.finishButtonText}>Finish Session</Text>
        </Pressable>
      </View>

      {/* Drill Selector Modal */}
      <Modal
        visible={showDrillSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDrillSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.drillSelectorModal}>
            {/* Header */}
            <View style={styles.drillSelectorHeader}>
              <Text style={styles.drillSelectorTitle}>Add Exercise</Text>
              <Pressable onPress={() => setShowDrillSelector(false)} style={styles.modalCloseButton}>
                <MaterialIcons name="close" size={28} color={colors.text} />
              </Pressable>
            </View>

            {/* Search */}
            <View style={styles.drillSearchContainer}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.drillSearchInput}
                placeholder="Search physical drills..."
                placeholderTextColor={colors.textSecondary}
                value={drillSearchQuery}
                onChangeText={setDrillSearchQuery}
              />
            </View>

            {/* Drills List */}
            {loadingDrills ? (
              <View style={styles.drillSelectorLoading}>
                <Text style={styles.drillSelectorLoadingText}>Loading drills...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredDrills}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.drillSelectorItem}
                    onPress={() => handleSelectDrill(item)}
                  >
                    <View style={styles.drillSelectorItemIcon}>
                      <MaterialIcons name="fitness-center" size={24} color={colors.physical} />
                    </View>
                    <View style={styles.drillSelectorItemContent}>
                      <Text style={styles.drillSelectorItemName}>{item.name}</Text>
                      <View style={styles.drillSelectorItemMeta}>
                        {item.subcategory && (
                          <View style={styles.drillSelectorItemBadge}>
                            <Text style={styles.drillSelectorItemBadgeText}>{item.subcategory}</Text>
                          </View>
                        )}
                        <View style={styles.drillSelectorItemDuration}>
                          <MaterialIcons name="access-time" size={14} color={colors.textSecondary} />
                          <Text style={styles.drillSelectorItemDurationText}>{item.duration_minutes} min</Text>
                        </View>
                      </View>
                      {item.description && (
                        <Text style={styles.drillSelectorItemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    <MaterialIcons name="add-circle" size={28} color={colors.success} />
                  </Pressable>
                )}
                contentContainerStyle={styles.drillSelectorList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
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
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  sessionTimeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  sessionTime: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.warning,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  mediaContainer: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  drillImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.background,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseName: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  removeExerciseButton: {
    padding: spacing.xs,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.text,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerButtonActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  timerButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  timerButtonTextActive: {
    color: colors.textLight,
  },
  notesContainer: {
    marginTop: spacing.xs,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  addExerciseText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    background: 'linear-gradient(90deg, #4CAF50 0%, #2196F3 100%)',
    backgroundColor: colors.success,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  finishButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  drillSelectorModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    paddingBottom: spacing.xl,
  },
  drillSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drillSelectorTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  drillSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  drillSearchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  drillSelectorLoading: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  drillSelectorLoadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  drillSelectorList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  drillSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  drillSelectorItemIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.physicalLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drillSelectorItemContent: {
    flex: 1,
    gap: spacing.xs,
  },
  drillSelectorItemName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  drillSelectorItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  drillSelectorItemBadge: {
    backgroundColor: colors.physical + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  drillSelectorItemBadgeText: {
    ...typography.caption,
    color: colors.physical,
    fontWeight: '600',
    fontSize: 10,
  },
  drillSelectorItemDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  drillSelectorItemDurationText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  drillSelectorItemDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
