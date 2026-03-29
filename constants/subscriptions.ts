// Subscription tiers configuration for RevenueCat
// Product IDs must match those configured in RevenueCat Dashboard and App Store Connect / Google Play Console

export const SUBSCRIPTION_CONFIG = {
  // 7-day free trial with limited content access
  FREE_TRIAL_DAYS: 7,
  
  // Free tier limitations (applies after trial ends without subscription)
  FREE_TIER_LIMITS: {
    // Only 2 drills per pillar accessible without subscription
    maxDrillsPerPillar: 2,
    // No AI Coach access
    aiCoachEnabled: false,
    // Basic analytics only
    advancedAnalytics: false,
    // No custom sessions
    customSessions: false,
    // No challenges
    challengesEnabled: false,
  },
  
  // Premium benefits
  PREMIUM_BENEFITS: [
    'Unlimited access to all drills across all 4 pillars',
    'AI-powered coaching with personalized feedback',
    'Advanced progress tracking and analytics',
    'Custom training session builder',
    'Exclusive challenges and competitions',
    'Video analysis tools and drill demonstrations',
    'Priority support and early access to new features',
  ],
};

// RevenueCat Product Identifiers
// These MUST match the product IDs you create in:
// 1. App Store Connect (iOS)
// 2. Google Play Console (Android)
// 3. RevenueCat Dashboard (linked to both stores)
export const PRODUCT_IDS = {
  monthly: 'bat_better_monthly_1499',      // $14.99/month
  sixMonth: 'bat_better_6month_8999',      // $89.99/6 months
  annual: 'bat_better_annual_16999',       // $169.99/year
};

// Subscription tiers display information
export const SUBSCRIPTION_TIERS = {
  monthly: {
    name: 'Monthly Pass',
    displayPrice: '$14.99',
    interval: 'month',
    save: '',
    productId: PRODUCT_IDS.monthly,
    description: 'Perfect for trying out premium features',
  },
  sixMonth: {
    name: '6-Month Season Pass',
    displayPrice: '$89.99',
    interval: '6 months',
    save: 'SAVE $10',
    productId: PRODUCT_IDS.sixMonth,
    description: 'Ideal for a full cricket season',
    monthlyCost: '$15.00/month',
  },
  annual: {
    name: 'Annual Elite Pass',
    displayPrice: '$169.99',
    interval: 'year',
    save: 'SAVE 40%',
    productId: PRODUCT_IDS.annual,
    description: 'Best value for serious players',
    monthlyCost: '$14.17/month',
    popular: true,
  },
};
