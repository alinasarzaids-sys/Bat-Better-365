import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface GamePhase {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const limitedOversPhases: GamePhase[] = [
  {
    id: 'powerplay',
    name: 'Powerplay',
    description: 'Aggressive batting in opening overs',
    icon: 'flash-on',
  },
  {
    id: 'middle',
    name: 'Middle Overs',
    description: 'Building momentum in middle phase',
    icon: 'adjust',
  },
  {
    id: 'death',
    name: 'Death Overs',
    description: 'Maximum acceleration in final overs',
    icon: 'security',
  },
];

const testCricketPhases: GamePhase[] = [
  {
    id: 'early',
    name: 'Early',
    description: 'Building an innings and settling in',
    icon: 'flash-on',
  },
  {
    id: 'late',
    name: 'Late',
    description: 'Accelerating and pushing for runs',
    icon: 'adjust',
  },
];

export default function TacticalScenarioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const format = (params.format as string) || 'T20';

  // Determine which phases to show based on format
  const isTestCricket = format === 'Longer Format (4-5 Day)';
  const gamePhases = isTestCricket ? testCricketPhases : limitedOversPhases;

  const handlePhaseSelect = (phaseId: string) => {
    // Navigate back to training with tactical drills filtered by phase
    // The phase ID maps to subcategory in drills table
    router.push({
      pathname: '/(tabs)/training',
      params: {
        pillar: 'Tactical',
        format: format,
        focusArea: 'Field Scenario',
        phase: phaseId,
      },
    } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Tactical Training</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <MaterialIcons name={isTestCricket ? 'schedule' : 'flash-on'} size={56} color={colors.warning} />
          </View>
        </View>

        {/* Title Section */}
        <Text style={styles.title}>{format}{isTestCricket ? '' : ' Cricket'} - Game Scenario</Text>
        <Text style={styles.subtitle}>Select the phase of the innings</Text>

        {/* Phase Cards Grid */}
        <View style={styles.phasesGrid}>
          {gamePhases.map((phase) => (
            <Pressable
              key={phase.id}
              style={({ pressed }) => [
                styles.phaseCard,
                pressed && styles.phaseCardPressed,
              ]}
              onPress={() => handlePhaseSelect(phase.id)}
            >
              <View style={styles.phaseIconContainer}>
                <MaterialIcons name={phase.icon} size={32} color={colors.warning} />
              </View>
              <Text style={styles.phaseName}>{phase.name}</Text>
              <Text style={styles.phaseDescription}>{phase.description}</Text>
            </Pressable>
          ))}
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
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
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
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    fontSize: 26,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl * 2,
    fontSize: 16,
  },
  phasesGrid: {
    gap: spacing.lg,
  },
  phaseCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phaseCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  phaseIconContainer: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.lg,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  phaseName: {
    ...typography.h2,
    fontSize: 22,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  phaseDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
