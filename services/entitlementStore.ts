/**
 * EntitlementStore - Persistent storage for mock subscription status
 * 
 * This stores premium subscription status locally using AsyncStorage
 * Only used when MOCK_IAP is enabled
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREMIUM_KEY = '@bat_better_is_premium';
const TRIAL_KEY = '@bat_better_trial_end';
const PLAN_KEY = '@bat_better_plan_id';

export interface MockEntitlement {
  isPremium: boolean;
  isInTrial: boolean;
  trialEndDate: string | null;
  planId: string | null;
}

/**
 * Get current premium status
 */
export async function getIsPremium(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PREMIUM_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Failed to get premium status:', error);
    return false;
  }
}

/**
 * Set premium status
 */
export async function setIsPremium(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREMIUM_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to set premium status:', error);
  }
}

/**
 * Get trial end date
 */
export async function getTrialEndDate(): Promise<Date | null> {
  try {
    const value = await AsyncStorage.getItem(TRIAL_KEY);
    return value ? new Date(value) : null;
  } catch (error) {
    console.error('Failed to get trial end date:', error);
    return null;
  }
}

/**
 * Set trial end date (7 days from now)
 */
export async function setTrialEndDate(date: Date): Promise<void> {
  try {
    await AsyncStorage.setItem(TRIAL_KEY, date.toISOString());
  } catch (error) {
    console.error('Failed to set trial end date:', error);
  }
}

/**
 * Get current plan ID
 */
export async function getPlanId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PLAN_KEY);
  } catch (error) {
    console.error('Failed to get plan ID:', error);
    return null;
  }
}

/**
 * Set current plan ID
 */
export async function setPlanId(planId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PLAN_KEY, planId);
  } catch (error) {
    console.error('Failed to set plan ID:', error);
  }
}

/**
 * Get full entitlement info
 */
export async function getEntitlement(): Promise<MockEntitlement> {
  const isPremium = await getIsPremium();
  const trialEndDate = await getTrialEndDate();
  const planId = await getPlanId();
  
  // Check if trial is still active
  const isInTrial = trialEndDate ? new Date() < new Date(trialEndDate) : false;
  
  return {
    isPremium,
    isInTrial,
    trialEndDate: trialEndDate?.toISOString() || null,
    planId,
  };
}

/**
 * Activate premium with trial period
 */
export async function activatePremiumWithTrial(planId: string): Promise<void> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7); // 7 days from now
  
  await setIsPremium(true);
  await setTrialEndDate(trialEnd);
  await setPlanId(planId);
  
  console.log('Mock subscription activated:', {
    planId,
    trialEnd: trialEnd.toISOString(),
  });
}

/**
 * Clear all entitlements (logout/restore)
 */
export async function clearEntitlements(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([PREMIUM_KEY, TRIAL_KEY, PLAN_KEY]);
    console.log('Mock entitlements cleared');
  } catch (error) {
    console.error('Failed to clear entitlements:', error);
  }
}
