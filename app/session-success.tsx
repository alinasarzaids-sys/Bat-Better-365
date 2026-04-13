import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function SessionSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Parse XP breakdown params
  const baseXP = parseInt(params.baseXP as string) || 10;
  const ratingBonus = parseInt(params.ratingBonus as string) || 0;
  const consistencyBonus = parseInt(params.consistencyBonus as string) || 0;
  const streakBonus = parseInt(params.streakBonus as string) || 0;
  const xpEarned = parseInt(params.xpEarned as string) || baseXP;
  
  // Parse other params
  const totalXp = parseInt(params.totalXp as string) || 115;
  const pillarPoints = parseInt(params.pillarPoints as string) || 20;
  const pillarName = (params.pillarName as string) || 'Physical';
  const drillsCompleted = parseInt(params.drillsCompleted as string) || 1;
  const minutesTrained = parseInt(params.minutesTrained as string) || 15;
  const newLevel = (params.newLevel as string) || 'Beginner';

  const handleContinueToHome = () => {
    // Navigate back to home screen and clear the navigation stack
    router.replace('/(tabs)');
  };

  const getPillarIcon = (pillar: string): keyof typeof MaterialIcons.glyphMap => {
    switch (pillar) {
      case 'Technical':
        return 'sports-cricket';
      case 'Physical':
        return 'fitness-center';
      case 'Mental':
        return 'psychology';
      case 'Tactical':
        return 'lightbulb';
      default:
        return 'fitness-center';
    }
  };

  const getPillarColor = (pillar: string) => {
    switch (pillar) {
      case 'Technical':
        return '#9C27B0';
      case 'Physical':
        return '#FFC107';
      case 'Mental':
        return '#3F51B5';
      case 'Tactical':
        return '#FF6F42';
      default:
        return colors.primary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleContinueToHome} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Success!</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Trophy Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="emoji-events" size={64} color={colors.textLight} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Session Complete! 🎉</Text>

        {/* Congratulations Message */}
        <View style={styles.messageBox}>
          <Text style={styles.messageIcon}>⭐</Text>
          <Text style={styles.messageText}>Great session! Consistency is key to greatness!</Text>
        </View>

        {/* XP Earned Section with Breakdown */}
        <View style={styles.xpContainer}>
          <Text style={styles.xpIcon}>⭐</Text>
          <Text style={styles.xpValue}>+{xpEarned}</Text>
          <Text style={styles.xpLabel}>XP Earned</Text>
          
          {/* XP Breakdown */}
          <View style={styles.xpBreakdown}>
            <View style={styles.xpBreakdownItem}>
              <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.xpBreakdownText}>Drill completion: +{baseXP}</Text>
            </View>
            
            {ratingBonus > 0 && (
              <View style={styles.xpBreakdownItem}>
                <MaterialIcons name="star" size={16} color="#FFB800" />
                <Text style={styles.xpBreakdownText}>Good rating: +{ratingBonus}</Text>
              </View>
            )}
            
            {consistencyBonus > 0 && (
              <View style={styles.xpBreakdownItem}>
                <MaterialIcons name="trending-up" size={16} color="#2196F3" />
                <Text style={styles.xpBreakdownText}>Consistency: +{consistencyBonus}</Text>
              </View>
            )}
            
            {streakBonus > 0 && (
              <View style={styles.xpBreakdownItem}>
                <MaterialIcons name="local-fire-department" size={16} color="#FF6B35" />
                <Text style={styles.xpBreakdownText}>Streak: +{streakBonus}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.xpDivider} />
          <Text style={styles.xpTotal}>Total XP: {totalXp}</Text>
          <Text style={styles.xpLevel}>Level: {newLevel}</Text>
        </View>

        {/* Pillar Progress Section */}
        <View style={styles.pillarSection}>
          <View style={styles.pillarHeader}>
            <MaterialIcons name="my-location" size={24} color={colors.text} />
            <Text style={styles.pillarHeaderText}>Pillar Progress</Text>
          </View>
          <View style={styles.pillarCard}>
            <View style={[
              styles.pillarIconContainer,
              { backgroundColor: getPillarColor(pillarName) + '20' }
            ]}>
              <MaterialIcons 
                name={getPillarIcon(pillarName)} 
                size={28} 
                color={getPillarColor(pillarName)} 
              />
            </View>
            <View style={styles.pillarInfo}>
              <Text style={styles.pillarName}>{pillarName}</Text>
              <Text style={[styles.pillarPoints, { color: getPillarColor(pillarName) }]}>
                {pillarPoints} XP
              </Text>
            </View>
          </View>
        </View>

        {/* Session Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={32} color={colors.info} />
            <Text style={styles.statValue}>{drillsCompleted}</Text>
            <Text style={styles.statLabel}>Drills Completed</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="access-time" size={32} color={colors.success} />
            <Text style={styles.statValue}>{minutesTrained}</Text>
            <Text style={styles.statLabel}>Minutes Trained</Text>
          </View>
        </View>

        {/* XP System Explanation */}
        <View style={styles.infoBox}>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info-outline" size={20} color={colors.primary} />
            <Text style={styles.infoTitle}>How XP Works</Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>Drill completion: +10 XP</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>Good rating (7+): +5 XP</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>Consistency (3+ sessions/week): +15 XP</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoBullet}>•</Text>
              <Text style={styles.infoText}>Streak (3+ days): +20 XP</Text>
            </View>
          </View>
        </View>

        {/* Continue Button */}
        <Pressable style={styles.continueButton} onPress={handleContinueToHome}>
          <Text style={styles.continueButtonText}>Continue to Home</Text>
          <MaterialIcons name="arrow-forward" size={24} color={colors.textLight} />
        </Pressable>
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
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
    width: 40,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
    paddingBottom: spacing.xl * 2,
  },
  iconContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #4CAF50 0%, #2196F3 100%)',
    backgroundColor: colors.success,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    marginBottom: spacing.xl,
    width: '100%',
  },
  messageIcon: {
    fontSize: 20,
  },
  messageText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  xpContainer: {
    width: '100%',
    backgroundColor: '#FFF9E6',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  xpIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  xpValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#F57C00',
    marginBottom: spacing.xs,
  },
  xpLabel: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  xpBreakdown: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  xpBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  xpBreakdownText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  xpDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    width: '100%',
    marginVertical: spacing.sm,
  },
  xpTotal: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  xpLevel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  pillarSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pillarHeaderText: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  pillarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pillarIconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  pillarInfo: {
    flex: 1,
  },
  pillarName: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  pillarPoints: {
    fontSize: 32,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#E3F2FD',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  infoContent: {
    gap: spacing.xs,
  },
  infoItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoBullet: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    background: 'linear-gradient(90deg, #4CAF50 0%, #2196F3 100%)',
    backgroundColor: colors.success,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonText: {
    ...typography.h3,
    color: colors.textLight,
    fontWeight: '600',
  },
});
