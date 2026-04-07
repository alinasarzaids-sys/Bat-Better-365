import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { academyService } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type Step = 'choose' | 'academy-code';

export default function ModeSelectionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<Step>('choose');
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [position, setPosition] = useState('Batsman');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const POSITIONS = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper', 'Fielder'];

  const saveMode = async (mode: 'individual' | 'academy') => {
    if (!user) return;
    const supabase = getSupabaseClient();
    await supabase
      .from('user_profiles')
      .update({ app_mode: mode })
      .eq('id', user.id);
  };

  const handleIndividual = async () => {
    setLoading(true);
    await saveMode('individual');
    setLoading(false);
    router.replace('/profile-setup');
  };

  const handleAcademyNext = () => {
    setStep('academy-code');
  };

  const handleJoinAcademy = async () => {
    if (!user) return;
    if (!joinCode.trim()) { showAlert('Error', 'Please enter your academy code'); return; }
    if (!displayName.trim()) { showAlert('Error', 'Please enter your name'); return; }

    setLoading(true);
    const { data, error } = await academyService.joinAcademy(
      joinCode.trim(),
      user.id,
      displayName.trim(),
      position,
      jerseyNumber.trim(),
    );
    if (error) {
      setLoading(false);
      showAlert('Error', error);
      return;
    }
    await saveMode('academy');
    setLoading(false);

    const role = data!.role === 'coach' ? 'Coach' : 'Player';
    showAlert(
      'Joined!',
      `You have joined ${data!.academy.name} as ${role}.`,
    );
    router.replace('/profile-setup');
  };

  if (step === 'academy-code') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable style={styles.backBtn} onPress={() => setStep('choose')}>
              <MaterialIcons name="arrow-back" size={22} color={colors.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <View style={styles.iconCircle}>
              <MaterialIcons name="shield" size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>Join Your Academy</Text>
            <Text style={styles.subtitle}>
              Enter the code provided by your coach or academy administrator to get started.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Academy Code *</Text>
              <TextInput
                style={styles.input}
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="e.g. ABC123"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                maxLength={6}
                autoFocus
              />
              <Text style={styles.hint}>Your coach will give you this code. It is 6 characters long.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Your Full Name *</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Jamie Smith"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Your Position *</Text>
              <View style={styles.positionGrid}>
                {POSITIONS.map(p => (
                  <Pressable
                    key={p}
                    style={[styles.positionChip, position === p && styles.positionChipActive]}
                    onPress={() => setPosition(p)}
                  >
                    <Text style={[styles.positionText, position === p && styles.positionTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Jersey Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={jerseyNumber}
                onChangeText={setJerseyNumber}
                placeholder="#7"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <Pressable
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={handleJoinAcademy}
            >
              {loading ? (
                <ActivityIndicator color={colors.textLight} />
              ) : (
                <>
                  <MaterialIcons name="login" size={20} color={colors.textLight} />
                  <Text style={styles.primaryBtnText}>Join Academy</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <MaterialIcons name="sports-cricket" size={48} color={colors.primary} />
          <Text style={styles.title}>How will you use{'\n'}Bat Better 365?</Text>
          <Text style={styles.subtitle}>
            Choose your training mode. You can always access the other from settings.
          </Text>
        </View>

        {/* Individual Mode Card */}
        <Pressable
          style={styles.modeCard}
          onPress={handleIndividual}
        >
          <View style={[styles.modeIconCircle, { backgroundColor: colors.primary + '20' }]}>
            <MaterialIcons name="person" size={36} color={colors.primary} />
          </View>
          <View style={styles.modeTextBlock}>
            <Text style={styles.modeTitle}>Individual Mode</Text>
            <Text style={styles.modeDesc}>
              Train on your own terms. Access all drills, freestyle sessions, AI coaching, and personal analytics. Perfect for self-directed athletes.
            </Text>
            <View style={styles.modeFeatureList}>
              {['Drill library across all pillars', 'Freestyle session tracking', 'Personal analytics & XP', 'AI Coach chat', 'Daily journal'].map(f => (
                <View key={f} style={styles.modeFeature}>
                  <MaterialIcons name="check" size={14} color={colors.primary} />
                  <Text style={styles.modeFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </Pressable>

        {/* Academy Mode Card */}
        <Pressable
          style={[styles.modeCard, styles.modeCardAcademy]}
          onPress={handleAcademyNext}
        >
          <View style={[styles.modeIconCircle, { backgroundColor: colors.warning + '20' }]}>
            <MaterialIcons name="shield" size={36} color={colors.warning} />
          </View>
          <View style={styles.modeTextBlock}>
            <Text style={[styles.modeTitle, { color: colors.warning }]}>Academy Mode</Text>
            <Text style={styles.modeDesc}>
              Join your club, school, or cricket academy. Log sessions, track attendance, and get AI-powered coaching reports reviewed by your coach.
            </Text>
            <View style={styles.modeFeatureList}>
              {['Join with academy code', 'Log sessions & stats', 'Coach visibility into training', 'Attendance tracking', 'AI coaching reports'].map(f => (
                <View key={f} style={styles.modeFeature}>
                  <MaterialIcons name="check" size={14} color={colors.warning} />
                  <Text style={styles.modeFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
            <View style={styles.codeRequiredBadge}>
              <MaterialIcons name="vpn-key" size={12} color={colors.warning} />
              <Text style={styles.codeRequiredText}>Requires an academy code from your coach</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </Pressable>

        <Text style={styles.footerNote}>
          You can access both modes from the Academy tab after setup.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  backText: { ...typography.body, color: colors.text, fontWeight: '600' },

  headerSection: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  modeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 2, borderColor: colors.primary + '40',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  modeCardAcademy: { borderColor: colors.warning + '40' },
  modeIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  modeTextBlock: { flex: 1 },
  modeTitle: { ...typography.h4, color: colors.primary, fontWeight: '800', marginBottom: spacing.xs },
  modeDesc: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  modeFeatureList: { gap: 5, marginBottom: spacing.sm },
  modeFeature: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  modeFeatureText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  codeRequiredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.warning + '15', paddingHorizontal: spacing.sm,
    paddingVertical: 4, borderRadius: borderRadius.sm, alignSelf: 'flex-start',
  },
  codeRequiredText: { fontSize: 11, color: colors.warning, fontWeight: '700' },

  footerNote: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 18 },

  field: { marginBottom: spacing.md },
  label: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.xs },
  hint: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    ...typography.body, color: colors.text,
  },
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  positionChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
  },
  positionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  positionText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  positionTextActive: { color: colors.textLight },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md, marginTop: spacing.lg,
  },
  primaryBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});
