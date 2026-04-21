/**
 * Academy Locked Screen
 * Shown when academy billing_status = 'locked'
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useAuth } from '@/template';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const SUPPORT_WHATSAPP = '+923001234567';
const SUPPORT_EMAIL = 'billing@batbetter365.com';

export default function AcademyLockedScreen() {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="lock" size={52} color={colors.error} />
        </View>

        <Text style={styles.title}>Academy Subscription Pending</Text>
        <Text style={styles.subtitle}>
          Your academy's subscription has expired or a payment is overdue. 
          All coaches and players are temporarily restricted until payment is confirmed.
        </Text>

        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={18} color={colors.warning} />
          <Text style={styles.infoText}>
            If you have already paid, please contact your administrator to confirm payment and unlock the academy.
          </Text>
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Contact Your Administrator</Text>
          <View style={styles.contactRow}>
            <MaterialIcons name="phone" size={16} color={colors.primary} />
            <Text style={styles.contactValue}>{SUPPORT_WHATSAPP}</Text>
          </View>
          <View style={styles.contactRow}>
            <MaterialIcons name="email" size={16} color={colors.primary} />
            <Text style={styles.contactValue}>{SUPPORT_EMAIL}</Text>
          </View>
        </View>

        <Text style={styles.instructionText}>
          Once payment is confirmed, the admin will unlock your academy and you will regain full access immediately.
        </Text>

        <Pressable style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/login'); }}>
          <MaterialIcons name="logout" size={18} color={colors.textSecondary} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.error + '15', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, fontWeight: '800', textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.warning + '12', borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.warning + '40', width: '100%',
  },
  infoText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  contactCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, width: '100%', gap: spacing.sm },
  contactTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.xs },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contactValue: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  instructionText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  logoutText: { fontSize: 15, color: colors.textSecondary, fontWeight: '700' },
});
