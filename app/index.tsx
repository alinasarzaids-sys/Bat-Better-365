/**
 * ROOT ROUTER — Single source of truth for navigation.
 * 
 * Flow:
 * 1. Wait for auth to load (Supabase persistent session)
 * 2. No user → show intro (first time) or login
 * 3. User exists → read app_mode from DB
 *    - no app_mode   → intro questions (mode-selection)
 *    - 'admin'       → main tabs (full access)
 *    - 'academy'     → main tabs (with academy tab)
 *    - 'individual'  → check subscription → paywall OR main tabs
 */

import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors } from '@/constants/theme';

const INTRO_SEEN_KEY = '@bb365_intro_seen';

type RouteDecision =
  | 'loading'
  | 'intro'       // green splash, unauthenticated first-time
  | 'login'
  | 'mode-select' // pick individual vs academy
  | 'paywall'     // individual, unpaid
  | 'app';        // go to main tabs

export default function RootScreen() {
  const { user, loading: authLoading } = useAuth();
  const [route, setRoute] = useState<RouteDecision>('loading');
  // Prevent re-running if user changes mid-check
  const resolvedRef = useRef(false);

  useEffect(() => {
    // Reset when auth loading finishes
    if (!authLoading) {
      resolvedRef.current = false;
      resolveRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const resolveRoute = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    // ── No user ────────────────────────────────────────────────────────────
    if (!user) {
      const seen = await AsyncStorage.getItem(INTRO_SEEN_KEY);
      setRoute(seen === 'true' ? 'login' : 'intro');
      return;
    }

    // ── Authenticated user ─────────────────────────────────────────────────
    try {
      const supabase = getSupabaseClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('app_mode')
        .eq('id', user.id)
        .single();

      const mode = profile?.app_mode as string | null | undefined;

      if (!mode) {
        // Brand new user — pick mode
        setRoute('mode-select');
        return;
      }

      if (mode === 'admin' || mode === 'academy') {
        // Academy/admin — no paywall
        setRoute('app');
        return;
      }

      // Independent player — check subscription
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id, status, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const isPaid = sub && new Date(sub.expires_at) > new Date();
      setRoute(isPaid ? 'app' : 'paywall');
    } catch {
      // DB error — let them in, don't trap in a loop
      setRoute('app');
    }
  };

  if (route === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (route === 'intro')        return <Redirect href="/onboarding" />;
  if (route === 'login')        return <Redirect href="/login" />;
  if (route === 'mode-select')  return <Redirect href="/mode-selection" />;
  if (route === 'paywall')      return <Redirect href="/paywall" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
