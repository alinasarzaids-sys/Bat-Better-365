import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { MOCK_IAP } from '@/constants/featureFlags';
import { 
  getEntitlement, 
  activatePremiumWithTrial, 
  clearEntitlements,
  getIsPremium,
} from './entitlementStore';

// Platform-specific RevenueCat API keys
// Android key starts with 'goog_', iOS key starts with 'appl_'
const REVENUECAT_ANDROID_KEY = 'goog_OqVRwtGaEFOIbXuemoBTKzBupSS';
const REVENUECAT_IOS_KEY = 'appl_REPLACE_WITH_IOS_KEY'; // Replace with iOS key when available
const REVENUECAT_PUBLIC_KEY = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

// Mock packages for testing
const MOCK_PACKAGES = [
  {
    identifier: 'bat_better_monthly',
    product: {
      identifier: 'bat_better_monthly',
      priceString: '$14.99',
      price: 14.99,
      currencyCode: 'USD',
      title: 'Monthly Subscription',
      description: 'Bat Better 365 Monthly',
    },
  },
  {
    identifier: 'bat_better_6month',
    product: {
      identifier: 'bat_better_6month',
      priceString: '$89.99',
      price: 89.99,
      currencyCode: 'USD',
      title: '6-Month Subscription',
      description: 'Bat Better 365 6-Month',
    },
  },
  {
    identifier: 'bat_better_annual',
    product: {
      identifier: 'bat_better_annual',
      priceString: '$169.99',
      price: 169.99,
      currencyCode: 'USD',
      title: 'Annual Subscription',
      description: 'Bat Better 365 Annual',
    },
  },
];

class RevenueCatService {
  private initialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.initialized) return;

    if (MOCK_IAP) {
      this.initialized = true;
      console.log('🎭 MOCK IAP MODE - RevenueCat bypassed for user:', userId);
      return;
    }

    try {
      // Configure RevenueCat SDK
      await Purchases.configure({
        apiKey: REVENUECAT_PUBLIC_KEY,
        appUserID: userId,
      });

      this.initialized = true;
      console.log('RevenueCat initialized for user:', userId);
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    if (MOCK_IAP) {
      console.log('🎭 MOCK IAP - Returning mock packages');
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 600));
      
      return {
        identifier: 'default',
        serverDescription: 'Mock Default Offering',
        availablePackages: MOCK_PACKAGES as any,
        lifetime: null,
        annual: MOCK_PACKAGES[2] as any,
        sixMonth: MOCK_PACKAGES[1] as any,
        threeMonth: null,
        twoMonth: null,
        monthly: MOCK_PACKAGES[0] as any,
        weekly: null,
      } as PurchasesOffering;
    }

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('Failed to get offerings:', error);
      return null;
    }
  }

  async purchasePackage(packageToPurchase: any): Promise<{ success: boolean; error?: string }> {
    if (MOCK_IAP) {
      console.log('🎭 MOCK IAP - Simulating purchase:', packageToPurchase.identifier);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 900));
      
      // 10% chance of random error to test error handling
      if (Math.random() < 0.1) {
        console.log('🎭 MOCK IAP - Simulating random error');
        return { success: false, error: 'Purchase cancelled by user' };
      }
      
      // Activate premium with 7-day trial
      await activatePremiumWithTrial(packageToPurchase.identifier);
      
      console.log('🎭 MOCK IAP - Purchase successful! Premium activated with trial');
      return { success: true };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      
      if (this.isSubscriptionActive(customerInfo)) {
        return { success: true };
      }
      
      return { success: false, error: 'Purchase completed but subscription not active' };
    } catch (error: any) {
      if (error.userCancelled) {
        return { success: false, error: 'Purchase cancelled' };
      }
      
      console.error('Purchase error:', error);
      return { success: false, error: error.message || 'Purchase failed' };
    }
  }

  async restorePurchases(): Promise<{ success: boolean; error?: string }> {
    if (MOCK_IAP) {
      console.log('🎭 MOCK IAP - Checking for existing purchases');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const isPremium = await getIsPremium();
      
      if (isPremium) {
        console.log('🎭 MOCK IAP - Found existing subscription');
        return { success: true };
      }
      
      console.log('🎭 MOCK IAP - No existing subscriptions');
      return { success: false, error: 'No active subscriptions found' };
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      
      if (this.isSubscriptionActive(customerInfo)) {
        return { success: true };
      }
      
      return { success: false, error: 'No active subscriptions found' };
    } catch (error: any) {
      console.error('Restore error:', error);
      return { success: false, error: error.message || 'Failed to restore purchases' };
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (MOCK_IAP) {
      console.log('🎭 MOCK IAP - Returning mock customer info');
      const entitlement = await getEntitlement();
      
      // Create mock CustomerInfo object
      const mockCustomerInfo = {
        entitlements: {
          active: entitlement.isPremium ? {
            premium: {
              identifier: 'premium',
              isActive: true,
              periodType: entitlement.isInTrial ? 'trial' : 'normal',
              expirationDate: entitlement.trialEndDate,
              productIdentifier: entitlement.planId || 'bat_better_monthly',
            }
          } : {},
          all: {},
        },
        activeSubscriptions: entitlement.isPremium ? [entitlement.planId || 'bat_better_monthly'] : [],
        allPurchasedProductIdentifiers: [],
        latestExpirationDate: entitlement.trialEndDate,
        originalAppUserId: 'mock_user',
        requestDate: new Date().toISOString(),
        firstSeen: new Date().toISOString(),
        originalApplicationVersion: null,
        managementURL: null,
      } as any;
      
      return mockCustomerInfo;
    }

    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('Failed to get customer info:', error);
      return null;
    }
  }

  isSubscriptionActive(customerInfo: CustomerInfo): boolean {
    const entitlements = customerInfo.entitlements.active;
    // Check if user has any active entitlements (including trial)
    return Object.keys(entitlements).length > 0;
  }

  isInTrialPeriod(customerInfo: CustomerInfo): boolean {
    const entitlements = customerInfo.entitlements.active;
    // Check if any active entitlement is in trial period
    for (const key in entitlements) {
      if (entitlements[key].periodType === 'trial') {
        return true;
      }
    }
    return false;
  }

  getTrialEndDate(customerInfo: CustomerInfo): Date | null {
    const entitlements = customerInfo.entitlements.active;
    for (const key in entitlements) {
      if (entitlements[key].periodType === 'trial' && entitlements[key].expirationDate) {
        return new Date(entitlements[key].expirationDate!);
      }
    }
    return null;
  }

  async logout(): Promise<void> {
    if (MOCK_IAP) {
      console.log('🎭 MOCK IAP - Clearing entitlements on logout');
      await clearEntitlements();
      this.initialized = false;
      return;
    }

    try {
      await Purchases.logOut();
      this.initialized = false;
    } catch (error) {
      console.error('Failed to logout from RevenueCat:', error);
    }
  }
}

export const revenueCatService = new RevenueCatService();
