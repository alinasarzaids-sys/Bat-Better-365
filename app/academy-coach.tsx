import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { academyService, AcademyMember, AcademyTrainingLog, AcademySquad } from '@/services/academyService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

function getPositionColor(position: string): string {
  switch (position) {
    case 'Batsman': return colors.technical;
    case 'Bowler': return colors.physical;
    case 'All-Rounder': return colors.primary;
    case 'Wicket-Keeper': return colors.mental;
    case 'Fielder': return colors.tactical;
    default: return colors.textSecondary;
  }
}

function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return colors.success;
  if (intensity <= 6) return colors.warning;
  return colors.error;
}

function MiniHeatmap({ logs }: { logs: AcademyTrainingLog[] }) {
  const days = 7;
  const today = new Date();
  const intensityByDay: number[] = Array(days).fill(0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const dStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.log_date === dStr);
    if (dayLogs.length > 0) {
      intensityByDay[i] = Math.round(dayLogs.reduce((a, l) => a + l.intensity, 0) / dayLogs.length);
    }
  }
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {intensityByDay.map((v, i) => (
        <View key={i} style={{
          width: 14, height: 14, borderRadius: 3,
          backgroundColor: v > 0 ? getIntensityColor(v) : colors.border,
          opacity: v > 0 ? 0.6 + (v / 10) * 0.4 : 1,
        }} />
      ))}
    </View>
  );
}

export default function AcademyCoachScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const academyId = params.academyId as string;
  const initialTab = params.tab as string || 'squad';

  const [activeTab, setActiveTab] = useState<'squad' | 'analytics'>(initialTab as any || 'squad');
  const [members, setMembers] = useState<AcademyMember[]>([]);
  const [allLogs, setAllLogs] = useState<Array<AcademyTrainingLog & { user_profiles: any }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<AcademyMember | null>(null);
  const [playerLogs, setPlayerLogs] = useState<AcademyTrainingLog[]>([]);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<AcademyMember | null>(null);
  // Squad state
  const [squads, setSquads] = useState<AcademySquad[]>([]);
  const [selectedSquadFilter, setSelectedSquadFilter] = useState<string | null>(null);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [squadModalName, setSquadModalName] = useState('');
  const [squadModalColor, setSquadModalColor] = useState('#2196F3');
  const [creatingSquad, setCreatingSquad] = useState(false);
  const [assigningMember, setAssigningMember] = useState<AcademyMember | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const load = useCallback(async () => {
    const [membersRes, logsRes, squadsRes] = await Promise.all([
      academyService.getAcademyMembers(academyId),
      academyService.getAcademyLogs(academyId, 30),
      academyService.getSquads(academyId),
    ]);
    setMembers(membersRes.data || []);
    setAllLogs(logsRes.data || []);
    setSquads(squadsRes.data || []);
    setLoading(false);
  }, [academyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleToggleActive = async (member: AcademyMember) => {
    const name = member.display_name || 'this player';
    const isActive = member.is_active !== false;

    if (isActive) {
      setDeactivateTarget(member);
      setShowDeactivateModal(true);
    } else {
      // Check 30-day reactivation lock
      const lockUntil = academyService.cannotReactivateUntil(member);
      if (lockUntil) {
        const daysLeft = Math.ceil((lockUntil.getTime() - Date.now()) / 86400000);
        showAlert(
          'Reactivation Locked',
          `${name} was deactivated less than 30 days ago. Reactivation unlocks in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${lockUntil.toLocaleDateString()}).`,
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }
      showAlert('Reactivate Player?', `Adding ${name} back to your active roster. They will be billed again from next month.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setTogglingId(member.id);
            const { error } = await academyService.setPlayerActive(member.id, true);
            setTogglingId(null);
            if (error) { showAlert('Error', error); return; }
            await load();
            showAlert('Reactivated', `${name} is back on the active roster and will be billed from next month.`);
          },
        },
      ]);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    const name = deactivateTarget.display_name || 'this player';
    setShowDeactivateModal(false);
    setTogglingId(deactivateTarget.id);
    const { error } = await academyService.setPlayerActive(deactivateTarget.id, false);
    setTogglingId(null);
    setDeactivateTarget(null);
    if (error) { showAlert('Error', error); return; }
    await load();
    showAlert('Player Deactivated', `${name} is removed from the active roster and excluded from future billing.`);
  };

  const handleViewPlayer = async (member: AcademyMember) => {
    setSelectedPlayer(member);
    setAiReport('');
    const logs = allLogs.filter(l => l.user_id === member.user_id);
    setPlayerLogs(logs);
    setShowPlayerModal(true);
  };

  const handleGenerateAI = async () => {
    if (!selectedPlayer || playerLogs.length === 0) return;
    setAiLoading(true);
    const name = selectedPlayer.display_name || selectedPlayer.user_profiles?.username || 'Player';
    const { data, error } = await academyService.getAIAnalytics(playerLogs, name, selectedPlayer.position);
    setAiLoading(false);
    if (error) { showAlert('Error', error); return; }
    setAiReport(data || '');
  };

  // Squad helpers
  const allActivePlayers = members.filter(m => m.role === 'player' && m.is_active !== false);
  const activePlayers = selectedSquadFilter
    ? allActivePlayers.filter(m => (m as any).squad_id === selectedSquadFilter)
    : allActivePlayers;
  // Split active vs inactive
  const inactivePlayers = members.filter(m => m.role === 'player' && m.is_active === false);
  const coaches = members.filter(m => m.role === 'coach');

  const handleCreateSquad = async () => {
    if (!squadModalName.trim()) return;
    setCreatingSquad(true);
    const { error } = await academyService.createSquad(academyId, squadModalName, squadModalColor);
    setCreatingSquad(false);
    if (error) { showAlert('Error', error); return; }
    setShowSquadModal(false);
    setSquadModalName('');
    setSquadModalColor('#2196F3');
    await load();
  };

  const handleAssignSquad = async (squadId: string | null) => {
    if (!assigningMember) return;
    const { error } = await academyService.assignPlayerToSquad(assigningMember.id, squadId);
    if (error) { showAlert('Error', error); return; }
    setShowAssignModal(false);
    setAssigningMember(null);
    await load();
  };

  // Team analytics aggregation (all logs regardless of active status)
  const totalSessions = allLogs.length;
  const totalMinutes = allLogs.reduce((a, l) => a + l.duration_minutes, 0);
  const avgIntensity = allLogs.length > 0
    ? (allLogs.reduce((a, l) => a + l.intensity, 0) / allLogs.length).toFixed(1) : '—';
  const totalBallsFaced = allLogs.reduce((a, l) => a + (l.balls_faced || 0), 0);
  const totalBallsBowled = allLogs.reduce((a, l) => a + (l.balls_bowled || 0), 0);

  // Sessions per active player (use allActivePlayers for analytics)
  const sessionCounts = allActivePlayers.map(m => ({
    member: m,
    count: allLogs.filter(l => l.user_id === m.user_id).length,
    avgIntensity: (() => {
      const logs = allLogs.filter(l => l.user_id === m.user_id);
      if (!logs.length) return 0;
      return logs.reduce((a, l) => a + l.intensity, 0) / logs.length;
    })(),
    lastLog: allLogs.filter(l => l.user_id === m.user_id)[0] || null,
  })).sort((a, b) => b.count - a.count);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Coach Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Coach Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {(['squad', 'analytics'] as const).map(tab => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <MaterialIcons name={tab === 'squad' ? 'people' : 'analytics'} size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'squad' ? 'Squad' : 'Team Analytics'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Squad filter bar */}
      {activeTab === 'squad' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 52, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
          contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, alignItems: 'center' }}>
          <Pressable
            style={[squadFilterStyles.chip, !selectedSquadFilter && squadFilterStyles.chipAll]}
            onPress={() => setSelectedSquadFilter(null)}
          >
            <Text style={[squadFilterStyles.chipText, !selectedSquadFilter && squadFilterStyles.chipTextActive]}>
              All ({allActivePlayers.length})
            </Text>
          </Pressable>
          {squads.map(sq => (
            <Pressable
              key={sq.id}
              style={[squadFilterStyles.chip, selectedSquadFilter === sq.id && { backgroundColor: sq.color, borderColor: sq.color }]}
              onPress={() => setSelectedSquadFilter(selectedSquadFilter === sq.id ? null : sq.id)}
            >
              <View style={[squadFilterStyles.dot, { backgroundColor: selectedSquadFilter === sq.id ? 'rgba(255,255,255,0.7)' : sq.color }]} />
              <Text style={[squadFilterStyles.chipText, selectedSquadFilter === sq.id && squadFilterStyles.chipTextActive]}>
                {sq.name} ({allActivePlayers.filter(m => (m as any).squad_id === sq.id).length})
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[squadFilterStyles.chip, { borderStyle: 'dashed', borderColor: colors.primary + '60' }]}
            onPress={() => setShowSquadModal(true)}
          >
            <MaterialIcons name="add" size={12} color={colors.primary} />
            <Text style={[squadFilterStyles.chipText, { color: colors.primary }]}>New</Text>
          </Pressable>
        </ScrollView>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {activeTab === 'squad' && (
          <>
            {/* Billing banner */}
            <View style={styles.billingBanner}>
              <MaterialIcons name="receipt" size={14} color={colors.primary} />
              <Text style={styles.billingText}>
                <Text style={{ fontWeight: '800' }}>{activePlayers.length} Active</Text> players billed
                {inactivePlayers.length > 0 ? ` · ${inactivePlayers.length} deactivated (not billed)` : ''}
              </Text>
              <View />
            </View>

            {/* Quick stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{activePlayers.length}</Text>
                <Text style={styles.statLabel}>Active{'\n'}Players</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{totalSessions}</Text>
                <Text style={styles.statLabel}>Logs{'\n'}(30d)</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statVal, { color: parseFloat(avgIntensity as string) >= 7 ? colors.error : colors.warning }]}>{avgIntensity}</Text>
                <Text style={styles.statLabel}>Avg{'\n'}Intensity</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{Math.round(totalMinutes / 60)}h</Text>
                <Text style={styles.statLabel}>Total{'\n'}Hours</Text>
              </View>
            </View>

            {/* Active Player List */}
            <Text style={styles.sectionLabel}>
              {selectedSquadFilter
                ? `${squads.find(s => s.id === selectedSquadFilter)?.name || 'Squad'} — ${activePlayers.length} player(s) · tap to view`
                : `Active Players (${allActivePlayers.length}) — tap to view · press ✕ to deactivate`}
            </Text>
            {sessionCounts.map(({ member, count, avgIntensity: ai, lastLog }) => {
              const name = member.display_name || member.user_profiles?.username || member.user_profiles?.email || 'Player';
              const daysSinceLast = lastLog
                ? Math.floor((Date.now() - new Date(lastLog.log_date).getTime()) / 86400000) : null;
              const isToggling = togglingId === member.id;
              return (
                <Pressable key={member.id} style={styles.playerCard} onPress={() => handleViewPlayer(member)}>
                  <View style={styles.playerTop}>
                    <View style={[styles.positionDot, { backgroundColor: getPositionColor(member.position) }]}>
                      <Text style={styles.positionDotText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.playerNameRow}>
                        <Text style={styles.playerName}>{name}</Text>
                        {member.jersey_number ? <Text style={styles.jerseyBadge}>#{member.jersey_number}</Text> : null}
                        {(member as any).academy_squads && (
                          <View style={[squadFilterStyles.squadBadge, { backgroundColor: ((member as any).academy_squads?.color || colors.primary) + '20' }]}>
                            <Text style={[squadFilterStyles.squadBadgeText, { color: (member as any).academy_squads?.color || colors.primary }]}>
                              {(member as any).academy_squads?.name}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.playerPosition, { color: getPositionColor(member.position) }]}>{member.position}</Text>
                    </View>
                    <View style={styles.playerStats}>
                      <Text style={styles.playerSessionCount}>{count}</Text>
                      <Text style={styles.playerSessionLabel}>sessions</Text>
                    </View>
                    <Pressable
                      style={[styles.deactivateBtn, { backgroundColor: colors.mental + '12', marginRight: 3 }]}
                      onPress={() => { setAssigningMember(member); setShowAssignModal(true); }}
                      hitSlop={8}
                    >
                      <MaterialIcons name="swap-horiz" size={16} color={colors.mental} />
                    </Pressable>
                    <Pressable
                      style={styles.deactivateBtn}
                      onPress={() => handleToggleActive(member)}
                      hitSlop={8}
                    >
                      {isToggling
                        ? <ActivityIndicator size={14} color={colors.error} />
                        : <MaterialIcons name="person-off" size={18} color={colors.error} />}
                    </Pressable>
                  </View>
                  <View style={styles.playerBottom}>
                    <MiniHeatmap logs={allLogs.filter(l => l.user_id === member.user_id)} />
                    <View style={{ flex: 1 }} />
                    {daysSinceLast !== null ? (
                      <Text style={[styles.lastSeen, daysSinceLast > 7 ? { color: colors.error } : {}]}>
                        {daysSinceLast === 0 ? 'Today' : daysSinceLast === 1 ? 'Yesterday' : `${daysSinceLast}d ago`}
                      </Text>
                    ) : (
                      <Text style={[styles.lastSeen, { color: colors.error }]}>No logs</Text>
                    )}
                    {ai > 0 && (
                      <View style={[styles.intensityPill, { backgroundColor: getIntensityColor(Math.round(ai)) + '25' }]}>
                        <Text style={[styles.intensityPillText, { color: getIntensityColor(Math.round(ai)) }]}>
                          Avg {ai.toFixed(1)}/10
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

            {activePlayers.length === 0 && inactivePlayers.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="people-outline" size={48} color={colors.border} />
                <Text style={styles.emptyText}>No players yet. Share the player code!</Text>
              </View>
            )}

            {/* Deactivated Players Collapsible */}
            {inactivePlayers.length > 0 && (
              <>
                <Pressable
                  style={styles.inactiveToggleBtn}
                  onPress={() => setShowInactive(s => !s)}
                >
                  <MaterialIcons name="person-off" size={14} color={colors.textSecondary} />
                  <Text style={styles.inactiveToggleText}>
                    {inactivePlayers.length} Deactivated player{inactivePlayers.length > 1 ? 's' : ''} · not billed
                  </Text>
                  <MaterialIcons name={showInactive ? 'expand-less' : 'expand-more'} size={16} color={colors.textSecondary} />
                </Pressable>
                {showInactive && inactivePlayers.map(member => {
                  const name = member.display_name || member.user_profiles?.username || member.user_profiles?.email || 'Player';
                  const isToggling = togglingId === member.id;
                  return (
                    <View key={member.id} style={[styles.playerCard, styles.playerCardInactive]}>
                      <View style={styles.playerTop}>
                        <View style={[styles.positionDot, { backgroundColor: colors.border }]}>
                          <Text style={[styles.positionDotText, { color: colors.textSecondary }]}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.playerNameRow}>
                            <Text style={[styles.playerName, { color: colors.textSecondary }]}>{name}</Text>
                            <View style={styles.inactiveBadge}>
                              <Text style={styles.inactiveBadgeText}>INACTIVE · NOT BILLED</Text>
                            </View>
                          </View>
                          <Text style={[styles.playerPosition, { color: colors.border }]}>{member.position}</Text>
                        </View>
                        <Pressable
                          style={[styles.deactivateBtn, { backgroundColor: colors.success + '15' }]}
                          onPress={() => handleToggleActive(member)}
                          hitSlop={8}
                        >
                          {isToggling
                            ? <ActivityIndicator size={14} color={colors.success} />
                            : <MaterialIcons name="person-add" size={18} color={colors.success} />}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {coaches.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Coaching Staff</Text>
                {coaches.map(c => {
                  const name = c.display_name || c.user_profiles?.username || c.user_profiles?.email || 'Coach';
                  return (
                    <View key={c.id} style={[styles.playerCard, { opacity: 0.85 }]}>
                      <View style={styles.playerTop}>
                        <View style={[styles.positionDot, { backgroundColor: colors.warning }]}>
                          <Text style={styles.positionDotText}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.playerName}>{name}</Text>
                          <Text style={[styles.playerPosition, { color: colors.warning }]}>Coach</Text>
                        </View>
                        <MaterialIcons name="school" size={20} color={colors.warning} />
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {activeTab === 'analytics' && (() => {
          // ── Aggregate cricket stats across all active players ──
          const totalSuccessfulBat = allLogs.reduce((a, l) => a + (l.runs_scored || 0), 0);
          const totalSuccessfulBowl = allLogs.reduce((a, l) => a + (l.wickets || 0), 0);
          const totalCatches = allLogs.reduce((a, l) => a + (l.catches || 0), 0);
          const totalRunOuts = allLogs.reduce((a, l) => a + (l.run_outs || 0), 0);
          const totalStumpings = allLogs.reduce((a, l) => a + (l.stumpings || 0), 0);
          const totalFieldingChances = allLogs.reduce((a, l) => a + (l.catches || 0) + (l.run_outs || 0) + (l.stumpings || 0), 0);
          const battingPct = totalBallsFaced > 0 ? Math.round((totalSuccessfulBat / totalBallsFaced) * 100) : 0;
          const bowlingPct = totalBallsBowled > 0 ? Math.round((totalSuccessfulBowl / totalBallsBowled) * 100) : 0;
          const fieldingPct = totalFieldingChances > 0 ? Math.round((totalCatches / totalFieldingChances) * 100) : 0;

          // Per-player batting stats
          const battingStats = allActivePlayers.map(m => {
            const logs = allLogs.filter(l => l.user_id === m.user_id);
            const faced = logs.reduce((a, l) => a + (l.balls_faced || 0), 0);
            const successful = logs.reduce((a, l) => a + (l.runs_scored || 0), 0);
            return { member: m, faced, successful };
          }).filter(s => s.faced > 0).sort((a, b) => b.faced - a.faced);

          // Per-player bowling stats
          const bowlingStats = allActivePlayers.map(m => {
            const logs = allLogs.filter(l => l.user_id === m.user_id);
            const bowled = logs.reduce((a, l) => a + (l.balls_bowled || 0), 0);
            const successfulBowl = logs.reduce((a, l) => a + (l.wickets || 0), 0);
            return { member: m, bowled, successfulBowl };
          }).filter(s => s.bowled > 0).sort((a, b) => b.bowled - a.bowled);

          // Per-player fielding stats
          const fieldingStats = allActivePlayers.map(m => {
            const logs = allLogs.filter(l => l.user_id === m.user_id);
            const catches = logs.reduce((a, l) => a + (l.catches || 0), 0);
            const runOuts = logs.reduce((a, l) => a + (l.run_outs || 0), 0);
            const stumpings = logs.reduce((a, l) => a + (l.stumpings || 0), 0);
            const chances = catches + runOuts + stumpings;
            return { member: m, catches, chances };
          }).filter(s => s.chances > 0).sort((a, b) => b.chances - a.chances);

          const maxBatFaced = Math.max(...battingStats.map(s => s.faced), 1);
          const maxBowled = Math.max(...bowlingStats.map(s => s.bowled), 1);
          const maxFieldingChances = Math.max(...fieldingStats.map(s => s.chances), 1);
          const maxSessions = Math.max(...sessionCounts.map(s => s.count), 1);

          return (
            <>
              {/* ── Team Overview ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Team Overview (Last 30 Days)</Text>
                <View style={styles.analyticsGrid}>
                  <View style={styles.analyticsItem}>
                    <MaterialIcons name="event" size={22} color={colors.primary} />
                    <Text style={styles.analyticsVal}>{totalSessions}</Text>
                    <Text style={styles.analyticsLabel}>Total Logs</Text>
                  </View>
                  <View style={styles.analyticsItem}>
                    <MaterialIcons name="timer" size={22} color={colors.mental} />
                    <Text style={styles.analyticsVal}>{Math.round(totalMinutes / 60)}h</Text>
                    <Text style={styles.analyticsLabel}>Training Time</Text>
                  </View>
                  <View style={styles.analyticsItem}>
                    <MaterialIcons name="sports-cricket" size={22} color={colors.technical} />
                    <Text style={styles.analyticsVal}>{battingPct}%</Text>
                    <Text style={styles.analyticsLabel}>{"Batting\nSuccess Rate"}</Text>
                  </View>
                  <View style={styles.analyticsItem}>
                    <MaterialIcons name="sports-cricket" size={22} color={colors.physical} />
                    <Text style={styles.analyticsVal}>{bowlingPct}%</Text>
                    <Text style={styles.analyticsLabel}>{"Bowling\nSuccess Rate"}</Text>
                  </View>
                  <View style={styles.analyticsItem}>
                    <MaterialIcons name="pan-tool" size={22} color={colors.success} />
                    <Text style={styles.analyticsVal}>{fieldingPct}%</Text>
                    <Text style={styles.analyticsLabel}>{"Fielding\nSuccess Rate"}</Text>
                  </View>
                </View>
              </View>

              {/* ── Training Volume ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Training Volume by Player</Text>
                <Text style={styles.cardSub}>Sessions logged in last 30 days</Text>
                {sessionCounts.map(({ member, count }) => {
                  const name = member.display_name || member.user_profiles?.username || 'Player';
                  return (
                    <View key={member.id} style={styles.barRow}>
                      <Text style={styles.barLabel} numberOfLines={1}>{name}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(count / maxSessions) * 100}%`, backgroundColor: getPositionColor(member.position) }]} />
                      </View>
                      <Text style={[styles.barVal, { color: getPositionColor(member.position) }]}>{count}</Text>
                    </View>
                  );
                })}
                {sessionCounts.length === 0 && <Text style={styles.emptyChartText}>No sessions logged yet</Text>}
              </View>

              {/* ── Batting: Balls Faced vs Successful ── */}
              <View style={styles.card}>
                <View style={analyticsStyles.sectionHeader}>
                  <View style={[analyticsStyles.pillIcon, { backgroundColor: colors.technical + '20' }]}>
                    <MaterialIcons name="sports-cricket" size={16} color={colors.technical} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Batting Performance</Text>
                    <Text style={styles.cardSub}>Balls faced / successfully hit</Text>
                  </View>
                </View>
                <View style={analyticsStyles.legendRow}>
                  <View style={analyticsStyles.legendItem}>
                    <View style={[analyticsStyles.legendDot, { backgroundColor: colors.technical + '40' }]} />
                    <Text style={analyticsStyles.legendText}>Balls Faced</Text>
                  </View>
                  <View style={analyticsStyles.legendItem}>
                    <View style={[analyticsStyles.legendDot, { backgroundColor: colors.technical }]} />
                    <Text style={analyticsStyles.legendText}>Successfully Hit</Text>
                  </View>
                </View>
                {battingStats.map(({ member, faced, successful }) => {
                  const name = member.display_name || member.user_profiles?.username || 'Player';
                  const successWidth = faced > 0 ? Math.min((successful / faced) * 100, 100) : 0;
                  return (
                    <View key={member.id} style={analyticsStyles.cricketBarRow}>
                      <View style={analyticsStyles.cricketBarHeader}>
                        <Text style={analyticsStyles.cricketBarName} numberOfLines={1}>{name}</Text>
                        <Text style={[analyticsStyles.cricketBarRate, { color: colors.technical }]}>
                          {faced} / {successful}
                        </Text>
                      </View>
                      <View style={analyticsStyles.stackedTrack}>
                        <View style={[analyticsStyles.stackedBase, {
                          width: `${(faced / maxBatFaced) * 100}%`,
                          backgroundColor: colors.technical + '30',
                        }]}>
                          <View style={[analyticsStyles.stackedFill, {
                            width: `${successWidth}%`,
                            backgroundColor: colors.technical,
                          }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
                {battingStats.length === 0 && <Text style={styles.emptyChartText}>No batting data logged yet</Text>}
              </View>

              {/* ── Bowling: Balls Bowled vs Successful ── */}
              <View style={styles.card}>
                <View style={analyticsStyles.sectionHeader}>
                  <View style={[analyticsStyles.pillIcon, { backgroundColor: colors.physical + '20' }]}>
                    <MaterialIcons name="sports-cricket" size={16} color={colors.physical} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Bowling Performance</Text>
                    <Text style={styles.cardSub}>Balls bowled / successfully bowled</Text>
                  </View>
                </View>
                <View style={analyticsStyles.legendRow}>
                  <View style={analyticsStyles.legendItem}>
                    <View style={[analyticsStyles.legendDot, { backgroundColor: colors.physical + '40' }]} />
                    <Text style={analyticsStyles.legendText}>Balls Bowled</Text>
                  </View>
                  <View style={analyticsStyles.legendItem}>
                    <View style={[analyticsStyles.legendDot, { backgroundColor: colors.physical }]} />
                    <Text style={analyticsStyles.legendText}>Successful</Text>
                  </View>
                </View>
                {bowlingStats.map(({ member, bowled, successfulBowl }) => {
                  const name = member.display_name || member.user_profiles?.username || 'Player';
                  const successWidth = bowled > 0 ? Math.min((successfulBowl / bowled) * 100, 100) : 0;
                  return (
                    <View key={member.id} style={analyticsStyles.cricketBarRow}>
                      <View style={analyticsStyles.cricketBarHeader}>
                        <Text style={analyticsStyles.cricketBarName} numberOfLines={1}>{name}</Text>
                        <Text style={[analyticsStyles.cricketBarRate, { color: colors.physical }]}>
                          {bowled} / {successfulBowl}
                        </Text>
                      </View>
                      <View style={analyticsStyles.stackedTrack}>
                        <View style={[analyticsStyles.stackedBase, {
                          width: `${(bowled / maxBowled) * 100}%`,
                          backgroundColor: colors.physical + '30',
                        }]}>
                          <View style={[analyticsStyles.stackedFill, {
                            width: `${successWidth}%`,
                            backgroundColor: colors.physical,
                          }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
                {bowlingStats.length === 0 && <Text style={styles.emptyChartText}>No bowling data logged yet</Text>}
              </View>

              {/* ── Fielding: Chances vs Catches ── */}
              <View style={styles.card}>
                <View style={analyticsStyles.sectionHeader}>
                  <View style={[analyticsStyles.pillIcon, { backgroundColor: colors.success + '20' }]}>
                    <MaterialIcons name="pan-tool" size={16} color={colors.success} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Fielding Performance</Text>
                    <Text style={styles.cardSub}>Chances / catches taken</Text>
                  </View>
                </View>
                <View style={analyticsStyles.legendRow}>
                  <View style={analyticsStyles.legendItem}>
                    <View style={[analyticsStyles.legendDot, { backgroundColor: colors.success + '40' }]} />
                    <Text style={analyticsStyles.legendText}>Chances</Text>
                  </View>
                  <View style={analyticsStyles.legendItem}>
                    <View style={[analyticsStyles.legendDot, { backgroundColor: colors.success }]} />
                    <Text style={analyticsStyles.legendText}>Catches Taken</Text>
                  </View>
                </View>
                {fieldingStats.map(({ member, catches, chances }) => {
                  const name = member.display_name || member.user_profiles?.username || 'Player';
                  const catchWidth = chances > 0 ? Math.min((catches / chances) * 100, 100) : 0;
                  return (
                    <View key={member.id} style={analyticsStyles.cricketBarRow}>
                      <View style={analyticsStyles.cricketBarHeader}>
                        <Text style={analyticsStyles.cricketBarName} numberOfLines={1}>{name}</Text>
                        <Text style={[analyticsStyles.cricketBarRate, { color: colors.success }]}>
                          {chances} / {catches}
                        </Text>
                      </View>
                      <View style={analyticsStyles.stackedTrack}>
                        <View style={[analyticsStyles.stackedBase, {
                          width: `${(chances / maxFieldingChances) * 100}%`,
                          backgroundColor: colors.success + '30',
                        }]}>
                          <View style={[analyticsStyles.stackedFill, {
                            width: `${catchWidth}%`,
                            backgroundColor: colors.success,
                          }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
                {fieldingStats.length === 0 && <Text style={styles.emptyChartText}>No fielding data logged yet</Text>}
              </View>

              {/* ── Avg Intensity ── */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Average Training Intensity</Text>
                <Text style={styles.cardSub}>Self-reported, scale 1–10</Text>
                {sessionCounts.filter(s => s.count > 0).map(({ member, avgIntensity: ai }) => {
                  const name = member.display_name || member.user_profiles?.username || 'Player';
                  return (
                    <View key={member.id} style={styles.barRow}>
                      <Text style={styles.barLabel} numberOfLines={1}>{name}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${(ai / 10) * 100}%`, backgroundColor: getIntensityColor(Math.round(ai)) }]} />
                      </View>
                      <Text style={[styles.barVal, { color: getIntensityColor(Math.round(ai)) }]}>{ai.toFixed(1)}</Text>
                    </View>
                  );
                })}
                {sessionCounts.filter(s => s.count > 0).length === 0 && <Text style={styles.emptyChartText}>No data yet</Text>}
              </View>
            </>
          );
        })()}
      </ScrollView>

      {/* Squad Create Modal */}
      <Modal visible={showSquadModal} transparent animationType="fade" onRequestClose={() => setShowSquadModal(false)}>
        <View style={deactivateModalStyles.overlay}>
          <View style={deactivateModalStyles.card}>
            <Text style={[deactivateModalStyles.title, { fontSize: 17 }]}>Create Squad</Text>
            <Text style={deactivateModalStyles.playerNameSub}>Organise players into groups (e.g. U14, U16, Seniors)</Text>
            <TextInput
              style={[squadFilterStyles.squadInput, { marginTop: spacing.sm }]}
              placeholder="Squad name e.g. Under 16s"
              placeholderTextColor={colors.textSecondary}
              value={squadModalName}
              onChangeText={setSquadModalName}
              autoFocus
            />
            <Text style={[deactivateModalStyles.playerNameSub, { textAlign: 'left', marginTop: spacing.sm }]}>Colour</Text>
            <View style={squadFilterStyles.colorRow}>
              {['#2196F3','#4CAF50','#FF9800','#9C27B0','#F44336','#00BCD4','#FF5722','#607D8B'].map(c => (
                <Pressable
                  key={c}
                  style={[squadFilterStyles.colorDot, { backgroundColor: c }, squadModalColor === c && squadFilterStyles.colorDotSelected]}
                  onPress={() => setSquadModalColor(c)}
                />
              ))}
            </View>
            <View style={deactivateModalStyles.btnRow}>
              <Pressable style={deactivateModalStyles.cancelBtn} onPress={() => setShowSquadModal(false)}>
                <Text style={deactivateModalStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[deactivateModalStyles.confirmBtn, { backgroundColor: squadModalColor }, creatingSquad && { opacity: 0.6 }]}
                onPress={handleCreateSquad}
              >
                {creatingSquad
                  ? <ActivityIndicator color={colors.textLight} size="small" />
                  : <Text style={deactivateModalStyles.confirmBtnText}>Create Squad</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Squad Modal */}
      <Modal visible={showAssignModal} transparent animationType="fade" onRequestClose={() => setShowAssignModal(false)}>
        <View style={deactivateModalStyles.overlay}>
          <View style={deactivateModalStyles.card}>
            <Text style={[deactivateModalStyles.title, { fontSize: 17 }]}>Move to Squad</Text>
            <Text style={deactivateModalStyles.playerNameSub}>{assigningMember?.display_name || 'Player'}</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable
                style={[squadFilterStyles.assignOption, !(assigningMember as any)?.squad_id && { borderColor: colors.textSecondary, backgroundColor: colors.textSecondary + '10' }]}
                onPress={() => handleAssignSquad(null)}
              >
                <MaterialIcons name="people" size={16} color={colors.textSecondary} />
                <Text style={[squadFilterStyles.assignOptionText, { color: colors.textSecondary }]}>No Squad (General)</Text>
                {!(assigningMember as any)?.squad_id && <MaterialIcons name="check" size={15} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />}
              </Pressable>
              {squads.map(sq => (
                <Pressable
                  key={sq.id}
                  style={[squadFilterStyles.assignOption, (assigningMember as any)?.squad_id === sq.id && { borderColor: sq.color, backgroundColor: sq.color + '12' }]}
                  onPress={() => handleAssignSquad(sq.id)}
                >
                  <View style={[squadFilterStyles.dot, { backgroundColor: sq.color, width: 14, height: 14, borderRadius: 7 }]} />
                  <Text style={[squadFilterStyles.assignOptionText, { color: sq.color }]}>{sq.name}</Text>
                  {(assigningMember as any)?.squad_id === sq.id && <MaterialIcons name="check" size={15} color={sq.color} style={{ marginLeft: 'auto' }} />}
                </Pressable>
              ))}
              {squads.length === 0 && (
                <Pressable
                  style={[squadFilterStyles.assignOption, { borderStyle: 'dashed', borderColor: colors.primary + '50' }]}
                  onPress={() => { setShowAssignModal(false); setShowSquadModal(true); }}
                >
                  <MaterialIcons name="add" size={15} color={colors.primary} />
                  <Text style={[squadFilterStyles.assignOptionText, { color: colors.primary }]}>Create a squad first</Text>
                </Pressable>
              )}
            </View>
            <Pressable style={[deactivateModalStyles.cancelBtn, { marginTop: spacing.md }]} onPress={() => { setShowAssignModal(false); setAssigningMember(null); }}>
              <Text style={deactivateModalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Deactivation Warning Modal */}
      <Modal visible={showDeactivateModal} animationType="fade" transparent onRequestClose={() => setShowDeactivateModal(false)}>
        <View style={deactivateModalStyles.overlay}>
          <View style={deactivateModalStyles.card}>
            <View style={deactivateModalStyles.iconRow}>
              <View style={deactivateModalStyles.iconCircle}>
                <MaterialIcons name="person-off" size={28} color={colors.error} />
              </View>
            </View>
            <Text style={deactivateModalStyles.title}>Deactivate Player?</Text>
            <Text style={deactivateModalStyles.playerNameSub}>{deactivateTarget?.display_name || 'This player'}</Text>

            <View style={deactivateModalStyles.warningBlock}>
              <View style={deactivateModalStyles.warningRow}>
                <MaterialIcons name="history" size={15} color={colors.error} />
                <Text style={deactivateModalStyles.warningTitle}>Data Access Lost</Text>
              </View>
              <Text style={deactivateModalStyles.warningBody}>
                You will immediately lose access to this player{'"'}s training logs, journal entries, and AI Coach history.
              </Text>
            </View>

            <View style={[deactivateModalStyles.warningBlock, { borderColor: colors.warning + '50', backgroundColor: colors.warning + '08' }]}>
              <View style={deactivateModalStyles.warningRow}>
                <MaterialIcons name="receipt" size={15} color={colors.warning} />
                <Text style={[deactivateModalStyles.warningTitle, { color: colors.warning }]}>Billing Impact</Text>
              </View>
              <Text style={deactivateModalStyles.warningBody}>
                If this player was active at any point this month, they remain on the current invoice. This is fair — you provided the service. They are removed from all future billing cycles.
              </Text>
            </View>

            <View style={[deactivateModalStyles.warningBlock, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <View style={deactivateModalStyles.warningRow}>
                <MaterialIcons name="lock-clock" size={15} color={colors.textSecondary} />
                <Text style={[deactivateModalStyles.warningTitle, { color: colors.textSecondary }]}>30-Day Reactivation Lock</Text>
              </View>
              <Text style={deactivateModalStyles.warningBody}>
                This player cannot be reactivated for 30 days once removed, preventing mid-month deactivation abuse.
              </Text>
            </View>

            <View style={deactivateModalStyles.btnRow}>
              <Pressable
                style={deactivateModalStyles.cancelBtn}
                onPress={() => { setShowDeactivateModal(false); setDeactivateTarget(null); }}
              >
                <Text style={deactivateModalStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={deactivateModalStyles.confirmBtn} onPress={confirmDeactivate}>
                <MaterialIcons name="person-off" size={15} color={colors.textLight} />
                <Text style={deactivateModalStyles.confirmBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Player Detail Modal */}
      <Modal visible={showPlayerModal} animationType="slide" transparent onRequestClose={() => setShowPlayerModal(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <View style={modalStyles.header}>
              <Text style={modalStyles.headerTitle}>
                {selectedPlayer?.display_name || selectedPlayer?.user_profiles?.username || 'Player'}
              </Text>
              <Pressable onPress={() => setShowPlayerModal(false)} style={modalStyles.closeBtn}>
                <MaterialIcons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            {selectedPlayer && (
              <ScrollView contentContainerStyle={modalStyles.content} showsVerticalScrollIndicator={false}>
                <View style={modalStyles.playerMeta}>
                  <Text style={[modalStyles.positionBadge, { color: getPositionColor(selectedPlayer.position) }]}>{selectedPlayer.position}</Text>
                  {selectedPlayer.jersey_number ? <Text style={modalStyles.jerseyText}>#{selectedPlayer.jersey_number}</Text> : null}
                  <Text style={modalStyles.sessionCount}>{playerLogs.length} sessions logged</Text>
                </View>

                {playerLogs.length === 0 ? (
                  <View style={modalStyles.emptyPlayer}>
                    <MaterialIcons name="event-busy" size={40} color={colors.border} />
                    <Text style={modalStyles.emptyPlayerText}>No training logs yet</Text>
                  </View>
                ) : (
                  <>
                    <View style={modalStyles.statsRow}>
                      <View style={modalStyles.statBlock}>
                        <Text style={modalStyles.statVal}>{Math.round(playerLogs.reduce((a, l) => a + l.duration_minutes, 0) / 60)}h</Text>
                        <Text style={modalStyles.statLabel}>Total Time</Text>
                      </View>
                      <View style={modalStyles.statBlock}>
                        <Text style={modalStyles.statVal}>{(playerLogs.reduce((a, l) => a + l.intensity, 0) / playerLogs.length).toFixed(1)}</Text>
                        <Text style={modalStyles.statLabel}>Avg Intensity</Text>
                      </View>
                      <View style={modalStyles.statBlock}>
                        <Text style={modalStyles.statVal}>{playerLogs.reduce((a, l) => a + (l.balls_faced || l.balls_bowled || 0), 0)}</Text>
                        <Text style={modalStyles.statLabel}>Total Balls</Text>
                      </View>
                    </View>

                    {!aiReport ? (
                      <Pressable style={[modalStyles.aiBtn, aiLoading && { opacity: 0.6 }]} onPress={handleGenerateAI}>
                        {aiLoading ? (
                          <>
                            <ActivityIndicator color={colors.textLight} size="small" />
                            <Text style={modalStyles.aiBtnText}>Generating AI Report...</Text>
                          </>
                        ) : (
                          <>
                            <MaterialIcons name="auto-awesome" size={18} color={colors.textLight} />
                            <Text style={modalStyles.aiBtnText}>Generate AI Coaching Report</Text>
                          </>
                        )}
                      </Pressable>
                    ) : (
                      <View style={modalStyles.aiReport}>
                        <View style={modalStyles.aiReportHeader}>
                          <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
                          <Text style={modalStyles.aiReportTitle}>AI Coaching Report</Text>
                        </View>
                        <Text style={modalStyles.aiReportText}>{aiReport}</Text>
                      </View>
                    )}

                    <Text style={modalStyles.recentLabel}>Recent Sessions</Text>
                    {playerLogs.slice(0, 8).map(log => (
                      <View key={log.id} style={modalStyles.logRow}>
                        <View style={[modalStyles.logDot, { backgroundColor: getIntensityColor(log.intensity) }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={modalStyles.logType}>{log.session_type}</Text>
                          <Text style={modalStyles.logMeta}>
                            {log.log_date} · {log.duration_minutes}min · Intensity {log.intensity}/10
                          </Text>
                          {(log.balls_faced || log.balls_bowled) ? (
                            <Text style={modalStyles.logStats}>
                              {log.balls_faced ? `${log.balls_faced} faced` : ''}
                              {log.balls_bowled ? `${log.balls_bowled} bowled` : ''}
                              {log.wickets ? ` · ${log.wickets}wkt` : ''}
                              {log.catches ? ` · ${log.catches} catches` : ''}
                            </Text>
                          ) : null}
                          {log.notes ? <Text style={modalStyles.logNotes} numberOfLines={1}>{log.notes}</Text> : null}
                        </View>
                        <View style={[modalStyles.intensityBadge, { backgroundColor: getIntensityColor(log.intensity) + '20' }]}>
                          <Text style={[modalStyles.intensityBadgeText, { color: getIntensityColor(log.intensity) }]}>{log.intensity}/10</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const deactivateModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, width: '100%', gap: spacing.md },
  iconRow: { alignItems: 'center' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.error + '15', justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h3, color: colors.text, fontWeight: '800', textAlign: 'center' },
  playerNameSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.xs },
  warningBlock: { borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error + '40', backgroundColor: colors.error + '06', padding: spacing.md, gap: spacing.xs },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  warningTitle: { ...typography.bodySmall, color: colors.error, fontWeight: '800' },
  warningBody: { fontSize: 12.5, color: colors.text, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { ...typography.body, color: colors.text, fontWeight: '700' },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.error },
  confirmBtnText: { ...typography.bodySmall, color: colors.textLight, fontWeight: '800' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 40 },
  playerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  positionBadge: { ...typography.bodySmall, fontWeight: '700' },
  jerseyText: { ...typography.bodySmall, color: colors.textSecondary },
  sessionCount: { ...typography.caption, color: colors.textSecondary, marginLeft: 'auto' },
  statsRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md, gap: spacing.sm },
  statBlock: { flex: 1, alignItems: 'center' },
  statVal: { ...typography.h4, color: colors.text, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
  aiBtnText: { ...typography.bodySmall, color: colors.textLight, fontWeight: '700' },
  aiReport: { backgroundColor: colors.primary + '10', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary + '30' },
  aiReportHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  aiReportTitle: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  aiReportText: { ...typography.bodySmall, color: colors.text, lineHeight: 20 },
  recentLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  logType: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  logMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  logStats: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 1 },
  logNotes: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginTop: 1 },
  intensityBadge: { paddingHorizontal: spacing.xs + 2, paddingVertical: 3, borderRadius: borderRadius.sm },
  intensityBadgeText: { fontSize: 11, fontWeight: '800' },
  emptyPlayer: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyPlayerText: { ...typography.body, color: colors.textSecondary },
});

const squadFilterStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: borderRadius.full, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  chipAll: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  chipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.textLight },
  dot: { width: 8, height: 8, borderRadius: 4 },
  squadBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  squadBadgeText: { fontSize: 9, fontWeight: '800' },
  colorRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginVertical: spacing.sm },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: colors.text },
  squadInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 15, color: colors.text, fontWeight: '600',
  },
  assignOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  assignOptionText: { fontSize: 14, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, fontWeight: '700' },
  auditBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },
  billingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap',
    backgroundColor: colors.primary + '10', borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.primary + '20',
  },
  billingText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  billingLink: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statVal: { ...typography.h4, color: colors.text, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  playerCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  playerCardInactive: { opacity: 0.55, borderStyle: 'dashed' },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  positionDot: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  positionDotText: { color: colors.textLight, fontWeight: '800', fontSize: 16 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  playerName: { ...typography.body, color: colors.text, fontWeight: '700' },
  jerseyBadge: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  playerPosition: { ...typography.caption, fontWeight: '600', marginTop: 1 },
  playerStats: { alignItems: 'center', marginRight: spacing.xs },
  playerSessionCount: { ...typography.h4, color: colors.text, fontWeight: '800' },
  playerSessionLabel: { fontSize: 9, color: colors.textSecondary },
  playerBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lastSeen: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  intensityPill: { paddingHorizontal: spacing.xs + 2, paddingVertical: 2, borderRadius: borderRadius.sm },
  intensityPillText: { fontSize: 10, fontWeight: '700' },
  deactivateBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.error + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  inactiveBadge: {
    backgroundColor: colors.border, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  inactiveBadgeText: { fontSize: 9, fontWeight: '800', color: colors.textSecondary },
  inactiveToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  inactiveToggleText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700', marginBottom: 4 },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  analyticsItem: { flex: 1, minWidth: '40%', alignItems: 'center', backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm, gap: 4, borderWidth: 1, borderColor: colors.border },
  analyticsVal: { ...typography.h4, color: colors.text, fontWeight: '800' },
  analyticsLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  barLabel: { width: 90, fontSize: 12, color: colors.text, fontWeight: '500' },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, minWidth: 4 },
  barVal: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  emptyChartText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.md, fontStyle: 'italic' },
});

const analyticsStyles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  pillIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  cricketBarRow: { marginBottom: spacing.md },
  cricketBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  cricketBarName: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
  cricketBarRate: { fontSize: 12, fontWeight: '700', marginLeft: spacing.sm },
  stackedTrack: { height: 14, backgroundColor: colors.border, borderRadius: 7, overflow: 'hidden' },
  stackedBase: { height: '100%', borderRadius: 7, overflow: 'hidden', flexDirection: 'row' },
  stackedFill: { height: '100%' },
  cricketBarMeta: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 3 },
  metaText: { fontSize: 11, color: colors.textSecondary },
});
