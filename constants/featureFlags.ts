/**
 * Feature Flags Configuration
 * 
 * Toggle features on/off for development and testing
 */

/**
 * MOCK_IAP - Mock In-App Purchases
 * 
 * When true: Uses mock purchase system with AsyncStorage
 * When false: Uses real RevenueCat + App Store/Play Store
 * 
 * Set to false when you're ready to test real purchases
 */
export const MOCK_IAP = false;

/**
 * DEVELOPER_MODE - Skip authentication for development
 * Already defined in app/index.tsx, kept here for reference
 */
export const DEVELOPER_MODE = false;
