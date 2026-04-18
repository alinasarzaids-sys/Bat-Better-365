/**
 * PAYWALL — only shown to Independent_Player role.
 * Pricing: Monthly $14.90 / 6-Month $59.90 / Annual $99.90
 * Discount code PROMO850 → $8.50 / $39.90 / $69.90
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const DISCOUNT_CODE = 'PROMO850';

const PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: 14.90,
    discountPrice: 8.50,
    period: '/month',
    badge: null,
    save: null,
  },
  {
    id: 'sixmonth',
    label: '6-Month',
    price: 59.90,
    discountPrice: 39.90,
    period: '/6 months',
    badge: 'POPULAR',
    save: 'Save 33%',
  },
  {
    id: 'annual',
    label: 'Annual',
    price: 99.90,
    discountPrice: 69.90,
    period: '/year',
    badge: 'BEST VALUE',
    save: 'Save 42%',
  },
];

const FEATURES = [
  { icon: 'fitness-center', text: 'Unlimited access to all 4 pillars of drills' },
  { icon: 'psychology', text: 'AI-powered coaching & personalised feedback' },
  { icon: 'bar-chart', text: 'Advanced analytics & performance tracking' },
  { icon: 'book', text: 'Daily performance journal & goal tracking' },
  { icon: 'emoji-events', text: 'XP system, levels & leaderboards' },
  { icon: 'event', text: 'Session planner & calendar integration' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [selectedPlan, setSelectedPlan] = useState<string>('annual');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingSub, setExistingSub] = useState<{ product_id: string; expires_at: string } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  React.useEffect(() => {
    checkExistingSubscription();
  }, [user?.id]);

  const checkExistingSubscription = async () => {
    if (!user?.id) { setCheckingExisting(false); return; }
    const supabase = getSupabaseClient();
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('product_id, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (sub && new Date(sub.expires_at) > new Date()) {
      setExistingSub(sub);
    }
    setCheckingExisting(false);
  };

  const applyDiscount = () => {
    if (discountCode.trim().toUpperCase() === DISCOUNT_CODE) {
      setDiscountApplied(true);
      setShowCodeInput(false);
      showAlert('Discount Applied!', 'Your special discount has been applied to all plans.');
    } else {
      showAlert('Invalid Code', 'That discount code is not valid. Please check and try again.');
    }
  };

  const getPrice = (plan: typeof PLANS[0]) =>
    discountApplied ? plan.discountPrice : plan.price;

  const handleSubscribe = async () => {
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan || !user) return;

    setLoading(true);

    try {
      // Mock subscription: record in user_subscriptions
      const supabase = getSupabaseClient();

      // Calculate expiry based on plan
      const expiry = new Date();
      if (plan.id === 'monthly') expiry.setMonth(expiry.getMonth() + 1);
      else if (plan.id === 'sixmonth') expiry.setMonth(expiry.getMonth() + 6);
      else expiry.setFullYear(expiry.getFullYear() + 1);

      // Remove any existing subscription first
      await supabase.from('user_subscriptions').delete().eq('user_id', user.id);

      // Insert new subscription
      const { error } = await supabase.from('user_subscriptions').insert({
        user_id: user.id,
        product_id: `bat_better_${plan.id}`,
        platform: 'ios',
        status: 'active',
        transaction_id: `mock_${Date.now()}`,
        expires_at: expiry.toISOString(),
      });

      if (error) throw error;

      setLoading(false);
      router.replace('/');
    } catch (e: any) {
      setLoading(false);
      showAlert('Error', e.message || 'Something went wrong. Please try again.');
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id, status, expires_at')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (sub && new Date(sub.expires_at) > new Date()) {
        setLoading(false);
        router.replace('/');
        return;
      }
      setLoading(false);
      showAlert('No Active Subscription', 'We could not find an active subscription for this account.');
    } catch {
      setLoading(false);
      showAlert('Error', 'Failed to restore purchases. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Back button — always goes to mode-selection so user can switch to Academy mode */}
        <Pressable style={styles.backBtn} onPress={() => router.replace('/mode-selection' as any)}>
          <MaterialIcons name="arrow-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backBtnText}>Choose Mode</Text>
        </Pressable>

        {/* Loading check */}
        {checkingExisting && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Already subscribed */}
        {!checkingExisting && existingSub && (
          <View style={styles.alreadySubCard}>
            <View style={styles.alreadySubIcon}>
              <MaterialIcons name="check-circle" size={48} color="#22C55E" />
            </View>
            <Text style={styles.alreadySubTitle}>You are Already Subscribed!</Text>
            <Text style={styles.alreadySubSub}>
              Your <Text style={{ fontWeight: '800', color: colors.primary }}>{existingSub.product_id.replace('bat_better_', '').replace('_', ' ')}</Text> plan is active until{' '}
              <Text style={{ fontWeight: '700' }}>
                {new Date(existingSub.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>.
            </Text>
            <View style={styles.planFeatures}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <MaterialIcons name={f.icon as any} size={16} color="#22C55E" />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>
            <Pressable style={[styles.subscribeBtn, { backgroundColor: '#22C55E' }]} onPress={() => router.replace('/(tabs)' as any)}>
              <MaterialIcons name="home" size={20} color="#fff" />
              <Text style={styles.subscribeBtnText}>Go to Dashboard</Text>
            </Pressable>
            <Pressable style={styles.changePlanBtn} onPress={() => setExistingSub(null)}>
              <Text style={styles.changePlanText}>Want to change your plan?</Text>
            </Pressable>
          </View>
        )}

        {/* Full paywall */}
        {!checkingExisting && !existingSub && (<>
        <View style={styles.header}>
          <View style={styles.badgePill}>
            <MaterialIcons name="sports-cricket" size={14} color="#fff" />
            <Text style={styles.badgeText}>Bat Better 365 Premium</Text>
          </View>
          <Text style={styles.headline}>Unlock Your Full{'\n'}Batting Potential</Text>
          <Text style={styles.subline}>
            Train smarter. Progress faster. Perform better.{'\n'}
            Join thousands of cricketers already improving.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <MaterialIcons name={f.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Discount applied banner */}
        {discountApplied && (
          <View style={styles.discountBanner}>
            <MaterialIcons name="local-offer" size={16} color="#fff" />
            <Text style={styles.discountBannerText}>Discount code applied — special prices below!</Text>
          </View>
        )}

        {/* Plan selector */}
        <Text style={styles.sectionTitle}>Choose Your Plan</Text>
        {PLANS.map(plan => {
          const price = getPrice(plan);
          const selected = selectedPlan === plan.id;
          return (
            <Pressable
              key={plan.id}
              style={[styles.planCard, selected && styles.planCardSelected]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
                {selected && <View style={styles.planRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.planLabel, selected && { color: colors.primary }]}>{plan.label}</Text>
                  {plan.badge && (
                    <View style={[styles.planBadge, selected && { backgroundColor: colors.primary }]}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                </View>
                {plan.save && discountApplied && (
                  <Text style={styles.planSave}>{plan.save}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {discountApplied && (
                  <Text style={styles.planOldPrice}>${plan.price.toFixed(2)}</Text>
                )}
                <Text style={[styles.planPrice, selected && { color: colors.primary }]}>
                  ${price.toFixed(2)}
                </Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
            </Pressable>
          );
        })}

        {/* Subscribe button */}
        <Pressable
          style={[styles.subscribeBtn, loading && { opacity: 0.7 }]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="lock-open" size={20} color="#fff" />
              <Text style={styles.subscribeBtnText}>Start Training Now</Text>
            </>
          )}
        </Pressable>

        {/* Discount code */}
        {!discountApplied && (
          <View style={styles.discountSection}>
            {!showCodeInput ? (
              <Pressable onPress={() => setShowCodeInput(true)} style={styles.discountToggle}>
                <MaterialIcons name="local-offer" size={15} color={colors.primary} />
                <Text style={styles.discountToggleText}>Have a discount code? Enter here</Text>
              </Pressable>
            ) : (
              <View style={styles.discountRow}>
                <TextInput
                  style={styles.discountInput}
                  value={discountCode}
                  onChangeText={setDiscountCode}
                  placeholder="Enter code (e.g. PROMO850)"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  autoFocus
                />
                <Pressable style={styles.discountApplyBtn} onPress={applyDiscount}>
                  <Text style={styles.discountApplyText}>Apply</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Restore + legal */}
        <View style={styles.footer}>
          <Pressable onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
          <Text style={styles.legal}>
            Subscriptions auto-renew unless cancelled. Cancel anytime in App Store / Play Store settings.
            By subscribing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>

        </>)}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 48 },

  header: { alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.md },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginBottom: spacing.md,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  headline: { fontSize: 30, fontWeight: '900', color: colors.text, textAlign: 'center', lineHeight: 36, marginBottom: spacing.sm },
  subline: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  featuresCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  featureText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '500' },

  discountBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#22C55E', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  discountBannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.sm },

  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md + 4,
    borderWidth: 2, borderColor: colors.border, marginBottom: spacing.sm,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '06',
  },
  planRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  planRadioSelected: { borderColor: colors.primary },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  planBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
  planBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  planSave: { fontSize: 11, color: '#22C55E', fontWeight: '700', marginTop: 2 },
  planPrice: { fontSize: 20, fontWeight: '900', color: colors.text },
  planOldPrice: { fontSize: 12, color: colors.textSecondary, textDecorationLine: 'line-through' },
  planPeriod: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },

  subscribeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  subscribeBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },

  discountSection: { alignItems: 'center', marginBottom: spacing.md },
  discountToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
  discountToggleText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  discountRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  discountInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    fontSize: 14, color: colors.text, fontWeight: '700', letterSpacing: 2,
  },
  discountApplyBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg, justifyContent: 'center',
  },
  discountApplyText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  restoreBtn: { paddingVertical: spacing.sm },
  restoreText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  legal: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 15 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  backBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  alreadySubCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl,
    borderWidth: 2, borderColor: '#22C55E40', alignItems: 'center', gap: spacing.md,
  },
  alreadySubIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#22C55E15', justifyContent: 'center', alignItems: 'center',
  },
  alreadySubTitle: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' },
  alreadySubSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  planFeatures: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
  changePlanBtn: { paddingVertical: spacing.sm },
  changePlanText: { color: colors.textSecondary, fontSize: 13, textDecorationLine: 'underline' },
});
