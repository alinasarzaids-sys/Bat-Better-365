/**
 * Waiting Room Screen
 * Shown to players whose status is 'pending' — awaiting coach approval
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useAuth, getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function WaitingRoomScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAcademies, setPendingAcademies] = useState<Array<{ name: string; description?: string; joined_at: string }>>([]);
  const [approved, setApproved] = useState(false);

  const checkStatus = async () => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('academy_members')
      .select('status, joined_at, academies(name, description)')
      .eq('user_id', user.id);

    const pending = (data || []).filter((m: any) => m.status === 'pending');
    const hasApproved = (data || []).some((m: any) => m.status === 'approved');

    setPendingAcademies(pending.map((m: any) => ({
      name: m.academies?.name || 'Academy',
      description: m.academies?.description,
      joined_at: m.joined_at,
    })));

    if (hasApproved) {
      setApproved(true);
      // Redirect to main app — they're now approved
      setTimeout(() => router.replace('/'), 1000);
    }

    setLoading(false);
  };

  useEffect(() => { checkStatus(); }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkStatus();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (approved) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={[styles.iconCircle, { backgroundColor: '#22C55E20' }]}>
            <MaterialIcons name="check-circle" size={48} color="#22C55E" />
          </View>
          <Text style={styles.approvedTitle}>You're Approved!</Text>
          <Text style={styles.approvedSub}>Redirecting to your Academy Portal...</Text>
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bat Better 365</Text>
          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialIcons name="logout" size={18} color={colors.textSecondary} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Waiting illustration */}
        <View style={styles.heroBlock}>
          <View style={[styles.iconCircle, { width: 100, height: 100, borderRadius: 50 }]}>
            <MaterialIcons name="hourglass-empty" size={52} color={colors.warning} />
          </View>
          <Text style={styles.heroTitle}>Awaiting Coach Approval</Text>
          <Text style={styles.heroSub}>
            Your request to join the academy has been received.{'\n'}
            Your coach needs to approve your membership before you can access training content.
          </Text>
        </View>

        {/* Pending academies */}
        {pendingAcademies.map((a, i) => (
          <View key={i} style={styles.academyCard}>
            <View style={styles.academyCardIcon}>
              <MaterialIcons name="shield" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.academyName}>{a.name}</Text>
              {a.description ? <Text style={styles.academyDesc}>{a.description}</Text> : null}
              <Text style={styles.academyDate}>
                Requested: {new Date(a.joined_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>PENDING</Text>
            </View>
          </View>
        ))}

        {/* What happens next */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>What happens next?</Text>
          {[
            { icon: 'notifications', text: 'Your coach receives a notification about your request' },
            { icon: 'how-to-reg', text: 'They review and approve your membership in their Coach Portal' },
            { icon: 'sports-cricket', text: 'You get full access to drills, AI coaching, and training logs' },
          ].map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <MaterialIcons name={s.icon as any} size={18} color={colors.primary} />
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>

        {/* Pull to refresh */}
        <View style={styles.refreshHint}>
          <MaterialIcons name="refresh" size={16} color={colors.textSecondary} />
          <Text style={styles.refreshHintText}>Pull down to check if you have been approved</Text>
        </View>

        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={18} color={colors.primary} />
          <Text style={styles.refreshBtnText}>Check Approval Status</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  scroll: { padding: spacing.md, paddingBottom: 60, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.md },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '800' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  logoutText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  heroBlock: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.warning + '20', justifyContent: 'center', alignItems: 'center' },
  heroTitle: { ...typography.h2, color: colors.text, fontWeight: '800', textAlign: 'center' },
  heroSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  academyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.warning + '40',
  },
  academyCardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  academyName: { fontSize: 16, fontWeight: '700', color: colors.text },
  academyDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  academyDate: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  pendingBadge: { backgroundColor: colors.warning + '20', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: colors.warning + '50' },
  pendingBadgeText: { fontSize: 10, color: colors.warning, fontWeight: '800', letterSpacing: 0.5 },
  stepsCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  stepsTitle: { ...typography.body, color: colors.text, fontWeight: '700', marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { fontSize: 11, color: colors.textLight, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  refreshHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  refreshHintText: { fontSize: 12, color: colors.textSecondary },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary + '15', borderRadius: borderRadius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  refreshBtnText: { fontSize: 15, color: colors.primary, fontWeight: '700' },
  approvedTitle: { ...typography.h2, color: colors.text, fontWeight: '800', textAlign: 'center', marginTop: spacing.md },
  approvedSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
