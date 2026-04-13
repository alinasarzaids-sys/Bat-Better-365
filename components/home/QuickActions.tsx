import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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


  const handleActionPress = (route: string) => {
    if (route === '/plan-session' && onPlanSession) {
      onPlanSession();
    } else if (route === '/session-freestyle') {
      // Navigate to freestyle session with current date
      const dateParam = new Date().toISOString();
      router.push(`/session-freestyle?date=${encodeURIComponent(dateParam)}` as any);
    } else {
      router.push(route as any);
    }
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
