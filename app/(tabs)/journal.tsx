import React, { useState, useEffect } from 'react';
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
  hourly_3am?: string;
  hourly_4am?: string;
  hourly_5am?: string;
  hourly_6am?: string;
  hourly_7am?: string;
  hourly_8am?: string;
  hourly_9am?: string;
  hourly_10am?: string;
  hourly_11am?: string;
  hourly_12pm?: string;
  hourly_1pm?: string;
  hourly_2pm?: string;
  hourly_3pm?: string;
  hourly_4pm?: string;
  hourly_5pm?: string;
  hourly_6pm?: string;
  hourly_7pm?: string;
  hourly_8pm?: string;
  hourly_9pm?: string;
  hourly_10pm?: string;
  hourly_11pm?: string;
  hourly_12am?: string;
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
  hourly_3am: '',
  hourly_4am: '',
  hourly_5am: '',
  hourly_6am: '',
  hourly_7am: '',
  hourly_8am: '',
  hourly_9am: '',
  hourly_10am: '',
  hourly_11am: '',
  hourly_12pm: '',
  hourly_1pm: '',
  hourly_2pm: '',
  hourly_3pm: '',
  hourly_4pm: '',
  hourly_5pm: '',
  hourly_6pm: '',
  hourly_7pm: '',
  hourly_8pm: '',
  hourly_9pm: '',
  hourly_10pm: '',
  hourly_11pm: '',
  hourly_12am: '',
  is_completed: false,
  points_awarded: 0,
});

const hourlySchedule = [
  { time: '3:00am', field: 'hourly_3am' as keyof JournalEntry },
  { time: '4:00am', field: 'hourly_4am' as keyof JournalEntry },
  { time: '5:00am', field: 'hourly_5am' as keyof JournalEntry },
  { time: '6:00am', field: 'hourly_6am' as keyof JournalEntry },
  { time: '7:00am', field: 'hourly_7am' as keyof JournalEntry },
  { time: '8:00am', field: 'hourly_8am' as keyof JournalEntry },
  { time: '9:00am', field: 'hourly_9am' as keyof JournalEntry },
  { time: '10:00am', field: 'hourly_10am' as keyof JournalEntry },
  { time: '11:00am', field: 'hourly_11am' as keyof JournalEntry },
  { time: '12:00pm', field: 'hourly_12pm' as keyof JournalEntry },
  { time: '1:00pm', field: 'hourly_1pm' as keyof JournalEntry },
  { time: '2:00pm', field: 'hourly_2pm' as keyof JournalEntry },
  { time: '3:00pm', field: 'hourly_3pm' as keyof JournalEntry },
  { time: '4:00pm', field: 'hourly_4pm' as keyof JournalEntry },
  { time: '5:00pm', field: 'hourly_5pm' as keyof JournalEntry },
  { time: '6:00pm', field: 'hourly_6pm' as keyof JournalEntry },
  { time: '7:00pm', field: 'hourly_7pm' as keyof JournalEntry },
  { time: '8:00pm', field: 'hourly_8pm' as keyof JournalEntry },
  { time: '9:00pm', field: 'hourly_9pm' as keyof JournalEntry },
  { time: '10:00pm', field: 'hourly_10pm' as keyof JournalEntry },
  { time: '11:00pm', field: 'hourly_11pm' as keyof JournalEntry },
  { time: '12:00am', field: 'hourly_12am' as keyof JournalEntry },
];

export default function JournalScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(
    (params.date as string) || new Date().toISOString().split('T')[0]
  );
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showPrescreeningView, setShowPrescreeningView] = useState(false);
  const [editingOnboarding, setEditingOnboarding] = useState(false);

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
    } else {
      setEntry(emptyEntry(user.id, selectedDate));
    }
    
    setLoading(false);
  };

  const completeOnboarding = async () => {
    if (!user || !entry) return;
    
    const supabase = getSupabaseClient();
    
    // Save onboarding data
    await supabase
      .from('journal_entries')
      .upsert({
        ...entry,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,entry_date',
      });

    // Mark onboarding as completed (only if not editing)
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
    if (onboardingStep === 1) {
      setOnboardingStep(2);
    } else {
      completeOnboarding();
    }
  };

  const saveOnboardingStep = () => {
    if (onboardingStep === 1) {
      setOnboardingStep(2);
    } else {
      completeOnboarding();
    }
  };

  const completeJournal = async () => {
    if (!user || !entry) return;
    
    const supabase = getSupabaseClient();
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    
    if (!isToday) return; // Can only complete today's journal
    
    // Mark as completed and award points
    const { error } = await supabase
      .from('journal_entries')
      .upsert({
        ...entry,
        is_completed: true,
        completed_at: new Date().toISOString(),
        points_awarded: 40,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,entry_date',
      });

    if (!error) {
      // Update user progress points
      await supabase.rpc('increment_user_points', {
        p_user_id: user.id,
        p_points: 40,
      });

      setEntry({ ...entry, is_completed: true, points_awarded: 40 });
      setShowCompletionModal(true);

      // Check if it's Sunday to show weekly review
      const date = new Date(selectedDate);
      if (date.getDay() === 0) {
        setTimeout(() => {
          setShowCompletionModal(false);
          setShowWeeklyReview(true);
        }, 2000);
      }
    }
  };

  const updateArrayField = (field: keyof JournalEntry, index: number, value: string) => {
    if (!entry) return;
    const array = [...(entry[field] as string[])];
    array[index] = value;
    setEntry({ ...entry, [field]: array });
  };

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const getWeekDays = () => {
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return days.map((day, index) => ({
      label: day,
      isToday: index === dayOfWeek,
    }));
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
                What are your top 5 goals? (Optional - you can skip and add later)
              </Text>
              
              <ScrollView style={styles.onboardingScroll}>
                {entry.mindset_goals.map((goal, index) => (
                  <TextInput
                    key={index}
                    style={styles.onboardingInput}
                    placeholder={`Goal ${index + 1}`}
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
                Tell us more about yourself (Optional - you can skip and add later)
              </Text>
              
              <ScrollView style={styles.onboardingScroll}>
                <Text style={styles.onboardingLabel}>My Purpose</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="What drives me..."
                  value={entry.my_purpose}
                  onChangeText={(text) => setEntry({ ...entry, my_purpose: text })}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.onboardingLabel}>My Values</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="What I stand for..."
                  value={entry.my_values}
                  onChangeText={(text) => setEntry({ ...entry, my_values: text })}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.onboardingLabel}>My Vision</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="Where I am heading..."
                  value={entry.my_vision}
                  onChangeText={(text) => setEntry({ ...entry, my_vision: text })}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.onboardingLabel}>Message to Younger Self</Text>
                <TextInput
                  style={[styles.onboardingInput, styles.textArea]}
                  placeholder="What I wish I knew..."
                  value={entry.message_to_younger_self}
                  onChangeText={(text) => setEntry({ ...entry, message_to_younger_self: text })}
                  multiline
                  numberOfLines={3}
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
    const handleEditOnboarding = () => {
      setEditingOnboarding(true);
      setShowPrescreeningView(false);
      setShowOnboarding(true);
      setOnboardingStep(1);
    };

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => setShowPrescreeningView(false)}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Pre-Screening Data</Text>
          <Pressable style={styles.editButton} onPress={handleEditOnboarding}>
            <MaterialIcons name="edit" size={24} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Goals</Text>
            {entry.mindset_goals.map((goal, index) => (
              <Text key={index} style={styles.prescreeningText}>
                {index + 1}. {goal || 'Not set'}
              </Text>
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

  const handleWeekDayPress = (dayIndex: number) => {
    const date = new Date(selectedDate);
    const currentDay = date.getDay();
    const diff = dayIndex - currentDay;
    date.setDate(date.getDate() + diff);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back Button Row */}
        <View style={styles.backButtonRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
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
                style={[
                  styles.weekDay,
                  day.isToday && styles.weekDayActive,
                ]}
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

        {/* Date Navigation */}
        <View style={styles.dateNav}>
          <Pressable style={styles.dateNavButton} onPress={goToPreviousDay}>
            <MaterialIcons name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          
          <Text style={styles.dateText}>
            {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          
          <Pressable 
            style={styles.dateNavButton} 
            onPress={goToNextDay}
          >
            <MaterialIcons 
              name="chevron-right" 
              size={24} 
              color={colors.text} 
            />
          </Pressable>
        </View>
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
              />
            ))}
          </View>

          {/* 2. Hourly Journal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hourly Journal</Text>
            <View style={styles.hourlyContainer}>
              {hourlySchedule.map((slot) => (
                <View key={slot.time} style={styles.hourlyRow}>
                  <Text style={styles.hourlyTime}>{slot.time}</Text>
                  <TextInput
                    style={styles.hourlyInput}
                    placeholder="What's happening..."
                    placeholderTextColor={colors.textSecondary}
                    value={entry[slot.field] as string || ''}
                    onChangeText={(text) => setEntry({ ...entry, [slot.field]: text })}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* 3. Gratitude */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>I am grateful for...</Text>
            {entry.grateful_for.map((item, index) => (
              <TextInput
                key={index}
                style={styles.gratefulInput}
                placeholder="•"
                placeholderTextColor={colors.textSecondary}
                value={item}
                onChangeText={(text) => updateArrayField('grateful_for', index, text)}
              />
            ))}
          </View>

          {/* 4. Wellness Checkboxes */}
          <View style={styles.section}>
            <View style={styles.wellnessGrid}>
              <Pressable 
                style={[styles.wellnessCheckbox, entry.wellness_yoga && styles.wellnessCheckboxActive]}
                onPress={() => setEntry({ ...entry, wellness_yoga: !entry.wellness_yoga })}
              >
                <MaterialIcons 
                  name={entry.wellness_yoga ? 'check-box' : 'check-box-outline-blank'} 
                  size={20} 
                  color={entry.wellness_yoga ? colors.primary : colors.textSecondary} 
                />
                <Text style={styles.wellnessLabel}>Yoga</Text>
              </Pressable>
              <Pressable 
                style={[styles.wellnessCheckbox, entry.wellness_meditate && styles.wellnessCheckboxActive]}
                onPress={() => setEntry({ ...entry, wellness_meditate: !entry.wellness_meditate })}
              >
                <MaterialIcons 
                  name={entry.wellness_meditate ? 'check-box' : 'check-box-outline-blank'} 
                  size={20} 
                  color={entry.wellness_meditate ? colors.primary : colors.textSecondary} 
                />
                <Text style={styles.wellnessLabel}>Meditate</Text>
              </Pressable>
            </View>

            <View style={styles.wellnessGrid}>
              <Pressable 
                style={[styles.wellnessCheckbox, entry.wellness_visualise && styles.wellnessCheckboxActive]}
                onPress={() => setEntry({ ...entry, wellness_visualise: !entry.wellness_visualise })}
              >
                <MaterialIcons 
                  name={entry.wellness_visualise ? 'check-box' : 'check-box-outline-blank'} 
                  size={20} 
                  color={entry.wellness_visualise ? colors.primary : colors.textSecondary} 
                />
                <Text style={styles.wellnessLabel}>Visualise</Text>
              </Pressable>
              <Pressable 
                style={[styles.wellnessCheckbox, entry.wellness_cold_therapy && styles.wellnessCheckboxActive]}
                onPress={() => setEntry({ ...entry, wellness_cold_therapy: !entry.wellness_cold_therapy })}
              >
                <MaterialIcons 
                  name={entry.wellness_cold_therapy ? 'check-box' : 'check-box-outline-blank'} 
                  size={20} 
                  color={entry.wellness_cold_therapy ? colors.primary : colors.textSecondary} 
                />
                <Text style={styles.wellnessLabel}>Cold Therapy</Text>
              </Pressable>
            </View>
          </View>

          {/* 5. Nutrition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <TextInput
              style={styles.nutritionField}
              placeholder="Breakfast"
              placeholderTextColor={colors.textSecondary}
              value={entry.nutrition_breakfast}
              onChangeText={(text) => setEntry({ ...entry, nutrition_breakfast: text })}
              multiline
            />
            <TextInput
              style={styles.nutritionField}
              placeholder="Lunch"
              placeholderTextColor={colors.textSecondary}
              value={entry.nutrition_lunch}
              onChangeText={(text) => setEntry({ ...entry, nutrition_lunch: text })}
              multiline
            />
            <TextInput
              style={styles.nutritionField}
              placeholder="Dinner"
              placeholderTextColor={colors.textSecondary}
              value={entry.nutrition_dinner}
              onChangeText={(text) => setEntry({ ...entry, nutrition_dinner: text })}
              multiline
            />
            <TextInput
              style={styles.nutritionField}
              placeholder="Snacks"
              placeholderTextColor={colors.textSecondary}
              value={entry.nutrition_snacks}
              onChangeText={(text) => setEntry({ ...entry, nutrition_snacks: text })}
              multiline
            />
          </View>

          {/* 6. Journal Writing Space */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Journal</Text>
            <TextInput
              style={styles.journalTextArea}
              value={entry.daily_notes}
              onChangeText={(text) => setEntry({ ...entry, daily_notes: text })}
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
                style={styles.winsInput}
                placeholder={`${index + 1}.`}
                placeholderTextColor={colors.textSecondary}
                value={win}
                onChangeText={(text) => updateArrayField('todays_wins', index, text)}
              />
            ))}
          </View>

          {/* 8. Things to Improve */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Things to improve tomorrow</Text>
            {entry.things_to_improve.map((item, index) => (
              <TextInput
                key={index}
                style={styles.winsInput}
                placeholder={`${index + 1}.`}
                placeholderTextColor={colors.textSecondary}
                value={item}
                onChangeText={(text) => updateArrayField('things_to_improve', index, text)}
              />
            ))}
          </View>
        </View>

        {/* Complete Button */}
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

      {/* Completion Modal */}
      <Modal visible={showCompletionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.completionModal}>
            <MaterialIcons name="celebration" size={64} color={colors.success} />
            <Text style={styles.completionTitle}>Good job!</Text>
            <Text style={styles.completionMessage}>
              You completed today's journal entry
            </Text>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>+40 Points</Text>
            </View>
            <Pressable 
              style={styles.modalButton}
              onPress={() => setShowCompletionModal(false)}
            >
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
            <Text style={styles.completionMessage}>
              You completed your weekly journal streak
            </Text>
            <View style={[styles.pointsBadge, { backgroundColor: '#FFB800' }]}>
              <Text style={styles.pointsText}>+60 Points</Text>
            </View>
            <Pressable 
              style={styles.modalButton}
              onPress={() => setShowWeeklyReview(false)}
            >
              <Text style={styles.modalButtonText}>Awesome!</Text>
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
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekIndicator: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  weekDay: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  weekDayActive: {
    backgroundColor: '#000000',
  },
  weekDayText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  weekDayTextActive: {
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  mainScroll: {
    flex: 1,
  },
  journalContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  goalInput: {
    ...typography.body,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },

  hourlyContainer: {
    gap: spacing.md,
  },
  hourlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hourlyTime: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    width: 80,
  },
  hourlyInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  gratefulInput: {
    ...typography.body,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  wellnessGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  wellnessCheckbox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  wellnessCheckboxActive: {
    // No background change needed
  },
  wellnessLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  nutritionField: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: 48,
  },
  journalTextArea: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  winsInput: {
    ...typography.body,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  completeButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },
  completedText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  onboardingContainer: {
    flex: 1,
    padding: spacing.xl,
  },
  onboardingTitle: {
    ...typography.h1,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  onboardingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  onboardingScroll: {
    flex: 1,
  },
  onboardingLabel: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  onboardingInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    minHeight: 48,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  onboardingButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  continueButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  completionModal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
  },
  completionTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  completionMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  pointsBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  pointsText: {
    ...typography.h3,
    color: colors.textLight,
    fontWeight: '700',
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 200,
  },
  modalButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    textAlign: 'center',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  prescreeningText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
});
