import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors } from '@/constants/theme';

const ONBOARDING_KEY = '@bat_better_onboarding_completed';
const PROFILE_SETUP_KEY = '@bat_better_profile_setup_completed';

export default function RootScreen() {
  const { user, loading: authLoading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [profileSetupCompleted, setProfileSetupCompleted] = useState<boolean | null>(null);
  const [modeSelected, setModeSelected] = useState<boolean | null>(null);

  useEffect(() => {
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (user) checkMode();
    else setModeSelected(null);
  }, [user]);

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

  const checkMode = async () => {
    if (!user) return;
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('app_mode')
        .eq('id', user.id)
        .single();
      setModeSelected(!!data?.app_mode);
    } catch {
      setModeSelected(false);
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

  // Step 1: Show onboarding only for unauthenticated first-time visitors
  if (!onboardingCompleted && !user) {
    return <Redirect href="/onboarding" />;
  }

  // Step 2: Check authentication
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Step 3: Check mode selection
  if (modeSelected === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!modeSelected) {
    return <Redirect href="/mode-selection" />;
  }

  // Step 4: User has a mode — go straight to app
  // (Profile setup is optional; academy users bypass it entirely)
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
