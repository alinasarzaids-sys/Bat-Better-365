import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

// Time options for the picker
const TIME_OPTIONS = [
  '12:00am', '1:00am', '2:00am', '3:00am', '4:00am', '5:00am',
  '6:00am', '7:00am', '8:00am', '9:00am', '10:00am', '11:00am',
  '12:00pm', '1:00pm', '2:00pm', '3:00pm', '4:00pm', '5:00pm',
  '6:00pm', '7:00pm', '8:00pm', '9:00pm', '10:00pm', '11:00pm',
];

interface TimeBlock {
  id: string;
  fromTime: string;
  toTime: string;
  activity: string;
}

interface JournalEntry {
  id?: string;
  user_id: string;
  entry_date: string;
  mindset_goals: string[];
  my_purpose: string;
  my_values: string;
  my_vision: string;
  message_to_younger_self: string;
  top_3_tasks: string[];
  grateful_for: string[];
  wellness_yoga: boolean;
  wellness_meditate: boolean;
  wellness_visualise: boolean;
  wellness_cold_therapy: boolean;
  nutrition_breakfast: string;
  nutrition_lunch: string;
  nutrition_dinner: string;
  nutrition_snacks: string;
  performance_goals: string[];
  todays_wins: string[];
  things_to_improve: string[];
  daily_notes: string;
  // We store time blocks as JSON in hourly_6am field
  hourly_6am?: string;
  is_completed?: boolean;
  completed_at?: string;
  points_awarded?: number;
}

const emptyEntry = (userId: string, date: string): JournalEntry => ({
  user_id: userId,
  entry_date: date,
  mindset_goals: ['', '', '', '', ''],
  my_purpose: '',
  my_values: '',
  my_vision: '',
  message_to_younger_self: '',
  top_3_tasks: ['', '', ''],
  grateful_for: ['', ''],
  wellness_yoga: false,
  wellness_meditate: false,
  wellness_visualise: false,
  wellness_cold_therapy: false,
  nutrition_breakfast: '',
  nutrition_lunch: '',
  nutrition_dinner: '',
  nutrition_snacks: '',
  performance_goals: ['', '', ''],
  todays_wins: ['', '', ''],
  things_to_improve: ['', '', ''],
  daily_notes: '',
  hourly_6am: '[]',
  is_completed: false,
  points_awarded: 0,
});

const parseTimeBlocks = (raw?: string): TimeBlock[] => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function JournalScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(
    (params.date as string) || new Date().toISOString().split('T')[0]
  );
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showPrescreeningView, setShowPrescreeningView] = useState(false);
  const [editingOnboarding, setEditingOnboarding] = useState(false);

  // Time block modal state
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockFrom, setBlockFrom] = useState('6:00am');
  const [blockTo, setBlockTo] = useState('7:00am');
  const [blockActivity, setBlockActivity] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Auto-save debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryRef = useRef<JournalEntry | null>(null);
  const timeBlocksRef = useRef<TimeBlock[]>([]);

  useEffect(() => {
    if (params.date && typeof params.date === 'string') {
      setSelectedDate(params.date);
    }
  }, [params.date]);

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  useEffect(() => {
    if (user && !showOnboarding) {
      loadEntry();
    }
  }, [user, selectedDate, showOnboarding]);

  // Keep refs in sync for auto-save
  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  useEffect(() => {
    timeBlocksRef.current = timeBlocks;
  }, [timeBlocks]);

  const checkOnboardingStatus = async () => {
    if (!user) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('user_profiles')
      .select('journal_onboarding_completed')
      .eq('id', user.id)
      .single();
    if (!data?.journal_onboarding_completed) {
      setShowOnboarding(true);
      setLoading(false);
    }
  };

  const loadEntry = async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('entry_date', selectedDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading journal entry:', error);
    }

    if (data) {
      setEntry(data);
      setTimeBlocks(parseTimeBlocks(data.hourly_6am));
    } else {
      const fresh = emptyEntry(user.id, selectedDate);
      setEntry(fresh);
      setTimeBlocks([]);
    }
    setLoading(false);
  };

  // Auto-save: triggered on any entry/block change with debounce
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      performSave();
    }, 1500);
  }, []);

  const performSave = async () => {
    const currentEntry = entryRef.current;
    const currentBlocks = timeBlocksRef.current;
    if (!currentEntry || !user) return;

    setSaving(true);
    const supabase = getSupabaseClient();

    const payload = {
      ...currentEntry,
      hourly_6am: JSON.stringify(currentBlocks),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('journal_entries')
      .upsert(payload, { onConflict: 'user_id,entry_date' })
      .select()
      .single();

    if (!error && data && !currentEntry.id) {
      setEntry((prev) => prev ? { ...prev, id: data.id } : prev);
    }
    setSaving(false);
  };

  // Update entry field and trigger auto-save
  const updateEntry = (updates: Partial<JournalEntry>) => {
    setEntry((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      entryRef.current = next;
      return next;
    });
    scheduleSave();
  };

  const updateArrayField = (field: keyof JournalEntry, index: number, value: string) => {
    if (!entry) return;
    const array = [...(entry[field] as string[])];
    array[index] = value;
    updateEntry({ [field]: array });
  };

  // Time block operations
  const updateTimeBlocks = (blocks: TimeBlock[]) => {
    setTimeBlocks(blocks);
    timeBlocksRef.current = blocks;
    scheduleSave();
  };

  const openAddBlock = () => {
    setEditingBlockId(null);
    setBlockFrom('6:00am');
    setBlockTo('7:00am');
    setBlockActivity('');
    setShowAddBlockModal(true);
  };

  const openEditBlock = (block: TimeBlock) => {
    setEditingBlockId(block.id);
    setBlockFrom(block.fromTime);
    setBlockTo(block.toTime);
    setBlockActivity(block.activity);
    setShowAddBlockModal(true);
  };

  const saveBlock = () => {
    if (!blockActivity.trim()) return;
    if (editingBlockId) {
      const updated = timeBlocks.map((b) =>
        b.id === editingBlockId
          ? { ...b, fromTime: blockFrom, toTime: blockTo, activity: blockActivity }
          : b
      );
      updateTimeBlocks(updated);
    } else {
      const newBlock: TimeBlock = {
        id: Date.now().toString(),
        fromTime: blockFrom,
        toTime: blockTo,
        activity: blockActivity,
      };
      updateTimeBlocks([...timeBlocks, newBlock]);
    }
    setShowAddBlockModal(false);
  };

  const deleteBlock = (id: string) => {
    updateTimeBlocks(timeBlocks.filter((b) => b.id !== id));
  };

  const completeOnboarding = async () => {
    if (!user || !entry) return;
    const supabase = getSupabaseClient();
    await supabase
      .from('journal_entries')
      .upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: 'user_id,entry_date' });
    if (!editingOnboarding) {
      await supabase
        .from('user_profiles')
        .update({ journal_onboarding_completed: true })
        .eq('id', user.id);
    }
    setShowOnboarding(false);
    setEditingOnboarding(false);
    loadEntry();
  };

  const skipOnboardingStep = () => {
    if (onboardingStep === 1) setOnboardingStep(2);
    else completeOnboarding();
  };

  const saveOnboardingStep = () => {
    if (onboardingStep === 1) setOnboardingStep(2);
    else completeOnboarding();
  };

  const completeJournal = async () => {
    if (!user || !entry) return;
    const supabase = getSupabaseClient();
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    if (!isToday) return;

    const { error } = await supabase
      .from('journal_entries')
      .upsert({
        ...entry,
        hourly_6am: JSON.stringify(timeBlocks),
        is_completed: true,
        completed_at: new Date().toISOString(),
        points_awarded: 40,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,entry_date' });

    if (!error) {
      await supabase.rpc('increment_user_points', { p_user_id: user.id, p_points: 40 });
      setEntry({ ...entry, is_completed: true, points_awarded: 40 });
      setShowCompletionModal(true);
      const date = new Date(selectedDate);
      if (date.getDay() === 0) {
        setTimeout(() => { setShowCompletionModal(false); setShowWeeklyReview(true); }, 2000);
      }
    }
  };

  const goToPreviousDay = () => {
    // Save before navigating
    performSave();
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    performSave();
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const getWeekDays = () => {
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => ({
      label: day,
      isToday: index === dayOfWeek,
    }));
  };

  const handleWeekDayPress = (dayIndex: number) => {
    performSave();
    const date = new Date(selectedDate);
    const diff = dayIndex - date.getDay();
    date.setDate(date.getDate() + diff);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Onboarding Flow
  if (showOnboarding && entry) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.onboardingContainer}>
          {onboardingStep === 1 ? (
            <>
              <Text style={styles.onboardingTitle}>Your Goals</Text>
              <Text style={styles.onboardingSubtitle}>
                What are your top 5 goals? (Optional — you can skip and add later)
              </Text>
              <ScrollView style={styles.onboardingScroll}>
                {entry.mindset_goals.map((goal, index) => (
                  <TextInput
                    key={index}
                    style={styles.onboardingInput}
                    placeholder={`Goal ${index + 1}`}
                    placeholderTextColor={colors.text}
                    value={goal}
                    onChangeText={(text) => updateArrayField('mindset_goals', index, text)}
                    multiline
                  />
                ))}
              </ScrollView>
              <View style={styles.onboardingButtons}>
                <Pressable style={styles.skipButton} onPress={skipOnboardingStep}>
                  <Text style={styles.skipButtonText}>Skip</Text>
                </Pressable>
                <Pressable style={styles.continueButton} onPress={saveOnboardingStep}>
                  <Text style={styles.continueButtonText}>Save & Continue</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.onboardingTitle}>About You</Text>
              <Text style={styles.onboardingSubtitle}>
                Tell us more about yourself (Optional — you can skip and add later)
              </Text>
              <ScrollView style={styles.onboardingScroll}>
                <Text style={styles.onboardingLabel}>My Purpose</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="What drives me..."
                  value={entry.my_purpose}
                  onChangeText={(text) => setEntry({ ...entry, my_purpose: text })}
                  multiline numberOfLines={3}
                />
                <Text style={styles.onboardingLabel}>My Values</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="What I stand for..."
                  value={entry.my_values}
                  onChangeText={(text) => setEntry({ ...entry, my_values: text })}
                  multiline numberOfLines={3}
                />
                <Text style={styles.onboardingLabel}>My Vision</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="Where I am heading..."
                  value={entry.my_vision}
                  onChangeText={(text) => setEntry({ ...entry, my_vision: text })}
                  multiline numberOfLines={3}
                />
                <Text style={styles.onboardingLabel}>Message to Younger Self</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="What I wish I knew..."
                  value={entry.message_to_younger_self}
                  onChangeText={(text) => setEntry({ ...entry, message_to_younger_self: text })}
                  multiline numberOfLines={3}
                />
              </ScrollView>
              <View style={styles.onboardingButtons}>
                <Pressable style={styles.skipButton} onPress={skipOnboardingStep}>
                  <Text style={styles.skipButtonText}>Skip</Text>
                </Pressable>
                <Pressable style={styles.continueButton} onPress={saveOnboardingStep}>
                  <Text style={styles.continueButtonText}>Save & Continue</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Prescreening View
  if (showPrescreeningView && entry) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.backButtonRow}>
            <Pressable style={styles.backButton} onPress={() => setShowPrescreeningView(false)}>
              <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitleText}>Pre-Screening Data</Text>
            <Pressable style={styles.backButton} onPress={() => {
              setEditingOnboarding(true);
              setShowPrescreeningView(false);
              setShowOnboarding(true);
              setOnboardingStep(1);
            }}>
              <MaterialIcons name="edit" size={24} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Goals</Text>
            {entry.mindset_goals.map((goal, index) => (
              <Text key={index} style={styles.prescreeningText}>{index + 1}. {goal || 'Not set'}</Text>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Purpose</Text>
            <Text style={styles.prescreeningText}>{entry.my_purpose || 'Not set'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Values</Text>
            <Text style={styles.prescreeningText}>{entry.my_values || 'Not set'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Vision</Text>
            <Text style={styles.prescreeningText}>{entry.my_vision || 'Not set'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message to Younger Self</Text>
            <Text style={styles.prescreeningText}>{entry.message_to_younger_self || 'Not set'}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!entry) return null;

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const weekDays = getWeekDays();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.backButtonRow}>
          <Pressable style={styles.backButton} onPress={() => { performSave(); router.back(); }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitleText}>Journal</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.headerRow}>
          <View style={styles.weekIndicator}>
            {weekDays.map((day, index) => (
              <Pressable
                key={index}
                style={[styles.weekDay, day.isToday && styles.weekDayActive]}
                onPress={() => handleWeekDayPress(index)}
              >
                <Text style={[styles.weekDayText, day.isToday && styles.weekDayTextActive]}>
                  {day.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={() => setShowPrescreeningView(true)}>
              <MaterialIcons name="info-outline" size={24} color={colors.text} />
            </Pressable>
            <Pressable style={styles.headerButton} onPress={() => router.push('/(tabs)/calendar')}>
              <MaterialIcons name="event" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.dateNav}>
          <Pressable style={styles.dateNavButton} onPress={goToPreviousDay}>
            <MaterialIcons name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.dateText}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </Text>
          <Pressable style={styles.dateNavButton} onPress={goToNextDay}>
            <MaterialIcons name="chevron-right" size={24} color={colors.text} />
          </Pressable>
        </View>

        {saving && (
          <Text style={styles.savingIndicator}>Saving...</Text>
        )}
      </View>

      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.journalContent}>

          {/* 1. Performance Goals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My 3 performance goals</Text>
            {entry.performance_goals.map((goal, index) => (
              <TextInput
                key={index}
                style={styles.goalInput}
                placeholder={`${index + 1}.`}
                placeholderTextColor={colors.textSecondary}
                value={goal}
                onChangeText={(text) => updateArrayField('performance_goals', index, text)}
                onBlur={() => performSave()}
              />
            ))}
          </View>

          {/* 2. Hourly Journal — Time Block Style */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hourly Journal</Text>
              <Pressable style={styles.addBlockBtn} onPress={openAddBlock}>
                <MaterialIcons name="add" size={18} color={colors.textLight} />
                <Text style={styles.addBlockText}>Add</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionSubtitle}>
              Log what you did during each time block of your day
            </Text>

            {timeBlocks.length === 0 ? (
              <Pressable style={styles.emptyBlockArea} onPress={openAddBlock}>
                <MaterialIcons name="schedule" size={32} color={colors.textSecondary} />
                <Text style={styles.emptyBlockText}>Tap + Add to log your first time block</Text>
                <Text style={styles.emptyBlockExample}>e.g. 3:00pm – 5:00pm · Training</Text>
              </Pressable>
            ) : (
              <View style={styles.blocksList}>
                {timeBlocks.map((block) => (
                  <Pressable key={block.id} style={styles.blockCard} onPress={() => openEditBlock(block)}>
                    <View style={styles.blockTimeTag}>
                      <MaterialIcons name="schedule" size={14} color={colors.primary} />
                      <Text style={styles.blockTimeText}>
                        {block.fromTime} – {block.toTime}
                      </Text>
                    </View>
                    <Text style={styles.blockActivity}>{block.activity}</Text>
                    <Pressable
                      style={styles.blockDeleteBtn}
                      onPress={() => deleteBlock(block.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="close" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* 3. Gratitude */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>I am grateful for...</Text>
            {entry.grateful_for.map((item, index) => (
              <TextInput
                key={index}
                style={styles.goalInput}
                placeholder={`${index + 1}.`}
                placeholderTextColor={colors.textSecondary}
                value={item}
                onChangeText={(text) => updateArrayField('grateful_for', index, text)}
                onBlur={() => performSave()}
              />
            ))}
          </View>

          {/* 4. Wellness */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wellness</Text>
            <View style={styles.wellnessGrid}>
              {[
                { key: 'wellness_yoga', label: 'Yoga' },
                { key: 'wellness_meditate', label: 'Meditate' },
                { key: 'wellness_visualise', label: 'Visualise' },
                { key: 'wellness_cold_therapy', label: 'Cold Therapy' },
              ].map((item) => {
                const val = entry[item.key as keyof JournalEntry] as boolean;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.wellnessCheckbox, val && styles.wellnessCheckboxActive]}
                    onPress={() => updateEntry({ [item.key]: !val })}
                  >
                    <MaterialIcons
                      name={val ? 'check-box' : 'check-box-outline-blank'}
                      size={20}
                      color={val ? colors.primary : colors.textSecondary}
                    />
                    <Text style={styles.wellnessLabel}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. Nutrition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            {[
              { key: 'nutrition_breakfast', label: 'Breakfast' },
              { key: 'nutrition_lunch', label: 'Lunch' },
              { key: 'nutrition_dinner', label: 'Dinner' },
              { key: 'nutrition_snacks', label: 'Snacks' },
            ].map((item) => (
              <TextInput
                key={item.key}
                style={styles.nutritionField}
                placeholder={item.label}
                placeholderTextColor={colors.textSecondary}
                value={entry[item.key as keyof JournalEntry] as string}
                onChangeText={(text) => updateEntry({ [item.key]: text })}
                onBlur={() => performSave()}
                multiline
              />
            ))}
          </View>

          {/* 6. Journal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Journal</Text>
            <TextInput
              style={styles.journalTextArea}
              value={entry.daily_notes}
              onChangeText={(text) => updateEntry({ daily_notes: text })}
              onBlur={() => performSave()}
              multiline
              placeholder="Write your thoughts..."
              placeholderTextColor={colors.textSecondary}
              textAlignVertical="top"
            />
          </View>

          {/* 7. Today's Wins */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's wins</Text>
            {entry.todays_wins.map((win, index) => (
              <TextInput
                key={index}
                style={styles.goalInput}
                placeholder={`${index + 1}.`}
                placeholderTextColor={colors.textSecondary}
                value={win}
                onChangeText={(text) => updateArrayField('todays_wins', index, text)}
                onBlur={() => performSave()}
              />
            ))}
          </View>

          {/* 8. Things to Improve */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Things to improve tomorrow</Text>
            {entry.things_to_improve.map((item, index) => (
              <TextInput
                key={index}
                style={styles.goalInput}
                placeholder={`${index + 1}.`}
                placeholderTextColor={colors.textSecondary}
                value={item}
                onChangeText={(text) => updateArrayField('things_to_improve', index, text)}
                onBlur={() => performSave()}
              />
            ))}
          </View>
        </View>

        {isToday && !entry.is_completed && (
          <Pressable style={styles.completeButton} onPress={completeJournal}>
            <MaterialIcons name="check-circle" size={20} color={colors.textLight} />
            <Text style={styles.completeButtonText}>Complete Today's Journal</Text>
          </Pressable>
        )}

        {entry.is_completed && (
          <View style={styles.completedBadge}>
            <MaterialIcons name="verified" size={16} color={colors.success} />
            <Text style={styles.completedText}>Completed • +{entry.points_awarded} points</Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Time Block Modal */}
      <Modal visible={showAddBlockModal} transparent animationType="slide" onRequestClose={() => setShowAddBlockModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddBlockModal(false)}>
          <Pressable style={styles.blockModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.blockModalHeader}>
              <Text style={styles.blockModalTitle}>
                {editingBlockId ? 'Edit Time Block' : 'Add Time Block'}
              </Text>
              <Pressable onPress={() => setShowAddBlockModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* From Time */}
            <Text style={styles.blockLabel}>From</Text>
            <Pressable style={styles.timePickerBtn} onPress={() => { setShowFromPicker(!showFromPicker); setShowToPicker(false); }}>
              <MaterialIcons name="schedule" size={18} color={colors.primary} />
              <Text style={styles.timePickerBtnText}>{blockFrom}</Text>
              <MaterialIcons name="expand-more" size={18} color={colors.textSecondary} />
            </Pressable>
            {showFromPicker && (
              <ScrollView style={styles.timePicker} nestedScrollEnabled>
                {TIME_OPTIONS.map((t) => (
                  <Pressable key={t} style={[styles.timeOption, blockFrom === t && styles.timeOptionActive]}
                    onPress={() => { setBlockFrom(t); setShowFromPicker(false); }}>
                    <Text style={[styles.timeOptionText, blockFrom === t && styles.timeOptionTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* To Time */}
            <Text style={styles.blockLabel}>To</Text>
            <Pressable style={styles.timePickerBtn} onPress={() => { setShowToPicker(!showToPicker); setShowFromPicker(false); }}>
              <MaterialIcons name="schedule" size={18} color={colors.primary} />
              <Text style={styles.timePickerBtnText}>{blockTo}</Text>
              <MaterialIcons name="expand-more" size={18} color={colors.textSecondary} />
            </Pressable>
            {showToPicker && (
              <ScrollView style={styles.timePicker} nestedScrollEnabled>
                {TIME_OPTIONS.map((t) => (
                  <Pressable key={t} style={[styles.timeOption, blockTo === t && styles.timeOptionActive]}
                    onPress={() => { setBlockTo(t); setShowToPicker(false); }}>
                    <Text style={[styles.timeOptionText, blockTo === t && styles.timeOptionTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Activity */}
            <Text style={styles.blockLabel}>What were you doing?</Text>
            <TextInput
              style={styles.blockActivityInput}
              placeholder="e.g. Training, Rest, Study, Match..."
              placeholderTextColor={colors.textSecondary}
              value={blockActivity}
              onChangeText={setBlockActivity}
              multiline
            />

            <Pressable
              style={[styles.saveBlockBtn, !blockActivity.trim() && styles.saveBlockBtnDisabled]}
              onPress={saveBlock}
              disabled={!blockActivity.trim()}
            >
              <Text style={styles.saveBlockBtnText}>
                {editingBlockId ? 'Save Changes' : 'Add Block'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Completion Modal */}
      <Modal visible={showCompletionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.completionModal}>
            <MaterialIcons name="celebration" size={64} color={colors.success} />
            <Text style={styles.completionTitle}>Good job!</Text>
            <Text style={styles.completionMessage}>You completed today's journal entry</Text>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>+40 Points</Text>
            </View>
            <Pressable style={styles.modalButton} onPress={() => setShowCompletionModal(false)}>
              <Text style={styles.modalButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Weekly Review Modal */}
      <Modal visible={showWeeklyReview} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.completionModal}>
            <MaterialIcons name="emoji-events" size={64} color="#FFB800" />
            <Text style={styles.completionTitle}>Congratulations!</Text>
            <Text style={styles.completionMessage}>You completed your weekly journal streak</Text>
            <View style={[styles.pointsBadge, { backgroundColor: '#FFB800' }]}>
              <Text style={styles.pointsText}>+60 Points</Text>
            </View>
            <Pressable style={styles.modalButton} onPress={() => setShowWeeklyReview(false)}>
              <Text style={styles.modalButtonText}>Awesome!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40, height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleText: { ...typography.h3, color: colors.text, fontWeight: '600' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekIndicator: { flexDirection: 'row', gap: spacing.xs },
  weekDay: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
  },
  weekDayActive: { backgroundColor: '#000000' },
  weekDayText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  weekDayTextActive: { color: '#FFFFFF' },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerButton: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateNavButton: {
    width: 36, height: 36, borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  dateText: { ...typography.body, color: colors.text, fontWeight: '600' },
  savingIndicator: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
    fontStyle: 'italic',
  },
  mainScroll: { flex: 1 },
  journalContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: { ...typography.h4, color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  goalInput: {
    ...typography.body, color: colors.text,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },

  // Time Block UI
  addBlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    marginBottom: spacing.md,
  },
  addBlockText: { ...typography.caption, color: colors.textLight, fontWeight: '700' },
  emptyBlockArea: {
    alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyBlockText: { ...typography.body, color: colors.textSecondary, fontWeight: '500' },
  emptyBlockExample: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' },
  blocksList: { gap: spacing.sm },
  blockCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  blockTimeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  blockTimeText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  blockActivity: { ...typography.body, color: colors.text, flex: 1, fontWeight: '500' },
  blockDeleteBtn: { padding: 4 },

  // Block Modal
  blockModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
  },
  blockModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  blockModalTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  blockLabel: {
    ...typography.bodySmall, color: colors.text, fontWeight: '600',
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  timePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.xs,
  },
  timePickerBtnText: { ...typography.body, color: colors.text, flex: 1 },
  timePicker: {
    maxHeight: 160,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  timeOption: {
    padding: spacing.sm, paddingHorizontal: spacing.md,
  },
  timeOptionActive: { backgroundColor: colors.primary + '15' },
  timeOptionText: { ...typography.body, color: colors.text },
  timeOptionTextActive: { color: colors.primary, fontWeight: '700' },
  blockActivityInput: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, minHeight: 80, textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  saveBlockBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md, padding: spacing.md,
    alignItems: 'center',
  },
  saveBlockBtnDisabled: { backgroundColor: colors.disabled },
  saveBlockBtnText: { ...typography.body, color: colors.textLight, fontWeight: '700' },

  wellnessGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  wellnessCheckbox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm, minWidth: '45%',
  },
  wellnessCheckboxActive: {},
  wellnessLabel: { ...typography.body, color: colors.text, fontWeight: '500' },
  nutritionField: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md, minHeight: 48,
  },
  journalTextArea: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, minHeight: 200, textAlignVertical: 'top',
  },
  completeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.success,
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    paddingVertical: spacing.md, borderRadius: borderRadius.md,
  },
  completeButtonText: { ...typography.body, color: colors.textLight, fontWeight: '600' },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, marginHorizontal: spacing.md, marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },
  completedText: { ...typography.body, color: colors.success, fontWeight: '600' },

  // Onboarding
  onboardingContainer: { flex: 1, padding: spacing.xl },
  onboardingTitle: { ...typography.h1, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  onboardingSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  onboardingScroll: { flex: 1 },
  onboardingLabel: {
    ...typography.bodySmall, color: colors.text, fontWeight: '600',
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
  onboardingInput: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, minHeight: 48,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  onboardingButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  skipButton: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  skipButtonText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  continueButton: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  continueButtonText: { ...typography.body, color: colors.textLight, fontWeight: '600' },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  completionModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl, padding: spacing.xl,
    alignItems: 'center', width: '90%', maxWidth: 400,
    marginBottom: spacing.xl,
  },
  completionTitle: { ...typography.h2, color: colors.text, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  completionMessage: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  pointsBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: borderRadius.full, marginBottom: spacing.lg,
  },
  pointsText: { ...typography.h3, color: colors.textLight, fontWeight: '700' },
  modalButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: borderRadius.md, minWidth: 200,
  },
  modalButtonText: { ...typography.body, color: colors.textLight, fontWeight: '600', textAlign: 'center' },

  // Prescreening
  scrollContent: { padding: spacing.md },
  section: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { ...typography.h4, color: colors.text, fontWeight: '600', marginBottom: spacing.md },
  prescreeningText: { ...typography.body, color: colors.text, marginBottom: spacing.sm, lineHeight: 22 },
  headerTitle: { ...typography.h2, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'center' },
  editButton: { width: 40, height: 40, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
});
