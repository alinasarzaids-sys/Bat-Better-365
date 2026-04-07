import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Modal, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, AcademySession } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function AcademyScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const academyId = params.academyId as string;
  const isCoach = params.isCoach === 'true';

  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00');
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState('Training');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await academyService.getAcademySessions(academyId);
    setSessions(data || []);
    setLoading(false);
  }, [academyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!newTitle.trim()) { showAlert('Error', 'Please enter a session title'); return; }
    setCreating(true);
    const { error } = await academyService.createSession({
      academy_id: academyId, title: newTitle.trim(), session_date: newDate,
      session_time: newTime, location: newLocation.trim() || undefined,
      session_type: newType, notes: newNotes.trim() || undefined, created_by: user.id,
    });
    setCreating(false);
    if (error) { showAlert('Error', error); return; }
    setShowCreateModal(false);
    setNewTitle(''); setNewDate(new Date().toISOString().split('T')[0]);
    setNewTime('10:00'); setNewLocation(''); setNewNotes('');
    await load();
  };

  const today = new Date().toISOString().split('T')[0];
  const upcoming = sessions.filter(s => s.session_date >= today).sort((a, b) => a.session_date.localeCompare(b.session_date));
  const past = sessions.filter(s => s.session_date < today).sort((a, b) => b.session_date.localeCompare(a.session_date));

  const typeColors: Record<string, string> = {
    Training: colors.primary, Match: colors.error, Fitness: colors.physical,
    Fielding: colors.tactical, Batting: colors.technical, Bowling: colors.physical,
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Schedule</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  function SessionCard({ s }: { s: AcademySession }) {
    const color = typeColors[s.session_type] || colors.primary;
    const isToday = s.session_date === today;
    const isPast = s.session_date < today;
    return (
      <View style={[styles.sessionCard, isToday && styles.sessionCardToday]}>
        <View style={[styles.sessionStripe, { backgroundColor: color }]} />
        <View style={styles.sessionContent}>
          <View style={styles.sessionTop}>
            <View style={{ flex: 1 }}>
              <View style={styles.sessionTitleRow}>
                <Text style={styles.sessionTitle}>{s.title}</Text>
                {isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>}
              </View>
              <Text style={styles.sessionMeta}>
                {s.session_date} · {s.session_time}
                {s.location ? ` · ${s.location}` : ''}
              </Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color }]}>{s.session_type}</Text>
            </View>
          </View>
          {s.notes ? <Text style={styles.sessionNotes} numberOfLines={2}>{s.notes}</Text> : null}
          {isCoach && !isPast && (
            <Pressable style={styles.markAttendanceBtn} onPress={() => router.push({ pathname: '/academy-attendance', params: { academyId } } as any)}>
              <MaterialIcons name="fact-check" size={14} color={colors.primary} />
              <Text style={styles.markAttendanceText}>Mark Attendance</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Schedule</Text>
        {isCoach ? (
          <Pressable style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
            <MaterialIcons name="add" size={22} color={colors.primary} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {upcoming.length === 0 && past.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-note" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>No sessions scheduled</Text>
            <Text style={styles.emptySubtitle}>
              {isCoach ? 'Create a session to get started' : 'Your coach will schedule sessions here'}
            </Text>
            {isCoach && (
              <Pressable style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
                <MaterialIcons name="add-circle" size={20} color={colors.textLight} />
                <Text style={styles.createBtnText}>Create Session</Text>
              </Pressable>
            )}
          </View>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Upcoming ({upcoming.length})</Text>
            {upcoming.map(s => <SessionCard key={s.id} s={s} />)}
          </>
        )}
        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Past Sessions</Text>
            {past.map(s => <SessionCard key={s.id} s={s} />)}
          </>
        )}
      </ScrollView>

      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <View style={modalStyles.header}>
              <Text style={modalStyles.headerTitle}>Create Session</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={modalStyles.closeBtn}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={modalStyles.content} keyboardShouldPersistTaps="handled">
              <Text style={modalStyles.label}>Session Title *</Text>
              <TextInput style={modalStyles.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Tuesday Nets Session" placeholderTextColor={colors.textSecondary} />
              <Text style={modalStyles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput style={modalStyles.input} value={newDate} onChangeText={setNewDate} placeholder="2026-04-15" placeholderTextColor={colors.textSecondary} />
              <Text style={modalStyles.label}>Time (HH:MM)</Text>
              <TextInput style={modalStyles.input} value={newTime} onChangeText={setNewTime} placeholder="10:00" placeholderTextColor={colors.textSecondary} />
              <Text style={modalStyles.label}>Location (Optional)</Text>
              <TextInput style={modalStyles.input} value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Main Ground" placeholderTextColor={colors.textSecondary} />
              <Text style={modalStyles.label}>Session Type</Text>
              <View style={modalStyles.chipRow}>
                {['Training', 'Match', 'Fitness', 'Fielding', 'Batting', 'Bowling'].map(t => (
                  <Pressable key={t} style={[modalStyles.chip, newType === t && modalStyles.chipActive]} onPress={() => setNewType(t)}>
                    <Text style={[modalStyles.chipText, newType === t && modalStyles.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={modalStyles.label}>Notes for Players (Optional)</Text>
              <TextInput style={[modalStyles.input, { minHeight: 70, textAlignVertical: 'top' }]} value={newNotes} onChangeText={setNewNotes} multiline placeholder="What should players bring / prepare?" placeholderTextColor={colors.textSecondary} />
              <Pressable style={[modalStyles.submitBtn, creating && { opacity: 0.6 }]} onPress={handleCreate}>
                {creating ? <ActivityIndicator color={colors.textLight} /> : (
                  <>
                    <MaterialIcons name="event" size={18} color={colors.textLight} />
                    <Text style={modalStyles.submitBtnText}>Create Session</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 40 },
  label: { ...typography.bodySmall, color: colors.text, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.lg },
  submitBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700', flex: 1 },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 60 },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  sessionCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sessionCardToday: { borderColor: colors.primary + '80', borderWidth: 2 },
  sessionStripe: { width: 5 },
  sessionContent: { flex: 1, padding: spacing.md },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  sessionTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  todayBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: borderRadius.sm },
  todayBadgeText: { fontSize: 9, color: colors.textLight, fontWeight: '800' },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  sessionNotes: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 16 },
  markAttendanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: colors.primary + '15', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm },
  markAttendanceText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md },
  createBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});
