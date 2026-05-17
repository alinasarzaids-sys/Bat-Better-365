/**
 * PAYWALL — only shown to Independent_Player role.
 * Pricing: Monthly $4.99 / 6-Month $24.99 / Annual $49.99
 * Regular (future) prices: Monthly $9.99 / 6-Month $49.99 / Annual $99.99
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { revenueCatService } from '@/services/revenueCatService';

const DISCOUNT_CODE = 'PROMO850';

const PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: 4.99,
    discountPrice: 4.99,
    period: '/month',
    badge: 'SALE',
    save: null,
  },
  {
    id: 'sixmonth',
    label: '6-Month',
    price: 24.99,
    discountPrice: 24.99,
    period: '/6 months',
    badge: 'POPULAR',
    save: 'Save 17%',
  },
  {
    id: 'annual',
    label: 'Annual',
    price: 49.99,
    discountPrice: 49.99,
    period: '/year',
    badge: 'BEST VALUE',
    save: 'Save 17%',
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
  const [promoLoading, setPromoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingSub, setExistingSub] = useState<{ product_id: string; expires_at: string } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [rcPackages, setRcPackages] = useState<any[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(true);

  React.useEffect(() => {
    checkExistingSubscription();
    initRevenueCat();
  }, [user?.id]);

  const initRevenueCat = async () => {
    if (!user?.id) { setOfferingsLoading(false); return; }
    try {
      await revenueCatService.initialize(user.id);
      const offering = await revenueCatService.getOfferings();
      if (offering?.availablePackages?.length) {
        setRcPackages(offering.availablePackages);
      }
    } catch (e) {
      console.error('RC init error:', e);
    }
    setOfferingsLoading(false);
  };

  const findRCPackage = (planId: string) => {
    if (!rcPackages.length) return null;
    // Match by packageType first
    const typeMap: Record<string, string> = {
      monthly: 'MONTHLY',
      sixmonth: 'SIX_MONTH',
      annual: 'ANNUAL',
    };
    const targetType = typeMap[planId];
    let pkg = rcPackages.find((p: any) => p.packageType === targetType);
    // Fallback: match by identifier string
    if (!pkg) {
      pkg = rcPackages.find((p: any) =>
        (p.identifier || '').toLowerCase().includes(planId) ||
        (p.product?.identifier || '').toLowerCase().includes(planId)
      );
    }
    return pkg || null;
  };

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

  const applyDiscount = async () => {
    const raw = discountCode.trim();
    const upper = raw.toUpperCase();

    // Standard discount code
    if (upper === DISCOUNT_CODE) {
      setDiscountApplied(true);
      setShowCodeInput(false);
      showAlert('Discount Applied!', 'Your special discount has been applied to all plans.');
      return;
    }

    // Promo codes (apna1–apna28) → grant 1 year free
    const lower = raw.toLowerCase();
    if (lower.startsWith('apna') && !isNaN(Number(lower.slice(4)))) {
      if (!user?.id) { showAlert('Sign In Required', 'Please sign in before redeeming a promo code.'); return; }
      setPromoLoading(true);
      try {
        const supabase = getSupabaseClient();
        // Find promo code
        const { data: promo, error: promoErr } = await supabase
          .from('promo_codes')
          .select('id, usage_limit, used_count, is_active')
          .eq('code', lower)
          .maybeSingle();

        if (promoErr || !promo) { showAlert('Invalid Code', 'This promo code does not exist.'); setPromoLoading(false); return; }
        if (!promo.is_active) { showAlert('Code Expired', 'This promo code is no longer active.'); setPromoLoading(false); return; }
        if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
          showAlert('Code Used', 'This promo code has already been redeemed.'); setPromoLoading(false); return;
        }

        // Check if user already redeemed this code
        const { data: existing } = await supabase
          .from('user_promo_redemptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('promo_code_id', promo.id)
          .maybeSingle();
        if (existing) { showAlert('Already Redeemed', 'You have already used this promo code.'); setPromoLoading(false); return; }

        // Grant 1 month free subscription
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);
        await supabase.from('user_subscriptions').delete().eq('user_id', user.id);
        const { error: subErr } = await supabase.from('user_subscriptions').insert({
          user_id: user.id,
          product_id: 'bat_better_promo_annual',
          platform: 'promo',
          status: 'active',
          transaction_id: `promo_${lower}_${Date.now()}`,
          expires_at: expiry.toISOString(),
        });
        if (subErr) throw subErr;

        // Record redemption
        await supabase.from('user_promo_redemptions').insert({ user_id: user.id, promo_code_id: promo.id });

        // Increment used_count
        await supabase.from('promo_codes').update({ used_count: promo.used_count + 1 }).eq('id', promo.id);

        setPromoLoading(false);
        showAlert('Access Granted!', 'Promo code accepted. You now have 1 year of free access!', [
          { text: 'Start Training', onPress: () => router.replace('/') }
        ]);
      } catch (e: any) {
        setPromoLoading(false);
        showAlert('Error', e.message || 'Failed to redeem promo code.');
      }
      return;
    }

    showAlert('Invalid Code', 'That code is not valid. Please check and try again.');
  };

  const getPrice = (plan: typeof PLANS[0]) =>
    discountApplied ? plan.discountPrice : plan.price;

  const handleSubscribe = async () => {
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan || !user) return;

    // Find the matching RevenueCat package
    const rcPackage = findRCPackage(selectedPlan);
    if (!rcPackage) {
      showAlert(
        'Plans Unavailable',
        'Could not load subscription plans. Please check your internet connection and try again.'
      );
      return;
    }

    setLoading(true);
    try {
      const result = await revenueCatService.purchasePackage(rcPackage);

      if (!result.success) {
        setLoading(false);
        // Silent dismiss on user cancellation
        if (result.error && result.error.toLowerCase().includes('cancel')) return;
        showAlert('Purchase Failed', result.error || 'Something went wrong. Please try again.');
        return;
      }

      // Purchase succeeded — sync to Supabase for our own tracking
      const supabase = getSupabaseClient();
      const expiry = new Date();
      if (plan.id === 'monthly') expiry.setMonth(expiry.getMonth() + 1);
      else if (plan.id === 'sixmonth') expiry.setMonth(expiry.getMonth() + 6);
      else expiry.setFullYear(expiry.getFullYear() + 1);

      await supabase.from('user_subscriptions').delete().eq('user_id', user.id);
      const { error: subErr } = await supabase.from('user_subscriptions').insert({
        user_id: user.id,
        product_id: rcPackage.product?.identifier || `bat_better_${plan.id}`,
        platform: Platform.OS,
        status: 'active',
        transaction_id: `rc_${Date.now()}`,
        expires_at: expiry.toISOString(),
      });

      if (subErr) {
        // Log but don't block — RC purchase is confirmed, Supabase sync is secondary
        console.error('Supabase sync error after purchase:', subErr);
      }

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
      const result = await revenueCatService.restorePurchases();

      if (result.success) {
        // Get customer info to determine expiry for Supabase sync
        const customerInfo = await revenueCatService.getCustomerInfo();
        const activeEntitlements = customerInfo?.entitlements?.active || {};
        const entitlementKeys = Object.keys(activeEntitlements);

        if (entitlementKeys.length > 0) {
          const entitlement = activeEntitlements[entitlementKeys[0]];
          const expiryDate = entitlement.expirationDate
            ? new Date(entitlement.expirationDate)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year fallback

          const supabase = getSupabaseClient();
          await supabase.from('user_subscriptions').delete().eq('user_id', user!.id);
          await supabase.from('user_subscriptions').insert({
            user_id: user!.id,
            product_id: entitlement.productIdentifier || 'restored',
            platform: Platform.OS,
            status: 'active',
            transaction_id: `rc_restore_${Date.now()}`,
            expires_at: expiryDate.toISOString(),
          });
        }

        setLoading(false);
        router.replace('/');
        return;
      }

      setLoading(false);
      showAlert('No Active Subscription', 'We could not find an active subscription for this account. If you believe this is an error, please contact support.');
    } catch {
      setLoading(false);
      showAlert('Error', 'Failed to restore purchases. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Back button */}
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            try {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/login' as any);
              }
            } catch {
              router.replace('/login' as any);
            }
          }}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 32 }}
          android_ripple={{ color: colors.border, borderless: false, radius: 40 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          <Text style={styles.backBtnText}>Back</Text>
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
          style={[styles.subscribeBtn, (loading || offeringsLoading) && { opacity: 0.7 }]}
          onPress={handleSubscribe}
          disabled={loading || offeringsLoading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : offeringsLoading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.subscribeBtnText}>Loading Plans...</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="lock-open" size={20} color="#fff" />
              <Text style={styles.subscribeBtnText}>Start Training Now</Text>
            </>
          )}
        </Pressable>

        {/* Promo / Discount code */}
        <View style={styles.discountSection}>
          {!showCodeInput ? (
            <Pressable onPress={() => setShowCodeInput(true)} style={styles.discountToggle}>
              <MaterialIcons name="local-offer" size={15} color={colors.primary} />
              <Text style={styles.discountToggleText}>{discountApplied ? 'Discount applied ✓' : 'Have a promo or discount code?'}</Text>
            </Pressable>
          ) : (
            <View style={styles.discountRow}>
              <TextInput
                style={styles.discountInput}
                value={discountCode}
                onChangeText={setDiscountCode}
                placeholder="e.g. apna1 or PROMO850"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={[styles.discountApplyBtn, promoLoading && { opacity: 0.6 }]} onPress={applyDiscount} disabled={promoLoading}>
                {promoLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.discountApplyText}>Apply</Text>}
              </Pressable>
            </View>
          )}
        </View>

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

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md, paddingVertical: 8, paddingHorizontal: 4, minHeight: 44 },
  backBtnText: { fontSize: 16, color: colors.text, fontWeight: '600' },

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
