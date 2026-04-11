import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type Mode = 'login' | 'signup' | 'otp' | 'forgot' | 'reset-otp' | 'academy-join';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword, signUpWithPassword, sendOTP, verifyOTPAndLogin, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [academyCode, setAcademyCode] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

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

  // Sign up via academy code — still sends OTP but carries code through
  const handleAcademySignup = async () => {
    if (!email || !password) { showAlert('Error', 'Please fill in your email and password'); return; }
    if (password !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return; }
    if (password.length < 6) { showAlert('Error', 'Password must be at least 6 characters long'); return; }
    if (!academyCode.trim()) { showAlert('Error', 'Please enter your academy code'); return; }
    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
      return;
    }
    showAlert('Success', `Verification code sent to ${email}`);
    setMode('otp');
  };

  const handleVerifyOTP = async () => {
    if (!otp) { showAlert('Error', 'Please enter the verification code'); return; }
    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) { showAlert('Verification Failed', error); return; }
    await new Promise(r => setTimeout(r, 500));
    // If they came from academy-join, pass code to mode-selection
    if (academyCode.trim()) {
      router.replace({ pathname: '/mode-selection', params: { prefillCode: academyCode.trim().toUpperCase() } } as any);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) showAlert('Google Sign-In Failed', error);
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

                {/* Academy Code shortcut */}
                <Pressable
                  style={styles.academyCodeBtn}
                  onPress={() => { setAcademyCode(''); setMode('academy-join'); }}
                >
                  <MaterialIcons name="vpn-key" size={16} color={colors.warning} />
                  <Text style={styles.academyCodeBtnText}>
                    {mode === 'login' ? 'Have an academy code? Sign up with it' : 'Have an academy code from your coach?'}
                  </Text>
                  <MaterialIcons name="chevron-right" size={16} color={colors.warning} />
                </Pressable>

                {/* Google Sign-In */}
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.divider} />
                </View>

                <Pressable
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || operationLoading}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <>
                      <MaterialIcons name="g-mobiledata" size={26} color="#4285F4" />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </>
                  )}
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
    textAlign: 'center', color: colors.warning, borderColor: colors.warning + '60',
    backgroundColor: colors.warning + '08',
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
  academyCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.warning + '12', borderWidth: 1, borderColor: colors.warning + '35',
    borderRadius: borderRadius.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  academyCodeBtnText: { flex: 1, fontSize: 13, color: colors.warning, fontWeight: '600' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.bodySmall, color: colors.textSecondary, marginHorizontal: spacing.md, fontWeight: '600' },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.lg,
  },
  googleButtonText: { ...typography.body, color: colors.text, fontWeight: '600' },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.success + '12', borderWidth: 1, borderColor: colors.success + '35',
    borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  demoBtnText: { fontSize: 12, color: colors.success, fontWeight: '700' },
});
