# RevenueCat Setup Guide

This app uses **RevenueCat** for in-app purchases on iOS and Android. Follow these steps to complete the setup.

## ✅ Already Completed
- ✅ RevenueCat SDK integrated in app code
- ✅ Public API key configured: `test_cXozrJSAaYUoqrMuNJqXTmcoWvv`
- ✅ Backend validation configured

## 📋 Next Steps You Need to Complete

### 1. Configure Products in RevenueCat Dashboard

1. Log in to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Go to your project
3. Navigate to **"Products"** tab
4. Create two products:
   - **Product ID**: `monthly_premium`
     - Type: Subscription
     - Duration: 1 month
   - **Product ID**: `yearly_premium`
     - Type: Subscription
     - Duration: 1 year

### 2. Create Products in App Store Connect (iOS)

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **"In-App Purchases"** section
4. Create **Auto-Renewable Subscriptions**:
   - Product ID: `monthly_premium`
     - Reference Name: Monthly Premium
     - Duration: 1 Month
     - Price: (Set your price)
   - Product ID: `yearly_premium`
     - Reference Name: Yearly Premium
     - Duration: 1 Year
     - Price: (Set your price - typically 40% discount vs monthly)

### 3. Create Products in Google Play Console (Android)

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **"Monetize" → "Products" → "Subscriptions"**
4. Create two subscriptions:
   - Product ID: `monthly_premium`
     - Name: Monthly Premium
     - Billing Period: 1 month
     - Price: (Set your price)
   - Product ID: `yearly_premium`
     - Name: Yearly Premium
     - Billing Period: 1 year
     - Price: (Set your price)

### 4. Link Products in RevenueCat

1. Back in RevenueCat dashboard
2. For each product (`monthly_premium`, `yearly_premium`):
   - Link to the iOS product ID you created in App Store Connect
   - Link to the Android product ID you created in Google Play Console

### 5. Create Entitlements (Optional but Recommended)

1. In RevenueCat, go to **"Entitlements"** tab
2. Create an entitlement called `premium`
3. Attach both products to this entitlement
4. This allows you to check for "premium" access instead of individual products

### 6. Get Secret API Key for Backend

1. In RevenueCat dashboard, go to **"API Keys"**
2. Copy your **Secret API Key** (different from the public key)
3. This key should already be configured in OnSpace Cloud secrets as `REVENUECAT_API_KEY`
4. **If you haven't done this yet**: Go to OnSpace Cloud → Secrets → Update `REVENUECAT_API_KEY` with the secret key

## 🧪 Testing

### Test on iOS Simulator
- Use RevenueCat's test mode
- Purchases won't actually charge

### Test on Android Emulator
- Configure test account in Google Play Console
- Add test email to closed testing track

### Test on Real Devices
- iOS: Use TestFlight
- Android: Use internal testing track

## 📱 Product Configuration

The app expects these product identifiers:
- `monthly_premium` - Monthly subscription
- `yearly_premium` - Annual subscription (with "BEST VALUE" badge)

Make sure to use these **exact** product IDs in:
- RevenueCat dashboard
- App Store Connect
- Google Play Console

## 🔑 API Keys

- **Public SDK Key** (client-side): `test_cXozrJSAaYUoqrMuNJqXTmcoWvv`
  - Used in: `services/revenueCatService.ts`
  - Safe to use in mobile app code
  
- **Secret API Key** (server-side): `REVENUECAT_API_KEY`
  - Used in: `supabase/functions/check-subscription/index.ts`
  - Must be kept secure in OnSpace Cloud secrets

## 📚 Resources

- [RevenueCat Documentation](https://docs.revenuecat.com)
- [iOS In-App Purchase Setup](https://docs.revenuecat.com/docs/ios-products)
- [Android In-App Purchase Setup](https://docs.revenuecat.com/docs/android-products)
- [Testing Guide](https://docs.revenuecat.com/docs/sandbox)

## 🆘 Troubleshooting

**"No subscription plans available"**
- Check that products are configured in RevenueCat
- Ensure product IDs match exactly
- Verify products are linked to iOS/Android store products

**"Purchase failed"**
- Check that app is configured in App Store Connect / Google Play Console
- Verify billing is enabled
- Try restoring purchases

**Subscription not showing as active**
- Check RevenueCat dashboard for customer info
- Verify backend secret API key is correct
- Check Edge Function logs in OnSpace Cloud
