import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  route: string;
}

const actions: QuickAction[] = [
  {
    id: '1',
    title: 'Start Freestyle',
    subtitle: 'Jump into a quick freestyle training session',
    icon: 'sports-cricket',
    color: colors.purple,
    route: '/session-freestyle',
  },
  {
    id: '2',
    title: 'Plan Session',
    subtitle: 'Schedule a structured training session',
    icon: 'calendar-today',
    color: colors.green,
    route: '/plan-session',
  },
  {
    id: '3',
    title: 'Start a Drill',
    subtitle: 'Browse and start individual drills',
    icon: 'fitness-center',
    color: colors.orange,
    route: '/(tabs)/training',
  },
  {
    id: '4',
    title: 'Calendar',
    subtitle: 'View and plan your schedule',
    icon: 'calendar-today',
    color: '#3B82F6',
    route: '/(tabs)/calendar',
  },
];

interface QuickActionsProps {
  onPlanSession?: () => void;
}

export function QuickActions({ onPlanSession }: QuickActionsProps) {
  const router = useRouter();
  const [showFreestyleModal, setShowFreestyleModal] = useState(false);

  const handleActionPress = (route: string) => {
    if (route === '/plan-session' && onPlanSession) {
      onPlanSession();
    } else if (route === '/session-freestyle') {
      setShowFreestyleModal(true);
    } else {
      router.push(route as any);
    }
  };

  const handleStartNow = () => {
    setShowFreestyleModal(false);
    router.push('/session-freestyle?mode=now' as any);
  };

  const handleLogPast = () => {
    setShowFreestyleModal(false);
    router.push('/session-freestyle?mode=log' as any);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: action.color },
              pressed && styles.pressed,
            ]}
            onPress={() => handleActionPress(action.route)}
          >
            <MaterialIcons name={action.icon} size={32} color={colors.textLight} />
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      {/* Freestyle Session Modal */}
      <Modal
        visible={showFreestyleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFreestyleModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFreestyleModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Freestyle Session</Text>
            <Text style={styles.modalSubtitle}>What would you like to do?</Text>

            <Pressable style={styles.optionButton} onPress={handleStartNow}>
              <View style={[styles.optionIcon, { backgroundColor: colors.primary + '18' }]}>
                <MaterialIcons name="play-arrow" size={28} color={colors.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Start Session</Text>
                <Text style={styles.optionDesc}>Begin a live freestyle session now</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={styles.optionButton} onPress={handleLogPast}>
              <View style={[styles.optionIcon, { backgroundColor: colors.success + '18' }]}>
                <MaterialIcons name="history" size={28} color={colors.success} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Log Past Session</Text>
                <Text style={styles.optionDesc}>Record a session you already completed</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => setShowFreestyleModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.sm,
  },
  actionCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    minHeight: 140,
  },
  pressed: {
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionTitle: {
    ...typography.h4,
    color: colors.textLight,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionSubtitle: {
    ...typography.bodySmall,
    color: colors.textLight,
    opacity: 0.9,
  },
});
