import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last Updated: March 18, 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agreement to Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using Bat Better 365, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Use of the App</Text>
          
          <Text style={styles.subsectionTitle}>1.1 License</Text>
          <Text style={styles.paragraph}>
            Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to use Bat Better 365 for your personal, non-commercial use.
          </Text>

          <Text style={styles.subsectionTitle}>1.2 Restrictions</Text>
          <Text style={styles.paragraph}>You agree not to:</Text>
          <Text style={styles.bulletPoint}>• Modify, reverse engineer, or create derivative works of the app</Text>
          <Text style={styles.bulletPoint}>• Use the app for any illegal or unauthorized purpose</Text>
          <Text style={styles.bulletPoint}>• Interfere with or disrupt the app's servers or networks</Text>
          <Text style={styles.bulletPoint}>• Share your account credentials with others</Text>
          <Text style={styles.bulletPoint}>• Use automated systems to access the app</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Account Registration</Text>
          <Text style={styles.bulletPoint}>• You must provide accurate and complete information when creating an account</Text>
          <Text style={styles.bulletPoint}>• You are responsible for maintaining the security of your account</Text>
          <Text style={styles.bulletPoint}>• You must notify us immediately of any unauthorized use of your account</Text>
          <Text style={styles.bulletPoint}>• You must be at least 13 years old to create an account</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Subscription and Payments</Text>
          
          <Text style={styles.subsectionTitle}>3.1 Premium Subscription</Text>
          <Text style={styles.bulletPoint}>• Premium features require a paid subscription</Text>
          <Text style={styles.bulletPoint}>• Subscriptions are available as monthly or annual plans</Text>
          <Text style={styles.bulletPoint}>• Payments are processed through Apple App Store or Google Play Store</Text>

          <Text style={styles.subsectionTitle}>3.2 Auto-Renewal</Text>
          <Text style={styles.bulletPoint}>• Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period</Text>
          <Text style={styles.bulletPoint}>• Your account will be charged for renewal within 24 hours prior to the end of the current period</Text>

          <Text style={styles.subsectionTitle}>3.3 Cancellation</Text>
          <Text style={styles.bulletPoint}>• You can cancel your subscription at any time through your App Store or Google Play Store account settings</Text>
          <Text style={styles.bulletPoint}>• Cancellation takes effect at the end of your current billing period</Text>
          <Text style={styles.bulletPoint}>• No refunds for partial subscription periods</Text>

          <Text style={styles.subsectionTitle}>3.4 Price Changes</Text>
          <Text style={styles.bulletPoint}>• We reserve the right to change subscription prices</Text>
          <Text style={styles.bulletPoint}>• Price changes will be communicated at least 30 days in advance</Text>
          <Text style={styles.bulletPoint}>• Continued use after price changes constitutes acceptance</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Content and Intellectual Property</Text>
          
          <Text style={styles.subsectionTitle}>4.1 Our Content</Text>
          <Text style={styles.paragraph}>
            All content in Bat Better 365, including drills, training programs, text, graphics, logos, and software, is our property or licensed to us and is protected by copyright and trademark laws.
          </Text>

          <Text style={styles.subsectionTitle}>4.2 Your Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of content you create in the app (journal entries, notes). By using the app, you grant us a license to use, store, and process your content to provide the service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT:
          </Text>
          <Text style={styles.bulletPoint}>• The app will be uninterrupted or error-free</Text>
          <Text style={styles.bulletPoint}>• Defects will be corrected</Text>
          <Text style={styles.bulletPoint}>• The app is free of viruses or harmful components</Text>
          <Text style={styles.bulletPoint}>• Training recommendations will result in specific outcomes</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR:
          </Text>
          <Text style={styles.bulletPoint}>• Any indirect, incidental, special, or consequential damages</Text>
          <Text style={styles.bulletPoint}>• Loss of profits, data, or goodwill</Text>
          <Text style={styles.bulletPoint}>• Physical injuries resulting from training activities</Text>
          <Text style={styles.bulletPoint}>• Damages exceeding the amount you paid for the subscription</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Health and Safety</Text>
          <Text style={styles.paragraph}>
            IMPORTANT: Bat Better 365 provides training guidance but is not a substitute for professional coaching or medical advice.
          </Text>
          <Text style={styles.bulletPoint}>• Consult a physician before starting any training program</Text>
          <Text style={styles.bulletPoint}>• Stop immediately if you experience pain or discomfort</Text>
          <Text style={styles.bulletPoint}>• We are not responsible for injuries sustained while training</Text>
          <Text style={styles.bulletPoint}>• Training recommendations are general and may not suit your specific condition</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. AI Coach Disclaimer</Text>
          <Text style={styles.paragraph}>
            The AI coaching feature uses artificial intelligence to provide training suggestions:
          </Text>
          <Text style={styles.bulletPoint}>• AI recommendations are not professional coaching advice</Text>
          <Text style={styles.bulletPoint}>• We do not guarantee the accuracy or effectiveness of AI suggestions</Text>
          <Text style={styles.bulletPoint}>• AI-generated content may contain errors</Text>
          <Text style={styles.bulletPoint}>• Use AI recommendations at your own discretion</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Termination</Text>
          <Text style={styles.paragraph}>We may suspend or terminate your account if you:</Text>
          <Text style={styles.bulletPoint}>• Violate these Terms and Conditions</Text>
          <Text style={styles.bulletPoint}>• Engage in fraudulent activity</Text>
          <Text style={styles.bulletPoint}>• Use the app in a manner that harms us or other users</Text>
          <Text style={styles.paragraph}>
            Upon termination, your right to use the app ceases immediately. You may request deletion of your data by contacting batbetter365@gmail.com.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify these Terms at any time. We will notify you of material changes through the app or via email. Your continued use after changes constitutes acceptance of the new Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of your country of residence. Any disputes will be resolved in the courts of your jurisdiction.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Information</Text>
          <Text style={styles.paragraph}>
            For questions about these Terms, contact us at:
          </Text>
          <Text style={styles.bulletPoint}>• Email: batbetter365@gmail.com</Text>
          <Text style={styles.bulletPoint}>• Subject: "Terms and Conditions"</Text>
        </View>

        <View style={styles.consentBox}>
          <MaterialIcons name="gavel" size={32} color={colors.primary} />
          <Text style={styles.consentText}>
            By using Bat Better 365, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
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
    borderColor: colors.primary,
    marginTop: spacing.lg,
  },
  consentText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
});
