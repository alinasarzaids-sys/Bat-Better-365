/**
 * Academy Owner Registration Screen
 * Collects: Full Name, Academy Name, Email, WhatsApp, Password
 * Auto-generates Player_Code + Coach_Code, sends welcome email, activates 30-day trial
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

type Step = 'form' | 'otp' | 'success';

export default function AcademyRegisterScreen() {
  const router = useRouter();
  const { sendOTP, verifyOTPAndLogin, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // OTP step
  const [otp, setOtp] = useState('');

  // Success step
  const [playerCode, setPlayerCode] = useState('');
  const [coachCode, setCoachCode] = useState('');
  const [adminCode, setAdminCode] = useState('');

  const busy = loading || operationLoading;

  // ─── Step 1: Validate & Send OTP ────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!fullName.trim()) { showAlert('Required', 'Enter your full name.'); return; }
    if (!academyName.trim()) { showAlert('Required', 'Enter your academy name.'); return; }
    if (!email.includes('@')) { showAlert('Required', 'Enter a valid email address.'); return; }
    if (!phone.trim() || phone.length < 8) { showAlert('Required', 'Enter a valid WhatsApp number.'); return; }
    if (password.length < 6) { showAlert('Required', 'Password must be at least 6 characters.'); return; }

    setLoading(true);
    const { error } = await sendOTP(email.trim().toLowerCase());
    setLoading(false);

    if (error) {
      showAlert('Error', error);
      return;
    }

    setStep('otp');
  };

  // ─── Step 2: Verify OTP → Create Account → Create Academy ───────────────────
  const handleVerifyAndCreate = async () => {
    if (otp.length < 4) { showAlert('Error', 'Enter the 4-digit verification code.'); return; }
    setLoading(true);

    const { error: authError, user } = await verifyOTPAndLogin(
      email.trim().toLowerCase(), otp, { password }
    );

    if (authError || !user) {
      setLoading(false);
      showAlert('Verification Failed', authError || 'Could not verify code. Please try again.');
      return;
    }

    // Create academy with billing/owner info
    try {
      const supabase = getSupabaseClient();

      // Generate codes
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const genCode = (len = 6) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      let pCode = genCode();
      let cCode = genCode();
      let aCode = genCode();
      while (cCode === pCode || cCode === aCode) cCode = genCode();
      while (aCode === pCode || aCode === cCode) aCode = genCode();

      const trialStart = new Date().toISOString().split('T')[0];
      const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const { data: academy, error: createErr } = await supabase
        .from('academies')
        .insert({
          name: academyName.trim(),
          description: '',
          player_code: pCode,
          coach_code: cCode,
          admin_code: aCode,
          created_by: user.id,
          owner_phone: phone.trim(),
          owner_email: email.trim().toLowerCase(),
          trial_start_date: trialStart,
          trial_end_date: trialEnd,
          billing_status: 'trial',
        })
        .select()
        .single();

      if (createErr || !academy) {
        setLoading(false);
        showAlert('Error', createErr?.message || 'Failed to create academy. Please contact support.');
        return;
      }

      // Auto-add as admin member
      await supabase.from('academy_members').insert({
        academy_id: academy.id,
        user_id: user.id,
        role: 'admin',
        position: 'Head Coach',
        display_name: fullName.trim(),
        status: 'approved',
      });

      // Update profile
      await supabase.from('user_profiles').update({
        app_mode: 'academy',
        full_name: fullName.trim(),
      }).eq('id', user.id);

      // Send welcome email via Resend
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            academyName: academy.name,
            ownerName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            playerCode: pCode,
            coachCode: cCode,
            adminCode: aCode,
            trialEndDate: trialEnd,
          },
        });
      } catch (_) {
        // Non-fatal — codes shown on screen anyway
      }

      setPlayerCode(pCode);
      setCoachCode(cCode);
      setAdminCode(aCode);
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.logoBlock}>
            <Image source={require('@/assets/logo.png')} style={styles.logo} contentFit="contain" transition={200} />
            <Text style={styles.appName}>Bat Better 365</Text>
          </View>

          {/* ── FORM ── */}
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

              <View style={styles.trialBanner}>
                <MaterialIcons name="star" size={16} color={colors.warning} />
                <Text style={styles.trialText}>30-day FREE trial · Full access · Cancel anytime</Text>
              </View>

              <Text style={styles.label}>Your Full Name *</Text>
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
                placeholder="e.g. Tariq Hussain" placeholderTextColor={colors.textSecondary} autoCapitalize="words" />

              <Text style={styles.label}>Academy / Team Name *</Text>
              <TextInput style={styles.input} value={academyName} onChangeText={setAcademyName}
                placeholder="e.g. Elite Cricket Academy" placeholderTextColor={colors.textSecondary} autoCapitalize="words" />

              <Text style={styles.label}>Email Address *</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail}
                placeholder="coach@academy.com" placeholderTextColor={colors.textSecondary}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

              <Text style={styles.label}>WhatsApp Number * (for billing support)</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone}
                placeholder="+923001234567" placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad" />

              <Text style={styles.label}>Password *</Text>
              <View style={styles.pwdRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password} onChangeText={setPassword}
                  placeholder="Min. 6 characters" placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword} autoCapitalize="none" />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                  <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handleSendOTP} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.btnText}>Send Verification Code</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </Pressable>

              <Text style={styles.termsNote}>
                By registering, you agree to the Bat Better 365 terms of service. 
                After the 30-day trial, you will be billed {'\u20A8'}550/player/month via bank transfer.
              </Text>
            </View>
          )}

          {/* ── OTP ── */}
          {step === 'otp' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => setStep('form')}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="mark-email-read" size={32} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Check Your Email</Text>
              <Text style={styles.cardSub}>
                We sent a 4-digit code to{'\n'}
                <Text style={{ fontWeight: '700', color: colors.text }}>{email}</Text>
              </Text>

              <Text style={styles.label}>Verification Code</Text>
              <TextInput style={[styles.input, styles.otpInput]}
                value={otp} onChangeText={setOtp}
                placeholder="0000" placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad" maxLength={6} autoFocus />

              <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handleVerifyAndCreate} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.btnText}>Create My Academy</Text>
                    <MaterialIcons name="check" size={20} color="#fff" />
                  </>
                )}
              </Pressable>

              <Pressable onPress={async () => {
                const { error } = await sendOTP(email.trim().toLowerCase());
                if (!error) showAlert('Sent', 'New code sent to your email!');
              }} style={styles.linkRow}>
                <Text style={styles.link}>Resend code</Text>
              </Pressable>
            </View>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: '#22C55E' + '20', width: 80, height: 80, borderRadius: 40 }]}>
                <MaterialIcons name="celebration" size={40} color="#22C55E" />
              </View>
              <Text style={styles.cardTitle}>Academy Created!</Text>
              <Text style={styles.cardSub}>
                Your 30-day free trial has started.{'\n'}Share these codes to invite your squad.
              </Text>

              <View style={styles.codesCard}>
                <Text style={styles.codesTitle}>🛡️ ADMIN CODE (Full Access)</Text>
                <Text style={[styles.codeVal, { color: colors.error }]}>{adminCode}</Text>
                <Text style={styles.codesHint}>Keep this private — gives coach + player access</Text>
              </View>

              <View style={[styles.codesCard, { borderColor: colors.warning + '40' }]}>
                <Text style={styles.codesTitle}>🎓 COACH CODE</Text>
                <Text style={[styles.codeVal, { color: colors.warning }]}>{coachCode}</Text>
                <Text style={styles.codesHint}>Share with assistant coaches only</Text>
              </View>

              <View style={[styles.codesCard, { borderColor: colors.primary + '40' }]}>
                <Text style={styles.codesTitle}>🏏 PLAYER CODE</Text>
                <Text style={[styles.codeVal, { color: colors.primary }]}>{playerCode}</Text>
                <Text style={styles.codesHint}>Share with players — requires your approval to join</Text>
              </View>

              <View style={styles.pendingNote}>
                <MaterialIcons name="info-outline" size={16} color={colors.primary} />
                <Text style={styles.pendingNoteText}>
                  Players who enter the Player Code will appear in a <Text style={{ fontWeight: '700' }}>Waiting Room</Text> until you approve them in the Academy Portal.
                </Text>
              </View>

              <Pressable style={styles.btn} onPress={() => router.replace('/')}>
                <Text style={styles.btnText}>Enter My Academy Portal</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              </Pressable>

              <Text style={styles.trialInfo}>
                📧 Your codes have been sent to {email}{'\n'}
                Trial ends: {new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
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
  trialText: { fontSize: 13, color: colors.warning, fontWeight: '700', flex: 1 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 5, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, marginBottom: spacing.xs,
  },
  otpInput: {
    textAlign: 'center', letterSpacing: 8, fontSize: 24,
    fontWeight: '800', color: colors.primary,
    borderColor: colors.primary + '60', backgroundColor: colors.primary + '08',
  },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs },
  eyeBtn: { padding: 4 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 4, marginTop: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  btnDisabled: { opacity: 0.55, shadowOpacity: 0 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  linkRow: { alignItems: 'center', marginTop: spacing.md },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  termsNote: { marginTop: spacing.md, fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  iconCircle: {
    width: 68, height: 68, borderRadius: 34,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: spacing.md,
  },
  codesCard: {
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.error + '40',
    padding: spacing.md, marginBottom: spacing.sm, alignItems: 'center',
  },
  codesTitle: { fontSize: 11, color: colors.textSecondary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeVal: { fontSize: 28, fontWeight: '900', letterSpacing: 6, marginVertical: 6 },
  codesHint: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  pendingNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '0C', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primary + '25',
  },
  pendingNoteText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  trialInfo: { marginTop: spacing.md, fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
