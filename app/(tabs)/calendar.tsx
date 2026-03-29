import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
import { sessionService } from '@/services/sessionService';
import { drillService } from '@/services/drillService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Session, Drill } from '@/types';
import * as Notifications from 'expo-notifications';

const { width } = Dimensions.get('window');

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type ViewMode = 'week' | 'month';

interface CalendarEvent {
  id: string;
  user_id: string;
  event_type: 'training' | 'match';
  title: string;
  event_date: string;
  notes: string;
  created_at: string;
  notification_scheduled: boolean;
}

interface DayData {
  date: Date;
  dateString: string;
  isToday: boolean;
  sessions: SessionWithDrill[];
}

interface SessionWithDrill extends Session {
  drill?: Drill;
}

export default function CalendarScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [sessions, setSessions] = useState<SessionWithDrill[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
  const [eventType, setEventType] = useState<'training' | 'match'>('training');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventTime, setEventTime] = useState('09:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const [weekDays, setWeekDays] = useState<DayData[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
      requestNotificationPermissions();
    }
  }, [user, currentDate]);

  useEffect(() => {
    generateWeekDays();
  }, [currentDate, sessions, calendarEvents]);

  const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }
    
    return true;
  };

  const scheduleEventNotifications = async (events: CalendarEvent[]) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const upcomingEvents = events.filter(event => {
      const eventDate = new Date(event.event_date);
      return eventDate >= now;
    });

    for (const event of upcomingEvents) {
      const eventDate = new Date(event.event_date);
      eventDate.setHours(9, 0, 0, 0); // Notify at 9 AM on event day
      
      if (eventDate > new Date() && !event.notification_scheduled) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: event.event_type === 'training' ? '🏏 Training Day' : '🏆 Match Day',
              body: `You have a ${event.event_type} today: ${event.title}`,
              data: { eventId: event.id, eventType: event.event_type },
              sound: true,
            },
            trigger: eventDate,
          });
          
          // Mark notification as scheduled
          const supabase = getSupabaseClient();
          await supabase
            .from('calendar_events')
            .update({ notification_scheduled: true })
            .eq('id', event.id);
        } catch (error) {
          console.error('Failed to schedule event notification:', error);
        }
      }
    }
  };

  const scheduleSessionNotifications = async (sessions: SessionWithDrill[]) => {
    // Cancel all existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    const now = new Date();
    const upcomingSessions = sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date);
      return sessionDate > now && session.status !== 'completed';
    });

    for (const session of upcomingSessions) {
      const sessionDate = new Date(session.scheduled_date);
      const notificationTime = new Date(sessionDate.getTime() - 15 * 60 * 1000); // 15 minutes before
      
      // Only schedule if notification time is in the future
      if (notificationTime > now) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🏏 Upcoming Training Session',
              body: `${session.title} starts in 15 minutes`,
              data: { sessionId: session.id, drillId: session.drill?.id },
              sound: true,
            },
            trigger: notificationTime,
          });
        } catch (error) {
          console.error('Failed to schedule notification:', error);
        }
      }
    }
  };

  const loadData = async () => {
    if (!user) return;
    
    const supabase = getSupabaseClient();
    
    // Load calendar events
    const { data: eventsData } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: true });
    
    if (eventsData) {
      setCalendarEvents(eventsData);
      await scheduleEventNotifications(eventsData);
    }
    
    // Load sessions
    const { data: sessionsData } = await sessionService.getUserSessions(user.id);
    
    // Load all drills
    const { data: drillsData } = await drillService.getAllDrills();
    if (drillsData) {
      setDrills(drillsData);
    }
    
    // Enrich sessions with drill data
    if (sessionsData && drillsData) {
      const enrichedSessions = sessionsData.map(session => {
        if (session.session_type === 'Structured' || session.session_type === 'Drill-Based') {
          // Find the drill for this session by matching title to drill name
          const drill = drillsData.find(d => d.name === session.title);
          return { ...session, drill };
        }
        return session;
      });
      setSessions(enrichedSessions);
      
      // Schedule notifications for upcoming sessions
      scheduleSessionNotifications(enrichedSessions);
    } else if (sessionsData) {
      setSessions(sessionsData);
    }
  };

  const generateWeekDays = () => {
    const startOfWeek = getStartOfWeek(currentDate);
    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      const daySessions = sessions.filter((session) => {
        const sessionDate = new Date(session.scheduled_date).toISOString().split('T')[0];
        return sessionDate === dateString;
      });
      
      const dayEvents = calendarEvents.filter((event) => {
        return event.event_date === dateString;
      });

      const isToday = date.getTime() === today.getTime();

      days.push({
        date,
        dateString,
        isToday,
        sessions: [...daySessions, ...dayEvents.map(e => ({
          id: e.id,
          user_id: e.user_id,
          title: e.title,
          scheduled_date: `${e.event_date}T09:00:00`,
          duration_minutes: 60,
          session_type: e.event_type === 'training' ? 'Training Event' : 'Match Event',
          status: 'planned',
          notes: e.notes,
          created_at: e.created_at,
        }))],
      });
    }

    setWeekDays(days);
  };

  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = getStartOfWeek(firstDay);
    
    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate 42 days (6 weeks) to fill the calendar grid
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      const daySessions = sessions.filter((session) => {
        const sessionDate = new Date(session.scheduled_date).toISOString().split('T')[0];
        return sessionDate === dateString;
      });
      
      const dayEvents = calendarEvents.filter((event) => {
        return event.event_date === dateString;
      });

      const isToday = date.getTime() === today.getTime();

      days.push({
        date,
        dateString,
        isToday,
        sessions: [...daySessions, ...dayEvents.map(e => ({
          id: e.id,
          user_id: e.user_id,
          title: e.title,
          scheduled_date: `${e.event_date}T09:00:00`,
          duration_minutes: 60,
          session_type: e.event_type === 'training' ? 'Training Event' : 'Match Event',
          status: 'planned',
          notes: e.notes,
          created_at: e.created_at,
        }))],
      });
    }

    return days;
  };

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const getWeekRange = () => {
    if (viewMode === 'month') {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    
    const start = getStartOfWeek(currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const formatDate = (date: Date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    };

    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const handleDayPress = (day: DayData) => {
    setSelectedDate(day.date);
    setSelectedEventDate(day.date);
    setShowPlanModal(true);
  };

  const handleViewJournal = () => {
    setShowPlanModal(false);
    if (selectedDate) {
      const dateString = selectedDate.toISOString().split('T')[0];
      router.push(`/(tabs)/journal?date=${dateString}` as any);
    }
  };

  const handleAddEvent = () => {
    setShowPlanModal(false);
    setShowEventModal(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedDate) {
      setTempTime(selectedDate);
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setEventTime(`${hours}:${minutes}`);
    }
  };

  const handleTimePickerConfirm = () => {
    setShowTimePicker(false);
  };

  const handleSaveEvent = async () => {
    if (!user || !selectedEventDate) {
      Alert.alert('Error', 'Invalid event data');
      return;
    }
    
    // Use default title if none provided
    const defaultTitle = eventType === 'training' ? 'Club Training' : 'Match';
    const finalTitle = eventTitle.trim() || defaultTitle;
    
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        event_type: eventType,
        title: finalTitle,
        event_date: selectedEventDate.toISOString().split('T')[0],
        event_time: eventTime,
        notes: eventNotes.trim(),
      });
    
    if (error) {
      Alert.alert('Error', 'Failed to create event');
      console.error(error);
    } else {
      setEventTitle('');
      setEventNotes('');
      setEventTime('09:00');
      setShowEventModal(false);
      await loadData();
    }
  };

  const handlePlanSession = (sessionType: 'Drill-Based' | 'Freestyle') => {
    setShowPlanModal(false);
    const dateParam = selectedDate?.toISOString() || new Date().toISOString();
    
    if (sessionType === 'Drill-Based') {
      router.push(`/session-drills?date=${encodeURIComponent(dateParam)}`);
    } else {
      router.push(`/session-freestyle?date=${encodeURIComponent(dateParam)}`);
    }
  };

  const getDayName = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
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
      case 'Freestyle':
        return colors.freestyle;
      case 'Training Event':
        return colors.clubTraining; // Club training events
      case 'Match Event':
        return colors.match;
      default:
        return colors.primary;
    }
  };

  const handleStartSession = (session: SessionWithDrill) => {
    if (session.drill && session.drill.id) {
      router.push(`/drill-start?id=${session.drill.id}` as any);
    } else if (session.session_type === 'Freestyle') {
      // Navigate to freestyle tracking
      router.push(`/session-freestyle?sessionId=${session.id}` as any);
    } else {
      Alert.alert('Session Not Available', 'Cannot start this session. Drill data not found.');
    }
  };

  const handleReviewSession = (session: SessionWithDrill) => {
    if (session.drill && session.drill.id) {
      // Navigate to drill detail for review
      router.push(`/drill-detail?id=${session.drill.id}` as any);
    } else {
      // Parse freestyle session notes for comprehensive summary
      const notes = session.notes || '';
      let summaryMessage = `Session: ${session.title}\n`;
      summaryMessage += `Duration: ${session.duration_minutes || 'N/A'} minutes\n`;
      summaryMessage += `Completed at: ${new Date(session.completed_at || session.scheduled_date).toLocaleString()}\n`;
      
      // Extract structured data from notes if available
      if (notes) {
        summaryMessage += `\n--- Session Details ---\n`;
        summaryMessage += notes;
      }
      
      Alert.alert('Session Review', summaryMessage);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Training Calendar</Text>
          <Text style={styles.headerSubtitle}>Plan and organize your cricket training sessions</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* View Mode Toggle & Date Navigation */}
        <View style={styles.controls}>
          <View style={styles.viewModeToggle}>
            <Pressable
              style={[styles.toggleButton, viewMode === 'week' && styles.toggleButtonActive]}
              onPress={() => setViewMode('week')}
            >
              <Text style={[styles.toggleButtonText, viewMode === 'week' && styles.toggleButtonTextActive]}>
                Week
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, viewMode === 'month' && styles.toggleButtonActive]}
              onPress={() => setViewMode('month')}
            >
              <Text style={[styles.toggleButtonText, viewMode === 'month' && styles.toggleButtonTextActive]}>
                Month
              </Text>
            </Pressable>
          </View>

          <View style={styles.dateNavigation}>
            <Pressable onPress={() => navigateWeek('prev')} style={styles.navButton}>
              <MaterialIcons name="chevron-left" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.dateRangeText}>{getWeekRange()}</Text>
            <Pressable onPress={() => navigateWeek('next')} style={styles.navButton}>
              <MaterialIcons name="chevron-right" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Week View */}
        {viewMode === 'week' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.weekScrollContainer}
            contentContainerStyle={styles.weekScrollContent}
          >
            {weekDays.map((day, index) => (
              <View
                key={index}
                style={[
                  styles.dayColumn,
                  day.isToday && styles.dayColumnToday,
                ]}
              >
                {/* Day Header */}
                <View style={styles.dayColumnHeader}>
                  <Text style={styles.dayName}>{getDayName(day.date)}</Text>
                  <Text style={styles.dayNumber}>{day.date.getDate()}</Text>
                  <Pressable
                    style={styles.addButton}
                    onPress={() => handleDayPress(day)}
                  >
                    <MaterialIcons name="add" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {/* Sessions List */}
                <ScrollView
                  style={styles.sessionsList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.sessionsListContent}
                >
                  {day.sessions.length === 0 ? (
                    <View style={styles.emptyState}>
                      <MaterialIcons
                        name="schedule"
                        size={40}
                        color={colors.border}
                      />
                      <Text style={styles.emptyStateText}>No sessions{"\n"}planned</Text>
                    </View>
                  ) : (
                    day.sessions.map((session, idx) => (
                      <View key={idx} style={styles.sessionCard}>
                        {/* Status & Duration Badge */}
                        <View style={styles.sessionHeader}>
                          <View style={[
                            styles.statusBadge,
                            session.status === 'completed' && styles.statusBadgeCompleted
                          ]}>
                            <Text style={[
                              styles.statusText,
                              session.status === 'completed' && styles.statusTextCompleted
                            ]}>
                              {session.status === 'completed' ? 'Completed' : 'Planned'}
                            </Text>
                          </View>
                          <View style={styles.durationBadge}>
                            <MaterialIcons name="access-time" size={12} color={colors.textSecondary} />
                            <Text style={styles.durationText}>{session.duration_minutes || 15}m</Text>
                          </View>
                        </View>

                        {/* Pillar Badge */}
                        <View style={[
                          styles.pillarBadge,
                          { backgroundColor: getPillarColor(session.drill?.pillar || 'Technical') + '20' }
                        ]}>
                          <Text style={[
                            styles.pillarText,
                            { color: getPillarColor(session.drill?.pillar || 'Technical') }
                          ]}>
                            {session.drill?.pillar || session.session_type}
                          </Text>
                        </View>

                        {/* Session Title */}
                        <Text style={styles.sessionTitle} numberOfLines={3}>
                          {session.title}
                        </Text>

                        {/* Scheduled Time */}
                        <Text style={styles.sessionTime}>
                          {formatTime(session.scheduled_date)}
                        </Text>

                        {/* Action Button */}
                        {session.status === 'completed' ? (
                          <Pressable
                            style={styles.actionButton}
                            onPress={() => handleReviewSession(session)}
                          >
                            <MaterialIcons name="play-arrow" size={16} color={colors.textLight} />
                            <Text style={styles.actionButtonText}>Review</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={styles.actionButton}
                            onPress={() => handleStartSession(session)}
                          >
                            <MaterialIcons name="play-arrow" size={16} color={colors.textLight} />
                            <Text style={styles.actionButtonText}>Start</Text>
                          </Pressable>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        ) : (
          /* Month View */
          <View style={styles.monthContainer}>
            {/* Color Legend */}
            <View style={styles.legendContainerTop}>
              <View style={styles.legendItems}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#9C27B0' }]} />
                  <Text style={styles.legendText}>Technical</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3F51B5' }]} />
                  <Text style={styles.legendText}>Mental</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FFC107' }]} />
                  <Text style={styles.legendText}>Physical</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF6F42' }]} />
                  <Text style={styles.legendText}>Tactical</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.clubTraining }]} />
                  <Text style={styles.legendText}>Club Training</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.freestyle }]} />
                  <Text style={styles.legendText}>Freestyle</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.match }]} />
                  <Text style={styles.legendText}>Match</Text>
                </View>
              </View>
            </View>

            {/* Day Headers */}
            <View style={styles.monthDayHeaders}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <View key={index} style={styles.monthDayHeader}>
                  <Text style={styles.monthDayHeaderText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Month Grid */}
            <View style={styles.monthGrid}>
              {generateMonthDays().map((day, index) => {
                const isCurrentMonth = day.date.getMonth() === currentDate.getMonth();
                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.monthCell,
                      day.isToday && styles.monthCellToday,
                      !isCurrentMonth && styles.monthCellOtherMonth,
                    ]}
                    onPress={() => handleDayPress(day)}
                  >
                    <Text style={[
                      styles.monthCellDate,
                      day.isToday && styles.monthCellDateToday,
                      !isCurrentMonth && styles.monthCellDateOtherMonth,
                    ]}>
                      {day.date.getDate()}
                    </Text>
                    
                    {/* Session Indicators */}
                    {day.sessions.length > 0 && isCurrentMonth && (
                      <View style={styles.monthSessionIndicators}>
                        {day.sessions.slice(0, 3).map((session, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.monthSessionDot,
                              { backgroundColor: getPillarColor(session.drill?.pillar || 'Technical') }
                            ]}
                          />
                        ))}
                        {day.sessions.length > 3 && (
                          <Text style={styles.monthSessionMore}>+{day.sessions.length - 3}</Text>
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
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
              <MaterialIcons name="event" size={20} color={colors.textLight} />
              <Text style={styles.addEventButtonText}>Add Club Training or Match Event</Text>
            </Pressable>

            <View style={styles.eventTypeDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable style={styles.viewJournalButton} onPress={handleViewJournal}>
              <MaterialIcons name="book" size={20} color={colors.primary} />
              <Text style={styles.viewJournalButtonText}>View Journal for This Day</Text>
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

            {selectedEventDate && (
              <Text style={styles.selectedDateText}>
                {selectedEventDate.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            )}

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

            <Pressable 
              style={styles.timePickerContainer}
              onPress={() => setShowTimePicker(true)}
            >
              <MaterialIcons name="access-time" size={20} color={colors.textSecondary} />
              <Text style={styles.timeText}>{eventTime}</Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
            </Pressable>

            {showTimePicker && (
              <>
                <DateTimePicker
                  value={tempTime}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                />
                {Platform.OS === 'ios' && (
                  <Pressable 
                    style={styles.timePickerConfirm}
                    onPress={handleTimePickerConfirm}
                  >
                    <Text style={styles.timePickerConfirmText}>Done</Text>
                  </Pressable>
                )}
              </>
            )}

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
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  controls: {
    padding: spacing.md,
    gap: spacing.md,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    alignSelf: 'flex-start',
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  toggleButtonActive: {
    backgroundColor: colors.text,
  },
  toggleButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: colors.textLight,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navButton: {
    padding: spacing.xs,
  },
  dateRangeText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  weekScrollContainer: {
    flex: 1,
  },
  weekScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  dayColumn: {
    width: 155,
    marginRight: spacing.md,
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  dayColumnToday: {
    borderColor: '#52B788',
    backgroundColor: '#F0FFF4',
  },
  dayColumnHeader: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayName: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  dayNumber: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 12,
  },
  addButton: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  sessionsList: {
    flex: 1,
  },
  sessionsListContent: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.md,
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: spacing.sm,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: '#F5F5F5',
  },
  statusBadgeCompleted: {
    backgroundColor: '#E8F5E9',
  },
  statusText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 10,
  },
  statusTextCompleted: {
    color: '#52B788',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  durationText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  pillarBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  pillarText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  sessionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  sessionTime: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#52B788',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  actionButtonText: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 13,
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
  selectedDateText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontWeight: '500',
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
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  timeText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  timePickerConfirm: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  timePickerConfirmText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  
  // Month View Styles
  monthContainer: {
    paddingVertical: spacing.md,
  },
  monthDayHeaders: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  monthDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  monthDayHeaderText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -0.5,
  },
  monthCell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.75,
    padding: spacing.xs,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    backgroundColor: colors.surface,
  },
  monthCellToday: {
    backgroundColor: '#F0FFF4',
    borderColor: '#52B788',
    borderWidth: 2,
  },
  monthCellOtherMonth: {
    backgroundColor: '#FAFAFA',
  },
  monthCellDate: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  monthCellDateToday: {
    color: '#52B788',
    fontWeight: '700',
  },
  monthCellDateOtherMonth: {
    color: colors.textSecondary,
    opacity: 0.5,
  },
  monthSessionIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
    marginTop: 4,
  },
  monthSessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthSessionMore: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  legendContainerTop: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
    color: colors.text,
    fontSize: 11,
    fontWeight: '500',
  },
});
