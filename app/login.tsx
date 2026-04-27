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
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

// 6 chars, no '@' = academy code
function isCode(val: string) {
  return val.length >= 4 && val.length <= 8 && !val.includes('@') && !val.includes('.');
}

type Step = 'main' | 'otp' | 'need-email' | 'forgot';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword, signUpWithPassword, sendOTP, verifyOTPAndLogin, logout, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<Step>('main');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<'player' | 'coach' | null>(null);

  // OTP step
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPassword, setOtpPassword] = useState('');
  const [pendingCode, setPendingCode] = useState('');

  // Need-email step (code but not signed in)
  const [codeEmail, setCodeEmail] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [verifiedAcademyName, setVerifiedAcademyName] = useState('');

  // Forgot
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPwd, setForgotPwd] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email');

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const lookupAcademy = async (code: string) => {
    const supabase = getSupabaseClient();
    const [{ data: p }, { data: c }, { data: a }] = await Promise.all([
      supabase.from('academies').select('id,name').eq('player_code', code).maybeSingle(),
      supabase.from('academies').select('id,name').eq('coach_code', code).maybeSingle(),
      supabase.from('academies').select('id,name').eq('admin_code', code).maybeSingle(),
    ]);
    return { academy: p || c || a, isAdmin: !!a, isCoach: !!c };
  };

  const joinAcademy = async (code: string, uid: string, email: string) => {
    const supabase = getSupabaseClient();
    const { academy, isAdmin, isCoach } = await lookupAcademy(code);
    if (!academy) return;

    const { data: existing } = await supabase
      .from('academy_members')
      .select('id,role')
      .eq('academy_id', academy.id)
      .eq('user_id', uid)
      .maybeSingle();

    const role = isAdmin ? 'admin' : isCoach ? 'coach' : 'player';

    if (existing) {
      // Upgrade role if needed
      if (isAdmin && existing.role !== 'admin') {
        await supabase.from('academy_members').update({ role: 'admin' }).eq('id', existing.id);
      }
    } else {
      const displayName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const { academyService } = await import('@/services/academyService');
      await academyService.joinAcademy(code, uid, displayName, isCoach ? 'Coach' : 'Batsman', '', undefined, undefined);
    }

    await supabase.from('user_profiles').update({ app_mode: 'academy' }).eq('id', uid);
  };

  // ─── MAIN CONTINUE ──────────────────────────────────────────────────────────
  const handleContinue = async () => {
    const raw = identifier.trim();
    if (!raw) { showAlert('Required', 'Enter your email or academy code.'); return; }
    if (!password) { showAlert('Required', 'Enter your password.'); return; }
    if (password.length < 4) { showAlert('Too Short', 'Password must be at least 4 characters.'); return; }

    setLoading(true);

    const val = isCode(raw) ? raw.toUpperCase() : raw.toLowerCase();

    // ── ACADEMY CODE ─────────────────────────────────────────────────────────
    if (isCode(val)) {
      try {
        const { academy } = await lookupAcademy(val);
        if (!academy) {
          setLoading(false);
          showAlert('Code Not Found', 'This code does not match any academy. Check with your coach.');
          return;
        }

        // Already signed in?
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;

        if (uid) {
          await joinAcademy(val, uid, authData.user!.email || '');
          setLoading(false);
          router.replace('/');
          return;
        }

        // Not signed in — need email
        setVerifiedCode(val);
        setVerifiedAcademyName(academy.name);
        setLoading(false);
        setStep('need-email');
      } catch (e: any) {
        setLoading(false);
        showAlert('Error', e.message || 'Something went wrong.');
      }
      return;
    }

    // ── EMAIL FLOW ───────────────────────────────────────────────────────────
    const email = val;

    // Try sign in
    const { error: loginErr } = await signInWithPassword(email, password);
    if (!loginErr) {
      setLoading(false);
      router.replace('/');
      return;
    }

    const isWrongPwd =
      loginErr.toLowerCase().includes('invalid') ||
      loginErr.toLowerCase().includes('credentials') ||
      loginErr.toLowerCase().includes('password') ||
      loginErr.toLowerCase().includes('email not confirmed') ||
      loginErr.toLowerCase().includes('not confirmed');

    if (isWrongPwd) {
      setLoading(false);
      showAlert('Wrong Password', 'The password you entered is incorrect. Try again or use Forgot Password.');
      return;
    }

    // New account — send OTP
    const { error: otpErr } = await sendOTP(email);
    if (otpErr) {
      setLoading(false);
      showAlert('Error', otpErr.includes('already') ? 'An account exists with this email. Check your password.' : otpErr);
      return;
    }

    setOtpEmail(email);
    setOtpPassword(password);
    setPendingCode('');
    setOtp('');
    setLoading(false);
    setStep('otp');
  };

  // ─── NEED-EMAIL (code login, no session) ────────────────────────────────────
  const handleNeedEmail = async () => {
    const email = codeEmail.trim().toLowerCase();
    if (!email.includes('@')) { showAlert('Required', 'Enter a valid email address.'); return; }
    setLoading(true);

    const { error: loginErr } = await signInWithPassword(email, password);
    if (!loginErr) {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        await joinAcademy(verifiedCode, authData.user.id, email);
      }
      setLoading(false);
      router.replace('/');
      return;
    }

    // New user — OTP
    const { error: otpErr } = await sendOTP(email);
    if (otpErr) { setLoading(false); showAlert('Error', otpErr); return; }

    setOtpEmail(email);
    setOtpPassword(password);
    setPendingCode(verifiedCode);
    setOtp('');
    setLoading(false);
    setStep('otp');
  };

  // ─── OTP VERIFY ─────────────────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (otp.length < 4) { showAlert('Error', 'Enter the verification code.'); return; }

    const { error } = await verifyOTPAndLogin(otpEmail, otp, { password: otpPassword });
    if (error) { showAlert('Verification Failed', error); return; }

    await new Promise(r => setTimeout(r, 400));

    if (pendingCode) {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        await joinAcademy(pendingCode, authData.user.id, otpEmail);
      }
    }

    router.replace('/');
  };

  // ─── FORGOT PASSWORD ────────────────────────────────────────────────────────
  const handleForgotSend = async () => {
    if (!forgotEmail.trim()) { showAlert('Required', 'Enter your email.'); return; }
    setLoading(true);
    const { error } = await sendOTP(forgotEmail.trim().toLowerCase());
    setLoading(false);
    if (error) { showAlert('Error', error); return; }
    setForgotStep('otp');
  };

  const handleForgotReset = async () => {
    if (!forgotOtp || !forgotPwd) { showAlert('Required', 'Fill in all fields.'); return; }
    if (forgotPwd.length < 4) { showAlert('Error', 'Password must be at least 4 characters.'); return; }
    setLoading(true);
    const { error } = await verifyOTPAndLogin(forgotEmail.trim().toLowerCase(), forgotOtp, { password: forgotPwd });
    setLoading(false);
    if (error) { showAlert('Error', error); return; }
    router.replace('/');
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  const busy = loading || operationLoading;

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

          {/* ── MAIN ─────────────────────────────────────────────────────── */}
          {step === 'main' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSub}>Sign in or create a new account</Text>

              <Text style={styles.label}>Email or Academy Code</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="john@email.com or ACAD01"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.pwdRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                  <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Pressable
                style={[styles.btn, busy && styles.btnDisabled]}
                onPress={handleContinue}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.btnText}>Continue</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => { setForgotEmail(''); setForgotOtp(''); setForgotPwd(''); setForgotStep('email'); setStep('forgot'); }} style={styles.linkRow}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>

              <View style={styles.hint}>
                <MaterialIcons name="info-outline" size={14} color={colors.primary} />
                <Text style={styles.hintText}>
                  New user? Enter your email + a new password to create an account.{"\n"}
                  Academy member? Enter your 6-digit code instead of email.
                </Text>
              </View>

              {/* ── DEMO BUTTONS ── */}
              <View style={styles.demoSection}>
                <View style={styles.demoLabelRow}>
                  <View style={styles.demoLine} />
                  <Text style={styles.demoLabelText}>Try a Demo</Text>
                  <View style={styles.demoLine} />
                </View>
                <View style={styles.demoRow}>
                  <Pressable
                    style={[styles.demoBtn, { flex: 1 }, demoLoading === 'player' && styles.btnDisabled]}
                    onPress={async () => {
                      setDemoLoading('player');
                      try { await logout(); } catch (_) {}
                      await new Promise(r => setTimeout(r, 300));
                      const supabase = getSupabaseClient();
                      const { error } = await supabase.auth.signInWithPassword({ email: 'demo.batbetter@gmail.com', password: 'Demo1234' });
                      setDemoLoading(null);
                      if (!error) { router.replace('/(tabs)' as any); return; }
                      showAlert('Demo Unavailable', error.message || 'Could not load player demo.');
                    }}
                    disabled={!!demoLoading || busy}
                  >
                    {demoLoading === 'player' ? <ActivityIndicator color={colors.primary} size="small" /> : (
                      <>
                        <MaterialIcons name="sports-cricket" size={20} color={colors.primary} />
                        <View>
                          <Text style={styles.demoBtnTitle}>Player Demo</Text>
                          <Text style={styles.demoBtnSub}>See player portal</Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.demoBtn, { flex: 1, borderColor: colors.warning, backgroundColor: colors.warning + '10' }, demoLoading === 'coach' && styles.btnDisabled]}
                    onPress={async () => {
                      setDemoLoading('coach');
                      try { await logout(); } catch (_) {}
                      await new Promise(r => setTimeout(r, 300));
                      const supabase = getSupabaseClient();
                      const { error } = await supabase.auth.signInWithPassword({ email: 'coach.batbetter@gmail.com', password: 'Demo1234' });
                      setDemoLoading(null);
                      if (!error) { router.replace('/(tabs)/academy' as any); return; }
                      showAlert('Demo Unavailable', error.message || 'Could not load coach demo.');
                    }}
                    disabled={!!demoLoading || busy}
                  >
                    {demoLoading === 'coach' ? <ActivityIndicator color={colors.warning} size="small" /> : (
                      <>
                        <MaterialIcons name="school" size={20} color={colors.warning} />
                        <View>
                          <Text style={[styles.demoBtnTitle, { color: colors.warning }]}>Coach Demo</Text>
                          <Text style={[styles.demoBtnSub, { color: colors.warning + 'AA' }]}>See coach portal</Text>
                        </View>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable style={styles.registerAcademyBtn} onPress={() => router.push('/academy-register' as any)}>
                <View style={[styles.iconCircle, { width: 40, height: 40, borderRadius: 20, marginBottom: 0, backgroundColor: colors.primary + '15' }]}>
                  <MaterialIcons name="shield" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.registerAcademyTitle}>Register a New Academy</Text>
                  <Text style={styles.registerAcademySub}>30-day free trial · No credit card</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>
          )}

          {/* ── OTP ──────────────────────────────────────────────────────── */}
          {step === 'otp' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => setStep('main')}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <View style={styles.iconCircle}>
                <MaterialIcons name="mark-email-read" size={32} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Check Your Email</Text>
              <Text style={styles.cardSub}>
                We sent a 4-digit code to{'\n'}
                <Text style={{ fontWeight: '700', color: colors.text }}>{otpEmail}</Text>
              </Text>

              <Text style={styles.label}>Verification Code</Text>
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

              <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handleVerifyOTP} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & Continue</Text>}
              </Pressable>

              <Pressable onPress={async () => { const { error } = await sendOTP(otpEmail); if (!error) showAlert('Sent', 'New code sent!'); }} style={styles.linkRow}>
                <Text style={styles.link}>Resend code</Text>
              </Pressable>
            </View>
          )}

          {/* ── NEED EMAIL ───────────────────────────────────────────────── */}
          {step === 'need-email' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => setStep('main')}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="shield" size={32} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>One More Step</Text>
              <Text style={styles.cardSub}>
                Joining <Text style={{ fontWeight: '800', color: colors.primary }}>{verifiedAcademyName}</Text>{'\n'}
                Enter your email to link your account.
              </Text>

              <Text style={styles.label}>Your Email</Text>
              <TextInput
                style={styles.input}
                value={codeEmail}
                onChangeText={setCodeEmail}
                placeholder="john@email.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />

              <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handleNeedEmail} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.btnText}>Join Academy</Text>
                    <MaterialIcons name="login" size={20} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* ── FORGOT ───────────────────────────────────────────────────── */}
          {step === 'forgot' && (
            <View style={styles.card}>
              <Pressable style={styles.backRow} onPress={() => setStep('main')}>
                <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={styles.backText}>Back to Login</Text>
              </Pressable>
              <Text style={styles.cardTitle}>Reset Password</Text>

              {forgotStep === 'email' && (
                <>
                  <Text style={styles.cardSub}>Enter your email and we will send a reset code.</Text>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={Platform.OS === 'ios'}
                    editable={!busy}
                    selectTextOnFocus
                  />
                  <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handleForgotSend} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Code</Text>}
                  </Pressable>
                </>
              )}

              {forgotStep === 'otp' && (
                <>
                  <Text style={styles.cardSub}>
                    Enter the code sent to <Text style={{ fontWeight: '700' }}>{forgotEmail}</Text> and your new password.
                  </Text>
                  <Text style={styles.label}>Reset Code</Text>
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
                  <Text style={styles.label}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={forgotPwd}
                    onChangeText={setForgotPwd}
                    placeholder="New password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={handleForgotReset} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
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
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center', paddingBottom: 48 },

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
  cardSub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },

  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md + 2,
    fontSize: 16, color: colors.text, marginBottom: spacing.xs,
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

  hint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.primary + '0C', borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.lg,
    borderWidth: 1, borderColor: colors.primary + '25',
  },
  hintText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: spacing.md,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  registerAcademyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md, backgroundColor: colors.primary + '0C',
    borderRadius: borderRadius.lg, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.primary + '30',
  },
  registerAcademyTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  registerAcademySub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  demoSection: { marginTop: spacing.lg },
  demoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  demoLine: { flex: 1, height: 1, backgroundColor: colors.border },
  demoLabelText: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  demoRow: { flexDirection: 'row', gap: spacing.sm },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 2, borderColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md, backgroundColor: colors.primary + '10',
    minHeight: 60,
  },
  demoBtnTitle: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  demoBtnSub: { color: colors.primary + '99', fontSize: 10, fontWeight: '500', marginTop: 1 },
});
