import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, Academy, AcademyMember, AcademyTrainingLog, AcademySquad } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

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

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ visible, academy, onClose }: {
  visible: boolean;
  academy: Academy | null;
  onClose: () => void;
}) {
  if (!academy) return null;

  const sharePlayerCode = () => Share.share({
    message: `Join ${academy.name} on Bat Better 365 as a Player!\n\nPlayer Code: ${academy.player_code}\n\nDownload Bat Better 365 and enter this code under Academy Portal.`,
    title: `Player Code — ${academy.name}`,
  });

  const shareCoachCode = () => Share.share({
    message: `Join ${academy.name} on Bat Better 365 as a Coach!\n\nCoach Code: ${academy.coach_code}\n\nDownload Bat Better 365 and enter this code under Academy Portal.`,
    title: `Coach Code — ${academy.name}`,
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={inviteModalStyles.overlay} onPress={onClose}>
        <Pressable style={inviteModalStyles.card} onPress={e => e.stopPropagation()}>
          <View style={inviteModalStyles.handle} />
          <Text style={inviteModalStyles.title}>Invite to {academy.name}</Text>
          <Text style={inviteModalStyles.subtitle}>Share the relevant code with your squad members</Text>

          <View style={[inviteModalStyles.codeBlock, { borderColor: colors.primary + '40' }]}>
            <View style={[inviteModalStyles.codeIconCircle, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="sports-cricket" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={inviteModalStyles.codeRoleLabel}>PLAYER CODE</Text>
              <Text style={[inviteModalStyles.codeValue, { color: colors.primary }]}>{academy.player_code}</Text>
            </View>
            <Pressable style={[inviteModalStyles.shareBtn, { backgroundColor: colors.primary }]} onPress={sharePlayerCode}>
              <MaterialIcons name="share" size={16} color={colors.textLight} />
              <Text style={inviteModalStyles.shareBtnText}>Share</Text>
            </Pressable>
          </View>

          <View style={[inviteModalStyles.codeBlock, { borderColor: colors.warning + '40' }]}>
            <View style={[inviteModalStyles.codeIconCircle, { backgroundColor: colors.warning + '15' }]}>
              <MaterialIcons name="school" size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={inviteModalStyles.codeRoleLabel}>COACH CODE</Text>
              <Text style={[inviteModalStyles.codeValue, { color: colors.warning }]}>{academy.coach_code}</Text>
            </View>
            <Pressable style={[inviteModalStyles.shareBtn, { backgroundColor: colors.warning }]} onPress={shareCoachCode}>
              <MaterialIcons name="share" size={16} color={colors.textLight} />
              <Text style={inviteModalStyles.shareBtnText}>Share</Text>
            </Pressable>
          </View>

          <Pressable style={inviteModalStyles.closeBtn} onPress={onClose}>
            <Text style={inviteModalStyles.closeBtnText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const inviteModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 32, gap: spacing.md },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xs },
  title: { ...typography.h4, color: colors.text, fontWeight: '800', textAlign: 'center' },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xs },
  codeBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderRadius: borderRadius.lg, padding: spacing.md, backgroundColor: colors.background },
  codeIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  codeRoleLabel: { fontSize: 9, color: colors.textSecondary, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  codeValue: { fontSize: 22, fontWeight: '900', letterSpacing: 4, marginTop: 2 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: borderRadius.md },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  closeBtn: { backgroundColor: colors.background, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs },
  closeBtnText: { ...typography.body, color: colors.text, fontWeight: '700' },
});

// ─── Edit Academy Modal ───────────────────────────────────────────────────────
function EditAcademyModal({ visible, academy, onClose, onSaved }: {
  visible: boolean;
  academy: Academy | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showAlert } = useAlert();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible && academy) {
      setName(academy.name);
      setDescription(academy.description || '');
    }
  }, [visible, academy]);

  const handleSave = async () => {
    if (!academy) return;
    if (!name.trim()) { showAlert('Error', 'Academy name cannot be empty.'); return; }
    setSaving(true);
    const { error } = await academyService.updateAcademy(academy.id, {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    onClose();
    onSaved();
    showAlert('Saved', 'Academy details updated successfully.');
  };

  if (!academy) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={editModalStyles.overlay}>
        <View style={editModalStyles.sheet}>
          <View style={editModalStyles.handle} />
          <View style={editModalStyles.header}>
            <Text style={editModalStyles.headerTitle}>Edit Academy</Text>
            <Pressable onPress={onClose} style={editModalStyles.closeBtn}>
              <MaterialIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={editModalStyles.content} keyboardShouldPersistTaps="handled">
            <Text style={editModalStyles.label}>Team / Academy Name</Text>
            <TextInput
              style={editModalStyles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Under 15"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <Text style={editModalStyles.hint}>This is the name players see when they join using your code.</Text>

            <Text style={[editModalStyles.label, { marginTop: spacing.md }]}>Organisation / Club Name (Optional)</Text>
            <TextInput
              style={[editModalStyles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Karachi Cricket Club"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <Text style={editModalStyles.hint}>Your club or organisation name shown as a subtitle.</Text>

            <Pressable
              style={[editModalStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.textLight} />
                : (
                  <>
                    <MaterialIcons name="save" size={18} color={colors.textLight} />
                    <Text style={editModalStyles.saveBtnText}>Save Changes</Text>
                  </>
                )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const editModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.xs },
  label: { fontSize: 13, color: colors.text, fontWeight: '700', marginBottom: 6 },
  hint: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 4 },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 15, color: colors.text, fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md, marginTop: spacing.lg,
  },
  saveBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});

// ─── Squad Overview Card ──────────────────────────────────────────────────────
function SquadOverviewCard({ members, logs, squad, squadFilter }: {
  members: AcademyMember[];
  logs: Array<AcademyTrainingLog & { user_profiles: any }>;
  squad: AcademySquad | null;
  squadFilter: string | null;
}) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const activePlayers = members.filter(m => m.role === 'player' && m.is_active !== false);
  const squadPlayers = squadFilter
    ? activePlayers.filter(m => (m as any).squad_id === squadFilter)
    : activePlayers;

  const squadPlayerIds = new Set(squadPlayers.map(m => m.user_id));
  const squadLogs = logs.filter(l => squadPlayerIds.has(l.user_id));
  const weekLogs = squadLogs.filter(l => l.log_date >= weekAgoStr);
  const activeThisWeek = new Set(weekLogs.map(l => l.user_id)).size;
  const avgIntensity = weekLogs.length > 0
    ? (weekLogs.reduce((a, l) => a + l.intensity, 0) / weekLogs.length).toFixed(1) : '—';

  const accentColor = squad?.color || colors.primary;

  return (
    <View style={[overviewStyles.card, { borderColor: accentColor + '30' }]}>
      <View style={overviewStyles.cardHeader}>
        <View style={[overviewStyles.dot, { backgroundColor: accentColor }]} />
        <Text style={overviewStyles.cardTitle}>{squad ? `${squad.name} Overview` : 'Academy Overview'}</Text>
        <Text style={overviewStyles.cardPeriod}>Last 7 days</Text>
      </View>
      <View style={overviewStyles.statsRow}>
        <View style={overviewStyles.statBlock}>
          <Text style={[overviewStyles.statVal, { color: accentColor }]}>{squadPlayers.length}</Text>
          <Text style={overviewStyles.statLabel}>Active Players</Text>
        </View>
        <View style={[overviewStyles.statBlock, overviewStyles.statDivider]}>
          <Text style={[overviewStyles.statVal, { color: colors.success }]}>{activeThisWeek}</Text>
          <Text style={overviewStyles.statLabel}>Trained This Week</Text>
        </View>
        <View style={[overviewStyles.statBlock, overviewStyles.statDivider]}>
          <Text style={[overviewStyles.statVal, { color: avgIntensity !== '—' && parseFloat(avgIntensity) >= 7 ? colors.error : colors.warning }]}>
            {avgIntensity}
          </Text>
          <Text style={overviewStyles.statLabel}>Avg Intensity</Text>
        </View>
      </View>
    </View>
  );
}

const overviewStyles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', flex: 1 },
  cardPeriod: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  statsRow: { flexDirection: 'row' },
  statBlock: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  statVal: { ...typography.h3, fontWeight: '900' },
  statLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
});

// ─── Join Confirmation Modal ──────────────────────────────────────────────────
function JoinConfirmModal({ visible, squadName, squadColor, position, displayName, academyName, joining, onConfirm, onCancel }: {
  visible: boolean;
  squadName: string | null;
  squadColor: string;
  position: string;
  displayName: string;
  academyName: string;
  joining: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.card}>
          <View style={[confirmStyles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
            <MaterialIcons name="help-outline" size={30} color={colors.primary} />
          </View>
          <Text style={confirmStyles.title}>Confirm Your Squad</Text>

          <View style={confirmStyles.detailsBox}>
            <View style={confirmStyles.detailRow}>
              <MaterialIcons name="person" size={16} color={colors.textSecondary} />
              <Text style={confirmStyles.detailLabel}>Name</Text>
              <Text style={confirmStyles.detailValue}>{displayName}</Text>
            </View>
            {squadName ? (
              <View style={confirmStyles.detailRow}>
                <View style={[confirmStyles.squadDot, { backgroundColor: squadColor }]} />
                <Text style={confirmStyles.detailLabel}>Squad</Text>
                <Text style={[confirmStyles.detailValue, { color: squadColor, fontWeight: '800' }]}>{squadName}</Text>
              </View>
            ) : null}
            <View style={confirmStyles.detailRow}>
              <MaterialIcons name="sports-cricket" size={16} color={colors.textSecondary} />
              <Text style={confirmStyles.detailLabel}>Position</Text>
              <Text style={confirmStyles.detailValue}>{position}</Text>
            </View>
            <View style={[confirmStyles.detailRow, { borderBottomWidth: 0 }]}>
              <MaterialIcons name="shield" size={16} color={colors.textSecondary} />
              <Text style={confirmStyles.detailLabel}>Academy</Text>
              <Text style={confirmStyles.detailValue} numberOfLines={1}>{academyName}</Text>
            </View>
          </View>

          <Text style={confirmStyles.hint}>
            Is this correct? Your coach can reassign your squad at any time from their dashboard.
          </Text>

          <View style={confirmStyles.btnRow}>
            <Pressable style={confirmStyles.cancelBtn} onPress={onCancel} disabled={joining}>
              <Text style={confirmStyles.cancelBtnText}>No, Change</Text>
            </Pressable>
            <Pressable
              style={[confirmStyles.confirmBtn, joining && { opacity: 0.6 }]}
              onPress={onConfirm}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator color={colors.textLight} size="small" />
                : (
                  <>
                    <MaterialIcons name="check" size={18} color={colors.textLight} />
                    <Text style={confirmStyles.confirmBtnText}>Yes, Join</Text>
                  </>
                )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const confirmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, width: '100%', gap: spacing.md, alignItems: 'center' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center' },
  detailsBox: { width: '100%', backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  squadDot: { width: 14, height: 14, borderRadius: 7 },
  detailLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', width: 64 },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: '700', flex: 1 },
  hint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { ...typography.body, color: colors.text, fontWeight: '700' },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary },
  confirmBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AcademyScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [memberships, setMemberships] = useState<Array<{ academy: Academy; member: AcademyMember }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recentLogs, setRecentLogs] = useState<AcademyTrainingLog[]>([]);
  const [allMemberLogs, setAllMemberLogs] = useState<Array<AcademyTrainingLog & { user_profiles: any }>>([]);
  const [allMembers, setAllMembers] = useState<AcademyMember[]>([]);
  const [squads, setSquads] = useState<AcademySquad[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [selectedSquadFilter, setSelectedSquadFilter] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditAcademyModal, setShowEditAcademyModal] = useState(false);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);

  // Join modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [joinStep, setJoinStep] = useState<'code' | 'details'>('code');
  const [joinCode, setJoinCode] = useState('');
  const [joinAcademyName, setJoinAcademyName] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joinPosition, setJoinPosition] = useState('Batsman');
  const [joinJersey, setJoinJersey] = useState('');
  const [joinSquadId, setJoinSquadId] = useState<string | null>(null);
  const [joinSquads, setJoinSquads] = useState<AcademySquad[]>([]);
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await academyService.getMyAcademies(user.id);
    setMemberships(data || []);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const currentMembership = memberships[selectedIdx] || null;
  const isCoach = currentMembership?.member.role === 'coach' && !previewAsPlayer;

  const loadCoachData = useCallback(async (academyId: string) => {
    const [logsRes, membersRes, squadsRes] = await Promise.all([
      academyService.getAcademyLogs(academyId, 30),
      academyService.getAcademyMembers(academyId),
      academyService.getSquads(academyId),
    ]);
    setAllMemberLogs(logsRes.data || []);
    setAllMembers(membersRes.data || []);
    setSquads(squadsRes.data || []);
  }, []);

  const loadPlayerLogs = useCallback(async (academyId: string) => {
    if (!user) return;
    setLogsLoading(true);
    const { data } = await academyService.getMyLogs(user.id, academyId, 7);
    setRecentLogs(data || []);
    setLogsLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => {
    if (!currentMembership) return;
    if (isCoach) loadCoachData(currentMembership.academy.id);
    else loadPlayerLogs(currentMembership.academy.id);
  }, [currentMembership?.academy.id, isCoach]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    if (currentMembership) {
      if (isCoach) await loadCoachData(currentMembership.academy.id);
      else await loadPlayerLogs(currentMembership.academy.id);
    }
    setRefreshing(false);
  };

  // ─── Join Flow ───────────────────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (!joinCode.trim() || joinCode.length < 6) {
      showAlert('Invalid Code', 'Please enter a valid 6-character code.');
      return;
    }
    setJoinCodeLoading(true);
    const upper = joinCode.trim().toUpperCase();
    const supabase = (await import('@/template')).getSupabaseClient();
    const { data: byPlayer } = await supabase.from('academies').select('id, name').eq('player_code', upper).maybeSingle();
    const { data: byCoach } = await supabase.from('academies').select('id, name').eq('coach_code', upper).maybeSingle();
    const academy = byPlayer || byCoach;

    if (!academy) {
      setJoinCodeLoading(false);
      showAlert('Code Not Found', 'This code does not match any academy. Please check and try again.');
      return;
    }

    // Check if user is already a member of this academy
    if (user) {
      const supabaseClient = (await import('@/template')).getSupabaseClient();
      const { data: existingMember } = await supabaseClient
        .from('academy_members')
        .select('id, role')
        .eq('academy_id', academy.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        setJoinCodeLoading(false);
        setShowJoinModal(false);
        resetJoinModal();
        showAlert(
          'Already Joined',
          `You are already a member of ${academy.name}. Pull down to refresh your Academy tab if it is not showing.`
        );
        load();
        return;
      }
    }

    setJoinCodeLoading(false);

    setJoinAcademyName(academy.name);
    const { data: sq } = await academyService.getSquads(academy.id);
    setJoinSquads(sq || []);
    setJoinSquadId(null);
    setJoinStep('details');
  };

  // Step 1: validate locally, then show confirmation modal
  const handleConfirmJoin = () => {
    if (!joinDisplayName.trim()) { showAlert('Error', 'Please enter your name'); return; }
    setShowJoinConfirm(true);
  };

  // Step 2: actually join after confirmation
  const handleJoin = async () => {
    if (!user) return;
    setShowJoinConfirm(false);
    setJoining(true);
    const { data, error } = await academyService.joinAcademy(
      joinCode, user.id, joinDisplayName, joinPosition, joinJersey, undefined, joinSquadId || undefined
    );
    setJoining(false);
    if (error) { showAlert('Error', error); return; }
    setShowJoinModal(false);
    resetJoinModal();
    await load();
    showAlert('Joined!', `You are now part of ${data!.academy.name} as ${data!.role === 'coach' ? 'Coach' : 'Player'}.`);
  };

  const resetJoinModal = () => {
    setJoinStep('code'); setJoinCode(''); setJoinAcademyName('');
    setJoinDisplayName(''); setJoinPosition('Batsman'); setJoinJersey('');
    setJoinSquadId(null); setJoinSquads([]);
    setShowJoinConfirm(false);
  };

  const currentSquad = squads.find(s => s.id === selectedSquadFilter) || null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}><Text style={styles.headerTitle}>Academy Portal</Text></View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

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
            Enter the code provided by your coach or academy administrator to connect with your club.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => setShowJoinModal(true)}>
            <MaterialIcons name="vpn-key" size={20} color={colors.textLight} />
            <Text style={styles.primaryBtnText}>Enter Join Code</Text>
          </Pressable>
          <View style={styles.codeInfoCard}>
            <MaterialIcons name="info-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.codeInfoText}>Your coach will give you a unique 6-character code. Enter it here to join instantly.</Text>
          </View>
        </ScrollView>
        <JoinModal
          visible={showJoinModal} step={joinStep}
          code={joinCode} onCodeChange={c => setJoinCode(c.toUpperCase())}
          academyName={joinAcademyName}
          displayName={joinDisplayName} onDisplayNameChange={setJoinDisplayName}
          position={joinPosition} onPositionChange={setJoinPosition}
          jersey={joinJersey} onJerseyChange={setJoinJersey}
          squads={joinSquads} selectedSquadId={joinSquadId} onSquadChange={setJoinSquadId}
          verifyLoading={joinCodeLoading} joining={joining}
          onVerify={handleVerifyCode} onBack={() => setJoinStep('code')}
          onClose={() => { setShowJoinModal(false); resetJoinModal(); }}
          onSubmit={handleConfirmJoin}
        />
        <JoinConfirmModal
          visible={showJoinConfirm}
          squadName={joinSquads.find(s => s.id === joinSquadId)?.name || null}
          squadColor={joinSquads.find(s => s.id === joinSquadId)?.color || colors.primary}
          position={joinPosition}
          displayName={joinDisplayName}
          academyName={joinAcademyName}
          joining={joining}
          onConfirm={handleJoin}
          onCancel={() => setShowJoinConfirm(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Academy Portal</Text>
          {memberships.length > 1 && <Text style={styles.headerSub}>{memberships.length} academies</Text>}
        </View>
        <View style={styles.headerActions}>
          {currentMembership?.member.role === 'coach' && (
            <Pressable
              style={[styles.previewToggleBtn, previewAsPlayer && styles.previewToggleBtnActive]}
              onPress={() => setPreviewAsPlayer(p => !p)}
              hitSlop={8}
            >
              <MaterialIcons
                name={previewAsPlayer ? 'manage-accounts' : 'person'}
                size={16}
                color={previewAsPlayer ? colors.textLight : colors.textSecondary}
              />
              <Text style={[styles.previewToggleText, previewAsPlayer && styles.previewToggleTextActive]}>
                {previewAsPlayer ? 'Player View' : 'Coach View'}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.joinMoreBtn} onPress={() => setShowJoinModal(true)} hitSlop={8}>
            <MaterialIcons name="vpn-key" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Academy switcher ── */}
      {memberships.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}
          contentContainerStyle={styles.switcherContent}>
          {memberships.map((m, i) => (
            <Pressable key={m.academy.id} style={[styles.switcherChip, selectedIdx === i && styles.switcherChipActive]}
              onPress={() => { setSelectedIdx(i); setSelectedSquadFilter(null); }}>
              <Text style={[styles.switcherText, selectedIdx === i && styles.switcherTextActive]} numberOfLines={1}>
                {m.academy.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Coach Squad Filter Pill Row ── */}
      {isCoach && squads.length > 0 && (
        <View style={styles.squadFilterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.squadFilterContent}>
            <Pressable
              style={[styles.squadPill, !selectedSquadFilter && styles.squadPillAll]}
              onPress={() => setSelectedSquadFilter(null)}
            >
              <MaterialIcons name="people" size={12} color={!selectedSquadFilter ? colors.textLight : colors.textSecondary} />
              <Text style={[styles.squadPillText, !selectedSquadFilter && styles.squadPillTextActive]}>All Academy</Text>
            </Pressable>
            {squads.map(sq => {
              const isActive = selectedSquadFilter === sq.id;
              return (
                <Pressable key={sq.id}
                  style={[styles.squadPill, isActive && { backgroundColor: sq.color, borderColor: sq.color }]}
                  onPress={() => setSelectedSquadFilter(isActive ? null : sq.id)}>
                  <View style={[styles.squadPillDot, { backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : sq.color }]} />
                  <Text style={[styles.squadPillText, isActive && styles.squadPillTextActive]}>{sq.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {/* ── Academy identity strip ── */}
        <View style={styles.academyStrip}>
          <View style={[styles.academyStripIcon, { backgroundColor: (isCoach ? colors.warning : colors.primary) + '20' }]}>
            <MaterialIcons name={isCoach ? 'school' : 'sports-cricket'} size={20} color={isCoach ? colors.warning : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.academyStripName} numberOfLines={1}>{currentMembership!.academy.name}</Text>
            {currentMembership!.academy.description ? (
              <Text style={styles.academyStripDesc} numberOfLines={1}>{currentMembership!.academy.description}</Text>
            ) : null}
            {!isCoach && currentMembership!.member.position ? (
              <Text style={[styles.academyStripSub, { color: getPositionColor(currentMembership!.member.position) }]}>
                {currentMembership!.member.position}
                {currentMembership!.member.jersey_number ? ` · #${currentMembership!.member.jersey_number}` : ''}
              </Text>
            ) : null}
          </View>
          {isCoach && (
            <Pressable style={styles.editAcademyBtn} onPress={() => setShowEditAcademyModal(true)} hitSlop={8}>
              <MaterialIcons name="edit" size={15} color={colors.warning} />
            </Pressable>
          )}
          <View style={[styles.roleChip, { backgroundColor: (isCoach ? colors.warning : colors.primary) + '18' }]}>
            <Text style={[styles.roleChipText, { color: isCoach ? colors.warning : colors.primary }]}>
              {isCoach ? 'Coach' : 'Player'}
            </Text>
          </View>
        </View>

        {/* ══ COACH VIEW ══ */}
        {isCoach && (
          <>
            <SquadOverviewCard members={allMembers} logs={allMemberLogs} squad={currentSquad} squadFilter={selectedSquadFilter} />

            <View style={styles.actionsGrid}>
              <Pressable style={styles.actionCard} onPress={() => router.push({
                pathname: '/academy-coach',
                params: { academyId: currentMembership!.academy.id, ...(selectedSquadFilter ? { squadFilter: selectedSquadFilter } : {}) }
              } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="people" size={28} color={colors.primary} />
                </View>
                <Text style={styles.actionTitle}>Squad View</Text>
                <Text style={styles.actionSub}>{selectedSquadFilter ? `${currentSquad?.name || 'Squad'} roster` : 'All player logs'}</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({
                pathname: '/academy-attendance',
                params: { academyId: currentMembership!.academy.id }
              } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                  <MaterialIcons name="fact-check" size={28} color={colors.success} />
                </View>
                <Text style={styles.actionTitle}>Attendance</Text>
                <Text style={styles.actionSub}>Mark & view</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({
                pathname: '/academy-schedule',
                params: { academyId: currentMembership!.academy.id, isCoach: 'true', ...(selectedSquadFilter ? { defaultSquad: selectedSquadFilter } : {}) }
              } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                  <MaterialIcons name="event-note" size={28} color={colors.warning} />
                </View>
                <Text style={styles.actionTitle}>Sessions</Text>
                <Text style={styles.actionSub}>Plan & manage</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => router.push({
                pathname: '/academy-coach',
                params: { academyId: currentMembership!.academy.id, tab: 'analytics' }
              } as any)}>
                <View style={[styles.actionIcon, { backgroundColor: colors.mental + '20' }]}>
                  <MaterialIcons name="analytics" size={28} color={colors.mental} />
                </View>
                <Text style={styles.actionTitle}>Analytics</Text>
                <Text style={styles.actionSub}>Team performance</Text>
              </Pressable>
            </View>

            <Pressable style={styles.inviteBtn} onPress={() => setShowInviteModal(true)}>
              <View style={styles.inviteBtnIconCircle}>
                <MaterialIcons name="person-add" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteBtnTitle}>Invite Players & Coaches</Text>
                <Text style={styles.inviteBtnSub}>Share codes to grow your squad</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
            </Pressable>

            <Pressable style={[styles.inviteBtn, { marginTop: 0, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/academy-coach', params: { academyId: currentMembership!.academy.id } } as any)}>
              <View style={[styles.inviteBtnIconCircle, { backgroundColor: colors.mental + '15' }]}>
                <MaterialIcons name="dashboard" size={20} color={colors.mental} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteBtnTitle}>Manage Squads</Text>
                <Text style={styles.inviteBtnSub}>Create, rename & assign players</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={[styles.inviteBtn, { marginTop: 0, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/academy-history', params: { academyId: currentMembership!.academy.id, isCoach: 'true' } } as any)}>
              <View style={[styles.inviteBtnIconCircle, { backgroundColor: colors.technical + '15' }]}>
                <MaterialIcons name="history" size={20} color={colors.technical} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteBtnTitle}>Training History</Text>
                <Text style={styles.inviteBtnSub}>All logged academy sessions</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </Pressable>
          </>
        )}

        {/* ══ PLAYER VIEW ══ */}
        {!isCoach && (
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
                    <View style={[styles.intensityBadge, { backgroundColor: (log.intensity >= 7 ? colors.error : log.intensity >= 4 ? colors.warning : colors.success) + '20' }]}>
                      <Text style={[styles.intensityBadgeText, { color: log.intensity >= 7 ? colors.error : log.intensity >= 4 ? colors.warning : colors.success }]}>{log.intensity}/10</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Edit Academy Modal ── */}
      <EditAcademyModal
        visible={showEditAcademyModal}
        academy={currentMembership?.academy || null}
        onClose={() => setShowEditAcademyModal(false)}
        onSaved={load}
      />

      {/* ── Invite Modal ── */}
      <InviteModal
        visible={showInviteModal}
        academy={currentMembership?.academy || null}
        onClose={() => setShowInviteModal(false)}
      />

      {/* ── Join Modal ── */}
      <JoinModal
        visible={showJoinModal} step={joinStep}
        code={joinCode} onCodeChange={c => setJoinCode(c.toUpperCase())}
        academyName={joinAcademyName}
        displayName={joinDisplayName} onDisplayNameChange={setJoinDisplayName}
        position={joinPosition} onPositionChange={setJoinPosition}
        jersey={joinJersey} onJerseyChange={setJoinJersey}
        squads={joinSquads} selectedSquadId={joinSquadId} onSquadChange={setJoinSquadId}
        verifyLoading={joinCodeLoading} joining={joining}
        onVerify={handleVerifyCode} onBack={() => setJoinStep('code')}
        onClose={() => { setShowJoinModal(false); resetJoinModal(); }}
        onSubmit={handleConfirmJoin}
      />

      {/* ── Join Confirmation Modal ── */}
      <JoinConfirmModal
        visible={showJoinConfirm}
        squadName={joinSquads.find(s => s.id === joinSquadId)?.name || null}
        squadColor={joinSquads.find(s => s.id === joinSquadId)?.color || colors.primary}
        position={joinPosition}
        displayName={joinDisplayName}
        academyName={joinAcademyName}
        joining={joining}
        onConfirm={handleJoin}
        onCancel={() => setShowJoinConfirm(false)}
      />
    </SafeAreaView>
  );
}

// ─── 2-Step Join Modal ────────────────────────────────────────────────────────
function JoinModal({
  visible, step, code, onCodeChange, academyName,
  displayName, onDisplayNameChange, position, onPositionChange,
  jersey, onJerseyChange, squads, selectedSquadId, onSquadChange,
  verifyLoading, joining, onVerify, onBack, onClose, onSubmit,
}: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          {step === 'code' && (
            <>
              <View style={modalStyles.header}>
                <Text style={modalStyles.headerTitle}>Join Academy</Text>
                <Pressable onPress={onClose} style={modalStyles.closeBtn}>
                  <MaterialIcons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={modalStyles.content} keyboardShouldPersistTaps="handled">
                <View style={modalStyles.stepIconCircle}>
                  <MaterialIcons name="vpn-key" size={32} color={colors.primary} />
                </View>
                <Text style={modalStyles.stepTitle}>Enter Your Academy Code</Text>
                <Text style={modalStyles.stepSubtitle}>Your coach will give you a 6-character code. Enter it below to get started.</Text>
                <TextInput
                  style={modalStyles.codeInput}
                  value={code} onChangeText={onCodeChange}
                  placeholder="e.g. A1B2C3" placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters" maxLength={6} autoFocus
                />
                <Pressable
                  style={[modalStyles.submitBtn, (verifyLoading || code.length < 6) && { opacity: 0.5 }]}
                  onPress={onVerify} disabled={verifyLoading || code.length < 6}
                >
                  {verifyLoading ? <ActivityIndicator color={colors.textLight} /> : (
                    <>
                      <Text style={modalStyles.submitBtnText}>Verify Code</Text>
                      <MaterialIcons name="arrow-forward" size={18} color={colors.textLight} />
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </>
          )}

          {step === 'details' && (
            <>
              <View style={modalStyles.header}>
                <Pressable onPress={onBack} style={modalStyles.closeBtn}>
                  <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={modalStyles.headerTitle}>Complete Profile</Text>
                <Pressable onPress={onClose} style={modalStyles.closeBtn}>
                  <MaterialIcons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={modalStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={modalStyles.welcomeBanner}>
                  <MaterialIcons name="celebration" size={20} color={colors.primary} />
                  <Text style={modalStyles.welcomeText}>
                    Welcome to <Text style={{ fontWeight: '800', color: colors.primary }}>{academyName}</Text>!
                  </Text>
                </View>

                {squads && squads.length > 0 && (
                  <View style={modalStyles.squadSection}>
                    <Text style={modalStyles.squadSectionTitle}>Which squad are you in?</Text>
                    <View style={modalStyles.squadGrid}>
                      {squads.map((s: any) => {
                        const isSelected = selectedSquadId === s.id;
                        return (
                          <Pressable key={s.id}
                            style={[modalStyles.squadTile, isSelected && { backgroundColor: s.color, borderColor: s.color }]}
                            onPress={() => onSquadChange(isSelected ? null : s.id)}>
                            <View style={[modalStyles.squadTileDot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.6)' : s.color }]} />
                            <Text style={[modalStyles.squadTileText, isSelected && { color: colors.textLight }]}>{s.name}</Text>
                            {isSelected && <MaterialIcons name="check-circle" size={14} color={colors.textLight} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Text style={modalStyles.label}>Your Name</Text>
                <TextInput style={modalStyles.input} value={displayName} onChangeText={onDisplayNameChange}
                  placeholder="e.g. Jamie Smith" placeholderTextColor={colors.textSecondary} />

                <Text style={modalStyles.label}>Position</Text>
                <View style={modalStyles.positionGrid}>
                  {(['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper']).map((p: string) => (
                    <Pressable key={p} style={[modalStyles.chip, position === p && modalStyles.chipActive]} onPress={() => onPositionChange(p)}>
                      <Text style={[modalStyles.chipText, position === p && modalStyles.chipTextActive]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={modalStyles.label}>Jersey Number (Optional)</Text>
                <TextInput style={modalStyles.input} value={jersey} onChangeText={onJerseyChange}
                  placeholder="#7" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" maxLength={3} />

                <Pressable style={[modalStyles.submitBtn, joining && { opacity: 0.6 }]} onPress={onSubmit}>
                  {joining ? <ActivityIndicator color={colors.textLight} /> : (
                    <>
                      <MaterialIcons name="login" size={20} color={colors.textLight} />
                      <Text style={modalStyles.submitBtnText}>Join Academy</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.xs },
  stepIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  stepTitle: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center' },
  stepSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: spacing.xs, marginBottom: spacing.lg },
  codeInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
    borderWidth: 2, borderColor: colors.primary + '40',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md + 4,
    fontSize: 28, fontWeight: '900', color: colors.text,
    letterSpacing: 10, textAlign: 'center', marginBottom: spacing.md,
  },
  welcomeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.primary + '25', marginBottom: spacing.md,
  },
  welcomeText: { ...typography.body, color: colors.text, flex: 1 },
  squadSection: { marginBottom: spacing.md },
  squadSectionTitle: { ...typography.body, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  squadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  squadTile: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full, backgroundColor: colors.background,
    borderWidth: 1.5, borderColor: colors.border,
  },
  squadTileDot: { width: 8, height: 8, borderRadius: 4 },
  squadTileText: { fontSize: 14, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, color: colors.text, fontWeight: '600', marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.text },
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md + 2, borderRadius: borderRadius.md, marginTop: spacing.lg },
  submitBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textSecondary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  joinMoreBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary + '12', borderRadius: 18, borderWidth: 1, borderColor: colors.primary + '30' },
  previewToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  previewToggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  previewToggleText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  previewToggleTextActive: { color: colors.textLight },
  switcherScroll: { maxHeight: 48, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  switcherContent: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  switcherChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  switcherChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  switcherText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  switcherTextActive: { color: colors.textLight },
  squadFilterWrapper: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  squadFilterContent: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: spacing.sm, alignItems: 'center' },
  squadPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm + 2, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  squadPillAll: { backgroundColor: colors.primary, borderColor: colors.primary },
  squadPillDot: { width: 7, height: 7, borderRadius: 3.5 },
  squadPillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  squadPillTextActive: { color: colors.textLight },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80, gap: spacing.sm },
  academyStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  academyStripIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  academyStripName: { ...typography.body, color: colors.text, fontWeight: '700' },
  academyStripDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  academyStripSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  editAcademyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.warning + '15', justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  roleChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  roleChipText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', textAlign: 'center' },
  actionSub: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.primary + '40', padding: spacing.md },
  inviteBtnIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  inviteBtnTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
  inviteBtnSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  weekSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  weekStat: { flex: 1, alignItems: 'center' },
  weekStatVal: { ...typography.h4, color: colors.text, fontWeight: '800' },
  weekStatLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  logMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  logStats: { fontSize: 11, color: colors.primary, marginTop: 1, fontWeight: '600' },
  intensityBadge: { paddingHorizontal: spacing.xs + 2, paddingVertical: 3, borderRadius: borderRadius.sm },
  intensityBadgeText: { fontSize: 11, fontWeight: '800' },
  emptyContainer: { flexGrow: 1, alignItems: 'center', padding: spacing.xl, gap: spacing.md, paddingTop: 60 },
  emptyIconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { ...typography.h2, color: colors.text, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md, width: '100%', justifyContent: 'center' },
  primaryBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
  codeInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  codeInfoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },
});
