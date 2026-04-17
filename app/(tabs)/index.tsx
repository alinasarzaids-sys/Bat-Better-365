import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, RefreshControl, View, Text, Pressable, Modal, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter } from 'expo-router';
import { HeroCard } from '@/components/home/HeroCard';
import { QuickActions } from '@/components/home/QuickActions';
import { StatsRow } from '@/components/home/StatsRow';
import { SkillHeatmap } from '@/components/home/SkillHeatmap';
import { useProgress } from '@/hooks/useProgress';
import { useAuth } from '@/template';
import { sessionService } from '@/services/sessionService';
import { drillService } from '@/services/drillService';
import { leaderboardService, LeaderboardEntry } from '@/services/leaderboardService';
import { profileService } from '@/services/profileService';
import { getSupabaseClient } from '@/template';

import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Session, Drill } from '@/types';

interface SessionWithDrill extends Session {
  drill?: Drill;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { progress, loading: progressLoading, refresh } = useProgress();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithDrill[]>([]);
  const [completedSessions, setCompletedSessions] = useState<SessionWithDrill[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventType, setEventType] = useState<'training' | 'match'>('training');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [eventTime, setEventTime] = useState<Date>(new Date());
  const [showEventDatePicker, setShowEventDatePicker] = useState(false);
  const [showEventTimePicker, setShowEventTimePicker] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name?: string; username?: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadHomeData();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    const { data: profile } = await profileService.getProfile(user.id);
    if (profile) {
      setUserProfile(profile);
    }
  };

  const loadHomeData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Load upcoming sessions
      const { data: upcoming } = await sessionService.getUpcomingSessions(user.id);
      
      // Load recent completed sessions
      const { data: allSessions } = await sessionService.getUserSessions(user.id);
      const completed = allSessions?.filter(s => s.status === 'completed').slice(0, 2) || [];
      
      // Load all drills for matching
      const { data: allDrills } = await drillService.getAllDrills();
      
      // Enrich sessions with drill data
      if (upcoming && allDrills) {
        const enriched = upcoming.map(session => {
          const drill = allDrills.find(d => d.name === session.title);
          return { ...session, drill };
        });
        setUpcomingSessions(enriched);
      }
      
      if (completed && allDrills) {
        const enriched = completed.map(session => {
          const drill = allDrills.find(d => d.name === session.title);
          return { ...session, drill };
        });
        setCompletedSessions(enriched);
      }
      
      // Load leaderboard (top 5)
      const { data: leaderboardData, error: lbErr } = await leaderboardService.getLeaderboard('overall', 5);
      if (leaderboardData) {
        setLeaderboard(leaderboardData);
      } else {
        console.log('Leaderboard fetch issue:', lbErr);
      }

    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHomeData(), refresh()]);
    setRefreshing(false);
  };

  const handlePlanSession = (sessionType: 'Drill-Based' | 'Freestyle') => {
    setShowPlanModal(false);
    const dateParam = new Date().toISOString();
    
    if (sessionType === 'Drill-Based') {
      router.push(`/session-drills?date=${encodeURIComponent(dateParam)}`);
    } else {
      router.push(`/session-freestyle?date=${encodeURIComponent(dateParam)}`);
    }
  };

  const handleViewJournal = () => {
    setShowPlanModal(false);
    const dateString = new Date().toISOString().split('T')[0];
    router.push(`/(tabs)/journal?date=${dateString}` as any);
  };

  const handleAddEvent = () => {
    setShowPlanModal(false);
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!user) {
      Alert.alert('Error', 'Invalid event data');
      return;
    }
    
    // Use default title if none provided
    const defaultTitle = eventType === 'training' ? 'Training Session' : 'Match';
    const finalTitle = eventTitle.trim() || defaultTitle;
    
    // Combine date and time
    const combinedDateTime = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
      eventTime.getHours(),
      eventTime.getMinutes()
    );
    
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        event_type: eventType,
        title: finalTitle,
        event_date: combinedDateTime.toISOString().split('T')[0],
        notes: eventNotes.trim(),
      });
    
    if (error) {
      Alert.alert('Error', 'Failed to create event');
      console.error(error);
    } else {
      setEventTitle('');
      setEventNotes('');
      setEventDate(new Date());
      setEventTime(new Date());
      setShowEventModal(false);
      Alert.alert('Success', 'Event added successfully');
      handleRefresh();
    }
  };

  const handleStartSession = (session: SessionWithDrill) => {
    if (session.drill && session.drill.id) {
      router.push(`/drill-start?id=${session.drill.id}` as any);
    } else if (session.session_type === 'Freestyle' || session.session_type === 'Structured') {
      router.push('/session-freestyle' as any);
    } else {
      // Fallback: open freestyle session
      router.push('/session-freestyle' as any);
    }
  };

  const handleReviewSession = (session: SessionWithDrill) => {
    if (session.session_type === 'Freestyle') {
      // Show review modal for freestyle sessions
      let sessionData: any = {};
      
      // Safely parse session.notes with error handling
      if (session.notes && typeof session.notes === 'string') {
        try {
          sessionData = JSON.parse(session.notes);
        } catch (error) {
          console.error('Failed to parse session notes:', error);
          // If parsing fails, treat notes as plain text
          sessionData = { session_notes: session.notes };
        }
      }
      
      const formattedDuration = session.duration_minutes || 0;
      const formattedTime = formatSessionTime(session.completed_at || session.scheduled_date);
      
      const reviewMessage = `Session completed ${formattedTime}

Duration: ${formattedDuration} min

${sessionData.training_types ? `Training Types: ${sessionData.training_types.join(', ')}` : ''}
${sessionData.focus_area ? `Focus: ${sessionData.focus_area}` : ''}
${sessionData.session_goal ? `Goal: ${sessionData.session_goal}` : ''}
${sessionData.balls_faced ? `Balls: ${sessionData.balls_faced}` : ''}

${sessionData.technical_rating ? `Technical: ${sessionData.technical_rating}/5` : ''}
${sessionData.physical_rating ? `Physical: ${sessionData.physical_rating}/5` : ''}
${sessionData.mental_rating ? `Mental: ${sessionData.mental_rating}/5` : ''}
${sessionData.tactical_rating ? `Tactical: ${sessionData.tactical_rating}/5` : ''}

${sessionData.session_notes ? `Notes: ${sessionData.session_notes}` : ''}`;
      
      Alert.alert('Session Review', reviewMessage);
    } else if (session.drill && session.drill.id) {
      router.push(`/drill-detail?id=${session.drill.id}` as any);
    }
  };

  const formatSessionTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateStr = date.toDateString();
    const todayStr = today.toDateString();
    const tomorrowStr = tomorrow.toDateString();
    
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (dateStr === todayStr) {
      return `Today at ${timeStr}`;
    } else if (dateStr === tomorrowStr) {
      return `Tomorrow at ${timeStr}`;
    } else {
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${weekday}, ${month} ${day} at ${timeStr}`;
    }
  };

  const getPillarColor = (pillar: string) => {
    switch (pillar) {
      case 'Technical':
        return '#9C27B0';
      case 'Physical':
        return '#FFC107';
      case 'Mental':
        return '#3F51B5';
      case 'Tactical':
        return '#FF6F42';
      default:
        return colors.primary;
    }
  };

  const nextSession = upcomingSessions[0] || null;
  const otherUpcoming = upcomingSessions.slice(1, 4);
  const otherSessions = [...otherUpcoming, ...completedSessions.slice(0, 2)];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Profile and Settings Buttons */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Welcome back!</Text>
          <Text style={styles.headerSubtitle}>{userProfile?.full_name || user?.full_name || user?.username || 'Player'}</Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            style={styles.profileButton}
            onPress={() => router.push('/profile' as any)}
          >
            <MaterialIcons name="person" size={24} color={colors.primary} />
          </Pressable>
          <Pressable
            style={styles.profileButton}
            onPress={() => router.push('/settings' as any)}
          >
            <MaterialIcons name="settings" size={24} color={colors.primary} />
          </Pressable>
        </View>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing || progressLoading} 
            onRefresh={handleRefresh} 
            tintColor={colors.primary} 
          />
        }
      >
        <HeroCard />
        <QuickActions onPlanSession={() => setShowPlanModal(true)} />
        <StatsRow progress={progress} />
        <SkillHeatmap progress={progress} />

        {/* Leaderboard Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="emoji-events" size={24} color={colors.warning} />
            <Text style={styles.sectionTitle}>Leaderboard</Text>
          </View>
          <Text style={styles.leaderboardDescription}>Top players ranked by total training XP earned</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <MaterialIcons name="emoji-events" size={40} color={colors.border} />
              <Text style={styles.emptyStateText}>Be the first on the board!</Text>
              <Text style={[styles.emptyStateText, { fontSize: 12, marginTop: -spacing.sm }]}>Complete drills to earn XP</Text>
            </View>
          ) : (
            <>
              <View style={styles.leaderboardList}>
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = user?.id === entry.id;
                  const isTopThree = entry.rank <= 3;
                  const getRankMedal = (rank: number) => {
                    if (rank === 1) return '🥇';
                    if (rank === 2) return '🥈';
                    if (rank === 3) return '🥉';
                    return `${rank}`;
                  };

                  return (
                    <View
                      key={entry.id}
                      style={[
                        styles.leaderboardEntry,
                        isCurrentUser && styles.leaderboardEntryHighlight,
                        isTopThree && !isCurrentUser && styles.leaderboardEntryTopThree,
                      ]}
                    >
                      <View style={styles.leaderboardRank}>
                        <Text style={styles.leaderboardRankText}>{getRankMedal(entry.rank)}</Text>
                        {entry.rank === 1 && !isCurrentUser && (
                          <View style={styles.crownBadge}>
                            <MaterialIcons name="whatshot" size={12} color="#FF6F00" />
                          </View>
                        )}
                      </View>
                      <View style={styles.leaderboardInfo}>
                        <View style={styles.leaderboardNameRow}>
                          <Text style={styles.leaderboardName}>
                            {entry.username}
                            {isCurrentUser && <Text style={styles.leaderboardYou}> (You)</Text>}
                          </Text>
                          {entry.rank === 1 && (
                            <Text style={styles.topPlayerBadge}>Top Player</Text>
                          )}
                        </View>
                        <Text style={styles.leaderboardLevel}>{entry.skill_level}</Text>
                      </View>
                      <View style={styles.leaderboardXPContainer}>
                        <Text style={styles.leaderboardXP}>{entry.total_xp}</Text>
                        <Text style={styles.leaderboardXPLabel}>XP</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Pressable
                style={styles.viewAllButton}
                onPress={() => router.push('/(tabs)/leaderboard')}
              >
                <Text style={styles.viewAllButtonText}>View Full Leaderboard</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
              </Pressable>
            </>
          )}
        </View>

        {/* Today & Upcoming Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Today & Upcoming</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Next Scheduled Session */}
              {nextSession ? (
                <View style={styles.nextSessionCard}>
                  <View style={styles.nextSessionHeader}>
                    <MaterialIcons name="arrow-forward" size={18} color={colors.success} />
                    <Text style={styles.nextSessionLabel}>Next Scheduled Session</Text>
                  </View>
                  <Text style={styles.nextSessionDate}>{formatSessionTime(nextSession.scheduled_date)}</Text>
                  
                  <View style={styles.nextSessionContent}>
                    <View style={styles.nextSessionInfo}>
                      <MaterialIcons name="access-time" size={16} color={colors.textSecondary} />
                      <Text style={styles.nextSessionDuration}>{nextSession.duration_minutes || 15} min</Text>
                    </View>
                    
                    <View style={[
                      styles.sessionTypeBadge,
                      { backgroundColor: getPillarColor(nextSession.drill?.pillar || nextSession.session_type) + '20' }
                    ]}>
                      <Text style={[
                        styles.sessionTypeBadgeText,
                        { color: getPillarColor(nextSession.drill?.pillar || nextSession.session_type) }
                      ]}>
                        {nextSession.drill?.pillar || nextSession.session_type}
                      </Text>
                    </View>
                  </View>

                  <Pressable 
                    style={styles.startSessionButton}
                    onPress={() => handleStartSession(nextSession)}
                  >
                    <MaterialIcons name="play-arrow" size={18} color={colors.textLight} />
                    <Text style={styles.startSessionButtonText}>Start Session</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <MaterialIcons name="schedule" size={40} color={colors.border} />
                  <Text style={styles.emptyStateText}>No upcoming sessions</Text>
                  <Pressable 
                    style={styles.planNowButton}
                    onPress={() => setShowPlanModal(true)}
                  >
                    <Text style={styles.planNowButtonText}>Plan a session</Text>
                  </Pressable>
                </View>
              )}

              {/* Other Sessions List */}
              {otherSessions.length > 0 && (
                <View style={styles.otherSessionsList}>
                  {otherSessions.map((session, index) => (
                    <View key={session.id || index} style={styles.sessionListItem}>
                      <View style={[
                        styles.sessionIconCircle,
                        { backgroundColor: session.status === 'completed' ? colors.success + '20' : colors.primary + '20' }
                      ]}>
                        <MaterialIcons 
                          name={session.status === 'completed' ? 'check' : 'flash-on'} 
                          size={20} 
                          color={session.status === 'completed' ? colors.success : colors.primary} 
                        />
                      </View>

                      <View style={styles.sessionListContent}>
                        <Text style={styles.sessionListTitle}>{session.title}</Text>
                        <View style={styles.sessionListMeta}>
                          <MaterialIcons name="access-time" size={12} color={colors.textSecondary} />
                          <Text style={styles.sessionListTime}>
                            {formatSessionTime(session.scheduled_date)} • {session.duration_minutes || 15} min
                          </Text>
                        </View>
                      </View>

                      <View style={styles.sessionListActions}>
                        <View style={[
                          styles.sessionStatusBadge,
                          session.status === 'completed' && styles.sessionStatusBadgeCompleted
                        ]}>
                          <Text style={[
                            styles.sessionStatusText,
                            session.status === 'completed' && styles.sessionStatusTextCompleted
                          ]}>
                            {session.status === 'completed' ? 'Completed' : 'Planned'}
                          </Text>
                        </View>
                        
                        <View style={[
                          styles.sessionTypeBadgeSmall,
                          { backgroundColor: getPillarColor(session.drill?.pillar || session.session_type) + '20' }
                        ]}>
                          <Text style={[
                            styles.sessionTypeBadgeTextSmall,
                            { color: getPillarColor(session.drill?.pillar || session.session_type) }
                          ]}>
                            {session.drill?.pillar || session.session_type}
                          </Text>
                        </View>

                        <Pressable 
                          style={styles.sessionActionButton}
                          onPress={() => session.status === 'completed' ? handleReviewSession(session) : handleStartSession(session)}
                        >
                          <MaterialIcons 
                            name="play-arrow" 
                            size={16} 
                            color={colors.textSecondary} 
                          />
                          <Text style={styles.sessionActionButtonText}>
                            {session.status === 'completed' ? 'Review' : 'Start'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Plan New Session Modal */}
      <Modal
        visible={showPlanModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan New Session</Text>
              <Pressable onPress={() => setShowPlanModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.modalQuestion}>What kind of session are you planning?</Text>

            <View style={styles.sessionTypeGrid}>
              <Pressable
                style={styles.sessionTypeCard}
                onPress={() => handlePlanSession('Drill-Based')}
              >
                <View style={[styles.sessionTypeIcon, styles.sessionTypeIconDrill]}>
                  <MaterialIcons name="track-changes" size={32} color={colors.success} />
                </View>
                <Text style={styles.sessionTypeName}>Drill-Based</Text>
                <Text style={styles.sessionTypeDescription}>Structured training</Text>
              </Pressable>

              <Pressable
                style={styles.sessionTypeCard}
                onPress={() => handlePlanSession('Freestyle')}
              >
                <View style={[styles.sessionTypeIcon, styles.sessionTypeIconFreestyle]}>
                  <MaterialIcons name="flash-on" size={32} color={colors.tactical} />
                </View>
                <Text style={styles.sessionTypeName}>Freestyle</Text>
                <Text style={styles.sessionTypeDescription}>Open practice</Text>
              </Pressable>
            </View>

            <View style={styles.eventTypeDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.addEventButton} onPress={handleAddEvent}>
              <MaterialIcons name="calendar-today" size={20} color={colors.textLight} />
              <Text style={styles.addEventButtonText}>Add Club Training or Match Event</Text>
            </Pressable>

            <View style={styles.eventTypeDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.viewJournalButton} onPress={handleViewJournal}>
              <MaterialIcons name="book" size={20} color={colors.primary} />
              <Text style={styles.viewJournalButtonText}>View Journal for Today</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal
        visible={showEventModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Event</Text>
              <Pressable onPress={() => setShowEventModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.dateTimeSection}>
              <View style={styles.formGroup}>
                <Text style={styles.dateTimeLabel}>Date</Text>
                <Pressable
                  style={styles.dateTimeButton}
                  onPress={() => setShowEventDatePicker(true)}
                >
                  <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeButtonText}>
                    {eventDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
                {showEventDatePicker && (
                  <DateTimePicker
                    value={eventDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowEventDatePicker(Platform.OS === 'ios');
                      if (selectedDate) setEventDate(selectedDate);
                    }}
                    minimumDate={new Date()}
                  />
                )}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.dateTimeLabel}>Time</Text>
                <Pressable
                  style={styles.dateTimeButton}
                  onPress={() => setShowEventTimePicker(true)}
                >
                  <MaterialIcons name="access-time" size={20} color={colors.primary} />
                  <Text style={styles.dateTimeButtonText}>
                    {eventTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </Text>
                </Pressable>
                {showEventTimePicker && (
                  <DateTimePicker
                    value={eventTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                      setShowEventTimePicker(Platform.OS === 'ios');
                      if (selectedTime) setEventTime(selectedTime);
                    }}
                  />
                )}
              </View>
            </View>

            <View style={styles.eventTypeSelector}>
              <Pressable
                style={[styles.eventTypeOption, eventType === 'training' && styles.eventTypeOptionActive]}
                onPress={() => setEventType('training')}
              >
                <MaterialIcons 
                  name="fitness-center" 
                  size={24} 
                  color={eventType === 'training' ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.eventTypeOptionText, eventType === 'training' && styles.eventTypeOptionTextActive]}>
                  Club Training
                </Text>
              </Pressable>
              <Pressable
                style={[styles.eventTypeOption, eventType === 'match' && styles.eventTypeOptionActive]}
                onPress={() => setEventType('match')}
              >
                <MaterialIcons 
                  name="sports-cricket" 
                  size={24} 
                  color={eventType === 'match' ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.eventTypeOptionText, eventType === 'match' && styles.eventTypeOptionTextActive]}>
                  Match
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.eventInput}
              placeholder="Event title (optional)"
              placeholderTextColor={colors.textSecondary}
              value={eventTitle}
              onChangeText={setEventTitle}
            />

            <TextInput
              style={[styles.eventInput, styles.eventNotesInput]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textSecondary}
              value={eventNotes}
              onChangeText={setEventNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Pressable style={styles.saveEventButton} onPress={handleSaveEvent}>
              <Text style={styles.saveEventButtonText}>Save Event</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  nextSessionCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  nextSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  nextSessionLabel: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '600',
  },
  nextSessionDate: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  nextSessionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  nextSessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nextSessionDuration: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  sessionTypeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  sessionTypeBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  startSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  startSessionButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  emptyStateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  planNowButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  planNowButtonText: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontWeight: '600',
  },
  otherSessionsList: {
    gap: spacing.md,
  },
  sessionListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionListContent: {
    flex: 1,
  },
  sessionListTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sessionListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionListTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sessionListActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  sessionStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: '#F5F5F5',
  },
  sessionStatusBadgeCompleted: {
    backgroundColor: '#E8F5E9',
  },
  sessionStatusText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 10,
  },
  sessionStatusTextCompleted: {
    color: colors.success,
  },
  sessionTypeBadgeSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  sessionTypeBadgeTextSmall: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  sessionActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  sessionActionButtonText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  leaderboardList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  leaderboardDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  leaderboardEntryHighlight: {
    backgroundColor: '#FFF9E6',
    borderColor: '#FFB800',
  },
  leaderboardEntryTopThree: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BBDEFB',
  },
  leaderboardRank: {
    width: 40,
    alignItems: 'center',
    position: 'relative',
  },
  leaderboardRankText: {
    fontSize: 20,
    fontWeight: '700',
  },
  crownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderboardInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  leaderboardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leaderboardName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  topPlayerBadge: {
    ...typography.caption,
    color: '#FF6F00',
    fontWeight: '700',
    fontSize: 10,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  leaderboardYou: {
    color: colors.primary,
    fontWeight: '700',
  },
  leaderboardLevel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  leaderboardXPContainer: {
    alignItems: 'flex-end',
  },
  leaderboardXP: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '700',
  },
  leaderboardXPLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: -2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewAllButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    width: '88%',
    maxWidth: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  modalQuestion: {
    ...typography.h4,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sessionTypeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  sessionTypeCard: {
    width: 135,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  sessionTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sessionTypeIconDrill: {
    backgroundColor: colors.success + '20',
  },
  sessionTypeIconFreestyle: {
    backgroundColor: colors.tactical + '20',
  },
  sessionTypeName: {
    fontSize: 17,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sessionTypeDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  eventTypeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  addEventButtonText: {
    fontSize: 15,
    color: colors.textLight,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  viewJournalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  viewJournalButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  dateTimeSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  formGroup: {
    gap: spacing.xs,
  },
  dateTimeLabel: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dateTimeButtonText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  eventTypeSelector: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  eventTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  eventTypeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '20',
  },
  eventTypeOptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  eventTypeOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  eventInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  eventNotesInput: {
    minHeight: 80,
  },
  saveEventButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveEventButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },

});
