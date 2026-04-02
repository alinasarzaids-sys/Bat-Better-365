import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
import { sessionService } from '@/services/sessionService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

type ViewMode = 'week' | 'month';

interface CalendarEvent {
  id: string;
  user_id: string;
  event_type: 'training' | 'match';
  title: string;
  event_date: string;
  notes: string;
  created_at: string;
}

// Unified event for display on calendar
interface CalendarEntry {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  pillar: string; // Technical | Physical | Mental | Tactical | Freestyle | Club Training | Match
  status: 'planned' | 'completed';
  duration_minutes?: number;
  scheduled_time?: string;
}

interface DayData {
  date: Date;
  dateString: string;
  isToday: boolean;
  entries: CalendarEntry[];
}

// Consistent pillar → color mapping matching theme.ts
const PILLAR_COLORS: Record<string, string> = {
  Technical: colors.technical,     // #3B82F6 blue
  Physical: colors.physical,       // #10B981 green
  Mental: colors.mental,           // #8B5CF6 purple
  Tactical: colors.tactical,       // #F97316 orange
  Freestyle: colors.freestyle,     // #EF4444 red
  'Club Training': colors.clubTraining, // #34D399 emerald
  Match: colors.match,             // #06B6D4 cyan
};

const getPillarColor = (pillar: string) => PILLAR_COLORS[pillar] || colors.primary;

export default function CalendarScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [allEntries, setAllEntries] = useState<CalendarEntry[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
  const [eventType, setEventType] = useState<'training' | 'match'>('training');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventTime, setEventTime] = useState('09:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseClient();
    const entries: CalendarEntry[] = [];

    try {
      // 1. Load calendar events (Club Training / Match)
      const { data: eventsData } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (eventsData) {
        setCalendarEvents(eventsData);
        eventsData.forEach((e: CalendarEvent) => {
          entries.push({
            id: e.id,
            title: e.title,
            date: e.event_date,
            pillar: e.event_type === 'training' ? 'Club Training' : 'Match',
            status: 'planned',
            duration_minutes: 60,
            scheduled_time: '09:00',
          });
        });
      }

      // 2. Load planned sessions from `sessions` table (timezone-safe date extraction)
      const { data: sessionsData } = await sessionService.getUserSessions(user.id);
      if (sessionsData) {
        sessionsData.forEach((s: any) => {
          // Use local date from the stored ISO string to avoid UTC shift
          const d = new Date(s.scheduled_date);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          let pillar = 'Freestyle';
          if (s.session_type === 'Freestyle') pillar = 'Freestyle';
          else if (s.session_type === 'Structured' || s.session_type === 'Drill-Based') pillar = 'Technical';

          entries.push({
            id: s.id,
            title: s.title,
            date: dateStr,
            pillar,
            status: s.status === 'completed' ? 'completed' : 'planned',
            duration_minutes: s.duration_minutes,
            scheduled_time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          });
        });
      }

      // 3. Load technical drill logs (completed drills)
      const { data: techLogs } = await supabase
        .from('technical_drill_logs')
        .select('id, drill_name, time_elapsed, created_at')
        .eq('user_id', user.id);
      if (techLogs) {
        techLogs.forEach((log: any) => {
          entries.push({
            id: log.id,
            title: log.drill_name,
            date: new Date(log.created_at).toISOString().split('T')[0],
            pillar: 'Technical',
            status: 'completed',
            duration_minutes: Math.max(1, Math.floor((log.time_elapsed || 0) / 60)),
          });
        });
      }

      // 4. Load physical/workout drill logs
      const { data: workoutLogs } = await supabase
        .from('workout_drill_logs')
        .select('id, drill_name, time_elapsed, created_at')
        .eq('user_id', user.id);
      if (workoutLogs) {
        workoutLogs.forEach((log: any) => {
          entries.push({
            id: log.id,
            title: log.drill_name,
            date: new Date(log.created_at).toISOString().split('T')[0],
            pillar: 'Physical',
            status: 'completed',
            duration_minutes: Math.max(1, Math.floor((log.time_elapsed || 0) / 60)),
          });
        });
      }

      // 5. Load mental drill logs
      const { data: mentalLogs } = await supabase
        .from('mental_drill_logs')
        .select('id, drill_name, time_elapsed, created_at')
        .eq('user_id', user.id);
      if (mentalLogs) {
        mentalLogs.forEach((log: any) => {
          entries.push({
            id: log.id,
            title: log.drill_name,
            date: new Date(log.created_at).toISOString().split('T')[0],
            pillar: 'Mental',
            status: 'completed',
            duration_minutes: Math.max(1, Math.floor((log.time_elapsed || 0) / 60)),
          });
        });
      }

      // 6. Load tactical drill logs
      const { data: tacticalLogs } = await supabase
        .from('tactical_drill_logs')
        .select('id, drill_name, time_elapsed, created_at')
        .eq('user_id', user.id);
      if (tacticalLogs) {
        tacticalLogs.forEach((log: any) => {
          entries.push({
            id: log.id,
            title: log.drill_name,
            date: new Date(log.created_at).toISOString().split('T')[0],
            pillar: 'Tactical',
            status: 'completed',
            duration_minutes: Math.max(1, Math.floor((log.time_elapsed || 0) / 60)),
          });
        });
      }

    } catch (err) {
      console.error('Error loading calendar data:', err);
    }

    setAllEntries(entries);
    setLoading(false);
  };

  const getEntriesForDate = (dateStr: string): CalendarEntry[] =>
    allEntries.filter(e => e.date === dateStr);

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const diff = d.getDate() - d.getDay();
    return new Date(d.setDate(diff));
  };

  const generateWeekDays = (): DayData[] => {
    const startOfWeek = getStartOfWeek(currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateString = toLocalDateString(date);
      days.push({ date, dateString, isToday: date.getTime() === today.getTime(), entries: getEntriesForDate(dateString) });
    }
    return days;
  };

  const generateMonthDays = (): DayData[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = getStartOfWeek(firstDay);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: DayData[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateString = toLocalDateString(date);
      days.push({ date, dateString, isToday: date.getTime() === today.getTime(), entries: getEntriesForDate(dateString) });
    }
    return days;
  };

  // Build a timezone-safe YYYY-MM-DD string from a local Date
  const toLocalDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
    // Clear selected date so stale detail panel doesn't persist across navigation
    setSelectedDate(null);
  };

  const getHeaderLabel = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    const start = getStartOfWeek(currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const handleDayPress = (day: DayData) => {
    setSelectedDate(day.date);
    setSelectedEventDate(day.date);
    setShowPlanModal(true);
  };

  const handlePlanSession = (type: 'Drill-Based' | 'Freestyle') => {
    setShowPlanModal(false);
    // Use local date string to avoid UTC timezone shift issues
    const dateStr = selectedDate ? toLocalDateString(selectedDate) : toLocalDateString(new Date());
    if (type === 'Drill-Based') {
      router.push(`/session-drills?date=${encodeURIComponent(dateStr)}`);
    } else {
      router.push(`/session-freestyle?date=${encodeURIComponent(dateStr)}`);
    }
  };

  const handleViewJournal = () => {
    setShowPlanModal(false);
    if (selectedDate) {
      router.push(`/(tabs)/journal?date=${toLocalDateString(selectedDate)}` as any);
    }
  };

  const handleTimeChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) {
      setTempTime(selected);
      const h = selected.getHours().toString().padStart(2, '0');
      const m = selected.getMinutes().toString().padStart(2, '0');
      setEventTime(`${h}:${m}`);
    }
  };

  const handleSaveEvent = async () => {
    if (!user || !selectedEventDate) return;
    const supabase = getSupabaseClient();
    const title = eventTitle.trim() || (eventType === 'training' ? 'Club Training' : 'Match');
    const { error } = await supabase.from('calendar_events').insert({
      user_id: user.id,
      event_type: eventType,
      title,
      event_date: toLocalDateString(selectedEventDate),
      event_time: eventTime,
      notes: eventNotes.trim(),
    });
    if (error) {
      Alert.alert('Error', 'Failed to save event');
    } else {
      setEventTitle('');
      setEventNotes('');
      setEventTime('09:00');
      setShowEventModal(false);
      loadAllData();
    }
  };

  const weekDays = generateWeekDays();
  const monthDays = generateMonthDays();

  const selectedDayEntries = selectedDate
    ? getEntriesForDate(toLocalDateString(selectedDate))
    : [];

  const LEGEND = [
    { label: 'Technical', color: colors.technical },
    { label: 'Physical', color: colors.physical },
    { label: 'Mental', color: colors.mental },
    { label: 'Tactical', color: colors.tactical },
    { label: 'Freestyle', color: colors.freestyle },
    { label: 'Club Training', color: colors.clubTraining },
    { label: 'Match', color: colors.match },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Training Calendar</Text>
          <Text style={styles.headerSubtitle}>Plan and track your cricket training sessions</Text>
        </View>
        <Pressable
          style={styles.addFab}
          onPress={() => {
            setSelectedDate(new Date());
            setSelectedEventDate(new Date());
            setShowPlanModal(true);
          }}
        >
          <MaterialIcons name="add" size={24} color={colors.textLight} />
        </Pressable>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.viewToggle}>
          {(['week', 'month'] as ViewMode[]).map(mode => (
            <Pressable
              key={mode}
              style={[styles.toggleBtn, viewMode === mode && styles.toggleBtnActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.toggleBtnText, viewMode === mode && styles.toggleBtnTextActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.navRow}>
          <Pressable onPress={() => navigate('prev')} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.navLabel}>{getHeaderLabel()}</Text>
          <Pressable onPress={() => navigate('next')} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="chevron-right" size={28} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* Legend */}
          <View style={styles.legendRow}>
            {LEGEND.map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>

          {viewMode === 'week' ? (
            /* ── WEEK VIEW ── */
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekContent}>
              {weekDays.map((day, i) => (
                <View key={i} style={[styles.dayCol, day.isToday && styles.dayColToday]}>
                  <Pressable style={styles.dayColHeader} onPress={() => handleDayPress(day)}>
                    <Text style={styles.dayColName}>
                      {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dayColNum, day.isToday && styles.dayColNumToday]}>
                      {day.date.getDate()}
                    </Text>
                    <MaterialIcons name="add" size={16} color={colors.textSecondary} />
                  </Pressable>

                  <View style={styles.dayColBody}>
                    {day.entries.length === 0 ? (
                      <View style={styles.emptyDay}>
                        <MaterialIcons name="calendar-today" size={28} color={colors.border} />
                        <Text style={styles.emptyDayText}>No sessions</Text>
                      </View>
                    ) : (
                      day.entries.map((entry, idx) => (
                        <View
                          key={idx}
                          style={[styles.entryCard, { borderLeftColor: getPillarColor(entry.pillar), borderLeftWidth: 4 }]}
                        >
                          <View style={[styles.entryPillarBadge, { backgroundColor: getPillarColor(entry.pillar) + '20' }]}>
                            <Text style={[styles.entryPillarText, { color: getPillarColor(entry.pillar) }]}>
                              {entry.pillar}
                            </Text>
                          </View>
                          <Text style={styles.entryTitle} numberOfLines={2}>{entry.title}</Text>
                          <View style={styles.entryMeta}>
                            {entry.duration_minutes ? (
                              <Text style={styles.entryMetaText}>{entry.duration_minutes} min</Text>
                            ) : null}
                            <View style={[styles.entryStatusBadge, entry.status === 'completed' && styles.entryStatusDone]}>
                              <Text style={[styles.entryStatusText, entry.status === 'completed' && styles.entryStatusDoneText]}>
                                {entry.status === 'completed' ? '✓ Done' : 'Planned'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            /* ── MONTH VIEW ── */
            <View style={styles.monthContainer}>
              {/* Day headers */}
              <View style={styles.monthHeader}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <Text key={d} style={styles.monthHeaderCell}>{d}</Text>
                ))}
              </View>

              {/* Grid */}
              <View style={styles.monthGrid}>
                {monthDays.map((day, i) => {
                  const isCurrentMonth = day.date.getMonth() === currentDate.getMonth();
                  const dotEntries = day.entries.slice(0, 4);
                  return (
                    <Pressable
                      key={i}
                      style={[
                        styles.monthCell,
                        day.isToday && styles.monthCellToday,
                        !isCurrentMonth && styles.monthCellOther,
                      ]}
                      onPress={() => handleDayPress(day)}
                    >
                      <Text style={[
                        styles.monthCellDate,
                        day.isToday && styles.monthCellDateToday,
                        !isCurrentMonth && styles.monthCellDateOther,
                      ]}>
                        {day.date.getDate()}
                      </Text>
                      {isCurrentMonth && dotEntries.length > 0 && (
                        <View style={styles.monthDots}>
                          {dotEntries.map((entry, idx) => (
                            <View
                              key={idx}
                              style={[styles.monthDot, { backgroundColor: getPillarColor(entry.pillar) }]}
                            />
                          ))}
                          {day.entries.length > 4 && (
                            <Text style={styles.monthMoreText}>+{day.entries.length - 4}</Text>
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Selected Day Detail Panel */}
          {selectedDate && (
            <View style={styles.detailPanel}>
              <View style={styles.detailPanelHeader}>
                <Text style={styles.detailPanelDate}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                <Pressable
                  style={styles.detailAddBtn}
                  onPress={() => {
                    setSelectedEventDate(selectedDate);
                    setShowPlanModal(true);
                  }}
                >
                  <MaterialIcons name="add" size={18} color={colors.textLight} />
                  <Text style={styles.detailAddBtnText}>Add</Text>
                </Pressable>
              </View>

              {selectedDayEntries.length === 0 ? (
                <View style={styles.detailEmpty}>
                  <MaterialIcons name="event-available" size={36} color={colors.border} />
                  <Text style={styles.detailEmptyText}>Nothing planned. Tap Add to schedule a session.</Text>
                </View>
              ) : (
                selectedDayEntries.map((entry, idx) => (
                  <View
                    key={idx}
                    style={[styles.detailEntry, { borderLeftColor: getPillarColor(entry.pillar), borderLeftWidth: 4 }]}
                  >
                    <View style={styles.detailEntryTop}>
                      <View style={[styles.detailPillarBadge, { backgroundColor: getPillarColor(entry.pillar) + '20' }]}>
                        <Text style={[styles.detailPillarText, { color: getPillarColor(entry.pillar) }]}>
                          {entry.pillar}
                        </Text>
                      </View>
                      <View style={[styles.entryStatusBadge, entry.status === 'completed' && styles.entryStatusDone]}>
                        <Text style={[styles.entryStatusText, entry.status === 'completed' && styles.entryStatusDoneText]}>
                          {entry.status === 'completed' ? '✓ Completed' : 'Planned'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.detailEntryTitle}>{entry.title}</Text>
                    {entry.duration_minutes ? (
                      <Text style={styles.detailEntryMeta}>{entry.duration_minutes} min</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Plan Session Modal */}
      <Modal visible={showPlanModal} animationType="fade" transparent onRequestClose={() => setShowPlanModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : 'Plan Session'}
              </Text>
              <Pressable onPress={() => setShowPlanModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>What kind of session are you planning?</Text>

            <View style={styles.sessionTypeRow}>
              <Pressable style={styles.sessionTypeBtn} onPress={() => handlePlanSession('Drill-Based')}>
                <View style={[styles.sessionTypeIcon, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="track-changes" size={28} color={colors.primary} />
                </View>
                <Text style={styles.sessionTypeName}>Drill-Based</Text>
                <Text style={styles.sessionTypeDesc}>Structured training</Text>
              </Pressable>
              <Pressable style={styles.sessionTypeBtn} onPress={() => handlePlanSession('Freestyle')}>
                <View style={[styles.sessionTypeIcon, { backgroundColor: colors.freestyle + '20' }]}>
                  <MaterialIcons name="flash-on" size={28} color={colors.freestyle} />
                </View>
                <Text style={styles.sessionTypeName}>Freestyle</Text>
                <Text style={styles.sessionTypeDesc}>Open practice</Text>
              </Pressable>
            </View>

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              style={styles.eventBtn}
              onPress={() => { setShowPlanModal(false); setShowEventModal(true); }}
            >
              <MaterialIcons name="event" size={20} color={colors.textLight} />
              <Text style={styles.eventBtnText}>Add Club Training or Match Event</Text>
            </Pressable>

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable style={styles.journalBtn} onPress={handleViewJournal}>
              <MaterialIcons name="book" size={20} color={colors.primary} />
              <Text style={styles.journalBtnText}>View Journal for This Day</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal visible={showEventModal} animationType="fade" transparent onRequestClose={() => setShowEventModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Add Event</Text>
              <Pressable onPress={() => setShowEventModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Date is locked from calendar selection — display only, no picker */}
            {selectedEventDate && (
              <View style={styles.lockedDateRow}>
                <MaterialIcons name="event" size={18} color={colors.primary} />
                <Text style={styles.lockedDateText}>
                  {selectedEventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            )}

            <View style={styles.eventTypeRow}>
              {(['training', 'match'] as const).map(t => (
                <Pressable
                  key={t}
                  style={[styles.eventTypeOpt, eventType === t && styles.eventTypeOptActive]}
                  onPress={() => setEventType(t)}
                >
                  <MaterialIcons
                    name={t === 'training' ? 'fitness-center' : 'sports-cricket'}
                    size={22}
                    color={eventType === t ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.eventTypeOptText, eventType === t && styles.eventTypeOptTextActive]}>
                    {t === 'training' ? 'Club Training' : 'Match'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Event title (optional)"
              placeholderTextColor={colors.textSecondary}
              value={eventTitle}
              onChangeText={setEventTitle}
            />

            <Pressable style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
              <MaterialIcons name="access-time" size={20} color={colors.textSecondary} />
              <Text style={styles.timeText}>{eventTime}</Text>
              <MaterialIcons name="expand-more" size={20} color={colors.textSecondary} />
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
                  <Pressable style={styles.timeConfirmBtn} onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.timeConfirmText}>Done</Text>
                  </Pressable>
                )}
              </>
            )}

            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textSecondary}
              value={eventNotes}
              onChangeText={setEventNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Pressable style={styles.saveBtn} onPress={handleSaveEvent}>
              <Text style={styles.saveBtnText}>Save Event</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

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
  headerTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  headerSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  addFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  controls: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  viewToggle: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 3, alignSelf: 'flex-start' },
  toggleBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  toggleBtnActive: { backgroundColor: colors.text },
  toggleBtnText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  toggleBtnTextActive: { color: colors.textLight },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { padding: spacing.xs },
  navLabel: { ...typography.body, color: colors.text, fontWeight: '700', flex: 1, textAlign: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },

  /* Legend */
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.caption, color: colors.text, fontSize: 11 },

  /* Week View */
  weekContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  dayCol: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayColToday: { borderColor: colors.primary, borderWidth: 2 },
  dayColHeader: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  dayColName: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', fontSize: 11 },
  dayColNum: { ...typography.h4, color: colors.text, fontWeight: '700' },
  dayColNumToday: { color: colors.primary },
  dayColBody: { padding: spacing.sm, gap: spacing.sm, minHeight: 120 },
  emptyDay: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  emptyDayText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  entryCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: 4,
  },
  entryPillarBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  entryPillarText: { fontSize: 10, fontWeight: '700' },
  entryTitle: { ...typography.caption, color: colors.text, fontWeight: '600', lineHeight: 15 },
  entryMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  entryMetaText: { fontSize: 10, color: colors.textSecondary },
  entryStatusBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F5F5F5' },
  entryStatusDone: { backgroundColor: colors.primary + '20' },
  entryStatusText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  entryStatusDoneText: { color: colors.primary },

  /* Month View */
  monthContainer: { paddingHorizontal: 2 },
  monthHeader: { flexDirection: 'row', paddingVertical: spacing.sm },
  monthHeaderCell: { flex: 1, textAlign: 'center', ...typography.caption, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: {
    width: `${100 / 7}%`,
    minHeight: 56,
    padding: 4,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  monthCellToday: { backgroundColor: '#F0FFF4', borderColor: colors.primary, borderWidth: 2 },
  monthCellOther: { backgroundColor: '#FAFAFA' },
  monthCellDate: { ...typography.caption, color: colors.text, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  monthCellDateToday: { color: colors.primary, fontWeight: '800' },
  monthCellDateOther: { color: colors.textSecondary, opacity: 0.5 },
  monthDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginTop: 3 },
  monthDot: { width: 7, height: 7, borderRadius: 4 },
  monthMoreText: { fontSize: 9, color: colors.textSecondary, fontWeight: '600' },

  /* Detail Panel */
  detailPanel: {
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  detailPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailPanelDate: { ...typography.body, color: colors.text, fontWeight: '700' },
  detailAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  detailAddBtnText: { ...typography.bodySmall, color: colors.textLight, fontWeight: '600' },
  detailEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  detailEmptyText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  detailEntry: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailEntryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailPillarBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  detailPillarText: { fontSize: 11, fontWeight: '700' },
  detailEntryTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  detailEntryMeta: { ...typography.caption, color: colors.textSecondary },

  /* Modals */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, width: '90%', maxWidth: 480 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  modalSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },

  sessionTypeRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.md },
  sessionTypeBtn: { flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 2, borderColor: colors.border },
  sessionTypeIcon: { width: 56, height: 56, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  sessionTypeName: { ...typography.body, color: colors.text, fontWeight: '700', textAlign: 'center' },
  sessionTypeDesc: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },

  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.md },

  eventBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  eventBtnText: { ...typography.body, color: colors.textLight, fontWeight: '600' },
  journalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 2, borderColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  journalBtnText: { ...typography.body, color: colors.primary, fontWeight: '600' },

  selectedDateText: { ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.md, fontWeight: '600' },
  lockedDateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary + '12', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md },
  lockedDateText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600', flex: 1 },
  eventTypeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  eventTypeOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.background },
  eventTypeOptActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  eventTypeOptText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  eventTypeOptTextActive: { color: colors.primary },

  input: { ...typography.body, color: colors.text, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  notesInput: { minHeight: 80 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  timeText: { ...typography.body, color: colors.text, flex: 1 },
  timeConfirmBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.md },
  timeConfirmText: { ...typography.body, color: colors.textLight, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  saveBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },
});
