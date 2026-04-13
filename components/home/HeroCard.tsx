import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export function HeroCard() {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroTitle}>Ready to Train?</Text>
      <Text style={styles.heroSubtitle}>
        Plan your perfect cricket training with drill-based or freestyle sessions, schedule training or match events, and track your progress with the daily journal.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    backgroundColor: '#4CAF50',
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
