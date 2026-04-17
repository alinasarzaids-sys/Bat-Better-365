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
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type Mode = 'login' | 'signup' | 'otp' | 'forgot' | 'reset-otp' | 'academy-join' | 'code-signin';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword, signUpWithPassword, sendOTP, verifyOTPAndLogin, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [academyCode, setAcademyCode] = useState('');

  // Code sign-in flow state
  const [codeSigninStep, setCodeSigninStep] = useState<'code' | 'auth'>('code');
  const [codeSigninCode, setCodeSigninCode] = useState('');
  const [codeSigninRole, setCodeSigninRole] = useState<'player' | 'coach' | null>(null);
  const [codeSigninEmail, setCodeSigninEmail] = useState('');
  const [codeSigninPassword, setCodeSigninPassword] = useState('');
  const [codeSigninAcademyName, setCodeSigninAcademyName] = useState('');
  const [codeSigninLoading, setCodeSigninLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { showAlert('Error', 'Please fill in all fields'); return; }
    const { error } = await signInWithPassword(email, password);
    if (error) {
      let msg = error;
      if (error.toLowerCase().includes('invalid') || error.toLowerCase().includes('credentials')) {
        msg = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('user')) {
        msg = "Account not found. Please sign up first or check your email address.";
      } else if (error.toLowerCase().includes('email') && error.toLowerCase().includes('confirm')) {
        msg = 'Please verify your email before logging in. Check your inbox.';
      }
      showAlert('Login Failed', msg);
    } else {
      router.replace('/');
    }
  };

  const handleSignup = async () => {
    if (!email || !password) { showAlert('Error', 'Please fill in all fields'); return; }
    if (password !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return; }
    if (password.length < 6) { showAlert('Error', 'Password must be at least 6 characters long'); return; }
    const { error } = await sendOTP(email);
    if (error) {
      let msg = error;
      if (error.toLowerCase().includes('already') || error.toLowerCase().includes('exist')) {
        msg = 'This email is already registered. Please sign in instead.';
      }
      showAlert('Sign Up Failed', msg);
      return;
    }
    showAlert('Success', `Verification code sent to ${email}`);
    setMode('otp');
  };

  // Sign up via academy code
  const handleAcademySignup = async () => {
    if (!email || !password) { showAlert('Error', 'Please fill in your email and password'); return; }
    if (password !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return; }
    if (password.length < 6) { showAlert('Error', 'Password must be at least 6 characters long'); return; }
    if (!academyCode.trim()) { showAlert('Error', 'Please enter your academy code'); return; }
    const { error } = await sendOTP(email);
    if (error) { showAlert('Error', error); return; }
    showAlert('Success', `Verification code sent to ${email}`);
    setMode('otp');
  };

  const handleVerifyOTP = async () => {
    if (!otp) { showAlert('Error', 'Please enter the verification code'); return; }
    const { error, user: newUser } = await verifyOTPAndLogin(email, otp, { password });
    if (error) { showAlert('Verification Failed', error); return; }
    await new Promise(r => setTimeout(r, 500));
    if (academyCode.trim()) {
      // New user joining via academy code — auto-join and skip profile questions
      try {
        const { getSupabaseClient } = await import('@/template');
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (uid) {
          const code = academyCode.trim().toUpperCase();
          const defaultName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const { academyService } = await import('@/services/academyService');
          await academyService.joinAcademy(code, uid, defaultName, 'Batsman', '', undefined, undefined);
          await supabase.from('user_profiles').update({ app_mode: 'academy' }).eq('id', uid);
        }
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('@bat_better_profile_setup_completed', 'true');
      } catch (_) {}
      router.replace('/');
    } else {
      router.replace('/mode-selection');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { showAlert('Error', 'Please enter your email address'); return; }
    const { error } = await sendOTP(email);
    if (error) { showAlert('Error', error); return; }
    showAlert('Success', 'Verification code sent to your email');
    setMode('reset-otp');
  };

  const handleResetPassword = async () => {
    if (!otp || !password || !confirmPassword) { showAlert('Error', 'Please fill in all fields'); return; }
    if (password !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return; }
    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) { showAlert('Error', error); }
    else { showAlert('Success', 'Password reset successfully!'); router.replace('/'); }
  };

  // Code-based sign-in: verify academy code first
  const handleVerifyJoinCode = async () => {
    const code = codeSigninCode.trim().toUpperCase();
    if (code.length < 6) { showAlert('Invalid Code', 'Please enter a valid 6-character code.'); return; }
    setCodeSigninLoading(true);
    try {
      const { getSupabaseClient } = await import('@/template');
      const supabase = getSupabaseClient();
      const { data: byPlayer } = await supabase.from('academies').select('id, name').eq('player_code', code).maybeSingle();
      const { data: byCoach } = await supabase.from('academies').select('id, name').eq('coach_code', code).maybeSingle();
      const { data: byAdmin } = await supabase.from('academies').select('id, name').eq('admin_code', code).maybeSingle();
      const academy = byPlayer || byCoach || byAdmin;
      if (!academy) {
        setCodeSigninLoading(false);
        showAlert('Code Not Found', 'This code does not match any academy. Please check and try again.');
        return;
      }
      if (byAdmin) setCodeSigninRole('coach');
      else if (byCoach) setCodeSigninRole('coach');
      else setCodeSigninRole('player');
      setCodeSigninAcademyName(academy.name);

      // If user is already authenticated, skip email step — auto-join and redirect
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (uid) {
        // Check if already a member
        const { data: existing } = await supabase.from('academy_members').select('id').eq('academy_id', academy.id).eq('user_id', uid).maybeSingle();
        if (!existing) {
          const defaultName = authData.user?.email?.split('@')[0]?.replace(/[._]/g, ' ')?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Player';
          const { academyService } = await import('@/services/academyService');
          await academyService.joinAcademy(code, uid, defaultName, 'Batsman', '', undefined, undefined);
          await supabase.from('user_profiles').update({ app_mode: 'academy' }).eq('id', uid);
        }
        // Mark profile setup so they skip profile questions
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('@bat_better_profile_setup_completed', 'true');
        setCodeSigninLoading(false);
        router.replace('/');
        return;
      }

      setCodeSigninStep('auth');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to verify code');
    }
    setCodeSigninLoading(false);
  };

  const handleCodeSigninSubmit = async () => {
    if (!codeSigninEmail || !codeSigninPassword) { showAlert('Error', 'Please enter email and password'); return; }
    setCodeSigninLoading(true);
    // Try sign in first (existing account)
    const { error: loginErr } = await signInWithPassword(codeSigninEmail, codeSigninPassword);
    if (!loginErr) {
      // Existing user: auto-join the academy silently, then go straight to app
      try {
        const { getSupabaseClient } = await import('@/template');
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (uid) {
          const code = codeSigninCode.trim().toUpperCase();
          const { data: byPlayer } = await supabase.from('academies').select('id').eq('player_code', code).maybeSingle();
          const { data: byCoach } = await supabase.from('academies').select('id').eq('coach_code', code).maybeSingle();
          const { data: byAdmin } = await supabase.from('academies').select('id').eq('admin_code', code).maybeSingle();
          const acad = byPlayer || byCoach || byAdmin;
          if (acad) {
            const { data: existing } = await supabase.from('academy_members').select('id').eq('academy_id', acad.id).eq('user_id', uid).maybeSingle();
            if (!existing) {
              const defaultName = codeSigninEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              const { academyService } = await import('@/services/academyService');
              await academyService.joinAcademy(code, uid, defaultName, 'Batsman', '', undefined, undefined);
              await supabase.from('user_profiles').update({ app_mode: 'academy' }).eq('id', uid);
            }
          }
        }
        // Mark profile setup complete so existing users bypass profile questions
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('@bat_better_profile_setup_completed', 'true');
      } catch (_) {}
      setCodeSigninLoading(false);
      router.replace('/');
      return;
    }
    // Not signed in — new user: send OTP
    const { error: otpErr } = await sendOTP(codeSigninEmail);
    if (otpErr) { showAlert('Error', otpErr); setCodeSigninLoading(false); return; }
    setEmail(codeSigninEmail);
    setPassword(codeSigninPassword);
    setConfirmPassword(codeSigninPassword);
    setAcademyCode(codeSigninCode.trim().toUpperCase());
    setCodeSigninLoading(false);
    setMode('otp');
    showAlert('Verify Email', `A 4-digit code was sent to ${codeSigninEmail}`);
  };

  const resetCodeSignin = () => {
    setCodeSigninStep('code');
    setCodeSigninCode('');
    setCodeSigninEmail('');
    setCodeSigninPassword('');
    setCodeSigninAcademyName('');
    setCodeSigninRole(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.header}>
            <Image source={require('@/assets/logo.png')} style={styles.logo} contentFit="contain" transition={200} />
            <Text style={styles.appName}>Bat Better 365</Text>
            <Text style={styles.tagline}>Your Complete Batting Training System</Text>
          </View>

          <View style={styles.form}>

            {/* ── Reset OTP ── */}
            {mode === 'reset-otp' && (
              <>
                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>Enter the 4-digit code sent to {email} and your new password</Text>
                <TextInput style={styles.input} placeholder="4-digit code" placeholderTextColor="#9CA3AF" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={4} autoFocus />
                <TextInput style={styles.input} placeholder="New Password (min 6 chars)" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
                <TextInput style={styles.input} placeholder="Confirm New Password" placeholderTextColor="#9CA3AF" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
                <Button title="Reset Password" onPress={handleResetPassword} loading={operationLoading} fullWidth style={styles.button} />
                <Pressable onPress={() => setMode('forgot')}><Text style={styles.linkText}>Back</Text></Pressable>
              </>
            )}

            {/* ── Forgot Password ── */}
            {mode === 'forgot' && (
              <>
                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>Enter your email and we will send you a verification code</Text>
                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoFocus />
                <Button title="Send Verification Code" onPress={handleForgotPassword} loading={operationLoading} fullWidth style={styles.button} />
                <Pressable onPress={() => setMode('login')}><Text style={styles.linkText}>Back to login</Text></Pressable>
              </>
            )}

            {/* ── OTP Verification ── */}
            {mode === 'otp' && (
              <>
                <Text style={styles.formTitle}>Enter Verification Code</Text>
                <Text style={styles.formSubtitle}>We sent a 4-digit code to {email}</Text>
                <TextInput style={styles.input} placeholder="4-digit code" placeholderTextColor="#9CA3AF" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={4} autoFocus />
                <Button title="Verify & Create Account" onPress={handleVerifyOTP} loading={operationLoading} fullWidth style={styles.button} />
                <Pressable onPress={() => setMode(academyCode ? 'academy-join' : 'signup')}><Text style={styles.linkText}>Back</Text></Pressable>
              </>
            )}

            {/* ── Academy Join (Signup with code) ── */}
            {mode === 'academy-join' && (
              <>
                <Pressable style={styles.backRow} onPress={() => setMode('signup')}>
                  <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>
                <View style={styles.academyJoinHeader}>
                  <View style={styles.academyJoinIcon}>
                    <MaterialIcons name="shield" size={28} color={colors.warning} />
                  </View>
                  <Text style={styles.formTitle}>Join Your Academy</Text>
                  <Text style={styles.formSubtitle}>Create your account with the code provided by your coach</Text>
                </View>

                <Text style={styles.fieldLabel}>Academy Code from Coach *</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="e.g. ABC123"
                  placeholderTextColor="#9CA3AF"
                  value={academyCode}
                  onChangeText={v => setAcademyCode(v.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={6}
                  autoFocus
                />

                <Text style={styles.fieldLabel}>Email *</Text>
                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.fieldLabel}>Password *</Text>
                <TextInput style={styles.input} placeholder="Password (min 6 chars)" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

                <Text style={styles.fieldLabel}>Confirm Password *</Text>
                <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#9CA3AF" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />

                <Button title="Continue with Academy Code" onPress={handleAcademySignup} loading={operationLoading} fullWidth style={styles.button} />

                <Pressable style={styles.switchModeButton} onPress={() => { setMode('login'); setAcademyCode(''); }}>
                  <Text style={styles.linkText}>Already have an account? Sign in</Text>
                </Pressable>
              </>
            )}

            {/* ── Sign in with Code ── */}
            {mode === 'code-signin' && (
              <>
                <Pressable style={styles.backRow} onPress={() => { setMode('login'); resetCodeSignin(); }}>
                  <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>

                <View style={styles.academyJoinHeader}>
                  <View style={[styles.academyJoinIcon, { backgroundColor: colors.primary + '20' }]}>
                    <MaterialIcons name="vpn-key" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.formTitle}>Sign in with Code</Text>
                  <Text style={styles.formSubtitle}>
                    {codeSigninStep === 'code'
                      ? 'Enter the Player Code or Coach Code from your academy'
                      : `You are joining ${codeSigninAcademyName} as a ${codeSigninRole === 'coach' ? 'Coach' : 'Player'}`}
                  </Text>
                </View>

                {codeSigninStep === 'code' && (
                  <>
                    <Text style={styles.fieldLabel}>Academy Code *</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      placeholder="e.g. ABC123"
                      placeholderTextColor="#9CA3AF"
                      value={codeSigninCode}
                      onChangeText={v => setCodeSigninCode(v.toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={6}
                      autoFocus
                    />
                    <Text style={styles.codeHint}>
                      Your coach will give you a 6-character Player Code or Coach Code
                    </Text>
                    <Pressable
                      style={[styles.primaryActionBtn, codeSigninLoading || codeSigninCode.length < 6 ? styles.primaryActionBtnDisabled : null]}
                      onPress={handleVerifyJoinCode}
                      disabled={codeSigninLoading || codeSigninCode.length < 6}
                    >
                      {codeSigninLoading
                        ? <ActivityIndicator color={colors.textLight} />
                        : (
                          <>
                            <MaterialIcons name="arrow-forward" size={18} color={colors.textLight} />
                            <Text style={styles.primaryActionBtnText}>Verify Code</Text>
                          </>
                        )}
                    </Pressable>
                  </>
                )}

                {codeSigninStep === 'auth' && (
                  <>
                    {/* Academy confirmation banner */}
                    <View style={styles.academyBanner}>
                      <MaterialIcons name={codeSigninRole === 'coach' ? 'school' : 'sports-cricket'} size={18} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.academyBannerName}>{codeSigninAcademyName}</Text>
                        <Text style={styles.academyBannerRole}>Joining as {codeSigninRole === 'coach' ? 'Coach' : 'Player'} · Code: {codeSigninCode}</Text>
                      </View>
                    </View>

                    <Text style={styles.fieldLabel}>Email *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#9CA3AF"
                      value={codeSigninEmail}
                      onChangeText={setCodeSigninEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                    />
                    <Text style={styles.fieldLabel}>Password *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Password (min 6 chars)"
                      placeholderTextColor="#9CA3AF"
                      value={codeSigninPassword}
                      onChangeText={setCodeSigninPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <Text style={styles.codeHint}>
                      Already have an account? Just sign in. New here? Enter a password to create your account automatically.
                    </Text>
                    <Pressable
                      style={[styles.primaryActionBtn, codeSigninLoading ? styles.primaryActionBtnDisabled : null]}
                      onPress={handleCodeSigninSubmit}
                      disabled={codeSigninLoading}
                    >
                      {codeSigninLoading
                        ? <ActivityIndicator color={colors.textLight} />
                        : (
                          <>
                            <MaterialIcons name="login" size={18} color={colors.textLight} />
                            <Text style={styles.primaryActionBtnText}>Continue</Text>
                          </>
                        )}
                    </Pressable>
                    <Pressable style={{ marginTop: spacing.sm }} onPress={() => setCodeSigninStep('code')}>
                      <Text style={[styles.linkText, { fontSize: 13 }]}>Wrong code? Change it</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* ── Login / Signup ── */}
            {(mode === 'login' || mode === 'signup') && (
              <>
                <Text style={styles.formTitle}>{mode === 'login' ? 'Welcome Back' : 'Get Started'}</Text>

                <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                <TextInput style={styles.input} placeholder="Password (min 6 characters)" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
                {mode === 'signup' && (
                  <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#9CA3AF" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
                )}

                <Button
                  title={mode === 'login' ? 'Sign In' : 'Sign Up'}
                  onPress={mode === 'login' ? handleLogin : handleSignup}
                  loading={operationLoading}
                  fullWidth
                  style={styles.button}
                />

                {mode === 'login' && (
                  <Pressable onPress={() => setMode('forgot')} style={styles.forgotButton}>
                    <Text style={styles.linkText}>Forgot password?</Text>
                  </Pressable>
                )}

                {/* Sign in with Code */}
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.divider} />
                </View>

                <Pressable
                  style={styles.codeSigninBtn}
                  onPress={() => { resetCodeSignin(); setMode('code-signin'); }}
                >
                  <MaterialIcons name="vpn-key" size={18} color={colors.primary} />
                  <Text style={styles.codeSigninBtnText}>Sign in with Academy Code</Text>
                  <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                </Pressable>

                {/* Demo shortcut */}
                <Pressable
                  style={styles.demoBtn}
                  onPress={async () => {
                    setEmail('james.mitchell@demo.com');
                    setPassword('demo1234');
                    const { error } = await signInWithPassword('james.mitchell@demo.com', 'demo1234');
                    if (error) showAlert('Demo Login', 'Set the demo account password first in Supabase Dashboard, or use your own credentials.');
                    else router.replace('/');
                  }}
                >
                  <MaterialIcons name="sports-cricket" size={15} color={colors.success} />
                  <Text style={styles.demoBtnText}>Demo: Riverside Cricket Academy (Coach)</Text>
                </Pressable>

                <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.switchModeButton}>
                  <Text style={styles.linkText}>
                    {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </Text>
                </Pressable>
              </>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 120, height: 120 },
  appName: { ...typography.h1, color: colors.text, marginTop: spacing.md },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  form: { width: '100%' },
  formTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  formSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center', lineHeight: 22 },
  fieldLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '600', marginBottom: spacing.xs, marginTop: 4 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D1D5DB',
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
    ...typography.body, color: colors.text, fontSize: 16,
  },
  codeInput: {
    letterSpacing: 4, fontSize: 22, fontWeight: '800',
    textAlign: 'center', color: colors.primary, borderColor: colors.primary + '60',
    backgroundColor: colors.primary + '08',
  },
  button: { marginTop: spacing.md, marginBottom: spacing.lg },
  linkText: { ...typography.body, color: colors.primary, textAlign: 'center' },
  forgotButton: { marginBottom: spacing.md },
  switchModeButton: { marginTop: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
  backText: { ...typography.bodySmall, color: colors.textSecondary },
  academyJoinHeader: { alignItems: 'center', marginBottom: spacing.md },
  academyJoinIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.warning + '20', justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.bodySmall, color: colors.textSecondary, marginHorizontal: spacing.md, fontWeight: '600' },
  codeSigninBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary + '12', borderWidth: 1.5, borderColor: colors.primary + '40',
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  codeSigninBtnText: { flex: 1, fontSize: 15, color: colors.primary, fontWeight: '700' },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.success + '12', borderWidth: 1, borderColor: colors.success + '35',
    borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  demoBtnText: { fontSize: 12, color: colors.success, fontWeight: '700' },
  codeHint: {
    fontSize: 12, color: colors.textSecondary, textAlign: 'center',
    marginBottom: spacing.md, lineHeight: 18,
  },
  primaryActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 2, marginBottom: spacing.md,
  },
  primaryActionBtnDisabled: { opacity: 0.5 },
  primaryActionBtnText: { color: colors.textLight, fontWeight: '700', fontSize: 16 },
  academyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  academyBannerName: { fontSize: 14, fontWeight: '800', color: colors.primary },
  academyBannerRole: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
});
