import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export function HeroCard() {
  return (
    <LinearGradient
      colors={['#4CAF50', '#388E3C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.heroTitle}>Ready to Train?</Text>
      <Text style={styles.heroSubtitle}>
        Plan your perfect cricket training with drill-based or freestyle sessions, schedule training or match events, and track your progress with the daily journal.
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textLight,
    opacity: 0.95,
    lineHeight: 24,
  },
});
