import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// Detect if identifier is an academy code (6 chars, no @)
function isAcademyCode(val: string): boolean {
  return val.length === 6 && !val.includes('@');
}

type Step = 'main' | 'otp' | 'code-needs-email' | 'forgot';

export default function LoginScreen() {
  const router = useRouter();
  const { user: authUser, signInWithPassword, signUpWithPassword, sendOTP, verifyOTPAndLogin, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<Step>('main');

  // Main step state
  const [identifier, setIdentifier] = useState('');   // email OR academy code
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP step state
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPassword, setOtpPassword] = useState('');
  const [pendingAcademyCode, setPendingAcademyCode] = useState('');

  // Code-needs-email step (new user joining with code)
  const [codeEmail, setCodeEmail] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [verifiedAcademyName, setVerifiedAcademyName] = useState('');

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email');

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN CONTINUE HANDLER
  // ─────────────────────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    const val = identifier.trim().toUpperCase();
    if (!val) { showAlert('Required', 'Please enter your email or academy code.'); return; }
    if (!password) { showAlert('Required', 'Please enter your password.'); return; }

    setLoading(true);

    if (isAcademyCode(val)) {
      // ── Academy Code Flow ──────────────────────────────────────────────────
      try {
        const { getSupabaseClient } = await import('@/template');
        const supabase = getSupabaseClient();

        // Look up academy by any code type
        const [{ data: byPlayer }, { data: byCoach }, { data: byAdmin }] = await Promise.all([
          supabase.from('academies').select('id, name').eq('player_code', val).maybeSingle(),
          supabase.from('academies').select('id, name').eq('coach_code', val).maybeSingle(),
          supabase.from('academies').select('id, name').eq('admin_code', val).maybeSingle(),
        ]);
        const academy = byPlayer || byCoach || byAdmin;

        if (!academy) {
          setLoading(false);
          showAlert('Code Not Found', 'This code does not match any academy. Please check with your coach.');
          return;
        }

        // If user already signed in (persistent session) — just join & go
        const uid = authUser?.id || (await supabase.auth.getUser()).data?.user?.id;
        if (uid) {
          const { data: existing } = await supabase
            .from('academy_members').select('id, role').eq('academy_id', academy.id).eq('user_id', uid).maybeSingle();

          if (existing && byAdmin && existing.role !== 'admin') {
            await supabase.from('academy_members').update({ role: 'admin' }).eq('id', existing.id);
          } else if (!existing) {
            const defaultName = authUser?.email?.split('@')[0]?.replace(/[._]/g, ' ')
              ?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Player';
            const { academyService } = await import('@/services/academyService');
            const role = byAdmin ? 'admin' : byCoach ? 'coach' : 'player';
            await academyService.joinAcademy(val, uid, defaultName, role === 'coach' ? 'Coach' : 'Batsman', '', undefined, undefined);
            await supabase.from('user_profiles').update({ app_mode: 'academy' }).eq('id', uid);
          }
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          await AsyncStorage.setItem('@bat_better_profile_setup_completed', 'true');
          setLoading(false);
          router.replace('/');
          return;
        }

        // Not signed in — try password sign-in with email we don't have yet
        // We need to collect email first → go to code-needs-email step
        setVerifiedCode(val);
        setVerifiedAcademyName(academy.name);
        setLoading(false);
        setStep('code-needs-email');
      } catch (e: any) {
        setLoading(false);
        showAlert('Error', e.message || 'Something went wrong. Please try again.');
      }
    } else {
      // ── Email Flow ─────────────────────────────────────────────────────────
      const email = identifier.trim().toLowerCase();

      // Try sign in first (existing user)
      const { error: loginErr } = await signInWithPassword(email, password);
      if (!loginErr) {
        // Existing user → mark profile setup, go to app
        try {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          await AsyncStorage.setItem('@bat_better_profile_setup_completed', 'true');
        } catch (_) {}
        setLoading(false);
        router.replace('/');
        return;
      }

      // Sign-in failed — check if it's a wrong password vs non-existent account
      const isWrongPassword = loginErr.toLowerCase().includes('invalid') ||
        loginErr.toLowerCase().includes('credentials') ||
        loginErr.toLowerCase().includes('password');

      if (isWrongPassword) {
        setLoading(false);
        showAlert('Incorrect Password', 'The password you entered is wrong. Please try again or use Forgot Password.');
        return;
      }

      // Account doesn't exist → create new account via OTP
      const { error: otpErr } = await sendOTP(email);
      if (otpErr) {
        setLoading(false);
        let msg = otpErr;
        if (otpErr.toLowerCase().includes('already')) {
          msg = 'An account with this email already exists. Please check your password.';
        }
        showAlert('Error', msg);
        return;
      }

      // Show OTP verification screen
      setOtpEmail(email);
      setOtpPassword(password);
      setPendingAcademyCode('');
      setOtp('');
      setLoading(false);
      setStep('otp');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CODE-NEEDS-EMAIL STEP: user entered a code but isn't logged in
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCodeEmailContinue = async () => {
    const email = codeEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) { showAlert('Required', 'Please enter a valid email address.'); return; }

    setLoading(true);

    // Try sign in with the existing password
    const { error: loginErr } = await signInWithPassword(email, password);
    if (!loginErr) {
      // Existing user — join academy and go to app
      try {
        const { getSupabaseClient } = await import('@/template');
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (uid) {
          const [{ data: byPlayer }, { data: byCoach }, { data: byAdmin }] = await Promise.all([
            supabase.from('academies').select('id, name').eq('player_code', verifiedCode).maybeSingle(),
            supabase.from('academies').select('id, name').eq('coach_code', verifiedCode).maybeSingle(),
            supabase.from('academies').select('id, name').eq('admin_code', verifiedCode).maybeSingle(),
          ]);
          const acad = byPlayer || byCoach || byAdmin;
          if (acad) {
            const { data: existing } = await supabase
              .from('academy_members').select('id, role').eq('academy_id', acad.id).eq('user_id', uid).maybeSingle();
            if (existing && byAdmin && existing.role !== 'admin') {
              await supabase.from('academy_members').update({ role: 'admin' }).eq('id', existing.id);
            } else if (!existing) {
              const defaultName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              const { academyService } = await import('@/services/academyService');
              await academyService.joinAcademy(verifiedCode, uid, defaultName, byAdmin ? 'Admin' : byCoach ? 'Coach' : 'Batsman', '', undefined, undefined);
              await supabase.from('user_profiles').update({ app_mode: 'academy' }).eq('id', uid);
            }
          }
        }
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('@bat_better_profile_setup_completed', 'true');
      } catch (_) {}
      setLoading(false);
      router.replace('/');
      return;
    }

    // Not signed in → new account, send OTP
    const { error: otpErr } = await sendOTP(email);
    if (otpErr) {
      setLoading(false);
      showAlert('Error', otpErr);
      return;
    }

    setOtpEmail(email);
    setOtpPassword(password);
    setPendingAcademyCode(verifiedCode);
    setOtp('');
    setLoading(false);
    setStep('otp');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // OTP VERIFY
  // ─────────────────────────────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) { showAlert('Error', 'Please enter the verification code.'); return; }

    const { error, user: newUser } = await verifyOTPAndLogin(otpEmail, otp, { password: otpPassword });
    if (error) { showAlert('Verification Failed', error); return; }

    await new Promise(r => setTimeout(r, 500));

    try {
      const { getSupabaseClient } = await import('@/template');
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;

      if (uid && pendingAcademyCode) {
        // Auto-join academy for new user who signed up via code
        const [{ data: byPlayer }, { data: byCoach }, { data: byAdmin }] = await Promise.all([
          supabase.from('academies').select('id, name').eq('player_code', pendingAcademyCode).maybeSingle(),
          supabase.from('academies').select('id, name').eq('coach_code', pendingAcademyCode).maybeSingle(),
          supabase.from('academies').select('id, name').eq('admin_code', pendingAcademyCode).maybeSingle(),
        ]);
        const acad = byPlayer || byCoach || byAdmin;
        if (acad) {
          const defaultName = otpEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const { academyService } = await import('@/services/academyService');
          await academyService.joinAcademy(pendingAcademyCode, uid, defaultName, byAdmin ? 'Admin' : byCoach ? 'Coach' : 'Batsman', '', undefined, undefined);
          await supabase.from('user_profiles').update({ app_mode: 'academy' }).eq('id', uid);
        }
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('@bat_better_profile_setup_completed', 'true');
        router.replace('/');
      } else {
        // New individual user → intro questions
        router.replace('/mode-selection');
      }
    } catch (_) {
      router.replace('/mode-selection');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ─────────────────────────────────────────────────────────────────────────────
  const handleForgotSend = async () => {
    if (!forgotEmail.trim()) { showAlert('Required', 'Please enter your email address.'); return; }
    setLoading(true);
    const { error } = await sendOTP(forgotEmail.trim().toLowerCase());
    setLoading(false);
    if (error) { showAlert('Error', error); return; }
    setForgotStep('otp');
  };

  const handleForgotReset = async () => {
    if (!forgotOtp || !forgotPassword) { showAlert('Required', 'Please fill in all fields.'); return; }
    if (forgotPassword.length < 6) { showAlert('Error', 'Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error } = await verifyOTPAndLogin(forgotEmail.trim().toLowerCase(), forgotOtp, { password: forgotPassword });
    setLoading(false);
    if (error) { showAlert('Error', error); return; }
    showAlert('Done', 'Password reset successfully! You are now logged in.');
    router.replace('/');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={styles.logoBlock}>
            <Image source={require('@/assets/logo.png')} style={styles.logo} contentFit="contain" transition={200} />
            <Text style={styles.appName}>Bat Better 365</Text>
            <Text style={styles.tagline}>Your Complete Batting Training System</Text>
          </View>

          {/* ── MAIN STEP ───────────────────────────────────────────────────── */}
          {step === 'main' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome</Text>
              <Text style={styles.cardSubtitle}>Enter your email or academy code to continue</Text>

              <Text style={styles.fieldLabel}>Email or Academy Code</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={t => setIdentifier(t.toUpperCase())}
                placeholder="e.g. john@email.com or ABC123"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password (min 6 characters)"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />

              <Pressable
                style={[styles.continueBtn, (loading || operationLoading) && styles.continueBtnDisabled]}
                onPress={handleContinue}
                disabled={loading || operationLoading}
              >
                {loading || operationLoading
                  ? <ActivityIndicator color={colors.textLight} />
                  : (
                    <>
                      <Text style={styles.continueBtnText}>Continue</Text>
                      <MaterialIcons name="arrow-forward" size={20} color={colors.textLight} />
                    </>
                  )}
              </Pressable>

              <Pressable onPress={() => { setForgotEmail(''); setForgotOtp(''); setForgotPassword(''); setForgotStep('email'); setStep('forgot'); }} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
              </Pressable>

              <View style={styles.hintCard}>
                <MaterialIcons name="info-outline" size={16} color={colors.primary} />
                <Text style={styles.hintText}>
                  New here? Just enter your email + a new password and we will set up your account automatically.
                  Have an academy code? Enter the code + a password.
                </Text>
              </View>
            </View>
          )}

          {/* ── OTP STEP ────────────────────────────────────────────────────── */}
          {step === 'otp' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => setStep('main')}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <View style={styles.otpIconCircle}>
                <MaterialIcons name="mark-email-read" size={32} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Check Your Email</Text>
              <Text style={styles.cardSubtitle}>
                We sent a 4-digit code to{'\n'}<Text style={{ fontWeight: '700', color: colors.text }}>{otpEmail}</Text>
              </Text>

              <Text style={styles.fieldLabel}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={setOtp}
                placeholder="0000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <Pressable
                style={[styles.continueBtn, operationLoading && styles.continueBtnDisabled]}
                onPress={handleVerifyOTP}
                disabled={operationLoading}
              >
                {operationLoading
                  ? <ActivityIndicator color={colors.textLight} />
                  : <Text style={styles.continueBtnText}>Verify & Continue</Text>}
              </Pressable>

              <Pressable onPress={async () => {
                const { error } = await sendOTP(otpEmail);
                if (!error) showAlert('Sent', 'A new code was sent to your email.');
              }} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>Resend code</Text>
              </Pressable>
            </View>
          )}

          {/* ── CODE-NEEDS-EMAIL STEP ────────────────────────────────────────── */}
          {step === 'code-needs-email' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => setStep('main')}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <View style={[styles.otpIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="shield" size={32} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>One More Step</Text>
              <Text style={styles.cardSubtitle}>
                You are joining{' '}
                <Text style={{ fontWeight: '800', color: colors.primary }}>{verifiedAcademyName}</Text>
                {'\n'}Enter your email to link your account.
              </Text>

              <Text style={styles.fieldLabel}>Your Email</Text>
              <TextInput
                style={styles.input}
                value={codeEmail}
                onChangeText={setCodeEmail}
                placeholder="e.g. john@email.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />

              <Pressable
                style={[styles.continueBtn, (loading || operationLoading) && styles.continueBtnDisabled]}
                onPress={handleCodeEmailContinue}
                disabled={loading || operationLoading}
              >
                {loading || operationLoading
                  ? <ActivityIndicator color={colors.textLight} />
                  : (
                    <>
                      <Text style={styles.continueBtnText}>Join Academy</Text>
                      <MaterialIcons name="login" size={20} color={colors.textLight} />
                    </>
                  )}
              </Pressable>
            </View>
          )}

          {/* ── FORGOT PASSWORD ──────────────────────────────────────────────── */}
          {step === 'forgot' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => setStep('main')}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back to Login</Text>
              </Pressable>

              <Text style={styles.cardTitle}>Reset Password</Text>

              {forgotStep === 'email' && (
                <>
                  <Text style={styles.cardSubtitle}>Enter your email and we will send a reset code.</Text>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                  <Pressable
                    style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
                    onPress={handleForgotSend}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color={colors.textLight} />
                      : <Text style={styles.continueBtnText}>Send Reset Code</Text>}
                  </Pressable>
                </>
              )}

              {forgotStep === 'otp' && (
                <>
                  <Text style={styles.cardSubtitle}>
                    Enter the code sent to{' '}
                    <Text style={{ fontWeight: '700' }}>{forgotEmail}</Text>
                    {' '}and your new password.
                  </Text>
                  <Text style={styles.fieldLabel}>Reset Code</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    placeholder="0000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <Text style={styles.fieldLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={forgotPassword}
                    onChangeText={setForgotPassword}
                    placeholder="New password (min 6 chars)"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Pressable
                    style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
                    onPress={handleForgotReset}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color={colors.textLight} />
                      : <Text style={styles.continueBtnText}>Reset Password</Text>}
                  </Pressable>
                </>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center', paddingBottom: 40 },

  logoBlock: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 100, height: 100 },
  appName: { ...typography.h2, color: colors.text, fontWeight: '800', marginTop: spacing.md },
  tagline: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  cardTitle: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  cardSubtitle: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md + 2,
    fontSize: 16, color: colors.text,
    marginBottom: spacing.xs,
  },
  otpInput: {
    textAlign: 'center', letterSpacing: 8, fontSize: 24,
    fontWeight: '800', color: colors.primary,
    borderColor: colors.primary + '60', backgroundColor: colors.primary + '08',
  },

  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 4, marginTop: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  continueBtnDisabled: { opacity: 0.55, shadowOpacity: 0 },
  continueBtnText: { color: colors.textLight, fontSize: 17, fontWeight: '800' },

  forgotLink: { alignItems: 'center', marginTop: spacing.md },
  forgotLinkText: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  hintCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '0C', borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.lg,
    borderWidth: 1, borderColor: colors.primary + '25',
  },
  hintText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  otpIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: spacing.md,
  },
});
