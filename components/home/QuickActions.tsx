import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { sessionService } from '@/services/sessionService';
import { useAuth, useAlert } from '@/template';

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
    title: 'Repeat Last',
    subtitle: 'Redo your previous training',
    icon: 'replay',
    color: '#0EA5E9',
    route: '/repeat-last',
  },
];

interface QuickActionsProps {
  onPlanSession?: () => void;
}

export function QuickActions({ onPlanSession }: QuickActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loadingRepeat, setLoadingRepeat] = useState(false);

  const handleRepeatLast = async () => {
    if (!user) {
      showAlert('Please log in to repeat sessions');
      return;
    }

    setLoadingRepeat(true);
    
    // Check both regular sessions and mental drill logs
    const { data: lastSession, error: sessionError } = await sessionService.getLastCompletedSession(user.id);
    
    // Also check mental drill logs (they use a different table)
    const { getSupabaseClient } = await import('@/template');
    const supabase = getSupabaseClient();
    const { data: mentalDrills, error: mentalError } = await supabase
      .from('mental_drill_logs')
      .select('*, drill:drills(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    setLoadingRepeat(false);

    // Determine which was more recent
    let lastDrill = null;
    let isFreestyle = false;

    if (lastSession && mentalDrills && mentalDrills.length > 0) {
      const sessionDate = new Date(lastSession.completed_at || lastSession.created_at);
      const mentalDate = new Date(mentalDrills[0].created_at);
      
      if (mentalDate > sessionDate) {
        lastDrill = mentalDrills[0].drill;
      } else if (lastSession.session_type === 'Freestyle') {
        isFreestyle = true;
      } else if (lastSession.items && lastSession.items.length > 0) {
        lastDrill = lastSession.items[0].drill;
      }
    } else if (mentalDrills && mentalDrills.length > 0) {
      lastDrill = mentalDrills[0].drill;
    } else if (lastSession) {
      if (lastSession.session_type === 'Freestyle') {
        isFreestyle = true;
      } else if (lastSession.items && lastSession.items.length > 0) {
        lastDrill = lastSession.items[0].drill;
      }
    }

    // Navigate to the appropriate screen
    if (isFreestyle) {
      const dateParam = new Date().toISOString();
      router.push(`/session-freestyle?date=${encodeURIComponent(dateParam)}` as any);
    } else if (lastDrill && lastDrill.id) {
      router.push(`/drill-start?id=${lastDrill.id}` as any);
    } else {
      showAlert('No previous sessions found', 'Complete a session first to use this feature');
    }
  };

  const handleActionPress = (route: string) => {
    if (route === '/plan-session' && onPlanSession) {
      onPlanSession();
    } else if (route === '/session-freestyle') {
      // Navigate to freestyle session with current date
      const dateParam = new Date().toISOString();
      router.push(`/session-freestyle?date=${encodeURIComponent(dateParam)}` as any);
    } else if (route === '/repeat-last') {
      handleRepeatLast();
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
            disabled={action.route === '/repeat-last' && loadingRepeat}
          >
            {action.route === '/repeat-last' && loadingRepeat ? (
              <ActivityIndicator size={32} color={colors.textLight} />
            ) : (
              <MaterialIcons name={action.icon} size={32} color={colors.textLight} />
            )}
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
