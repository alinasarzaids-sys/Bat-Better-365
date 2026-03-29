# RevenueCat Testing Guide for Bat Better 365

## Current Setup

Your app is already configured with:
- ✅ RevenueCat SDK installed (`react-native-purchases`)
- ✅ Test API Key configured: `test_cXozrJSAaYUoqrMuNJqXTmcoWvv`
- ✅ Service layer implemented (`services/revenueCatService.ts`)
- ✅ Subscription context and screens ready

## Testing Steps

### 1. Configure Products in RevenueCat Dashboard

1. **Go to RevenueCat Dashboard**: https://app.revenuecat.com/
2. **Navigate to**: Projects → Your Project → Products
3. **Create Products** with these identifiers:

   **Monthly Plan:**
   - Product ID: `bat_better_monthly`
   - Duration: 1 month
   - Price: $14.99
   - Trial: 7 days

   **6-Month Plan:**
   - Product ID: `bat_better_6month`
   - Duration: 6 months
   - Price: $89.99
   - Trial: 7 days

   **Annual Plan:**
   - Product ID: `bat_better_annual`
   - Duration: 1 year
   - Price: $169.99
   - Trial: 7 days

### 2. Create an Offering

1. **Navigate to**: Entitlements → Create Entitlement
   - Name: `premium`
   - Identifier: `premium`

2. **Create Offering**:
   - Navigate to: Offerings → Create Offering
   - Identifier: `default`
   - Add all 3 products to this offering

### 3. Test on Device (Required for In-App Purchases)

**Important**: In-app purchases CANNOT be tested in simulators/emulators. You must use real devices.

#### iOS Testing:

1. **Create Sandbox Tester Account**:
   - Go to App Store Connect
   - Navigate to: Users and Access → Sandbox Testers
   - Create a new sandbox tester account

2. **On your iPhone**:
   - Settings → App Store → Sign Out
   - Build and run your app from Xcode
   - When prompted to sign in for purchase, use your sandbox tester credentials

3. **Download the app**:
   - Click the Download button (top right) in OnSpace
   - Select "iOS Project"
   - Open in Xcode
   - Select your device
   - Click Run (⌘R)

#### Android Testing:

1. **Set up Google Play Console**:
   - Create an app in Google Play Console
   - Create in-app products matching your RevenueCat product IDs
   - Add yourself as a license tester

2. **Download the app**:
   - Click Download button → "Download APK"
   - Install APK on your Android device
   - Purchases will use test mode automatically

### 4. Test the Flow

1. **Launch the app** on your device
2. You should see the onboarding screen (green background)
3. Tap **"Get Started"**
4. You'll see the subscription screen with all 3 plans
5. **Without logging in**, select a plan and tap "Start 7-Day Free Trial"
6. You'll be redirected to the login screen
7. Create an account or log in
8. After authentication, you'll return to subscription screen
9. Tap "Start 7-Day Free Trial" again
10. **Native subscription dialog will appear** (Apple/Google)
11. Complete the test purchase

### 5. Verify Subscription

After successful purchase:
- App should navigate to the main tabs
- Check RevenueCat dashboard for the transaction
- User should have access to all premium features

## Troubleshooting

### "No packages available"
- Ensure products are created in RevenueCat dashboard
- Check that offering is set to "Current"
- Verify API key is correct

### "Purchase failed"
- Must use real device (not simulator)
- For iOS: Must be signed in with sandbox tester
- For Android: Must be signed with same key as Play Console

### "Restore purchases not working"
- Must use same Apple ID/Google account used for purchase
- Only works on real devices
- Purchases must exist in App Store/Play Store

## Current Limitation

Since you're using the **test API key** (`test_cXozrJSAaYUoqrMuNJqXTmcoWvv`), all purchases are in **sandbox mode**. To accept real payments:

1. Create a production project in RevenueCat
2. Get your production API key
3. Update the key in `services/revenueCatService.ts`
4. Submit app to App Store and Play Store

## Next Steps for Production

1. ✅ Complete app development
2. ✅ Test thoroughly with sandbox purchases
3. Create app listings in App Store Connect and Google Play Console
4. Configure real in-app products in both stores
5. Link products in RevenueCat dashboard
6. Replace test API key with production key
7. Submit for app store review
