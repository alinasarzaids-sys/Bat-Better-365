import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const SESSION_TYPES = [
  'Nets - Batting', 'Nets - Bowling', 'Nets - Mixed',
  'Match Practice', 'Fielding Drills', 'Fitness / Conditioning',
  'Skill Development', 'Team Training', 'Individual Training',
];

const INTENSITY_LABELS: Record<number, string> = {
  1: 'Very Light', 2: 'Light', 3: 'Easy',
  4: 'Moderate', 5: 'Steady', 6: 'Challenging',
  7: 'Hard', 8: 'Very Hard', 9: 'Intense', 10: 'Maximum',
};

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return colors.success;
  if (intensity <= 6) return colors.warning;
  return colors.error;
}

export default function AcademyLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const academyId = params.academyId as string;
  const position = params.position as string || 'Batsman';

  const [sessionType, setSessionType] = useState('');
  const [duration, setDuration] = useState('60');
  const [intensity, setIntensity] = useState(5);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Batting
  const [ballsFaced, setBallsFaced] = useState('');
  const [runsScored, setRunsScored] = useState('');

  // Bowling
  const [ballsBowled, setBallsBowled] = useState('');
  const [wickets, setWickets] = useState('');
  const [runsConceded, setRunsConceded] = useState('');

  // Fielding / Keeping
  const [catches, setCatches] = useState('');
  const [runOuts, setRunOuts] = useState('');
  const [stumpings, setStumpings] = useState('');

  // Quality ratings
  const [technicalRating, setTechnicalRating] = useState(0);
  const [effortRating, setEffortRating] = useState(0);
  const [fitnessRating, setFitnessRating] = useState(0);

  const [saving, setSaving] = useState(false);

  const isBatter = ['Batsman', 'All-Rounder', 'Wicket-Keeper'].includes(position);
  const isBowler = ['Bowler', 'All-Rounder'].includes(position);
  const isKeeper = position === 'Wicket-Keeper';
  const isFielder = ['Fielder', 'All-Rounder', 'Wicket-Keeper'].includes(position);

  const handleSave = async () => {
    if (!user) return;
    if (!sessionType) { showAlert('Error', 'Please select a session type'); return; }
    if (!duration || parseInt(duration) < 1) { showAlert('Error', 'Please enter session duration'); return; }

    setSaving(true);
    const { error } = await academyService.logTraining({
      user_id: user.id,
      academy_id: academyId,
      log_date: logDate,
      session_type: sessionType,
      duration_minutes: parseInt(duration),
      intensity,
      balls_faced: ballsFaced ? parseInt(ballsFaced) : undefined,
      runs_scored: runsScored ? parseInt(runsScored) : undefined,
      balls_bowled: ballsBowled ? parseInt(ballsBowled) : undefined,
      wickets: wickets ? parseInt(wickets) : undefined,
      runs_conceded: runsConceded ? parseInt(runsConceded) : undefined,
      catches: catches ? parseInt(catches) : undefined,
      run_outs: runOuts ? parseInt(runOuts) : undefined,
      stumpings: stumpings ? parseInt(stumpings) : undefined,
      technical_rating: technicalRating || undefined,
      effort_rating: effortRating || undefined,
      fitness_rating: fitnessRating || undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);

    if (error) { showAlert('Error', error); return; }
    router.back();
    showAlert('Session Logged', 'Your training session has been recorded.');
  };

  function RatingStars({ value, onRate, color }: { value: number; onRate: (v: number) => void; color: string }) {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <Pressable key={s} onPress={() => onRate(s)} hitSlop={6}>
            <MaterialIcons name={s <= value ? 'star' : 'star-border'} size={28} color={s <= value ? color : colors.border} />
          </Pressable>
        ))}
        {value > 0 && <Text style={{ ...typography.caption, color, fontWeight: '800', marginLeft: 6, alignSelf: 'center' }}>{value}/5</Text>}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Training Session</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Date</Text>
          <TextInput
            style={styles.input}
            value={logDate}
            onChangeText={setLogDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Session Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Type *</Text>
          <View style={styles.chipGrid}>
            {SESSION_TYPES.map(t => (
              <Pressable key={t} style={[styles.chip, sessionType === t && styles.chipActive]} onPress={() => setSessionType(t)}>
                <Text style={[styles.chipText, sessionType === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Duration & Intensity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration (minutes) *</Text>
          <View style={styles.durationRow}>
            {['30', '45', '60', '90', '120'].map(d => (
              <Pressable key={d} style={[styles.durationChip, duration === d && styles.durationChipActive]} onPress={() => setDuration(d)}>
                <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>{d}</Text>
              </Pressable>
            ))}
            <TextInput
              style={[styles.durationInput, !['30', '45', '60', '90', '120'].includes(duration) && styles.durationInputActive]}
              value={['30', '45', '60', '90', '120'].includes(duration) ? '' : duration}
              onChangeText={setDuration}
              placeholder="Other"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training Intensity: {intensity}/10 — {INTENSITY_LABELS[intensity]}</Text>
          <View style={[styles.intensityBar, { backgroundColor: getIntensityColor(intensity) + '20' }]}>
            <View style={[styles.intensityFill, { width: `${intensity * 10}%`, backgroundColor: getIntensityColor(intensity) }]} />
          </View>
          <View style={styles.intensityBtns}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <Pressable key={n} style={[styles.intensityBtn, intensity === n && { backgroundColor: getIntensityColor(n) }]} onPress={() => setIntensity(n)}>
                <Text style={[styles.intensityBtnText, intensity === n && { color: colors.textLight }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Batting Stats */}
        {isBatter && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="sports-cricket" size={16} color={colors.technical} />
              <Text style={[styles.sectionTitle, { color: colors.technical, marginBottom: 0 }]}>Batting Stats</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Balls Faced</Text>
                <TextInput style={styles.statInput} value={ballsFaced} onChangeText={setBallsFaced} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Runs Scored</Text>
                <TextInput style={styles.statInput} value={runsScored} onChangeText={setRunsScored} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
              </View>
            </View>
            {ballsFaced && runsScored && parseInt(ballsFaced) > 0 && (
              <View style={styles.calcBadge}>
                <MaterialIcons name="trending-up" size={13} color={colors.success} />
                <Text style={styles.calcBadgeText}>
                  Strike Rate: {Math.round((parseInt(runsScored) / parseInt(ballsFaced)) * 100)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bowling Stats */}
        {isBowler && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="sports-cricket" size={16} color={colors.physical} />
              <Text style={[styles.sectionTitle, { color: colors.physical, marginBottom: 0 }]}>Bowling Stats</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Balls Bowled</Text>
                <TextInput style={styles.statInput} value={ballsBowled} onChangeText={setBallsBowled} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Wickets</Text>
                <TextInput style={styles.statInput} value={wickets} onChangeText={setWickets} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Runs Given</Text>
                <TextInput style={styles.statInput} value={runsConceded} onChangeText={setRunsConceded} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
              </View>
            </View>
            {ballsBowled && parseInt(ballsBowled) > 0 && (
              <View style={styles.statsRow}>
                <View style={styles.calcBadge}>
                  <MaterialIcons name="sports" size={13} color={colors.physical} />
                  <Text style={[styles.calcBadgeText, { color: colors.physical }]}>
                    {Math.floor(parseInt(ballsBowled) / 6)}.{parseInt(ballsBowled) % 6} overs
                    {wickets ? ` · ${wickets} wkt` : ''}
                    {runsConceded && wickets && parseInt(wickets) > 0 ? ` · Economy ${(parseInt(runsConceded) / (parseInt(ballsBowled) / 6)).toFixed(1)}` : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Fielding/Keeping Stats */}
        {(isFielder || isKeeper) && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="sports-handball" size={16} color={colors.tactical} />
              <Text style={[styles.sectionTitle, { color: colors.tactical, marginBottom: 0 }]}>Fielding & Keeping</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Catches</Text>
                <TextInput style={styles.statInput} value={catches} onChangeText={setCatches} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Run Outs</Text>
                <TextInput style={styles.statInput} value={runOuts} onChangeText={setRunOuts} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
              </View>
              {isKeeper && (
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Stumpings</Text>
                  <TextInput style={styles.statInput} value={stumpings} onChangeText={setStumpings} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSecondary} textAlign="center" />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Quality Ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Self-Assessment</Text>
          <View style={styles.ratingRow}>
            <View style={styles.ratingLabelCol}>
              <Text style={styles.ratingLabel}>Technical Quality</Text>
              <Text style={styles.ratingSub}>How good was your technique?</Text>
            </View>
            <RatingStars value={technicalRating} onRate={setTechnicalRating} color={colors.technical} />
          </View>
          <View style={styles.ratingRow}>
            <View style={styles.ratingLabelCol}>
              <Text style={styles.ratingLabel}>Effort & Focus</Text>
              <Text style={styles.ratingSub}>How hard did you work?</Text>
            </View>
            <RatingStars value={effortRating} onRate={setEffortRating} color={colors.primary} />
          </View>
          <View style={styles.ratingRow}>
            <View style={styles.ratingLabelCol}>
              <Text style={styles.ratingLabel}>Fitness Level</Text>
              <Text style={styles.ratingSub}>How fit did you feel?</Text>
            </View>
            <RatingStars value={fitnessRating} onRate={setFitnessRating} color={colors.physical} />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Notes (Optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Any key observations, what went well, areas to improve..."
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.md) }]}>
        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave}>
          {saving ? <ActivityIndicator color={colors.textLight} /> : (
            <>
              <MaterialIcons name="check-circle" size={20} color={colors.textLight} />
              <Text style={styles.saveBtnText}>Save Training Log</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },
  section: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  durationChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  durationChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  durationTextActive: { color: colors.textLight },
  durationInput: { flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.bodySmall, color: colors.text, minWidth: 60, textAlign: 'center' },
  durationInputActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  intensityBar: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: spacing.sm },
  intensityFill: { height: '100%', borderRadius: 6 },
  intensityBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  intensityBtnText: { fontSize: 11, fontWeight: '700', color: colors.text },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  statBlock: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs, textAlign: 'center' },
  statInput: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, ...typography.h4, color: colors.text, fontWeight: '700' },
  calcBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success + '15', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: borderRadius.sm, alignSelf: 'flex-start', marginTop: spacing.sm },
  calcBadgeText: { fontSize: 12, color: colors.success, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  ratingLabelCol: { flex: 1, marginRight: spacing.sm },
  ratingLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  ratingSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  footer: { padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  saveBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});
