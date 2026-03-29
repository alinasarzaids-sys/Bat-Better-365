import React, { useState } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getSupabaseClient } from '@/template';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, sendOTP, verifyOTPAndLogin } = useAuth();
  const { showAlert } = useAlert();
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  
  // Change Password States
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordOTP, setPasswordOTP] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  


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
            const { error } = await logout();
            if (error) {
              showAlert('Error', error);
            } else {
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
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
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
});
