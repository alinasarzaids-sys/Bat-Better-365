import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useActiveSession } from '@/hooks/useActiveSession';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MiniSessionBar() {
  const router = useRouter();
  const { isActive, isMinimized, currentStep, elapsedSeconds, isPaused, ballsFacedLive, maximizeSession, setIsPaused } = useActiveSession();

  if (!isActive || !isMinimized || currentStep !== 2) return null;

  return (
    <Pressable
      style={styles.miniBar}
      onPress={() => {
        maximizeSession();
        router.push('/session-freestyle' as any);
      }}
    >
      <View style={styles.miniBarLeft}>
        <View style={[styles.miniDot, { backgroundColor: isPaused ? colors.warning : colors.success }]} />
        <View>
          <Text style={styles.miniBarTitle}>Freestyle Session</Text>
          <Text style={styles.miniBarSub}>{isPaused ? 'Paused' : 'Live'} · {ballsFacedLive} balls</Text>
        </View>
      </View>
      <View style={styles.miniBarRight}>
        <Text style={styles.miniBarTimer}>{formatTime(elapsedSeconds)}</Text>
        <Pressable
          style={styles.miniPauseBtn}
          onPress={(e) => { e.stopPropagation(); setIsPaused(!isPaused); }}
          hitSlop={8}
        >
          <MaterialIcons name={isPaused ? 'play-arrow' : 'pause'} size={18} color={colors.textLight} />
        </Pressable>
        <MaterialIcons name="expand-less" size={18} color={colors.textLight} style={{ opacity: 0.8 }} />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    height: Platform.select({
      ios: insets.bottom + 60,
      android: insets.bottom + 60,
      default: 70,
    }),
    paddingTop: 8,
    paddingBottom: Platform.select({
      ios: insets.bottom + 8,
      android: insets.bottom + 8,
      default: 8,
    }),
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="training"
          options={{
            title: 'Training',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="fitness-center" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="calendar-today" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: 'Journal',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="book" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai-coach"
          options={{
            title: 'AI Coach',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="psychology" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Analytics',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="bar-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            href: null,
          }}
        />
      </Tabs>
      <MiniSessionBar />
    </View>
  );
}

const styles = StyleSheet.create({
  miniBar: {
    position: 'absolute',
    bottom: Platform.select({ ios: 84, android: 72, default: 78 }),
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primaryDark,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  miniBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  miniBarTitle: { ...typography.bodySmall, color: colors.textLight, fontWeight: '700' },
  miniBarSub: { fontSize: 11, color: colors.textLight, opacity: 0.8, marginTop: 1 },
  miniBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  miniBarTimer: { ...typography.body, color: colors.textLight, fontWeight: '700', letterSpacing: 1 },
  miniPauseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
});
