import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, Academy, AcademyMember, AcademyTrainingLog } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const POSITIONS = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper', 'Fielder', 'Coach'];
const POSITION_ICONS: Record<string, string> = {
  Batsman: 'sports-cricket', Bowler: 'sports-cricket', 'All-Rounder': 'sports-cricket',
  'Wicket-Keeper': 'sports-handball', Fielder: 'sports-handball', Coach: 'school',
};

function getPositionColor(position: string): string {
  switch (position) {
    case 'Batsman': return colors.technical;
    case 'Bowler': return colors.physical;
    case 'All-Rounder': return colors.primary;
    case 'Wicket-Keeper': return colors.mental;
    case 'Fielder': return colors.tactical;
    case 'Coach': return colors.warning;
    default: return colors.primary;
  }
}

function WeeklyBar({ logs }: { logs: AcademyTrainingLog[] }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sessionsByDay: number[] = Array(7).fill(0);
  logs.forEach(log => {
    const diff = Math.floor((new Date(log.log_date).getTime() - monday.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) sessionsByDay[diff] = Math.min(3, sessionsByDay[diff] + 1);
  });
  return (
    <View style={weekBarStyles.row}>
      {days.map((d, i) => (
        <View key={i} style={weekBarStyles.dayCol}>
          <View style={[weekBarStyles.dot, sessionsByDay[i] > 0 && weekBarStyles.dotActive]}>
            {sessionsByDay[i] > 1 && <Text style={weekBarStyles.dotCount}>{sessionsByDay[i]}</Text>}
          </View>
          <Text style={weekBarStyles.dayLabel}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

const weekBarStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.sm },
  dayCol: { alignItems: 'center', gap: 4 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  dotActive: { backgroundColor: colors.primary },
  dotCount: { ...typography.caption, color: colors.textLight, fontWeight: '800', fontSize: 10 },
  dayLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
});

export default function AcademyScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [memberships, setMemberships] = useState<Array<{ academy: Academy; member: AcademyMember }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recentLogs, setRecentLogs] = useState<AcademyTrainingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Join modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [previewPlayerView, setPreviewPlayerView] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joinPosition, setJoinPosition] = useState('Batsman');
  const [joinJersey, setJoinJersey] = useState('');
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await academyService.getMyAcademies(user.id);
    setMemberships(data || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadLogs = useCallback(async (academyId: string) => {
    if (!user) return;
    setLogsLoading(true);
    const { data } = await academyService.getMyLogs(user.id, academyId, 7);
    setRecentLogs(data || []);
    setLogsLoading(false);
  }, [user]);

  const currentMembership = memberships[selectedIdx] || null;

  useFocusEffect(useCallback(() => {
    if (currentMembership) loadLogs(currentMembership.academy.id);
  }, [currentMembership?.academy.id]));

  const handleJoin = async () => {
    if (!user) return;
    if (!joinCode.trim()) { showAlert('Error', 'Please enter a code'); return; }
    if (!joinDisplayName.trim()) { showAlert('Error', 'Please enter your name'); return; }
    setJoining(true);
    const { data, error } = await academyService.joinAcademy(joinCode, user.id, joinDisplayName, joinPosition, joinJersey);
    setJoining(false);
    if (error) { showAlert('Error', error); return; }
    setShowJoinModal(false);
    setJoinCode(''); setJoinDisplayName(''); setJoinPosition('Batsman'); setJoinJersey('');
    await load();
    showAlert('Joined!', `You are now part of ${data!.academy.name} as ${data!.role === 'coach' ? 'Coach' : 'Player'}.`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    if (currentMembership) await loadLogs(currentMembership.academy.id);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}><Text style={styles.headerTitle}>Academy Portal</Text></View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  // No memberships yet
  if (memberships.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}><Text style={styles.headerTitle}>Academy Portal</Text></View>
        <ScrollView contentContainerStyle={styles.emptyContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyIconCircle}>
            <MaterialIcons name="shield" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Join Your Academy</Text>
          <Text style={styles.emptySubtitle}>
            Enter the code provided by your coach or academy administrator to connect with your club, school, or cricket program.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => setShowJoinModal(true)}>
            <MaterialIcons name="vpn-key" size={20} color={colors.textLight} />
            <Text style={styles.primaryBtnText}>Enter Join Code</Text>
          </Pressable>
          <View style={styles.codeInfoCard}>
            <MaterialIcons name="info-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.codeInfoText}>
              Your coach or academy administrator will provide you with a unique 6-character code. Players and coaching staff each receive a different code.
            </Text>
          </View>
        </ScrollView>
        <JoinModal
          visible={showJoinModal} code={joinCode} onCodeChange={setJoinCode}
          displayName={joinDisplayName} onDisplayNameChange={setJoinDisplayName}
          position={joinPosition} onPositionChange={setJoinPosition}
          jersey={joinJersey} onJerseyChange={setJoinJersey}
          loading={joining} onClose={() => setShowJoinModal(false)} onSubmit={handleJoin}
        />
      </SafeAreaView>
    );
  }

  const isCoach = currentMembership?.member.role === 'coach';
  const showPlayerView = !isCoach || previewPlayerView;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Academy Portal</Text>
          {memberships.length > 1 && <Text style={styles.headerSub}>{memberships.length} academies</Text>}
        </View>
        <View style={styles.headerActions}>
          {isCoach && (
            <Pressable
              style={[styles.viewToggleBtn, previewPlayerView && styles.viewToggleBtnActive]}
              onPress={() => setPreviewPlayerView(p => !p)}
              hitSlop={8}
            >
              <MaterialIcons name={previewPlayerView ? 'school' : 'person'} size={16} color={previewPlayerView ? colors.warning : colors.primary} />
              <Text style={[styles.viewToggleText, previewPlayerView && { color: colors.warning }]}>
                {previewPlayerView ? 'Coach' : 'Player'}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.joinMoreBtn} onPress={() => setShowJoinModal(true)} hitSlop={8}>
            <MaterialIcons name="vpn-key" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {memberships.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}
          contentContainerStyle={styles.switcherContent}>
          {memberships.map((m, i) => (
            <Pressable key={m.academy.id} style={[styles.switcherChip, selectedIdx === i && styles.switcherChipActive]}
              onPress={() => setSelectedIdx(i)}>
              <Text style={[styles.switcherText, selectedIdx === i && styles.switcherTextActive]} numberOfLines={1}>
                {m.academy.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {/* Academy Header Card */}
        <View style={styles.academyHeaderCard}>
          <View style={styles.academyHeaderRow}>
            <View style={[styles.academyIconCircle, { backgroundColor: (isCoach ? colors.warning : colors.primary) + '25' }]}>
              <MaterialIcons name={isCoach ? 'school' : 'sports-cricket'} size={28} color={isCoach ? colors.warning : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.academyName}>{currentMembership!.academy.name}</Text>
              {currentMembership!.academy.description ? (
                <Text style={styles.academyDesc} numberOfLines={1}>{currentMembership!.academy.description}</Text>
              ) : null}
            </View>
            <View style={[styles.roleChip, { backgroundColor: (isCoach ? colors.warning : colors.primary) + '20' }]}>
              <Text style={[styles.roleChipText, { color: isCoach ? colors.warning : colors.primary }]}>
                {isCoach ? 'Coach' : 'Player'}
              </Text>
            </View>
          </View>

          {isCoach && (
            <View style={styles.codesRow}>
              <View style={styles.codeBlock}>
                <Text style={styles.codeLabel}>Player Code</Text>
                <Text style={styles.codeValue}>{currentMembership!.academy.player_code}</Text>
              </View>
              <View style={[styles.codeBlock, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                <Text style={styles.codeLabel}>Coach Code</Text>
                <Text style={styles.codeValue}>{currentMembership!.academy.coach_code}</Text>
              </View>
            </View>
          )}

          {!isCoach && (
            <View style={styles.memberInfoRow}>
              <MaterialIcons name={(POSITION_ICONS[currentMembership!.member.position] || 'sports-cricket') as any} size={16} color={getPositionColor(currentMembership!.member.position)} />
              <Text style={[styles.memberPositionText, { color: getPositionColor(currentMembership!.member.position) }]}>
                {currentMembership!.member.position}
              </Text>
              {currentMembership!.member.jersey_number ? (
                <Text style={styles.jerseyText}>#{currentMembership!.member.jersey_number}</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Player View */}
        {showPlayerView && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <MaterialIcons name="date-range" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>This Week's Training</Text>
              </View>
              {logsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
              ) : (
                <>
                  <WeeklyBar logs={recentLogs} />
                  <View style={styles.weekSummaryRow}>
                    <View style={styles.weekStat}>
                      <Text style={styles.weekStatVal}>{recentLogs.length}</Text>
                      <Text style={styles.weekStatLabel}>Sessions</Text>
                    </View>
                    <View style={styles.weekStat}>
                      <Text style={styles.weekStatVal}>{recentLogs.reduce((a, l) => a + l.duration_minutes, 0)}</Text>
                      <Text style={styles.weekStatLabel}>Mins</Text>
                    </View>
                    <View style={styles.weekStat}>
                      <Text style={styles.weekStatVal}>
                        {recentLogs.length > 0 ? (recentLogs.reduce((a, l) => a + l.intensity, 0) / recentLogs.length).toFixed(1) : '—'}
                      </Text>
                      <Text style={styles.weekStatLabel}>Avg Intensity</Text>
                    </View>
                    <View style={styles.weekStat}>
                      <Text style={styles.weekStatVal}>
                        {recentLogs.reduce((a, l) => a + (l.balls_faced || 0), 0) || recentLogs.reduce((a, l) => a + (l.balls_bowled || 0), 0) || '—'}
                      </Text>
                      <Text style={styles.weekStatLabel}>Balls</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={styles.actionsGrid}>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-log', params: { academyId: currentMembership!.academy.id, position: currentMembership!.member.position } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="add-circle" size={28} color={colors.primary} />
                </View>
                <Text style={styles.actionTitle}>Log Training</Text>
                <Text style={styles.actionSub}>Record today's session</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-analytics', params: { academyId: currentMembership!.academy.id } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                  <MaterialIcons name="insights" size={28} color={colors.success} />
                </View>
                <Text style={styles.actionTitle}>My Analytics</Text>
                <Text style={styles.actionSub}>AI performance report</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-history', params: { academyId: currentMembership!.academy.id } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                  <MaterialIcons name="history" size={28} color={colors.warning} />
                </View>
                <Text style={styles.actionTitle}>My History</Text>
                <Text style={styles.actionSub}>All past logs</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-schedule', params: { academyId: currentMembership!.academy.id } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.mental + '20' }]}>
                  <MaterialIcons name="event" size={28} color={colors.mental} />
                </View>
                <Text style={styles.actionTitle}>Schedule</Text>
                <Text style={styles.actionSub}>Upcoming sessions</Text>
              </Pressable>
            </View>

            {recentLogs.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="history" size={18} color={colors.textSecondary} />
                  <Text style={styles.cardTitle}>Recent Logs</Text>
                </View>
                {recentLogs.slice(0, 5).map(log => (
                  <View key={log.id} style={styles.logRow}>
                    <View style={[styles.logDot, { backgroundColor: log.intensity >= 7 ? colors.error : log.intensity >= 4 ? colors.warning : colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logTitle}>{log.session_type}</Text>
                      <Text style={styles.logMeta}>{log.log_date} · {log.duration_minutes}min · Intensity {log.intensity}/10</Text>
                      {(log.balls_faced || log.balls_bowled || log.catches) ? (
                        <Text style={styles.logStats}>
                          {log.balls_faced ? `${log.balls_faced} balls faced ` : ''}
                          {log.balls_bowled ? `${log.balls_bowled} bowled ` : ''}
                          {log.catches ? `${log.catches} catches` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.intensityBadge, {
                      backgroundColor: (log.intensity >= 7 ? colors.error : log.intensity >= 4 ? colors.warning : colors.success) + '20'
                    }]}>
                      <Text style={[styles.intensityBadgeText, {
                        color: log.intensity >= 7 ? colors.error : log.intensity >= 4 ? colors.warning : colors.success
                      }]}>{log.intensity}/10</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Coach View */}
        {isCoach && !previewPlayerView && (
          <>
            <View style={styles.actionsGrid}>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-coach', params: { academyId: currentMembership!.academy.id } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="people" size={28} color={colors.primary} />
                </View>
                <Text style={styles.actionTitle}>Squad View</Text>
                <Text style={styles.actionSub}>Player training overview</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-attendance', params: { academyId: currentMembership!.academy.id } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                  <MaterialIcons name="fact-check" size={28} color={colors.success} />
                </View>
                <Text style={styles.actionTitle}>Attendance</Text>
                <Text style={styles.actionSub}>Mark & view attendance</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-schedule', params: { academyId: currentMembership!.academy.id, isCoach: 'true' } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                  <MaterialIcons name="event-note" size={28} color={colors.warning} />
                </View>
                <Text style={styles.actionTitle}>Sessions</Text>
                <Text style={styles.actionSub}>Create & manage</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({ pathname: '/academy-coach', params: { academyId: currentMembership!.academy.id, tab: 'analytics' } } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.mental + '20' }]}>
                  <MaterialIcons name="analytics" size={28} color={colors.mental} />
                </View>
                <Text style={styles.actionTitle}>Team Analytics</Text>
                <Text style={styles.actionSub}>Performance trends</Text>
              </Pressable>
            </View>

            <View style={styles.shareReminderCard}>
              <MaterialIcons name="share" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.shareReminderTitle}>Share Join Codes with Your Squad</Text>
                <Text style={styles.shareReminderText}>
                  Players: <Text style={styles.codeHighlight}>{currentMembership!.academy.player_code}</Text>
                  {'   '}Coaches: <Text style={styles.codeHighlight}>{currentMembership!.academy.coach_code}</Text>
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <JoinModal
        visible={showJoinModal} code={joinCode} onCodeChange={setJoinCode}
        displayName={joinDisplayName} onDisplayNameChange={setJoinDisplayName}
        position={joinPosition} onPositionChange={setJoinPosition}
        jersey={joinJersey} onJerseyChange={setJoinJersey}
        loading={joining} onClose={() => setShowJoinModal(false)} onSubmit={handleJoin}
      />
    </SafeAreaView>
  );
}

function JoinModal({ visible, code, onCodeChange, displayName, onDisplayNameChange, position, onPositionChange, jersey, onJerseyChange, loading, onClose, onSubmit }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>Join Another Academy</Text>
            <Pressable onPress={onClose} style={modalStyles.closeBtn}>
              <MaterialIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={modalStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={modalStyles.label}>Join Code</Text>
            <TextInput style={modalStyles.input} value={code} onChangeText={onCodeChange}
              placeholder="Enter 6-character code" placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters" maxLength={6} />
            <Text style={modalStyles.label}>Your Name</Text>
            <TextInput style={modalStyles.input} value={displayName} onChangeText={onDisplayNameChange}
              placeholder="e.g. Jamie Smith" placeholderTextColor={colors.textSecondary} />
            <Text style={modalStyles.label}>Position</Text>
            <View style={modalStyles.positionGrid}>
              {(['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper', 'Fielder', 'Coach']).map(p => (
                <Pressable key={p} style={[modalStyles.chip, position === p && modalStyles.chipActive]} onPress={() => onPositionChange(p)}>
                  <Text style={[modalStyles.chipText, position === p && modalStyles.chipTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={modalStyles.label}>Jersey Number (Optional)</Text>
            <TextInput style={modalStyles.input} value={jersey} onChangeText={onJerseyChange}
              placeholder="#7" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" maxLength={3} />
            <Pressable style={[modalStyles.submitBtn, loading && { opacity: 0.6 }]} onPress={onSubmit}>
              {loading ? <ActivityIndicator color={colors.textLight} /> : (
                <><MaterialIcons name="login" size={20} color={colors.textLight} /><Text style={modalStyles.submitBtnText}>Join Academy</Text></>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.lg },
  submitBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textSecondary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  viewToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30' },
  viewToggleBtnActive: { backgroundColor: colors.warning + '15', borderColor: colors.warning + '30' },
  viewToggleText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  switcherScroll: { maxHeight: 52, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  switcherContent: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  switcherChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  switcherChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  switcherText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  switcherTextActive: { color: colors.textLight },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },

  emptyContainer: { flexGrow: 1, alignItems: 'center', padding: spacing.xl, gap: spacing.md, paddingTop: 60 },
  emptyIconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { ...typography.h2, color: colors.text, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md, width: '100%', justifyContent: 'center' },
  primaryBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
  codeInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  codeInfoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },

  academyHeaderCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  academyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  academyIconCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  academyName: { ...typography.h4, color: colors.text, fontWeight: '700' },
  academyDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  roleChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  roleChipText: { ...typography.caption, fontWeight: '800', fontSize: 11 },
  codesRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  codeBlock: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  codeLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  codeValue: { ...typography.h4, color: colors.primary, fontWeight: '800', letterSpacing: 2 },
  memberInfoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  memberPositionText: { ...typography.bodySmall, fontWeight: '700' },
  jerseyText: { ...typography.bodySmall, color: colors.textSecondary, marginLeft: spacing.xs },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  weekSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  weekStat: { flex: 1, alignItems: 'center' },
  weekStatVal: { ...typography.h4, color: colors.text, fontWeight: '800' },
  weekStatLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  actionCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', textAlign: 'center' },
  actionSub: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  logMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  logStats: { fontSize: 11, color: colors.primary, marginTop: 1, fontWeight: '600' },
  intensityBadge: { paddingHorizontal: spacing.xs + 2, paddingVertical: 3, borderRadius: borderRadius.sm },
  intensityBadgeText: { fontSize: 11, fontWeight: '800' },

  shareReminderCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary + '10', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary + '30' },
  shareReminderTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: 2 },
  shareReminderText: { fontSize: 12, color: colors.textSecondary },
  codeHighlight: { fontWeight: '800', color: colors.primary, letterSpacing: 1 },
});
