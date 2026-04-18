import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getSupabaseClient } from '@/template';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, sendOTP, verifyOTPAndLogin } = useAuth();
  const { showAlert } = useAlert();
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Change Password States
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordOTP, setPasswordOTP] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Subscription state
  const [subStatus, setSubStatus] = useState<'loading' | 'active' | 'inactive' | 'academy'>('loading');
  const [subExpiry, setSubExpiry] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<string | null>(null);

  useEffect(() => {
    loadSubStatus();
  }, [user?.id]);

  const loadSubStatus = async () => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('app_mode')
      .eq('id', user.id)
      .single();
    const mode = profile?.app_mode;
    setAppMode(mode);
    if (mode === 'admin' || mode === 'academy') {
      setSubStatus('academy');
      return;
    }
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('status, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (sub && new Date(sub.expires_at) > new Date()) {
      setSubStatus('active');
      setSubExpiry(new Date(sub.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    } else {
      setSubStatus('inactive');
    }
  };
  


  const appVersion = '1.0.0';

  // Handle Privacy
  const handlePrivacy = () => {
    router.push('/privacy-policy' as any);
  };

  // Handle Terms
  const handleTerms = () => {
    router.push('/terms' as any);
  };

  // Handle FAQs
  const handleFAQs = () => {
    router.push('/faqs' as any);
  };

  // Handle Contact Us
  const handleContactUs = () => {
    const email = 'batbetter365@gmail.com';
    const subject = 'Support Request';
    const body = 'Hello, I need help with...';
    
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };



  // Handle Send OTP for Password Change
  const handleSendOTP = async () => {
    if (!user?.email) {
      showAlert('Error', 'User email not found');
      return;
    }

    setLoading(true);
    const { error } = await sendOTP(user.email);
    setLoading(false);

    if (error) {
      showAlert('Error', error);
    } else {
      setOtpSent(true);
      showAlert('Success', 'Verification code sent to your email');
    }
  };

  // Handle Change Password
  const handleChangePassword = async () => {
    if (!newPassword || !confirmNewPassword || !passwordOTP) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (!user?.email) {
      showAlert('Error', 'User email not found');
      return;
    }

    setLoading(true);
    const { error } = await verifyOTPAndLogin(user.email, passwordOTP, { password: newPassword });
    setLoading(false);

    if (error) {
      showAlert('Error', error);
    } else {
      showAlert('Success', 'Password changed successfully');
      setShowChangePasswordModal(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordOTP('');
      setOtpSent(false);
    }
  };





  // Handle Delete Account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showAlert('Error', 'Please type DELETE to confirm');
      return;
    }

    setDeleteLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        showAlert('Error', 'Session expired. Please log in again.');
        setDeleteLoading(false);
        return;
      }

      // Explicitly pass the auth token in the headers
      const { error } = await supabase.functions.invoke('delete-account', {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        let errorMessage = error.message;
        try {
          // Try to get more specific error details
          const text = await (error as any).context?.text?.();
          if (text) errorMessage = text;
        } catch {}
        showAlert('Error', errorMessage || 'Failed to delete account. Please try again.');
        setDeleteLoading(false);
        return;
      }

      // Clear local storage
      await AsyncStorage.multiRemove([
        '@bat_better_onboarding_completed',
        '@bat_better_profile_setup_completed',
      ]);

      // Sign out locally
      await supabase.auth.signOut();

      setShowDeleteAccountModal(false);
      router.replace('/login' as any);
    } catch (err: any) {
      console.error('Delete account error:', err);
      showAlert('Error', 'Failed to delete account. Please try again.');
    }
    setDeleteLoading(false);
  };

  // Handle Reset & Start Over
  const handleResetApp = async () => {
    Alert.alert(
      'Reset App',
      'This will log you out and take you back to the intro screen, just like a fresh install. Use this to test the full sign-up flow.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                '@bat_better_onboarding_completed',
                '@bat_better_profile_setup_completed',
                '@bb365_intro_seen',
              ]);
              const supabase = getSupabaseClient();
              await supabase.auth.signOut();
              router.replace('/onboarding' as any);
            } catch {
              router.replace('/onboarding' as any);
            }
          },
        },
      ]
    );
  };

  // Handle Logout
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear local storage first
              await AsyncStorage.multiRemove([
                '@bat_better_onboarding_completed',
                '@bat_better_profile_setup_completed',
              ]);

              // Attempt Supabase logout (may fail if session is corrupted)
              const { error } = await logout();
              
              // Even if logout fails, navigate to login screen
              // This ensures user can always log out locally
              router.replace('/login' as any);
              
              // Show error only if needed, but don't block logout
              if (error) {
                console.warn('Logout warning:', error);
              }
            } catch (err) {
              console.error('Logout error:', err);
              // Force navigation to login even on error
              router.replace('/login' as any);
            }
          },
        },
      ]
    );
  };



  const renderSettingItem = (icon: string, title: string, onPress: () => void, color?: string) => (
    <Pressable style={styles.settingItem} onPress={onPress}>
      <MaterialIcons name={icon as any} size={24} color={color || colors.primary} />
      <Text style={[styles.settingItemText, color && { color }]}>{title}</Text>
      <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info */}
        <View style={styles.userInfoCard}>
          <MaterialIcons name="account-circle" size={64} color={colors.primary} />
          <Text style={styles.userEmail}>Logged in as {user?.email || 'User'}</Text>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
          <View style={styles.subCard}>
            {subStatus === 'loading' && (
              <ActivityIndicator color={colors.primary} size="small" />
            )}
            {subStatus === 'academy' && (
              <View style={styles.subStatusRow}>
                <View style={[styles.subBadge, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="shield" size={16} color={colors.primary} />
                  <Text style={[styles.subBadgeText, { color: colors.primary }]}>Academy Member</Text>
                </View>
                <Text style={styles.subNote}>Your academy covers your subscription. Enjoy full access!</Text>
              </View>
            )}
            {subStatus === 'active' && (
              <View style={styles.subStatusRow}>
                <View style={[styles.subBadge, { backgroundColor: '#22C55E20' }]}>
                  <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                  <Text style={[styles.subBadgeText, { color: '#22C55E' }]}>Active Premium</Text>
                </View>
                {subExpiry && <Text style={styles.subNote}>Renews {subExpiry}</Text>}
                <Pressable style={styles.subManageBtn} onPress={() => router.push('/paywall' as any)}>
                  <Text style={styles.subManageText}>Manage Plan</Text>
                  <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                </Pressable>
              </View>
            )}
            {subStatus === 'inactive' && (
              <View style={styles.subStatusRow}>
                <View style={[styles.subBadge, { backgroundColor: colors.error + '20' }]}>
                  <MaterialIcons name="lock" size={16} color={colors.error} />
                  <Text style={[styles.subBadgeText, { color: colors.error }]}>No Active Plan</Text>
                </View>
                <Text style={styles.subNote}>Subscribe to unlock all drills, AI coaching, and analytics.</Text>
                <Pressable
                  style={[styles.subManageBtn, { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }]}
                  onPress={() => router.push('/paywall' as any)}
                >
                  <MaterialIcons name="lock-open" size={16} color="#fff" />
                  <Text style={[styles.subManageText, { color: '#fff', fontWeight: '800' }]}>View Plans</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* General Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GENERAL</Text>
          {renderSettingItem('privacy-tip', 'Privacy', handlePrivacy)}
          {renderSettingItem('description', 'Terms and Conditions', handleTerms)}
          {renderSettingItem('help-outline', 'FAQs', handleFAQs)}
          {renderSettingItem('mail-outline', 'Contact Us', handleContactUs)}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          {renderSettingItem('lock-outline', 'Change Password', () => setShowChangePasswordModal(true))}
          {renderSettingItem('delete-forever', 'Delete Account', () => {
            setDeleteConfirmText('');
            setShowDeleteAccountModal(true);
          }, colors.error)}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          {renderSettingItem('refresh', 'Reset & Start Over', handleResetApp, colors.warning)}
          {renderSettingItem('logout', 'Logout', handleLogout, colors.error)}
        </View>

        {/* App Version */}
        <Text style={styles.appVersion}>App version: {appVersion}</Text>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable onPress={() => {
                setShowChangePasswordModal(false);
                setOtpSent(false);
                setNewPassword('');
                setConfirmNewPassword('');
                setPasswordOTP('');
              }}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {!otpSent ? (
              <>
                <Text style={styles.modalDescription}>
                  We'll send a verification code to your email to confirm your identity before changing your password.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleSendOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textLight} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Verification Code</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalDescription}>
                  Enter the 4-digit code sent to {user?.email} and your new password.
                </Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Verification Code (4 digits)"
                  value={passwordOTP}
                  onChangeText={setPasswordOTP}
                  keyboardType="number-pad"
                  maxLength={4}
                />

                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />

                <Pressable
                  style={styles.primaryButton}
                  onPress={handleChangePassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textLight} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Change Password</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>


      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccountModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <Pressable onPress={() => setShowDeleteAccountModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.deleteWarningBox}>
              <MaterialIcons name="warning" size={32} color={colors.error} />
              <Text style={styles.deleteWarningTitle}>This action cannot be undone</Text>
              <Text style={styles.deleteWarningText}>
                Deleting your account will permanently remove all your data including training history, journal entries, progress, and achievements.
              </Text>
            </View>

            <Text style={styles.deleteInstructions}>
              Type <Text style={styles.deleteKeyword}>DELETE</Text> below to confirm:
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={colors.textSecondary}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.secondaryButton]}
                onPress={() => setShowDeleteAccountModal(false)}
                disabled={deleteLoading}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.error, flex: 1, marginTop: 0 }]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
              >
                {deleteLoading ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={styles.primaryButtonText}>Delete Account</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textLight,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  userInfoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userEmail: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingItemText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
    marginLeft: spacing.md,
  },
  appVersion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  subCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subStatusRow: { gap: spacing.sm },
  subBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  subBadgeText: { fontSize: 13, fontWeight: '800' },
  subNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  subManageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingVertical: 4,
  },
  subManageText: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  modalDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  warningButton: {
    flex: 1,
    backgroundColor: colors.warning,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: colors.error,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  warningBox: {
    backgroundColor: colors.warning + '10',
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dangerBox: {
    backgroundColor: colors.error + '10',
    borderColor: colors.error,
  },
  warningTitle: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  dangerTitle: {
    color: colors.error,
  },
  warningDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  confirmationInstructions: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmationKeyword: {
    fontWeight: '700',
    color: colors.error,
  },
  deleteWarningBox: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error + '40',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  deleteWarningTitle: {
    ...typography.body,
    color: colors.error,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteWarningText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteInstructions: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  deleteKeyword: {
    fontWeight: '700',
    color: colors.error,
  },
});
