# Bat Better 365 - Subscription Setup Guide

## 🎯 Overview

This app uses **RevenueCat** for native in-app purchases with a **7-day free trial** and three subscription tiers.

## 💰 Subscription Plans

| Plan | Price | Monthly Cost | Savings |
|------|-------|--------------|---------|
| Monthly | $14.99/month | $14.99 | - |
| 6-Month | $89.99/6 months | $15.00/month | Save $10 |
| Annual | $169.99/year | $14.17/month | Save 40% |

**Free Trial:** 7 days with full premium access

## 📋 Setup Checklist

### Step 1: App Store Connect (iOS)

1. **Create App in App Store Connect**
   - Log in to [App Store Connect](https://appstoreconnect.apple.com)
   - Create your app if not already created
   - Note your Bundle ID (e.g., `com.yourname.batbetter365`)

2. **Create Subscription Products**
   - Go to your app → Features → In-App Purchases
   - Click "+" to create new subscription
   
   **Monthly Subscription:**
   - Product ID: `bat_better_monthly_1499`
   - Subscription Duration: 1 month
   - Price: $14.99
   - Free Trial: 7 days
   
   **6-Month Subscription:**
   - Product ID: `bat_better_6month_8999`
   - Subscription Duration: 6 months
   - Price: $89.99
   - Free Trial: 7 days
   
   **Annual Subscription:**
   - Product ID: `bat_better_annual_16999`
   - Subscription Duration: 1 year
   - Price: $169.99
   - Free Trial: 7 days

3. **Create Subscription Group**
   - Name: "Bat Better Premium"
   - Add all three subscriptions to this group

### Step 2: Google Play Console (Android)

1. **Create App in Google Play Console**
   - Log in to [Google Play Console](https://play.google.com/console)
   - Create your app or select existing
   - Note your Package Name (same as Bundle ID)

2. **Create Subscription Products**
   - Go to Monetize → Subscriptions → Create subscription
   
   **Monthly Subscription:**
   - Product ID: `bat_better_monthly_1499`
   - Billing period: 1 month
   - Price: $14.99
   - Free trial: 7 days
   
   **6-Month Subscription:**
   - Product ID: `bat_better_6month_8999`
   - Billing period: 6 months
   - Price: $89.99
   - Free trial: 7 days
   
   **Annual Subscription:**
   - Product ID: `bat_better_annual_16999`
   - Billing period: 1 year
   - Price: $169.99
   - Free trial: 7 days

### Step 3: RevenueCat Dashboard

1. **Create Project**
   - Log in to [RevenueCat Dashboard](https://app.revenuecat.com)
   - Create new project: "Bat Better 365"

2. **Configure iOS**
   - Go to Project Settings → Apps → iOS
   - Enter Bundle ID
   - Upload App Store Connect API Key or enter Shared Secret
   - Link to App Store Connect

3. **Configure Android**
   - Go to Project Settings → Apps → Android
   - Enter Package Name
   - Upload Google Play Service Account JSON
   - Link to Google Play Console

4. **Create Entitlement**
   - Go to Entitlements → Create Entitlement
   - Name: `premium`
   - Description: "Full access to all premium features"

5. **Create Products**
   - Go to Products → Create Product
   
   **For each product (Monthly, 6-Month, Annual):**
   - Enter the Product ID (must match App Store and Play Store)
   - Attach to `premium` entitlement
   - Set as part of default offering

6. **Create Offering**
   - Go to Offerings → Create Offering
   - Identifier: `default`
   - Add all three products:
     - Monthly package
     - 6-month package
     - Annual package (mark as default)

7. **Get API Keys**
   - Go to Project Settings → API Keys
   - Copy your **Public API Key**
   - Update `.env` file with production key when ready

### Step 4: Testing

1. **iOS Testing**
   - Create sandbox test users in App Store Connect
   - Build and install app on device
   - Sign out of real Apple ID
   - Sign in with sandbox test account when prompted
   - Test subscription purchase

2. **Android Testing**
   - Add test accounts in Google Play Console
   - Build and install app on device
   - Test subscription purchase

3. **RevenueCat Testing**
   - Use test API key for development
   - Check customer info in RevenueCat dashboard
   - Verify entitlement unlocked after purchase
   - Test trial period countdown

## 🔧 Current Configuration

The app is currently using:
- **Test API Key:** `test_cXozrJSAaYUoqrMuNJqXTmcoWvv`
- **Product IDs:** Defined in `constants/subscriptions.ts`

## 🚀 Production Deployment

Before publishing:

1. **Update API Key**
   - Replace test key with production key in `services/revenueCatService.ts`
   - Or use environment variable

2. **Test All Flows**
   - ✅ Sign up → Free trial starts
   - ✅ Trial period shows in app
   - ✅ Content locked after trial expires (if no subscription)
   - ✅ Purchase unlocks content
   - ✅ Restore purchases works
   - ✅ Subscription renews correctly

3. **Submit for Review**
   - Upload build to App Store Connect
   - Upload build to Google Play Console
   - Both will review your subscriptions

## 📱 User Flow

1. **New User Journey:**
   ```
   Download App
   → Sign Up
   → Subscription Screen (7-day free trial offer)
   → Start Trial
   → Full Access for 7 Days
   → Day 7: Auto-renew or cancel
   ```

2. **Free Trial Benefits:**
   - All drills unlocked (Technical, Physical, Mental, Tactical)
   - AI Coach full access
   - Advanced analytics
   - Custom training sessions
   - All challenges and achievements

3. **After Trial (No Subscription):**
   - Limited to 2 drills per pillar
   - No AI Coach
   - Basic analytics only
   - No custom sessions

## 🔒 Content Access Logic

The app checks subscription status using RevenueCat:

```typescript
// User has access if:
// 1. Currently in trial period (first 7 days)
// 2. Has active paid subscription
isSubscribed = revenueCatService.isSubscriptionActive(customerInfo);
```

Premium content is gated based on `isSubscribed` flag.

## 🆘 Troubleshooting

**Products not showing:**
- Verify Product IDs match exactly in App Store, Play Store, and RevenueCat
- Wait up to 24 hours for products to sync

**Purchase fails:**
- Check app is signed with correct Bundle ID / Package Name
- Verify RevenueCat API key is correct
- Check store account has payment method

**Trial not working:**
- Confirm trial period configured in App Store Connect / Play Console
- Check RevenueCat dashboard shows trial status

## 📞 Support

- RevenueCat Docs: https://docs.revenuecat.com
- RevenueCat Support: support@revenuecat.com
- App Support: batbetter365@gmail.com
