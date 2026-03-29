import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/template';
import { colors } from '@/constants/theme';

const ONBOARDING_KEY = '@bat_better_onboarding_completed';
const PROFILE_SETUP_KEY = '@bat_better_profile_setup_completed';

export default function RootScreen() {
  const { user, loading: authLoading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [profileSetupCompleted, setProfileSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const onboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
      const profileSetup = await AsyncStorage.getItem(PROFILE_SETUP_KEY);
      setOnboardingCompleted(onboarding === 'true');
      setProfileSetupCompleted(profileSetup === 'true');
    } catch (error) {
      console.error('Error checking onboarding:', error);
      setOnboardingCompleted(false);
      setProfileSetupCompleted(false);
    }
  };

  // Show loading while checking onboarding or auth states
  if (onboardingCompleted === null || profileSetupCompleted === null || authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Step 1: Show onboarding if not completed
  if (!onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  // Step 2: Check authentication
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Step 3: Check profile setup
  if (!profileSetupCompleted) {
    return <Redirect href="/profile-setup" />;
  }

  // Step 4: User is authenticated and profile complete - show app
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
