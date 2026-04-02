import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { drillService } from '@/services/drillService';
import { sessionService } from '@/services/sessionService';
import { useAuth } from '@/template';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Drill } from '@/types';

type PillarFilter = 'all' | 'Technical' | 'Physical' | 'Mental' | 'Tactical';

export default function SessionDrillsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const prefilledDateStr = params.date as string | undefined;
  const [saving, setSaving] = useState(false);
  
  const [selectedPillar, setSelectedPillar] = useState<PillarFilter>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [showPillarDropdown, setShowPillarDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [filteredSubcategories, setFilteredSubcategories] = useState<string[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [filteredDrills, setFilteredDrills] = useState<Drill[]>([]);
  const [selectedDrills, setSelectedDrills] = useState<Set<string>>(new Set());
  const [subcategories, setSubcategories] = useState<string[]>([]);

  useEffect(() => {
    loadDrills();
  }, []);

  useEffect(() => {
    filterDrills();
  }, [drills, selectedPillar, selectedSubcategory]);

  const loadDrills = async () => {
    const { data } = await drillService.getAllDrills();
    if (data) {
      setDrills(data);
      // Extract unique subcategories
      const uniqueSubcategories = Array.from(
        new Set(data.map((d) => d.subcategory).filter(Boolean))
      ) as string[];
      setSubcategories(uniqueSubcategories.sort());
    }
  };

  const filterDrills = () => {
    let filtered = drills;

    if (selectedPillar !== 'all') {
      filtered = filtered.filter((d) => d.pillar === selectedPillar);
      
      // Update subcategories based on selected pillar
      const pillarSubcategories = Array.from(
        new Set(filtered.map((d) => d.subcategory).filter(Boolean))
      ) as string[];
      setFilteredSubcategories(pillarSubcategories.sort());
    } else {
      setFilteredSubcategories(subcategories);
    }

    if (selectedSubcategory !== 'all') {
      filtered = filtered.filter((d) => d.subcategory === selectedSubcategory);
    }

    setFilteredDrills(filtered);
  };

  const toggleDrillSelection = (drillId: string) => {
    const newSelected = new Set(selectedDrills);
    if (newSelected.has(drillId)) {
      newSelected.delete(drillId);
    } else {
      newSelected.add(drillId);
    }
    setSelectedDrills(newSelected);
  };

  const getTotalDuration = () => {
    return Array.from(selectedDrills).reduce((total, drillId) => {
      const drill = drills.find((d) => d.id === drillId);
      return total + (drill?.duration_minutes || 0);
    }, 0);
  };

  const handleNext = async () => {
    if (!user || selectedDrills.size === 0) return;

    // If came from calendar with a pre-filled date, save as planned session
    if (prefilledDateStr) {
      setSaving(true);
      const [y, m, d] = prefilledDateStr.split('-').map(Number);
      // Schedule at 9am on the selected date by default
      const scheduledDateTime = new Date(y, m - 1, d, 9, 0, 0);

      const selectedDrillObjs = Array.from(selectedDrills)
        .map(id => drills.find(d => d.id === id))
        .filter(Boolean) as Drill[];

      const pillar = selectedDrillObjs[0]?.pillar || 'Technical';
      const totalDuration = selectedDrillObjs.reduce((sum, d) => sum + (d.duration_minutes || 0), 0);
      const drillNames = selectedDrillObjs.map(d => d.name).join(', ');

      const { error } = await sessionService.createSession({
        user_id: user.id,
        title: `Drill Session: ${drillNames.length > 40 ? drillNames.slice(0, 40) + '...' : drillNames}`,
        scheduled_date: scheduledDateTime.toISOString(),
        duration_minutes: totalDuration || 30,
        session_type: 'Drill-Based',
        status: 'planned',
        notes: `Drills: ${drillNames}`,
      });

      setSaving(false);

      if (error) {
        Alert.alert('Error', 'Failed to schedule session');
        return;
      }

      Alert.alert('Session Scheduled', `${selectedDrills.size} drill(s) scheduled for ${new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    // Otherwise navigate back (no calendar context)
    router.back();
  };

  const pillarOptions: PillarFilter[] = ['all', 'Technical', 'Physical', 'Mental', 'Tactical'];
  const pillarLabels: Record<PillarFilter, string> = {
    all: 'All Pillars',
    Technical: 'Technical',
    Physical: 'Physical',
    Mental: 'Mental',
    Tactical: 'Tactical',
  };

  const getSubcategoryLabel = (drill: Drill) => {
    if (drill.pillar === 'Tactical' && drill.format) {
      return drill.format;
    }
    return drill.subcategory || drill.pillar;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Select Drills</Text>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.filtersTitle}>Filters</Text>
        <View style={styles.filtersRow}>
          {/* Pillar Filter */}
          <Pressable
            style={styles.filterButton}
            onPress={() => {
              setShowPillarDropdown(!showPillarDropdown);
              setShowSubcategoryDropdown(false);
            }}
          >
            <Text style={styles.filterButtonText}>{pillarLabels[selectedPillar]}</Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.textSecondary} />
          </Pressable>

          {/* Subcategory Filter */}
          <Pressable
            style={styles.filterButton}
            onPress={() => {
              setShowSubcategoryDropdown(!showSubcategoryDropdown);
              setShowPillarDropdown(false);
            }}
          >
            <Text style={styles.filterButtonText}>
              {selectedSubcategory === 'all' ? 'All Skills' : selectedSubcategory}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Global Dropdowns - Rendered outside filters for proper z-index */}
      {showPillarDropdown && (
        <>
          <Pressable 
            style={styles.globalDropdownBackdrop}
            onPress={() => setShowPillarDropdown(false)}
          />
          <View style={styles.globalDropdownContainer}>
            <ScrollView
              style={[styles.globalDropdown, { left: spacing.md }]}
              nestedScrollEnabled
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.dropdownContent}
            >
              {pillarOptions.map((pillar) => (
                <Pressable
                  key={pillar}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedPillar(pillar);
                    setSelectedSubcategory('all');
                    setShowPillarDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{pillarLabels[pillar]}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </>
      )}

      {showSubcategoryDropdown && (
        <>
          <Pressable 
            style={styles.globalDropdownBackdrop}
            onPress={() => setShowSubcategoryDropdown(false)}
          />
          <View style={styles.globalDropdownContainer}>
            <ScrollView
              style={[styles.globalDropdown, { right: spacing.md }]}
              nestedScrollEnabled
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.dropdownContent}
            >
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedSubcategory('all');
                  setShowSubcategoryDropdown(false);
                }}
              >
                <Text style={styles.dropdownItemText}>All Skills</Text>
              </Pressable>
              {filteredSubcategories.map((subcategory) => (
                <Pressable
                  key={subcategory}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedSubcategory(subcategory);
                    setShowSubcategoryDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{subcategory}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </>
      )}

      {/* Drills Grid */}
      <ScrollView
        style={styles.drillsScroll}
        contentContainerStyle={styles.drillsGrid}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showPillarDropdown && !showSubcategoryDropdown}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={21}
      >
        <View style={styles.drillsRow}>
          {filteredDrills.map((drill, index) => {
            const isSelected = selectedDrills.has(drill.id);
            const isLeftColumn = index % 2 === 0;
            return (
              <View
                key={drill.id}
                style={[styles.drillCardWrapper, isLeftColumn ? styles.leftCard : styles.rightCard]}
              >
                <Pressable
                  style={[styles.drillCard, isSelected && styles.drillCardSelected]}
                  onPress={() => router.push(`/drill-detail?id=${drill.id}` as any)}
                >
              {/* Selection Checkbox Overlay */}
              <Pressable
                style={styles.selectionOverlay}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleDrillSelection(drill.id);
                }}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && (
                    <MaterialIcons name="check" size={20} color={colors.textLight} />
                  )}
                </View>
              </Pressable>

              {/* Drill Image/Preview */}
              <View style={styles.drillImageContainer}>
                <View style={styles.drillImagePlaceholder}>
                  <MaterialIcons
                    name="sports-cricket"
                    size={48}
                    color={colors.border}
                  />
                </View>
                
                {/* Pillar Badge */}
                <View style={styles.pillarBadge}>
                  <MaterialIcons name="shield" size={12} color={colors.tactical} />
                  <Text style={styles.pillarBadgeText}>{drill.pillar}</Text>
                </View>

                {/* Duration Badge */}
                <View style={styles.durationBadge}>
                  <MaterialIcons name="access-time" size={12} color={colors.textLight} />
                  <Text style={styles.durationBadgeText}>{drill.duration_minutes} min</Text>
                </View>


              </View>

              {/* Drill Info */}
              <View style={styles.drillInfo}>
                <Text style={styles.drillName} numberOfLines={2}>
                  {drill.name}
                </Text>
                <View style={styles.drillMeta}>
                  <Text style={styles.drillMetaIcon}>💪</Text>
                  <Text style={styles.drillMetaText} numberOfLines={1}>
                    {getSubcategoryLabel(drill)}
                  </Text>
                </View>
                <Text style={styles.drillDescription} numberOfLines={2}>
                  {drill.description}
                </Text>
              </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.bottomBarInfo}>
          <Text style={styles.bottomBarCount}>
            {selectedDrills.size} drill{selectedDrills.size !== 1 ? 's' : ''} selected
          </Text>
          <Text style={styles.bottomBarDuration}>
            Total duration: {getTotalDuration()} min
          </Text>
        </View>
        <Pressable
          style={[
            styles.nextButton,
            (selectedDrills.size === 0 || saving) && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={selectedDrills.size === 0 || saving}
        >
          <Text
            style={[
              styles.nextButtonText,
              (selectedDrills.size === 0 || saving) && styles.nextButtonTextDisabled,
            ]}
          >
            {saving ? 'Saving...' : prefilledDateStr ? 'Schedule' : 'Next'}
          </Text>
        </Pressable>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  filtersSection: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButtonText: {
    ...typography.body,
    color: colors.text,
  },
  globalDropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
  },
  globalDropdownContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  globalDropdown: {
    position: 'absolute',
    top: 140,
    width: '45%',
    minWidth: 150,
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    maxHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 15,
  },
  dropdownContent: {
    paddingVertical: 0,
    flexGrow: 1,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    minHeight: 52,
    justifyContent: 'center',
  },
  dropdownItemText: {
    ...typography.body,
    color: colors.text,
  },
  drillsScroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  drillsGrid: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  drillCard: {
    width: '100%',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'visible',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    padding: spacing.xs,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  drillCardSelected: {
    borderColor: colors.success,
  },
  drillImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E8F5E9',
  },
  drillImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  pillarBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  pillarBadgeText: {
    ...typography.caption,
    color: colors.tactical,
    fontWeight: '600',
    fontSize: 11,
  },
  durationBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  durationBadgeText: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 11,
  },

  drillInfo: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  drillName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  drillMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  drillMetaIcon: {
    fontSize: 14,
  },
  drillMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  drillDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomBarInfo: {
    gap: spacing.xs,
  },
  bottomBarCount: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  bottomBarDuration: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  nextButtonDisabled: {
    backgroundColor: colors.border,
  },
  nextButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  nextButtonTextDisabled: {
    color: colors.textSecondary,
  },
  drillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  drillCardWrapper: {
    width: '50%',
    paddingHorizontal: 6,
  },
  leftCard: {
    paddingRight: 6,
  },
  rightCard: {
    paddingLeft: 6,
  },
});
