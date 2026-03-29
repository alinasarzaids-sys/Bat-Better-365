import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { UserProgress, Pillar } from '@/types';
import { sessionService } from '@/services/sessionService';
import { useAuth } from '@/template';

interface SkillHeatmapProps {
  progress: UserProgress | null;
}

export function SkillHeatmap({ progress }: SkillHeatmapProps) {
  const { user } = useAuth();
  const [monthlyStats, setMonthlyStats] = useState<{ pillar: string; minutes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    loadMonthlyStats();
  }, [user]);

  const loadMonthlyStats = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data } = await sessionService.getMonthlyTrainingByPillar(user.id);
    if (data) {
      setMonthlyStats(data);
    }
    setLoading(false);
  };

  const pillars: { name: string; color: string; minutes: number }[] = [
    { name: 'Technical', color: colors.technical, minutes: monthlyStats.find(s => s.pillar === 'Technical')?.minutes || 0 },
    { name: 'Physical', color: colors.physical, minutes: monthlyStats.find(s => s.pillar === 'Physical')?.minutes || 0 },
    { name: 'Mental', color: colors.mental, minutes: monthlyStats.find(s => s.pillar === 'Mental')?.minutes || 0 },
    { name: 'Tactical', color: colors.tactical, minutes: monthlyStats.find(s => s.pillar === 'Tactical')?.minutes || 0 },
    { name: 'Freestyle', color: '#E53935', minutes: monthlyStats.find(s => s.pillar === 'Freestyle')?.minutes || 0 },
  ];

  const maxMinutes = Math.max(...pillars.map(p => p.minutes), 1);

  if (loading) {
    return (
      <Card style={styles.container}>
        <Text style={styles.title}>Skill Heatmap</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </Card>
    );
  }

  // Get current month name
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });

  return (
    <>
      <Card style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Training Timeline</Text>
            <Pressable style={styles.infoButton} onPress={() => setShowInfoModal(true)}>
              <MaterialIcons name="info-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.monthLabel}>{currentMonth}</Text>
        </View>
        <Text style={styles.description}>Track your monthly training time across all four pillars</Text>
      <View style={styles.pillarsContainer}>
        {pillars.map((pillar) => {
          const percentage = (pillar.minutes / maxMinutes) * 100;
          return (
            <View key={pillar.name} style={styles.pillarRow}>
              <View style={styles.pillarHeader}>
                <View style={[styles.pillarDot, { backgroundColor: pillar.color }]} />
                <Text style={styles.pillarName}>{pillar.name}</Text>
              </View>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    { width: `${percentage}%`, backgroundColor: pillar.color },
                  ]}
                />
              </View>
              <Text style={styles.pillarPoints}>{pillar.minutes} min</Text>
            </View>
          );
        })}
      </View>
        <View style={styles.footerContainer}>
          <MaterialIcons name="info-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.subtitle}>Resets monthly • Focus on weaker areas to improve</Text>
        </View>
      </Card>

      {/* Training Timeline Explanation Modal */}
      <Modal
        visible={showInfoModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="info" size={24} color={colors.primary} />
                <Text style={styles.modalTitle}>Training Timeline</Text>
              </View>
              <Pressable onPress={() => setShowInfoModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDescription}>
                The Training Timeline shows your total training time (in minutes) for each pillar during the current month. This helps you track your training balance and identify areas that need more focus.
              </Text>

              <View style={styles.pillarExplanations}>
                <View style={styles.pillarExplanation}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.technical }]} />
                  <View style={styles.pillarExplanationContent}>
                    <Text style={styles.pillarExplanationTitle}>Technical Training</Text>
                    <Text style={styles.pillarExplanationText}>
                      Drills focused on batting technique, footwork, and shot mechanics
                    </Text>
                  </View>
                </View>

                <View style={styles.pillarExplanation}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.physical }]} />
                  <View style={styles.pillarExplanationContent}>
                    <Text style={styles.pillarExplanationTitle}>Physical Training</Text>
                    <Text style={styles.pillarExplanationText}>
                      Fitness, strength, speed, and conditioning workouts
                    </Text>
                  </View>
                </View>

                <View style={styles.pillarExplanation}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.mental }]} />
                  <View style={styles.pillarExplanationContent}>
                    <Text style={styles.pillarExplanationTitle}>Mental Training</Text>
                    <Text style={styles.pillarExplanationText}>
                      Focus, confidence building, and mental resilience exercises
                    </Text>
                  </View>
                </View>

                <View style={styles.pillarExplanation}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.tactical }]} />
                  <View style={styles.pillarExplanationContent}>
                    <Text style={styles.pillarExplanationTitle}>Tactical Training</Text>
                    <Text style={styles.pillarExplanationText}>
                      Game strategy, field awareness, and match situation analysis
                    </Text>
                  </View>
                </View>

                <View style={styles.pillarExplanation}>
                  <View style={[styles.pillarDot, { backgroundColor: '#E53935' }]} />
                  <View style={styles.pillarExplanationContent}>
                    <Text style={styles.pillarExplanationTitle}>Freestyle Sessions</Text>
                    <Text style={styles.pillarExplanationText}>
                      Custom open training sessions not tied to a specific pillar
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.tipCard}>
                <MaterialIcons name="lightbulb" size={20} color={colors.warning} />
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>💡 Training Tip</Text>
                  <Text style={styles.tipText}>
                    Aim for balanced training across all four pillars. If you see a pillar with low minutes, consider adding more drills from that category.
                  </Text>
                </View>
              </View>

              <View style={styles.resetInfo}>
                <MaterialIcons name="refresh" size={18} color={colors.textSecondary} />
                <Text style={styles.resetInfoText}>
                  Timeline resets at the start of each month to track fresh progress
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthLabel: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: colors.primaryLight + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pillarsContainer: {
    gap: spacing.md,
  },
  pillarRow: {
    gap: spacing.sm,
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pillarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pillarName: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  barContainer: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  pillarPoints: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'right',
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
    padding: spacing.lg,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  modalDescription: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  pillarExplanations: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pillarExplanation: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  pillarExplanationContent: {
    flex: 1,
  },
  pillarExplanationTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  pillarExplanationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tipCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  resetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  resetInfoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
});
