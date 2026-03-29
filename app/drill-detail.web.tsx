import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { drillService } from '@/services/drillService';
import { sessionService } from '@/services/sessionService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Drill } from '@/types';
import { useAuth, useAlert } from '@/template';

const { width } = Dimensions.get('window');

// Helper function to extract YouTube video ID from URL
const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/,
    /youtube\.com\/embed\/([^&?/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Helper function to get image source for local assets
const getLocalImageSource = (path: string) => {
  const assetMap: Record<string, any> = {
    'assets/drills/maintaining-composure.png': require('@/assets/drills/maintaining-composure.png'),
    'assets/drills/overcoming-unrealistic-expectations.png': require('@/assets/drills/overcoming-unrealistic-expectations.png'),
    'assets/drills/smart-cricket-goal-blueprint.png': require('@/assets/drills/smart-cricket-goal-blueprint.png'),
    'assets/drills/pregame-routine.png': require('@/assets/drills/pregame-routine.png'),
    'assets/drills/performing-beyond-comfort-zones.png': require('@/assets/drills/performing-beyond-comfort-zones.png'),
    'assets/drills/coping-with-pregame-jitters.png': require('@/assets/drills/coping-with-pregame-jitters.png'),
    'assets/drills/3r-focus-challenge.png': require('@/assets/drills/3r-focus-challenge.png'),
    'assets/drills/developing-confidence.png': require('@/assets/drills/developing-confidence.png'),
    'assets/drills/building-trust-in-your-skills.png': require('@/assets/drills/building-trust-in-your-skills.png'),
    'assets/drills/maintaining-composure-coping-with-mistakes.png': require('@/assets/drills/maintaining-composure-coping-with-mistakes.png'),
    'assets/drills/coping-with-perfectionism.png': require('@/assets/drills/coping-with-perfectionism.png'),
    'assets/drills/self-acceptance.png': require('@/assets/drills/self-acceptance.png'),
    'assets/drills/pre-shot-routine.png': require('@/assets/drills/pre-shot-routine.png'),
    'assets/drills/overcoming-need-for-approval.png': require('@/assets/drills/overcoming-need-for-approval.png'),
    'assets/drills/core-stability-circuit.png': require('@/assets/drills/core-stability-circuit.png'),
  };
  
  return assetMap[path] || { uri: path };
};

export default function DrillDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date());
  const [sessionTime, setSessionTime] = useState('09:00');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);

  const hasVideoUrl = drill?.video_url && !drill.video_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  useEffect(() => {
    loadDrillDetails();
  }, [params.id]);

  const loadDrillDetails = async () => {
    if (!params.id) return;
    
    const { data } = await drillService.getDrillById(params.id as string);
    if (data) {
      setDrill(data);
    }
    setLoading(false);
  };

  const getPillarColor = (pillar: string) => {
    switch (pillar) {
      case 'Technical':
        return colors.primary;
      case 'Physical':
        return colors.physical;
      case 'Mental':
        return colors.mental;
      case 'Tactical':
        return colors.tactical;
      default:
        return colors.textSecondary;
    }
  };

  const getPillarIcon = (pillar: string): keyof typeof MaterialIcons.glyphMap => {
    switch (pillar) {
      case 'Technical':
        return 'sports-cricket';
      case 'Physical':
        return 'fitness-center';
      case 'Mental':
        return 'psychology';
      case 'Tactical':
        return 'lightbulb';
      default:
        return 'star';
    }
  };

  const getInstructions = () => {
    if (!drill?.instructions) return [];
    if (Array.isArray(drill.instructions)) return drill.instructions;
    if (typeof drill.instructions === 'object' && drill.instructions.how_to_execute) {
      return drill.instructions.how_to_execute;
    }
    if (typeof drill.instructions === 'object' && drill.instructions.how_to_do_it) {
      return drill.instructions.how_to_do_it;
    }
    if (typeof drill.instructions === 'object' && drill.instructions.steps) {
      return drill.instructions.steps;
    }
    return [];
  };

  const getPurpose = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return [];
    return drill.instructions.purpose || [];
  };

  const getCoachingPoints = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return [];
    return drill.instructions.coaching_points || [];
  };

  const getCommonMistakes = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return [];
    return drill.instructions.common_mistakes || [];
  };

  const getScenarioDescription = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return null;
    return drill.instructions.scenario_description || null;
  };

  const getFieldDiagram = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return null;
    return drill.instructions.field_diagram || null;
  };

  const getEquipmentList = () => {
    if (!drill?.equipment || drill.equipment.length === 0) {
      return ['No equipment needed'];
    }
    return drill.equipment;
  };

  const handleAddToSession = () => {
    if (!drill) return;
    setDuration(drill.duration_minutes.toString());
    setShowScheduleModal(true);
  };

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleSaveSession = async () => {
    if (!user || !drill) {
      showAlert('Error', 'Please log in to schedule sessions');
      return;
    }

    if (!duration || parseInt(duration) <= 0) {
      showAlert('Error', 'Please enter a valid duration');
      return;
    }

    setSaving(true);

    const scheduledDateTime = new Date(sessionDate);
    const [hours, minutes] = sessionTime.split(':');
    scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));

    const { error } = await sessionService.createSession({
      user_id: user.id,
      title: drill.name,
      scheduled_date: scheduledDateTime.toISOString(),
      duration_minutes: parseInt(duration),
      session_type: 'Structured',
      status: 'planned',
      notes: `${drill.pillar} - ${drill.subcategory || ''}`,
    });

    setSaving(false);

    if (error) {
      showAlert('Error', error);
      return;
    }

    showAlert('Success', 'Drill session scheduled successfully!');
    setShowScheduleModal(false);
    router.back();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading drill details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!drill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Drill not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const pillarColor = getPillarColor(drill.pillar);
  const instructions = getInstructions();
  const purpose = getPurpose();
  const coachingPoints = getCoachingPoints();
  const commonMistakes = getCommonMistakes();
  const scenarioDescription = getScenarioDescription();
  const fieldDiagram = getFieldDiagram();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={[styles.pillarBadge, { backgroundColor: pillarColor + '20' }]}>
            <MaterialIcons name={getPillarIcon(drill.pillar)} size={14} color={pillarColor} />
            <Text style={[styles.pillarBadgeText, { color: pillarColor }]}>{drill.pillar}</Text>
          </View>
          
          <View style={styles.durationBadge}>
            <MaterialIcons name="access-time" size={14} color={colors.textSecondary} />
            <Text style={styles.durationBadgeText}>{drill.duration_minutes} min default</Text>
          </View>
          
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Text style={styles.drillTitle}>{drill.name}</Text>
        <Text style={styles.drillSubtitle}>{drill.subcategory || drill.pillar}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Tutorial or Image Section */}
        {drill.video_url && (
          drill.video_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <View style={styles.illustrationContainer}>
              <Image
                source={getLocalImageSource(drill.video_url)}
                style={styles.illustrationImage}
                contentFit="contain"
                transition={200}
              />
              {drill.description && (
                <View style={styles.descriptionBanner}>
                  <Text style={styles.descriptionText}>{drill.description}</Text>
                </View>
              )}
            </View>
          ) : (
            // YouTube iframe embed for web
            <View style={styles.videoSection}>
              <View style={styles.videoHeader}>
                <MaterialIcons name="play-circle-filled" size={20} color={colors.primary} />
                <Text style={styles.videoHeaderText}>Video Tutorial</Text>
              </View>
              <View style={styles.videoPlayerContainer}>
                {hasVideoUrl && drill.video_url && (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(drill.video_url)}?playsinline=1&modestbranding=1&rel=0&enablejsapi=1`}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </View>
            </View>
          )
        )}

        {fieldDiagram && (
          <View style={styles.fieldDiagramSection}>
            <View style={styles.fieldSettingBadge}>
              <MaterialIcons name="place" size={16} color={colors.warning} />
              <Text style={styles.fieldSettingText}>Field Setting: Preset</Text>
            </View>
            <Image
              source={{ uri: fieldDiagram }}
              style={styles.fieldDiagramImage}
              contentFit="contain"
              transition={200}
            />
          </View>
        )}

        {scenarioDescription && (
          <View style={styles.section}>
            <Text style={styles.sectionTitleSimple}>Scenario Description</Text>
            <Text style={styles.scenarioDescriptionText}>{scenarioDescription}</Text>
          </View>
        )}

        {!fieldDiagram && !drill.video_url && drill.instructions && typeof drill.instructions === 'object' && drill.instructions.image_url && (
          <View style={styles.illustrationContainer}>
            <Image
              source={{ uri: drill.instructions.image_url }}
              style={styles.illustrationImage}
              contentFit="contain"
              transition={200}
            />
            {drill.description && (
              <View style={styles.descriptionBanner}>
                <Text style={styles.descriptionText}>{drill.description}</Text>
              </View>
            )}
          </View>
        )}
        
        {!fieldDiagram && !drill.video_url && (!drill.instructions || typeof drill.instructions !== 'object' || !drill.instructions.image_url) && (
          <View style={styles.illustrationContainer}>
            <View style={styles.illustrationPlaceholder}>
              <MaterialIcons name="sports-cricket" size={80} color={colors.border} />
              <Text style={styles.illustrationText}>Drill Illustration</Text>
            </View>
            {drill.description && (
              <View style={styles.descriptionBanner}>
                <Text style={styles.descriptionText}>{drill.description}</Text>
              </View>
            )}
          </View>
        )}

        {purpose.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="flag" size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>Purpose of This Drill</Text>
            </View>
            <View style={styles.bulletList}>
              {purpose.map((item: string, index: number) => (
                <View key={index} style={styles.bulletItem}>
                  <MaterialIcons name="check" size={18} color={colors.success} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="flag" size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>Purpose of This Drill</Text>
            </View>
            <View style={styles.bulletList}>
              <View style={styles.bulletItem}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>
                  Develop {drill.pillar.toLowerCase()} skills through focused practice.
                </Text>
              </View>
            </View>
          </View>
        )}

        {instructions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="format-list-numbered" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>How to Execute</Text>
            </View>
            <View style={styles.stepsList}>
              {instructions.map((step: any, index: number) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>
                    {typeof step === 'string' ? step : step.text || step.description || ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {coachingPoints.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="verified" size={20} color={colors.tactical} />
              <Text style={styles.sectionTitle}>Key Coaching Points</Text>
            </View>
            <View style={styles.bulletList}>
              {coachingPoints.map((point: string, index: number) => (
                <View key={index} style={styles.bulletItem}>
                  <Text style={styles.arrowBullet}>→</Text>
                  <Text style={styles.bulletText}>{point}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {commonMistakes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="close" size={20} color={colors.error} />
              <Text style={styles.sectionTitle}>Common Mistakes to Avoid</Text>
            </View>
            <View style={styles.bulletList}>
              {commonMistakes.map((mistake: string, index: number) => (
                <View key={index} style={styles.bulletItem}>
                  <MaterialIcons name="close" size={18} color={colors.error} />
                  <Text style={styles.bulletText}>{mistake}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitleSimple}>Equipment Needed</Text>
          <View style={styles.equipmentList}>
            {getEquipmentList().map((item, index) => (
              <Text key={index} style={styles.equipmentItem}>{item}</Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleSimple}>Duration (minutes)</Text>
          <Text style={styles.durationValue}>{drill.duration_minutes}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable style={styles.addToSessionButton} onPress={handleAddToSession}>
          <MaterialIcons name="add-circle-outline" size={20} color={colors.textLight} />
          <Text style={styles.addToSessionButtonText}>Add to Session</Text>
        </Pressable>
        
        <Pressable 
          style={styles.startNowButton}
          onPress={() => router.push(`/drill-start?id=${drill.id}` as any)}
        >
          <MaterialIcons name="play-arrow" size={20} color={colors.textLight} />
          <Text style={styles.startNowButtonText}>Start Now</Text>
        </Pressable>
      </View>

      <Modal
        visible={showScheduleModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Drill Session</Text>
              <Pressable onPress={() => setShowScheduleModal(false)} style={styles.modalCloseButton}>
                <MaterialIcons name="close" size={28} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.modalFieldRow}>
              <View style={styles.modalFieldHalf}>
                <Text style={styles.modalFieldLabel}>Date</Text>
                <TextInput
                  style={styles.modalFieldInput}
                  value={formatDate(sessionDate)}
                  editable={false}
                />
              </View>

              <View style={styles.modalFieldHalf}>
                <Text style={styles.modalFieldLabel}>Start Time</Text>
                <TextInput
                  style={styles.modalFieldInput}
                  value={sessionTime}
                  onChangeText={setSessionTime}
                  placeholder="HH:MM"
                />
              </View>
            </View>

            <View style={styles.modalFieldFull}>
              <Text style={styles.modalFieldLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.modalFieldInput}
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <Pressable
              style={[styles.saveSessionButton, saving && styles.saveSessionButtonDisabled]}
              onPress={handleSaveSession}
              disabled={saving}
            >
              <MaterialIcons name="save" size={24} color={colors.textLight} />
              <Text style={styles.saveSessionButtonText}>
                {saving ? 'Saving...' : 'Save Session'}
              </Text>
            </Pressable>
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
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  backButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  pillarBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  durationBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  closeButton: {
    marginLeft: 'auto',
    padding: spacing.xs,
  },
  drillTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  drillSubtitle: {
    ...typography.body,
    color: colors.text,
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 3,
  },
  illustrationContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  illustrationPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  descriptionBanner: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: spacing.md,
  },
  descriptionText: {
    ...typography.body,
    color: colors.textLight,
    lineHeight: 22,
  },
  illustrationImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.background,
  },
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  sectionTitleSimple: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  bulletList: {
    gap: spacing.md,
  },
  bulletItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginTop: 8,
  },
  arrowBullet: {
    ...typography.body,
    color: colors.tactical,
    fontWeight: '700',
    fontSize: 18,
  },
  bulletText: {
    ...typography.body,
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 22,
  },
  stepsList: {
    gap: spacing.lg,
  },
  stepItem: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontWeight: '700',
  },
  stepText: {
    ...typography.body,
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 22,
  },
  equipmentList: {
    gap: spacing.sm,
  },
  equipmentItem: {
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  durationValue: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
  },
  fieldDiagramSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.lg,
  },
  fieldSettingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF4E6',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  fieldSettingText: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '600',
  },
  fieldDiagramImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  scenarioDescriptionText: {
    ...typography.body,
    color: '#2C2C2C',
    lineHeight: 22,
  },
  videoSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.lg,
  },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  videoHeaderText: {
    ...typography.h4,
    color: '#000000',
    fontWeight: '600',
  },
  videoPlayerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addToSessionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  addToSessionButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  startNowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  startNowButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalFieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalFieldHalf: {
    flex: 1,
  },
  modalFieldFull: {
    marginBottom: spacing.lg,
  },
  modalFieldLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  modalFieldInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
    fontSize: 18,
    fontWeight: '600',
  },
  saveSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  saveSessionButtonDisabled: {
    opacity: 0.6,
  },
  saveSessionButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 18,
  },
});
