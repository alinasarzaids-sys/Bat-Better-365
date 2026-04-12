import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Modal, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, AcademySession, AcademyMember, AttendanceRecord } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const STATUS_COLORS: Record<string, string> = {
  present: colors.success,
  absent: colors.error,
  late: colors.warning,
  excused: colors.textSecondary,
};

const STATUS_ICONS: Record<string, string> = {
  present: 'check-circle',
  absent: 'cancel',
  late: 'access-time',
  excused: 'info',
};

export default function AcademyAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const academyId = params.academyId as string;

  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [members, setMembers] = useState<AcademyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active attendance session
  const [activeSession, setActiveSession] = useState<AcademySession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord['status']>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create session modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState(() => { const d = new Date(); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; });
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState('Training');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [sessRes, membRes] = await Promise.all([
      academyService.getAcademySessions(academyId),
      academyService.getAcademyMembers(academyId),
    ]);
    setSessions(sessRes.data || []);
    setMembers((membRes.data || []).filter(m => m.role === 'player'));
    setLoading(false);
  }, [academyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleOpenSession = async (session: AcademySession) => {
    setActiveSession(session);
    setLoadingAttendance(true);
    const { data } = await academyService.getSessionAttendance(session.id);
    const map: Record<string, AttendanceRecord['status']> = {};
    (data || []).forEach(r => { map[r.user_id] = r.status; });
    // Default all players to absent if not recorded
    members.forEach(m => { if (!map[m.user_id]) map[m.user_id] = 'absent'; });
    setAttendance(map);
    setLoadingAttendance(false);
  };

  const toggleStatus = (userId: string) => {
    const cycle: AttendanceRecord['status'][] = ['present', 'late', 'excused', 'absent'];
    const current = attendance[userId] || 'absent';
    const nextIdx = (cycle.indexOf(current) + 1) % cycle.length;
    setAttendance(prev => ({ ...prev, [userId]: cycle[nextIdx] }));
  };

  const handleSaveAttendance = async () => {
    if (!activeSession || !user) return;
    setSaving(true);
    const records = Object.entries(attendance).map(([userId, status]) => ({ userId, status }));
    const { error } = await academyService.bulkMarkAttendance(activeSession.id, records, user.id);
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    setActiveSession(null);
    showAlert('Saved', 'Attendance recorded successfully.');
  };

  const handleCreateSession = async () => {
    if (!user) return;
    if (!newTitle.trim()) { showAlert('Error', 'Please enter a session title'); return; }
    if (!newDate) { showAlert('Error', 'Please enter a date'); return; }
    setCreating(true);
    const { error } = await academyService.createSession({
      academy_id: academyId,
      title: newTitle.trim(),
      session_date: newDate,
      session_time: newTime,
      location: newLocation.trim() || undefined,
      session_type: newType,
      notes: newNotes.trim() || undefined,
      created_by: user.id,
    });
    setCreating(false);
    if (error) { showAlert('Error', error); return; }
    setShowCreateModal(false);
    const nd = new Date();
    setNewTitle(''); setNewDate(nd.toISOString().split('T')[0]);
    setNewTime(`${nd.getHours().toString().padStart(2,'0')}:${nd.getMinutes().toString().padStart(2,'0')}`); setNewLocation(''); setNewNotes('');
    await load();
    showAlert('Session Created', 'You can now mark attendance for this session.');
  };

  const presentCount = activeSession ? Object.values(attendance).filter(s => s === 'present').length : 0;
  const lateCount = activeSession ? Object.values(attendance).filter(s => s === 'late').length : 0;
  const absentCount = activeSession ? Object.values(attendance).filter(s => s === 'absent').length : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Attendance</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  // Attendance marking view
  if (activeSession) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => setActiveSession(null)} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{activeSession.title}</Text>
            <Text style={styles.headerSub}>{activeSession.session_date} · {activeSession.session_time}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Summary row */}
        <View style={styles.attendanceSummary}>
          <View style={[styles.summaryChip, { backgroundColor: colors.success + '20' }]}>
            <MaterialIcons name="check-circle" size={14} color={colors.success} />
            <Text style={[styles.summaryChipText, { color: colors.success }]}>{presentCount} Present</Text>
          </View>
          <View style={[styles.attendanceSummaryChip, { backgroundColor: colors.warning + '20' }]}>
            <MaterialIcons name="access-time" size={14} color={colors.warning} />
            <Text style={[styles.summaryChipText, { color: colors.warning }]}>{lateCount} Late</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: colors.error + '20' }]}>
            <MaterialIcons name="cancel" size={14} color={colors.error} />
            <Text style={[styles.summaryChipText, { color: colors.error }]}>{absentCount} Absent</Text>
          </View>
        </View>

        <Text style={styles.tapHint}>Tap a player to cycle: Present → Late → Excused → Absent</Text>

        {loadingAttendance ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {members.map(member => {
              const status = attendance[member.user_id] || 'absent';
              const name = member.display_name || member.user_profiles?.username || member.user_profiles?.email || 'Player';
              const statusColor = STATUS_COLORS[status];
              return (
                <Pressable key={member.id} style={[styles.attendanceRow, { borderLeftColor: statusColor, borderLeftWidth: 4 }]}
                  onPress={() => toggleStatus(member.user_id)}>
                  <View style={[styles.attendanceAvatar, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.attendanceAvatarText, { color: statusColor }]}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attendanceName}>{name}</Text>
                    <Text style={[styles.attendancePosition, { color: statusColor + 'CC' }]}>{member.position}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <MaterialIcons name={STATUS_ICONS[status] as any} size={18} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                  </View>
                </Pressable>
              );
            })}
            {members.length === 0 && (
              <View style={styles.centered}>
                <MaterialIcons name="people-outline" size={48} color={colors.border} />
                <Text style={styles.emptyText}>No players in this academy yet</Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.md) }]}>
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveAttendance}>
            {saving ? <ActivityIndicator color={colors.textLight} /> : (
              <>
                <MaterialIcons name="save" size={20} color={colors.textLight} />
                <Text style={styles.saveBtnText}>Save Attendance</Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {sessions.length === 0 ? (
          <View style={[styles.centered, { paddingVertical: 60 }]}>
            <MaterialIcons name="event-busy" size={64} color={colors.border} />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySubtitle}>Create a session to start tracking attendance</Text>
            <Pressable style={styles.createFirstBtn} onPress={() => setShowCreateModal(true)}>
              <MaterialIcons name="add-circle" size={20} color={colors.textLight} />
              <Text style={styles.createFirstBtnText}>Create First Session</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Tap a session to mark attendance</Text>
            {sessions.map(s => (
              <Pressable key={s.id} style={styles.sessionCard} onPress={() => handleOpenSession(s)}>
                <View style={styles.sessionLeft}>
                  <View style={[styles.sessionTypeIcon, {
                    backgroundColor: s.session_type === 'Match' ? colors.error + '20' : s.session_type === 'Fitness' ? colors.physical + '20' : colors.primary + '20'
                  }]}>
                    <MaterialIcons
                      name={s.session_type === 'Match' ? 'sports-cricket' : s.session_type === 'Fitness' ? 'fitness-center' : 'group'}
                      size={20}
                      color={s.session_type === 'Match' ? colors.error : s.session_type === 'Fitness' ? colors.physical : colors.primary}
                    />
                  </View>
                  <View>
                    <Text style={styles.sessionTitle}>{s.title}</Text>
                    <Text style={styles.sessionMeta}>
                      {s.session_date} · {s.session_time}
                      {s.location ? ` · ${s.location}` : ''}
                    </Text>
                    <View style={[styles.sessionTypeBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.sessionTypeText, { color: colors.primary }]}>{s.session_type}</Text>
                    </View>
                  </View>
                </View>
                <MaterialIcons name="fact-check" size={22} color={colors.textSecondary} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* Create Session Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={createModalStyles.overlay}>
          <View style={createModalStyles.sheet}>
            <View style={createModalStyles.handle} />
            <View style={createModalStyles.header}>
              <Text style={createModalStyles.headerTitle}>Create Session</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={createModalStyles.closeBtn}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={createModalStyles.content} keyboardShouldPersistTaps="handled">
              <Text style={createModalStyles.label}>Session Title *</Text>
              <TextInput style={createModalStyles.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Tuesday Nets" placeholderTextColor={colors.textSecondary} />
              <Text style={createModalStyles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput style={createModalStyles.input} value={newDate} onChangeText={setNewDate} placeholder="2026-04-15" placeholderTextColor={colors.textSecondary} />
              <Text style={createModalStyles.label}>Time</Text>
              <TextInput style={createModalStyles.input} value={newTime} onChangeText={setNewTime} placeholder="10:00" placeholderTextColor={colors.textSecondary} />
              <Text style={createModalStyles.label}>Location (Optional)</Text>
              <TextInput style={createModalStyles.input} value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Main Oval" placeholderTextColor={colors.textSecondary} />
              <Text style={createModalStyles.label}>Session Type</Text>
              <View style={createModalStyles.chipRow}>
                {['Training', 'Match', 'Fitness', 'Fielding', 'Batting', 'Bowling'].map(t => (
                  <Pressable key={t} style={[createModalStyles.chip, newType === t && createModalStyles.chipActive]} onPress={() => setNewType(t)}>
                    <Text style={[createModalStyles.chipText, newType === t && createModalStyles.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={createModalStyles.label}>Notes (Optional)</Text>
              <TextInput style={[createModalStyles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={newNotes} onChangeText={setNewNotes} multiline placeholder="Any notes for players..." placeholderTextColor={colors.textSecondary} />
              <Pressable style={[createModalStyles.submitBtn, creating && { opacity: 0.6 }]} onPress={handleCreateSession}>
                {creating ? <ActivityIndicator color={colors.textLight} /> : (
                  <>
                    <MaterialIcons name="event" size={18} color={colors.textLight} />
                    <Text style={createModalStyles.submitBtnText}>Create Session</Text>
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

const createModalStyles = StyleSheet.create({
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700', flex: 1 },
  headerSub: { fontSize: 11, color: colors.textSecondary },
  createBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  attendanceSummary: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  attendanceSummaryChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  summaryChipText: { fontSize: 12, fontWeight: '700' },
  tapHint: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xs, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  sessionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sessionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  sessionTypeIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sessionTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  sessionTypeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, alignSelf: 'flex-start', marginTop: 4 },
  sessionTypeText: { fontSize: 10, fontWeight: '700' },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  attendanceAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  attendanceAvatarText: { fontWeight: '800', fontSize: 18 },
  attendanceName: { ...typography.body, color: colors.text, fontWeight: '700' },
  attendancePosition: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  statusText: { fontSize: 12, fontWeight: '700' },
  footer: { padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  saveBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
  emptyTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  createFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md, marginTop: spacing.md },
  createFirstBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});
