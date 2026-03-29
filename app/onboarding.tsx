import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

const ONBOARDING_KEY = '@bat_better_onboarding_completed';

export default function OnboardingScreen() {
  const router = useRouter();

  const handleGetStarted = async () => {
    // Mark onboarding as completed
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    // Navigate to login screen
    router.push('/login' as any);
  };

  const features = [
    {
      icon: 'fitness-center',
      title: 'Drills For All 4 Pillars',
      description: 'Technical, Physical, Mental & Tactical drills - master all 4 to become unstoppable',
    },
    {
      icon: 'auto-awesome',
      title: 'Personalized Training Plans',
      description: 'Custom drills tailored to your skill level and goals',
    },
    {
      icon: 'psychology',
      title: 'AI-Powered Coaching',
      description: 'Get instant feedback and improve faster than ever',
    },
    {
      icon: 'book',
      title: 'Performance Journal',
      description: 'Track your journey and identify patterns for improvement',
    },
    {
      icon: 'trending-up',
      title: 'Advanced Analytics',
      description: 'See exactly what is holding you back and fix it',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
          <Text style={styles.appName}>Bat Better 365</Text>
          <Text style={styles.question}>Are You Ready To Reach Your Full Potential?</Text>
        </View>

        {/* Problem Section */}
        <View style={styles.problemSection}>
          <Text style={styles.problemTitle}>The Common Mistake</Text>
          <Text style={styles.problemText}>
            Most players just hit balls without purpose. No plan. No tracking. No progress.
          </Text>
          <Text style={styles.problemSubtext}>
            They work hard but stay stuck at the same level.
          </Text>
        </View>

        {/* Solution Section */}
        <View style={styles.solutionSection}>
          <Text style={styles.solutionTitle}>This App Changes Everything</Text>
          <Text style={styles.solutionText}>
            Train all <Text style={styles.boldText}>4 pillars</Text> of batting (Technical • Physical • Mental • Tactical) with structured drills, progress tracking, and AI coaching.
          </Text>
          <Text style={styles.solutionSubtext}>
            Every session has a purpose. Every rep gets tracked. Every goal gets crushed.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What You Get</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <MaterialIcons name={feature.icon as any} size={28} color="#66BB6A" />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA Button */}
        <View style={styles.ctaSection}>
          <Pressable
            style={styles.getStartedButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6ABE6A',
  },
  scrollContent: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: spacing.lg,
    textAlign: 'center',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  question: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 32,
    letterSpacing: 0.3,
  },
  problemSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  problemTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  problemText: {
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 28,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  problemSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 24,
    fontWeight: '400',
  },
  solutionSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    marginBottom: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  solutionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2E7D32',
    marginBottom: spacing.md,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  solutionText: {
    fontSize: 17,
    color: '#1B5E20',
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  solutionSubtext: {
    fontSize: 16,
    color: '#424242',
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '800',
    color: '#2E7D32',
  },
  featuresContainer: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  featuresTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: spacing.lg,
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 5,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  featureIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C8E6C9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B5E20',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  featureDescription: {
    fontSize: 15,
    color: '#424242',
    lineHeight: 22,
    fontWeight: '500',
  },
  ctaSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  getStartedButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  getStartedButtonText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2E7D32',
    letterSpacing: 1,
  },
});
