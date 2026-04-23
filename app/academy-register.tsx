/**
 * Academy Owner Registration Screen
 * Zero-friction: form → direct signup → success screen (no OTP/email step)
 * Collects: Full Name, Academy Name, Email, WhatsApp, Password + Bank Payout Details
 * Auto-generates Coach_Code + Player_Code, activates 30-day trial
 * The registering user becomes the "Head Coach / Owner" (admin role in DB)
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type Step = 'form' | 'success';

export default function AcademyRegisterScreen() {
  const router = useRouter();
  const { operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Personal & Academy fields ─────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // ── Commission payout bank details ────────────────────────────────────────
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // ── Success step codes ────────────────────────────────────────────────────
  const [playerCode, setPlayerCode] = useState('');
  const [coachCode, setCoachCode] = useState('');

  const busy = loading || operationLoading;

  // ─── Generate a unique code ──────────────────────────────────────────────────
  const genCode = (len = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // ─── Submit: direct signup → create academy → success ──────────────────────
  const handleRegister = async () => {
    if (!fullName.trim()) { showAlert('Required', 'Enter your full name.'); return; }
    if (!academyName.trim()) { showAlert('Required', 'Enter your academy name.'); return; }
    if (!email.includes('@')) { showAlert('Required', 'Enter a valid email address.'); return; }
    if (!phone.trim() || phone.length < 8) { showAlert('Required', 'Enter a valid WhatsApp number.'); return; }
    if (password.length < 6) { showAlert('Required', 'Password must be at least 6 characters.'); return; }
    if (!bankName.trim()) { showAlert('Required', 'Enter your bank name for commission payouts.'); return; }
    if (!accountName.trim()) { showAlert('Required', 'Enter your account name for commission payouts.'); return; }
    if (!accountNumber.trim()) { showAlert('Required', 'Enter your account number for commission payouts.'); return; }

    setLoading(true);
    const emailLower = email.trim().toLowerCase();

    try {
      // Use edge function to create/confirm account and get session back
      const supabase = getSupabaseClient();
      let uid: string | null = null;

      const { data: regData, error: regErr } = await supabase.functions.invoke('confirm-and-register', {
        body: { email: emailLower, password, full_name: fullName.trim() },
      });

      if (regErr || !regData?.success) {
        let errMsg = 'Account creation failed. Please check your details and try again.';
        if (regErr?.message) errMsg = regErr.message;
        if (regData?.error) errMsg = regData.error;
        setLoading(false);
        showAlert('Error', errMsg);
        return;
      }

      uid = regData.user?.id;

      // Set the session returned by the edge function
      if (regData.session?.access_token) {
        await supabase.auth.setSession({
          access_token: regData.session.access_token,
          refresh_token: regData.session.refresh_token,
        });
      }

      if (!uid) {
        setLoading(false);
        showAlert('Error', 'Could not get user account. Please try again.');
        return;
      }

      const supabaseFinal = getSupabaseClient();

      // Check if this user already owns an academy
      const { data: existingAcademy } = await supabaseFinal
        .from('academies')
        .select('id, player_code, coach_code')
        .eq('created_by', uid)
        .maybeSingle();

      if (existingAcademy) {
        // Already registered — show their existing codes
        setPlayerCode(existingAcademy.player_code);
        setCoachCode(existingAcademy.coach_code);
        setLoading(false);
        setStep('success');
        return;
      }

      // Generate unique codes (2 tiers only)
      let pCode = genCode();
      let cCode = genCode();
      while (cCode === pCode) cCode = genCode();
      // Also generate internal admin_code (stored but not shown)
      const aCode = genCode();

      const trialStart = new Date().toISOString().split('T')[0];
      const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const { data: academy, error: createErr } = await supabaseFinal
        .from('academies')
        .insert({
          name: academyName.trim(),
          description: '',
          player_code: pCode,
          coach_code: cCode,
          admin_code: aCode,
          created_by: uid,
          owner_phone: phone.trim(),
          owner_email: emailLower,
          bank_name: bankName.trim(),
          account_name: accountName.trim(),
          account_number: accountNumber.trim(),
          trial_start_date: trialStart,
          trial_end_date: trialEnd,
          billing_status: 'trial',
          price_per_player: 550,
          currency: 'PKR',
        })
        .select()
        .single();

      if (createErr || !academy) {
        setLoading(false);
        showAlert('Error', createErr?.message || 'Failed to create academy. Please contact support.');
        return;
      }

      // Auto-add as admin/head coach — immediately approved, no waiting room
      await supabaseFinal.from('academy_members').insert({
        academy_id: academy.id,
        user_id: uid,
        role: 'admin',
        position: 'Head Coach',
        display_name: fullName.trim(),
        status: 'approved',
        is_active: true,
      });

      // Update profile
      await supabaseFinal.from('user_profiles').update({
        app_mode: 'academy',
        full_name: fullName.trim(),
      }).eq('id', uid);

      setPlayerCode(pCode);
      setCoachCode(cCode);
      setLoading(false);
      setStep('success');

    } catch (e: any) {
      setLoading(false);
      showAlert('Error', e.message || 'Something went wrong. Please try again.');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBlock}>
            <Image source={require('@/assets/logo.png')} style={styles.logo} contentFit="contain" transition={200} />
            <Text style={styles.appName}>Bat Better 365</Text>
          </View>

          {/* ── REGISTRATION FORM ── */}
          {step === 'form' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => router.back()}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back to Login</Text>
              </Pressable>

              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="shield" size={32} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Register Your Academy</Text>
              <Text style={styles.cardSub}>Get 30 days free — no credit card required</Text>

              {/* ── Personal Details ── */}
              <Text style={styles.sectionTitle}>Your Details</Text>

              <Text style={styles.label}>Your Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Tariq Hussain"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Academy / Team Name *</Text>
              <TextInput
                style={styles.input}
                value={academyName}
                onChangeText={setAcademyName}
                placeholder="e.g. Elite Cricket Academy"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="coach@academy.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>WhatsApp Number *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+923001234567"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Password *</Text>
              <View style={styles.pwdRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              {/* ── Commission Bank Payout Details ── */}
              <View style={styles.sectionDivider}>
                <MaterialIcons name="account-balance" size={16} color={colors.warning} />
                <Text style={styles.sectionDividerText}>Academy Payout Details</Text>
              </View>

              <Text style={styles.label}>Bank Name *</Text>
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. HBL, Meezan Bank, UBL"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Account Name *</Text>
              <TextInput
                style={styles.input}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Full name on your bank account"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Account Number *</Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="e.g. 01234567890123"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />

              <Pressable
                style={[styles.btn, busy && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="shield" size={20} color="#fff" />
                    <Text style={styles.btnText}>Create My Academy</Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.termsNote}>
                By registering you agree to the Bat Better terms.
              </Text>
            </View>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: '#22C55E20', width: 80, height: 80, borderRadius: 40 }]}>
                <MaterialIcons name="celebration" size={40} color="#22C55E" />
              </View>
              <Text style={styles.cardTitle}>Academy Created!</Text>
              <Text style={styles.cardSub}>
                Your 30-day free trial has started.{'\n'}
                Share these codes to invite your team.
              </Text>

              {/* How it works */}
              <View style={styles.howItWorksCard}>
                <MaterialIcons name="info-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.howItWorksTitle}>How the Waiting Room Works</Text>
                  <Text style={styles.howItWorksText}>
                    Anyone — player or assistant coach — who enters their code will be placed in a
                    {' '}<Text style={{ fontWeight: '800' }}>Waiting Room</Text>. You must approve them
                    from the Coach Portal before they gain access.
                  </Text>
                </View>
              </View>

              {/* Coach Code */}
              <View style={[styles.codesCard, { borderColor: colors.warning + '50', backgroundColor: colors.warning + '06' }]}>
                <View style={styles.codesTopRow}>
                  <MaterialIcons name="school" size={18} color={colors.warning} />
                  <Text style={[styles.codesTitle, { color: colors.warning }]}>COACH CODE</Text>
                  <Text style={styles.codesBillingTag}>Not billed</Text>
                </View>
                <Text style={[styles.codeVal, { color: colors.warning }]}>{coachCode}</Text>
                <Text style={styles.codesHint}>
                  Share with assistant coaches only. They will need your approval before getting access to the Coach Portal.
                </Text>
              </View>

              {/* Player Code */}
              <View style={[styles.codesCard, { borderColor: colors.primary + '50', backgroundColor: colors.primary + '06' }]}>
                <View style={styles.codesTopRow}>
                  <MaterialIcons name="sports-cricket" size={18} color={colors.primary} />
                  <Text style={[styles.codesTitle, { color: colors.primary }]}>PLAYER CODE</Text>
                  <View style={styles.billedTag}>
                    <MaterialIcons name="attach-money" size={11} color={colors.primary} />
                    <Text style={[styles.billedTagText, { color: colors.primary }]}>Billed at 850 PKR</Text>
                  </View>
                </View>
                <Text style={[styles.codeVal, { color: colors.primary }]}>{playerCode}</Text>
                <Text style={styles.codesHint}>
                  Share with players. They will appear in your Waiting Room until you approve them.
                </Text>
              </View>

              {/* Billing reminder */}
              <View style={styles.billingReminder}>
                <MaterialIcons name="receipt-long" size={15} color={colors.warning} />
                <Text style={styles.billingReminderText}>
                  <Text style={{ fontWeight: '800' }}>Billing note:</Text> Only approved Player Code members
                  are billed. Assistant coaches (Coach Code) are always free.
                </Text>
              </View>

              {/* Portal hint */}
              <View style={styles.portalHintCard}>
                <MaterialIcons name="vpn-key" size={15} color={colors.primary} />
                <Text style={styles.portalHintText}>
                  You can view and reshare these codes anytime inside the{' '}
                  <Text style={{ fontWeight: '800', color: colors.primary }}>Academy Portal</Text>
                  {' '}by tapping the key icon in the top-right corner.
                </Text>
              </View>

              <Pressable style={styles.btn} onPress={() => router.replace('/(tabs)/academy' as any)}>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                <Text style={styles.btnText}>Enter My Academy Portal</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center', paddingBottom: 48 },
  logoBlock: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { width: 80, height: 80 },
  appName: { ...typography.h3, color: colors.text, fontWeight: '800', marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  cardSub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.md },
  trialBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.warning + '15', borderRadius: borderRadius.md,
    padding: spacing.sm + 2, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.warning + '30',
  },
  trialText: { fontSize: 13, color: colors.warning, fontWeight: '700', flex: 1, lineHeight: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm, marginBottom: spacing.xs },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 5, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, marginBottom: spacing.xs,
  },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs },
  eyeBtn: { padding: 4 },
  sectionDivider: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.xl, marginBottom: spacing.xs,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  sectionDividerText: { fontSize: 14, fontWeight: '800', color: colors.warning },
  commissionNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.warning + '10', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.xs,
    borderWidth: 1, borderColor: colors.warning + '30',
  },
  commissionNoteText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 4, marginTop: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  btnDisabled: { opacity: 0.55, shadowOpacity: 0 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  termsNote: { marginTop: spacing.md, fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  iconCircle: {
    width: 68, height: 68, borderRadius: 34,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: spacing.md,
  },

  // Success screen
  howItWorksCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '0C', borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '25',
    marginBottom: spacing.sm,
  },
  howItWorksTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 3 },
  howItWorksText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  codesCard: {
    borderRadius: borderRadius.lg, borderWidth: 1.5,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  codesTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  codesTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  codesBillingTag: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', backgroundColor: colors.border + '80', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  billedTag: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary + '15', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  billedTagText: { fontSize: 10, fontWeight: '700' },
  codeVal: { fontSize: 30, fontWeight: '900', letterSpacing: 8, textAlign: 'center', marginVertical: spacing.xs },
  codesHint: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  billingReminder: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.warning + '10', borderRadius: borderRadius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.warning + '30',
    marginBottom: spacing.xs,
  },
  billingReminderText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  portalHintCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '08', borderRadius: borderRadius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '25',
    marginBottom: spacing.xs,
  },
  portalHintText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
