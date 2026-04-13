import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { Image } from 'expo-image';
import { useAuth, useAlert } from '@/template';
import { profileService } from '@/services/profileService';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_SETUP_KEY = '@bat_better_profile_setup_completed';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const { showAlert } = useAlert();

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [batsmanType, setBatsmanType] = useState('');
  const [loading, setLoading] = useState(false);

  const batsmanTypes = [
    { value: 'opener', label: 'Opener', icon: 'sports-cricket' },
    { value: 'middle-order', label: 'Middle Order', icon: 'filter-3' },
    { value: 'finisher', label: 'Finisher', icon: 'flash-on' },
    { value: 'all-rounder', label: 'All-Rounder', icon: 'star' },
  ];

  const handleComplete = async () => {
    // Validation
    if (!fullName.trim()) {
      showAlert('Missing Info', 'Please enter your full name');
      return;
    }

    if (!age.trim() || isNaN(parseInt(age)) || parseInt(age) < 5 || parseInt(age) > 100) {
      showAlert('Invalid Age', 'Please enter a valid age (5-100)');
      return;
    }

    if (!batsmanType) {
      showAlert('Missing Info', 'Please select your batsman type');
      return;
    }

    setLoading(true);

    // Refresh session to ensure user is properly loaded
    await refreshSession();
    
    if (!user?.id) {
      showAlert('Error', 'Session expired. Please login again.');
      setLoading(false);
      router.replace('/login');
      return;
    }
    try {
      // Update profile in database
      const { error } = await profileService.updateProfile(user.id, {
        full_name: fullName.trim(),
        age: parseInt(age),
        username: batsmanType, // Store batsman type in username field temporarily
      });

      if (error) {
        showAlert('Error', error);
        setLoading(false);
        return;
      }

      // Mark profile setup as completed
      await AsyncStorage.setItem(PROFILE_SETUP_KEY, 'true');

      // Navigate to main app
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      console.error('Profile setup error:', error);
      showAlert('Error', error.message || 'Failed to complete profile setup');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
          <Text style={styles.title}>Welcome to Bat Better 365!</Text>
          <Text style={styles.subtitle}>Tell us a bit about yourself to personalize your experience</Text>
        </View>

        {/* Full Name */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
          />
        </View>

        {/* Age */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Age *</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="Enter your age"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {/* Batsman Type */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Type of Batsman *</Text>
          <Text style={styles.hint}>Select your primary batting role</Text>
          
          <View style={styles.optionsGrid}>
            {batsmanTypes.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.optionCard,
                  batsmanType === type.value && styles.optionCardSelected,
                ]}
                onPress={() => setBatsmanType(type.value)}
              >
                <View style={[
                  styles.optionIconContainer,
                  batsmanType === type.value && styles.optionIconContainerSelected,
                ]}>
                  <MaterialIcons
                    name={type.icon as any}
                    size={32}
                    color={batsmanType === type.value ? colors.primary : colors.textSecondary}
                  />
                </View>
                <Text style={[
                  styles.optionLabel,
                  batsmanType === type.value && styles.optionLabelSelected,
                ]}>
                  {type.label}
                </Text>
                {batsmanType === type.value && (
                  <View style={styles.checkmark}>
                    <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Complete Button */}
        <Pressable
          style={[styles.completeButton, loading && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.completeButtonText}>Complete Setup</Text>
              <MaterialIcons name="arrow-forward" size={24} color="#fff" />
            </>
          )}
        </Pressable>

        <Text style={styles.footer}>
          You can update this information later in Settings
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  optionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '10',
  },
  optionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  optionIconContainerSelected: {
    backgroundColor: colors.primaryLight + '20',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
