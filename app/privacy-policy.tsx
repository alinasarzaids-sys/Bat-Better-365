import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last Updated: March 18, 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Introduction</Text>
          <Text style={styles.paragraph}>
            Welcome to Bat Better 365. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          
          <Text style={styles.subsectionTitle}>1.1 Personal Information</Text>
          <Text style={styles.paragraph}>
            When you create an account, we collect:
          </Text>
          <Text style={styles.bulletPoint}>• Email address</Text>
          <Text style={styles.bulletPoint}>• Username (optional)</Text>
          <Text style={styles.bulletPoint}>• Full name (optional)</Text>
          <Text style={styles.bulletPoint}>• Age (optional)</Text>
          <Text style={styles.bulletPoint}>• Password (encrypted)</Text>

          <Text style={styles.subsectionTitle}>1.2 Training Data</Text>
          <Text style={styles.paragraph}>
            To provide personalized training recommendations, we collect:
          </Text>
          <Text style={styles.bulletPoint}>• Training session records (drills completed, duration, performance metrics)</Text>
          <Text style={styles.bulletPoint}>• Progress tracking data (skill levels, achievements, streaks)</Text>
          <Text style={styles.bulletPoint}>• Journal entries (if you choose to use the journal feature)</Text>
          <Text style={styles.bulletPoint}>• Calendar events and training schedules</Text>
          <Text style={styles.bulletPoint}>• AI coach conversation history</Text>

          <Text style={styles.subsectionTitle}>1.3 Subscription Information</Text>
          <Text style={styles.paragraph}>
            When you subscribe to premium features:
          </Text>
          <Text style={styles.bulletPoint}>• Payment information (processed securely through Apple App Store or Google Play Store)</Text>
          <Text style={styles.bulletPoint}>• Subscription status and renewal dates</Text>
          <Text style={styles.bulletPoint}>• Purchase receipts and transaction IDs</Text>

          <Text style={styles.subsectionTitle}>1.4 Automatically Collected Information</Text>
          <Text style={styles.paragraph}>
            We may automatically collect:
          </Text>
          <Text style={styles.bulletPoint}>• Device information (device type, operating system)</Text>
          <Text style={styles.bulletPoint}>• App usage statistics (features used, session duration)</Text>
          <Text style={styles.bulletPoint}>• Error logs and crash reports</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          
          <Text style={styles.paragraph}>We use your information to:</Text>
          <Text style={styles.bulletPoint}>• Provide and maintain the app functionality</Text>
          <Text style={styles.bulletPoint}>• Personalize your training experience and recommendations</Text>
          <Text style={styles.bulletPoint}>• Process your subscription payments and manage your premium access</Text>
          <Text style={styles.bulletPoint}>• Send you important notifications about your training schedule and achievements</Text>
          <Text style={styles.bulletPoint}>• Provide customer support and respond to your inquiries</Text>
          <Text style={styles.bulletPoint}>• Improve our app features and user experience</Text>
          <Text style={styles.bulletPoint}>• Analyze app performance and fix technical issues</Text>
          <Text style={styles.bulletPoint}>• Protect against fraudulent or illegal activity</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. AI Coach and Data Processing</Text>
          
          <Text style={styles.paragraph}>
            Our AI coaching feature uses artificial intelligence to provide personalized cricket training advice. When you interact with the AI coach:
          </Text>
          <Text style={styles.bulletPoint}>• Your questions and conversation history may be processed by third-party AI service providers</Text>
          <Text style={styles.bulletPoint}>• Training data and performance metrics are used to generate personalized recommendations</Text>
          <Text style={styles.bulletPoint}>• Conversations are stored securely to improve coaching quality</Text>
          <Text style={styles.bulletPoint}>• We do not share your personal coaching conversations with other users</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Information Sharing and Disclosure</Text>
          
          <Text style={styles.paragraph}>
            We do not sell your personal information to third parties. We may share your information only in the following circumstances:
          </Text>

          <Text style={styles.subsectionTitle}>4.1 Service Providers</Text>
          <Text style={styles.paragraph}>
            We work with trusted third-party service providers who assist us in operating the app:
          </Text>
          <Text style={styles.bulletPoint}>• Cloud hosting and database services (OnSpace Cloud/Supabase)</Text>
          <Text style={styles.bulletPoint}>• AI processing services (OpenAI, Google AI)</Text>
          <Text style={styles.bulletPoint}>• Payment processing (Apple App Store, Google Play Store, RevenueCat)</Text>
          <Text style={styles.bulletPoint}>• Analytics and performance monitoring</Text>

          <Text style={styles.subsectionTitle}>4.2 Legal Requirements</Text>
          <Text style={styles.paragraph}>
            We may disclose your information if required by law or in response to valid legal requests from public authorities.
          </Text>

          <Text style={styles.subsectionTitle}>4.3 Business Transfers</Text>
          <Text style={styles.paragraph}>
            If Bat Better 365 is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Security</Text>
          
          <Text style={styles.paragraph}>
            We implement industry-standard security measures to protect your information:
          </Text>
          <Text style={styles.bulletPoint}>• End-to-end encryption for sensitive data transmission</Text>
          <Text style={styles.bulletPoint}>• Secure authentication using industry-standard protocols</Text>
          <Text style={styles.bulletPoint}>• Regular security audits and updates</Text>
          <Text style={styles.bulletPoint}>• Row-level security policies in our database</Text>
          <Text style={styles.bulletPoint}>• Limited employee access to personal data</Text>
          
          <Text style={styles.paragraph}>
            However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Data Retention</Text>
          
          <Text style={styles.paragraph}>
            We retain your personal information for as long as your account is active or as needed to provide you with services. Specifically:
          </Text>
          <Text style={styles.bulletPoint}>• Account information: Retained until you cancel your subscription</Text>
          <Text style={styles.bulletPoint}>• Training data: Retained while your account is active</Text>
          <Text style={styles.bulletPoint}>• Journal entries: Retained until you delete them or your subscription ends</Text>
          <Text style={styles.bulletPoint}>• Payment records: Retained for 7 years for legal and tax compliance</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Your Rights and Choices</Text>
          
          <Text style={styles.subsectionTitle}>7.1 Account Management</Text>
          <Text style={styles.bulletPoint}>• Update your profile information at any time through the Settings menu</Text>
          <Text style={styles.bulletPoint}>• Change your password through Settings → Change Password</Text>
          <Text style={styles.bulletPoint}>• Reset your training data through Settings → Reset Account (this keeps your login credentials)</Text>

          <Text style={styles.subsectionTitle}>7.2 Subscription Management</Text>
          <Text style={styles.bulletPoint}>• Cancel your subscription at any time through your App Store or Google Play Store account settings</Text>
          <Text style={styles.bulletPoint}>• Access to premium features continues until the end of your current billing period</Text>
          <Text style={styles.bulletPoint}>• After subscription cancellation, your data is retained for 30 days in case you resubscribe</Text>

          <Text style={styles.subsectionTitle}>7.3 Communication Preferences</Text>
          <Text style={styles.bulletPoint}>• Opt out of promotional notifications through your device settings</Text>
          <Text style={styles.bulletPoint}>• You will still receive important account-related notifications</Text>

          <Text style={styles.subsectionTitle}>7.4 Data Deletion</Text>
          <Text style={styles.paragraph}>
            To request deletion of your account and all associated data, please contact us at batbetter365@gmail.com. We will process your request within 30 days and permanently delete:
          </Text>
          <Text style={styles.bulletPoint}>• Your account and login credentials</Text>
          <Text style={styles.bulletPoint}>• All training data and progress</Text>
          <Text style={styles.bulletPoint}>• Journal entries and calendar events</Text>
          <Text style={styles.bulletPoint}>• AI coach conversation history</Text>
          
          <Text style={styles.paragraph}>
            Note: Payment records may be retained for legal compliance as noted in Section 6.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          
          <Text style={styles.paragraph}>
            Bat Better 365 is intended for users aged 13 and above. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us immediately at batbetter365@gmail.com.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. International Data Transfers</Text>
          
          <Text style={styles.paragraph}>
            Your information may be transferred to and maintained on servers located outside of your country. By using Bat Better 365, you consent to the transfer of your information to countries that may have different data protection laws than your country of residence.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Third-Party Links</Text>
          
          <Text style={styles.paragraph}>
            Our app may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies before providing any information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Changes to This Privacy Policy</Text>
          
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by:
          </Text>
          <Text style={styles.bulletPoint}>• Posting the new Privacy Policy in the app</Text>
          <Text style={styles.bulletPoint}>• Updating the "Last Updated" date at the top of this policy</Text>
          <Text style={styles.bulletPoint}>• Sending you an in-app notification for significant changes</Text>
          
          <Text style={styles.paragraph}>
            Your continued use of Bat Better 365 after any changes constitutes your acceptance of the updated Privacy Policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Us</Text>
          
          <Text style={styles.paragraph}>
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
          </Text>
          <Text style={styles.bulletPoint}>• Email: batbetter365@gmail.com</Text>
          <Text style={styles.bulletPoint}>• Subject Line: "Privacy Policy Inquiry"</Text>
          
          <Text style={styles.paragraph}>
            We will respond to your inquiry within 72 hours.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Governing Law</Text>
          
          <Text style={styles.paragraph}>
            This Privacy Policy is governed by and construed in accordance with applicable data protection laws. Any disputes relating to this policy will be subject to the exclusive jurisdiction of the courts in your country of residence.
          </Text>
        </View>

        <View style={styles.consentBox}>
          <MaterialIcons name="verified-user" size={32} color={colors.success} />
          <Text style={styles.consentText}>
            By using Bat Better 365, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  lastUpdated: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  bulletPoint: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    paddingLeft: spacing.md,
    marginBottom: spacing.xs,
  },
  consentBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.success,
    marginTop: spacing.lg,
  },
  consentText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
});
