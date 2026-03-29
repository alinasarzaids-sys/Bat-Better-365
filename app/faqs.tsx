import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'What is Bat Better 365?',
    answer: 'Bat Better 365 is a comprehensive cricket training app designed to help batsmen improve across all four pillars of batting: Technical, Physical, Mental, and Tactical. The app provides structured drills, AI coaching, progress tracking, and personalized training programs.',
  },
  {
    category: 'Getting Started',
    question: 'How do I create an account?',
    answer: 'Tap "Get Started" on the login screen, enter your email address, and follow the verification process. You can also sign in with Google for faster access.',
  },
  {
    category: 'Getting Started',
    question: 'What skill levels is this app suitable for?',
    answer: 'Bat Better 365 is designed for all skill levels, from beginners just learning the basics to advanced players looking to refine their technique. The app adapts to your level and provides appropriate drill recommendations.',
  },

  // Subscription & Premium
  {
    category: 'Subscription & Premium',
    question: 'What do I get with Premium?',
    answer: 'Premium members get unlimited access to all drills across all four pillars, AI-powered coaching with personalized feedback, advanced progress analytics, exclusive training programs and challenges, and priority support.',
  },
  {
    category: 'Subscription & Premium',
    question: 'How much does Premium cost?',
    answer: 'We offer two subscription plans: Monthly and Annual. The annual plan provides significant savings (40% off) compared to the monthly option. Check the subscription screen for current pricing in your region.',
  },
  {
    category: 'Subscription & Premium',
    question: 'How do I cancel my subscription?',
    answer: 'iOS: Open Settings → tap your name → Subscriptions → select Bat Better 365 → Cancel Subscription.\n\nAndroid: Open Google Play Store → Menu → Subscriptions → select Bat Better 365 → Cancel Subscription.\n\nYour premium access continues until the end of your current billing period.',
  },
  {
    category: 'Subscription & Premium',
    question: 'Can I get a refund?',
    answer: 'Refunds are handled by Apple (for iOS users) or Google (for Android users) according to their respective refund policies. Contact Apple Support or Google Play Support to request a refund. We do not process refunds directly.',
  },
  {
    category: 'Subscription & Premium',
    question: 'How do I restore my purchases?',
    answer: 'If you subscribed on another device or reinstalled the app, go to the subscription screen and tap "Restore Purchases". This will check your App Store or Play Store account and restore your premium access.',
  },

  // Training & Drills
  {
    category: 'Training & Drills',
    question: 'What are the four pillars of training?',
    answer: 'The four pillars are:\n\n• Technical: Batting technique, shot execution, and skill drills\n• Physical: Fitness, strength, and conditioning exercises\n• Mental: Focus, confidence, composure, and mindset training\n• Tactical: Match scenarios, game strategy, and decision-making',
  },
  {
    category: 'Training & Drills',
    question: 'How do I start a training session?',
    answer: 'Go to the Training tab, select your format (ODI, T20, or Test), choose a phase (Powerplay, Middle, Death, etc.), then pick a drill category. Select a drill and tap "Start Training" to begin.',
  },
  {
    category: 'Training & Drills',
    question: 'How long should I train each day?',
    answer: 'We recommend 30-60 minutes per day for consistent improvement. However, even 15-20 minutes of focused practice is valuable. The app tracks your training streak to help you stay consistent.',
  },
  {
    category: 'Training & Drills',
    question: 'Can I create custom training sessions?',
    answer: 'Yes! Premium members can create freestyle sessions by selecting multiple drills across different pillars. This lets you build personalized workouts tailored to your specific needs.',
  },
  {
    category: 'Training & Drills',
    question: 'Do I need special equipment?',
    answer: 'Most drills require minimal equipment: a bat, ball, stumps, and space to practice. Some physical drills may use common gym equipment. Each drill lists required equipment in its details.',
  },

  // AI Coach
  {
    category: 'AI Coach',
    question: 'How does the AI Coach work?',
    answer: 'The AI Coach uses advanced artificial intelligence to analyze your training data and provide personalized recommendations. You can ask questions, get technique tips, analyze your performance, and receive customized training advice.',
  },
  {
    category: 'AI Coach',
    question: 'Is the AI Coach as good as a real coach?',
    answer: 'The AI Coach is a powerful training assistant but should complement, not replace, professional coaching. It provides instant feedback and guidance based on proven cricket training principles and your personal data.',
  },
  {
    category: 'AI Coach',
    question: 'What questions can I ask the AI Coach?',
    answer: 'You can ask about:\n• Technique improvements for specific shots\n• How to handle pressure situations\n• Training recommendations based on your weaknesses\n• Match strategy and tactical decisions\n• Progress analysis and goal setting',
  },

  // Progress & Analytics
  {
    category: 'Progress & Analytics',
    question: 'How is my progress tracked?',
    answer: 'The app tracks your completed sessions, total training time, current streak, skill level, and points earned across each pillar. Premium members get detailed analytics including performance trends and improvement graphs.',
  },
  {
    category: 'Progress & Analytics',
    question: 'What are XP points and how do I earn them?',
    answer: 'XP (Experience Points) represent your overall training dedication. You earn XP by completing drills:\n• Technical drills: 15 XP (+5 bonus)\n• Physical drills: 20 XP (+5 bonus)\n• Mental drills: 10 XP (+5 bonus)\n• Tactical drills: 25 XP (+10 bonus)\n\nAs you accumulate XP, you level up from Beginner to Elite.',
  },
  {
    category: 'Progress & Analytics',
    question: 'How do achievements work?',
    answer: 'Achievements are special milestones you unlock by completing specific challenges (e.g., "Complete 10 training sessions", "Maintain a 7-day streak"). Each achievement adds to your profile and shows your dedication.',
  },
  {
    category: 'Progress & Analytics',
    question: 'What is the leaderboard?',
    answer: 'The leaderboard ranks players based on total XP earned. It is a friendly way to compare your progress with other users and stay motivated. Check the Home tab to see the top players.',
  },

  // Journal & Calendar
  {
    category: 'Journal & Calendar',
    question: 'What is the Training Journal?',
    answer: 'The Training Journal is your daily log where you can track goals, gratitude, wellness habits, nutrition, hourly schedule, and performance notes. It helps you build self-awareness and maintain a complete record of your cricket journey.',
  },
  {
    category: 'Journal & Calendar',
    question: 'Can I edit past journal entries?',
    answer: 'Yes! You can navigate to any date using the calendar or week navigation and view or edit your journal entries. This lets you review and update your reflections anytime.',
  },
  {
    category: 'Journal & Calendar',
    question: 'How do I use the Calendar?',
    answer: 'The Calendar tab shows your training schedule and events. You can add training sessions, matches, or personal reminders. Tap any date to see or add events, and switch between week and month views for different perspectives.',
  },

  // Account & Settings
  {
    category: 'Account & Settings',
    question: 'How do I change my password?',
    answer: 'Go to Settings → Change Password. You will receive a verification code via email. Enter the code and your new password to complete the change.',
  },
  {
    category: 'Account & Settings',
    question: 'How do I update my profile information?',
    answer: 'Go to your Profile screen (tap your avatar on the Home tab) and tap the edit icon. You can update your full name, age, and other profile details.',
  },
  {
    category: 'Account & Settings',
    question: 'What does "Reset Account" do?',
    answer: 'Reset Account permanently deletes all your training data, progress, sessions, achievements, and challenges. Your account and login credentials remain intact. This action cannot be undone, so use it carefully!',
  },
  {
    category: 'Account & Settings',
    question: 'How do I delete my account completely?',
    answer: 'To permanently delete your account and all associated data, email us at batbetter365@gmail.com with the subject "Account Deletion Request". We will process your request within 30 days.',
  },
  {
    category: 'Account & Settings',
    question: 'Is my data secure?',
    answer: 'Yes! We use industry-standard encryption for data transmission and storage. Your personal information is protected with row-level security policies, and we never share your data with third parties without your consent.',
  },

  // Technical Issues
  {
    category: 'Technical Issues',
    question: 'The app is crashing or freezing. What should I do?',
    answer: '1. Force close the app and restart it\n2. Check for app updates in the App Store or Play Store\n3. Restart your device\n4. If the problem persists, email us at batbetter365@gmail.com with details about when the crash occurs.',
  },
  {
    category: 'Technical Issues',
    question: 'Videos are not loading. How do I fix this?',
    answer: 'Make sure you have a stable internet connection. Videos require streaming, so try switching between Wi-Fi and mobile data. If the issue continues, the video may be temporarily unavailable - contact support.',
  },
  {
    category: 'Technical Issues',
    question: 'My progress is not saving. What is wrong?',
    answer: 'Ensure you have an active internet connection, as progress syncs to the cloud. If you are offline, your progress will sync once you reconnect. If the issue persists after reconnecting, contact support.',
  },
  {
    category: 'Technical Issues',
    question: 'I forgot my password. How do I reset it?',
    answer: 'On the login screen, tap "Forgot Password". Enter your email address to receive a password reset code. Enter the code and create a new password.',
  },

  // General
  {
    category: 'General',
    question: 'Can I use the app offline?',
    answer: 'Some features work offline (viewing drill instructions, logging sessions), but cloud sync, AI coaching, and video content require an internet connection. Your offline progress will sync automatically when you reconnect.',
  },
  {
    category: 'General',
    question: 'What devices are supported?',
    answer: 'Bat Better 365 works on iOS devices (iPhone, iPad running iOS 13+) and Android devices (running Android 8.0+). The app is optimized for both phones and tablets.',
  },
  {
    category: 'General',
    question: 'How do I contact support?',
    answer: 'Email us at batbetter365@gmail.com with your question or issue. We typically respond within 24-48 hours. For faster help, check this FAQ first!',
  },
  {
    category: 'General',
    question: 'Do you offer team or coaching licenses?',
    answer: 'Currently, Bat Better 365 is designed for individual players. We are exploring team and coaching options for the future. Email batbetter365@gmail.com to express interest or suggest features.',
  },
];

export default function FAQsScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const categories = Array.from(new Set(faqs.map((faq) => faq.category)));

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Frequently Asked Questions</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introSection}>
          <MaterialIcons name="help-outline" size={48} color={colors.primary} />
          <Text style={styles.introTitle}>How can we help you?</Text>
          <Text style={styles.introDescription}>
            Find answers to common questions about Bat Better 365. If you cannot find what you are looking for, contact us at batbetter365@gmail.com
          </Text>
        </View>

        {categories.map((category, categoryIndex) => {
          const categoryFAQs = faqs.filter((faq) => faq.category === category);
          const categoryStartIndex = faqs.findIndex((faq) => faq.category === category);

          return (
            <View key={categoryIndex} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <MaterialIcons name="folder-open" size={20} color={colors.primary} />
                <Text style={styles.categoryTitle}>{category}</Text>
              </View>

              {categoryFAQs.map((faq, localIndex) => {
                const globalIndex = categoryStartIndex + localIndex;
                const isExpanded = expandedIndex === globalIndex;

                return (
                  <Pressable
                    key={globalIndex}
                    style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                    onPress={() => toggleExpand(globalIndex)}
                  >
                    <View style={styles.faqQuestion}>
                      <Text style={styles.questionText}>{faq.question}</Text>
                      <MaterialIcons
                        name={isExpanded ? 'expand-less' : 'expand-more'}
                        size={24}
                        color={colors.primary}
                      />
                    </View>

                    {isExpanded && (
                      <View style={styles.faqAnswer}>
                        <Text style={styles.answerText}>{faq.answer}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        <View style={styles.contactSection}>
          <MaterialIcons name="mail-outline" size={32} color={colors.primary} />
          <Text style={styles.contactTitle}>Still have questions?</Text>
          <Text style={styles.contactDescription}>
            We are here to help! Send us an email and we will get back to you as soon as possible.
          </Text>
          <Text style={styles.contactEmail}>batbetter365@gmail.com</Text>
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
  introSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  },
  introTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  introDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  categorySection: {
    marginBottom: spacing.xl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  categoryTitle: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: '600',
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  faqItemExpanded: {
    borderColor: colors.primary,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  questionText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  faqAnswer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  answerText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  contactSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  contactTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  contactDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  contactEmail: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: '600',
  },
});
