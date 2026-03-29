
import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword, signUpWithPassword, sendOTP, verifyOTPAndLogin, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  
  const [mode, setMode] = useState<'login' | 'signup' | 'otp' | 'forgot' | 'reset-otp'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    const { error } = await signInWithPassword(email, password);
    
    if (error) {
      // Provide more helpful error messages
      let errorMessage = error;
      if (error.toLowerCase().includes('invalid') || error.toLowerCase().includes('credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('user')) {
        errorMessage = "Account not found. Please sign up first or check your email address.";
      } else if (error.toLowerCase().includes('email') && error.toLowerCase().includes('confirm')) {
        errorMessage = 'Please verify your email before logging in. Check your inbox for the verification link.';
      }
      showAlert('Login Failed', errorMessage);
    } else {
      // After successful login, let the root router handle the flow
      // It will check subscription status and profile setup automatically
      router.replace('/');
    }
  };

  const handleSignup = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters long');
      return;
    }

    console.log('Starting signup process...');
    
    // Direct sign-up without email verification
    const { error, user: newUser } = await signUpWithPassword(email, password);
    
    console.log('Signup result:', { error, hasUser: !!newUser });
    
    if (error) {
      console.error('Signup error:', error);
      let errorMessage = error;
      if (error.toLowerCase().includes('already') || error.toLowerCase().includes('exist')) {
        errorMessage = 'This email is already registered. Please sign in instead or use a different email.';
      }
      showAlert('Sign Up Failed', errorMessage);
      return;
    }
    
    // Successful signup - go directly to profile setup
    console.log('Signup successful! Navigating to profile setup...');
    
    // Small delay to ensure auth state updates
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Navigate directly to profile setup
    router.replace('/profile-setup');
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      showAlert('Error', 'Please enter the verification code');
      return;
    }

    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Verification Failed', error);
    } else {
      // After successful verification, let the root router handle the flow
      router.replace('/');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showAlert('Error', 'Please enter your email address');
      return;
    }

    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
      return;
    }

    showAlert('Success', 'Verification code sent to your email');
    setMode('reset-otp');
  };

  const handleResetPassword = async () => {
    if (!otp || !password || !confirmPassword) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    // Verify OTP and set new password
    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Error', error);
    } else {
      // After successful password reset, let the root router handle the flow
      showAlert('Success', 'Password reset successfully!');
      router.replace('/');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    
    if (error) {
      showAlert('Google Sign-In Failed', error);
    }
    // Success case is handled by AuthRouter automatically
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              contentFit="contain"
              transition={200}
            />
            <Text style={styles.appName}>Bat Better 365</Text>
            <Text style={styles.tagline}>Your Complete Batting Training System</Text>
          </View>

          <View style={styles.form}>
            {mode === 'reset-otp' ? (
              <>
                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>
                  Enter the verification code sent to {email} and your new password
                </Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Enter 4-digit code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={4}
                />

                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <Button
                  title="Reset Password"
                  onPress={handleResetPassword}
                  loading={operationLoading}
                  fullWidth
                  style={styles.button}
                />

                <Pressable onPress={() => setMode('forgot')}>
                  <Text style={styles.linkText}>Back</Text>
                </Pressable>
              </>
            ) : mode === 'forgot' ? (
              <>
                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>
                  Enter your email and we will send you a verification code
                </Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoFocus
                />

                <Button
                  title="Send Verification Code"
                  onPress={handleForgotPassword}
                  loading={operationLoading}
                  fullWidth
                  style={styles.button}
                />

                <Pressable onPress={() => setMode('login')}>
                  <Text style={styles.linkText}>Back to login</Text>
                </Pressable>
              </>
            ) : mode === 'otp' ? (
              <>
                <Text style={styles.formTitle}>Enter Verification Code</Text>
                <Text style={styles.formSubtitle}>
                  We sent a 4-digit code to {email}
                </Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Enter 4-digit code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                />

                <Button
                  title="Verify & Create Account"
                  onPress={handleVerifyOTP}
                  loading={operationLoading}
                  fullWidth
                  style={styles.button}
                />

                <Pressable onPress={() => setMode('signup')}>
                  <Text style={styles.linkText}>Back to signup</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.formTitle}>
                  {mode === 'login' ? 'Welcome Back' : 'Get Started'}
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                {mode === 'signup' && (
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                )}

                <Button
                  title={mode === 'login' ? 'Sign In' : 'Sign Up'}
                  onPress={mode === 'login' ? handleLogin : handleSignup}
                  loading={operationLoading}
                  fullWidth
                  style={styles.button}
                />

                {mode === 'login' && (
                  <Pressable
                    onPress={() => setMode('forgot')}
                    style={styles.forgotButton}
                  >
                    <Text style={styles.linkText}>Forgot password?</Text>
                  </Pressable>
                )}

                {/* Google Sign-In is currently disabled - requires backend configuration */}
                {/*
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
                      <MaterialIcons name="android" size={24} color="#4285F4" />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </>
                  )}
                </Pressable>
                */}

                <Pressable
                  onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  style={styles.switchModeButton}
                >
                  <Text style={styles.linkText}>
                    {mode === 'login'
                      ? "Don't have an account? Sign up"
                      : 'Already have an account? Sign in'}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: spacing.md,
  },
  appName: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    width: '100%',
  },
  formTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  formSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.body,
  },
  button: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
    textAlign: 'center',
  },
  forgotButton: {
    marginBottom: spacing.md,
  },
  switchModeButton: {
    marginTop: spacing.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  googleButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
});
