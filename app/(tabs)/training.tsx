import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Dimensions, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { useDrills } from '@/hooks/useDrills';
import { drillService } from '@/services/drillService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Pillar, Drill } from '@/types';

// Helper function to get image source for local assets
const getLocalImageSource = (path: string) => {
  // Map local asset paths to static require statements
  const assetMap: Record<string, any> = {
    'assets/drills/maintaining-composure.png': require('@/assets/drills/maintaining-composure.png'),
    'assets/drills/overcoming-unrealistic-expectations.png': require('@/assets/drills/overcoming-unrealistic-expectations.png'),
    'assets/drills/smart-cricket-goal-blueprint.png': require('@/assets/drills/smart-cricket-goal-blueprint.png'),
    'assets/drills/pregame-routine.png': require('@/assets/drills/pregame-routine.png'),
    'assets/drills/performing-beyond-comfort-zones.png': require('@/assets/drills/performing-beyond-comfort-zones.png'),
    'assets/drills/coping-with-pregame-jitters.png': require('@/assets/drills/coping-with-pregame-jitters.png'),
    'assets/drills/3r-focus-challenge.png': require('@/assets/drills/3r-focus-challenge.png'),
    'assets/drills/developing-confidence.png': require('@/assets/drills/developing-confidence.png'),
    'assets/drills/building-trust-in-your-skills.png': require('@/assets/drills/building-trust-in-your-skills.png'),
    'assets/drills/maintaining-composure-coping-with-mistakes.png': require('@/assets/drills/maintaining-composure-coping-with-mistakes.png'),
    'assets/drills/coping-with-perfectionism.png': require('@/assets/drills/coping-with-perfectionism.png'),
    'assets/drills/self-acceptance.png': require('@/assets/drills/self-acceptance.png'),
    'assets/drills/pre-shot-routine.png': require('@/assets/drills/pre-shot-routine.png'),
    'assets/drills/overcoming-need-for-approval.png': require('@/assets/drills/overcoming-need-for-approval.png'),
    'assets/drills/core-stability-circuit.png': require('@/assets/drills/core-stability-circuit.png'),
  };
  
  return assetMap[path] || { uri: path };
};

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

const pillars: { name: Pillar; color: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { name: 'Technical', color: colors.technical, icon: 'sports-cricket' },
  { name: 'Physical', color: colors.physical, icon: 'fitness-center' },
  { name: 'Mental', color: colors.mental, icon: 'psychology' },
  { name: 'Tactical', color: colors.tactical, icon: 'lightbulb' },
];

export default function TrainingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedPillar, setSelectedPillar] = useState<Pillar>(
    (params.pillar as Pillar) || 'Technical'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(
    (params.format as string) || null
  );
  const [selectedFocusArea, setSelectedFocusArea] = useState<string | null>(
    (params.focusArea as string) || null
  );
  const [selectedPhase, setSelectedPhase] = useState<string | null>(
    (params.phase as string) || null
  );
  const { drills, loading } = useDrills(selectedPillar);

  useEffect(() => {
    if (selectedPillar) {
      loadSubcategories();
    } else {
      setSubcategories([]);
      setSelectedSubcategory('All');
    }
  }, [selectedPillar]);

  const loadSubcategories = async () => {
    if (!selectedPillar) return;
    const { data } = await drillService.getSubcategoriesByPillar(selectedPillar);
    if (data && data.length > 0) {
      // Sort alphabetically to ensure consistent order
      const sortedData = data.sort((a, b) => a.localeCompare(b));
      setSubcategories(sortedData);
      setSelectedSubcategory('All');
    } else {
      setSubcategories([]);
    }
  };

  const filteredDrills = drills.filter((drill) => {
    // For Tactical pillar, filter by format, focus area, and phase
    if (selectedPillar === 'Tactical') {
      if (selectedFormat && drill.format !== selectedFormat) {
        return false;
      }
      if (selectedFocusArea && drill.subcategory !== selectedFocusArea) {
        return false;
      }
      if (selectedPhase && (drill as any).phase !== selectedPhase) {
        return false;
      }
    }
    // For other pillars, filter by subcategory
    else {
      if (selectedSubcategory !== 'All' && drill.subcategory !== selectedSubcategory) {
        return false;
      }
    }
    // Filter by search query
    if (searchQuery && !drill.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Tactical format cards configuration
  const tacticalFormats = [
    {
      name: 'T20 Cricket',
      emoji: '⚡',
      description: 'Fast-paced power hitting',
      gradientColors: ['#E84C3D', '#FF6B35'],
      buttonColor: '#E84C3D',
    },
    {
      name: 'One-Day (50 Overs)',
      emoji: '☀️',
      description: 'Balance & adaptability',
      gradientColors: ['#4A90E2', '#5DADE2'],
      buttonColor: '#4A90E2',
    },
    {
      name: 'Longer Format (4-5 Day)',
      emoji: '🕐',
      description: 'Patience & technique',
      gradientColors: ['#52B788', '#74C69D'],
      buttonColor: '#52B788',
    },
  ];

  // Tactical focus areas configuration
  const tacticalFocusAreas = [
    {
      name: 'Field Scenario',
      icon: '🎯',
      description: 'Match situations & pressure batting',
      iconBg: '#FFE5CC',
      iconColor: '#FF6B35',
    },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return colors.success;
      case 'Intermediate':
        return colors.warning;
      case 'Advanced':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getVideoThumbnail = (videoUrl: string) => {
    // Check if it's a YouTube video
    const youtubePatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/,
      /youtube\.com\/embed\/([^&?/]+)/,
    ];
    
    for (const pattern of youtubePatterns) {
      const match = videoUrl.match(pattern);
      if (match && match[1]) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }
    }
    
    // Extract Google Drive file ID from various URL formats
    if (videoUrl.includes('drive.google.com')) {
      const fileIdMatch = videoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || videoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        // Use Google Drive's direct thumbnail URL with higher resolution
        return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w800`;
      }
    }
    // For other hosts, return null (will use icon fallback)
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Training Pillars</Text>
            <Text style={styles.headerSubtitle}>Select a pillar to view drills</Text>
          </View>
          <Pressable
            style={styles.performanceHubBtn}
            onPress={() => router.push('/session-analytics' as any)}
          >
            <MaterialIcons name="analytics" size={18} color={colors.primary} />
            <Text style={styles.performanceHubText}>Performance Hub</Text>
          </Pressable>
        </View>
      </View>

      {/* Pillar Tabs - Always visible */}
      <View style={styles.tabsContainer}>
        {pillars.map((pillar) => (
          <Pressable
            key={pillar.name}
            style={[
              styles.tab,
              selectedPillar === pillar.name && [
                styles.tabActive,
                { borderBottomColor: pillar.color }
              ],
            ]}
            onPress={() => {
              setSelectedPillar(pillar.name);
              setSearchQuery('');
              setSelectedSubcategory('All');
              setSelectedFormat(null);
              setSelectedFocusArea(null);
              setSelectedPhase(null);
            }}
          >
            <MaterialIcons
              name={pillar.icon}
              size={28}
              color={selectedPillar === pillar.name ? pillar.color : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                selectedPillar === pillar.name && [
                  styles.tabTextActive,
                  { color: pillar.color }
                ],
              ]}
            >
              {pillar.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search - Only show for non-Tactical or when phase is selected */}
        {(selectedPillar !== 'Tactical' || selectedPhase) && (
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search drills..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}

        {/* Subcategory Filter - Only show when has subcategories and NOT Tactical or Mental */}
        {selectedPillar !== 'Tactical' && selectedPillar !== 'Mental' && subcategories.length > 0 && (
          <View style={styles.subcategoryContainer}>
            <Pressable
              style={styles.dropdown}
              onPress={() => setShowSubcategoryDropdown(!showSubcategoryDropdown)}
            >
              <MaterialIcons name="tune" size={20} color={colors.textSecondary} />
              <Text style={styles.dropdownText}>
                {selectedSubcategory === 'All' ? `All ${selectedPillar} Focus` : selectedSubcategory}
              </Text>
              <MaterialIcons
                name={showSubcategoryDropdown ? 'expand-less' : 'expand-more'}
                size={24}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        )}

        {/* Subcategory Modal Dropdown */}
        <Modal
          visible={showSubcategoryDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSubcategoryDropdown(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowSubcategoryDropdown(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select {selectedPillar} Focus</Text>
                <Pressable onPress={() => setShowSubcategoryDropdown(false)}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={true}>
                {['All', ...subcategories].map((item) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.modalItem,
                      selectedSubcategory === item && styles.modalItemActive,
                    ]}
                    onPress={() => {
                      setSelectedSubcategory(item);
                      setShowSubcategoryDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        selectedSubcategory === item && styles.modalItemTextActive,
                      ]}
                    >
                      {item === 'All' ? `All ${selectedPillar} Focus` : item}
                    </Text>
                    {selectedSubcategory === item && (
                      <MaterialIcons
                        name="check"
                        size={20}
                        color={pillars.find((p) => p.name === selectedPillar)?.color || colors.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        {/* Tactical Format Cards - Show when Tactical selected but no format chosen */}
        {selectedPillar === 'Tactical' && !selectedFormat && (
          <View style={styles.formatsContainer}>
            {tacticalFormats.map((format) => (
              <Pressable
                key={format.name}
                style={styles.formatCard}
                onPress={() => setSelectedFormat(format.name)}
              >
                <View
                  style={[
                    styles.formatCardHeader,
                    { backgroundColor: format.gradientColors[0] },
                  ]}
                />
                <View style={styles.formatCardContent}>
                  <Text style={styles.formatEmoji}>{format.emoji}</Text>
                  <Text style={styles.formatName}>{format.name}</Text>
                  <Text style={styles.formatDescription}>{format.description}</Text>
                  <Pressable
                    style={[
                      styles.formatButton,
                      { backgroundColor: format.buttonColor },
                    ]}
                    onPress={() => {
                      setSelectedFormat(format.name);
                      // Auto-navigate to tactical scenario since there's only one focus area
                      router.push(`/tactical-scenario?format=${format.name}` as any);
                    }}
                  >
                    <Text style={styles.formatButtonText}>Enter Training</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}



        {/* Drills Grid - Show when not Tactical OR phase is selected */}
        {(selectedPillar !== 'Tactical' || selectedPhase) && (
          <View style={styles.drillsContainer}>
            {loading ? (
              <Text style={styles.loadingText}>Loading drills...</Text>
            ) : filteredDrills.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No drills found</Text>
                <Text style={styles.emptySubtext}>
                  Phase: {selectedPhase || 'None'} | Format: {selectedFormat || 'None'}
                </Text>
              </View>
            ) : (
            <View style={styles.drillsGrid}>
              {filteredDrills.map((drill) => (
                <Pressable
                  key={drill.id}
                  style={styles.drillCardWrapper}
                  onPress={() => router.push(`/drill-detail?id=${drill.id}` as any)}
                >
                  <Card style={styles.drillCard}>
                    {/* Drill Image Area */}
                    <View
                      style={[
                        styles.drillImage,
                        {
                          backgroundColor:
                            pillars.find((p) => p.name === drill.pillar)?.color + '20' ||
                            colors.primaryLight + '20',
                        },
                      ]}
                    >
                      {/* Pillar Badge */}
                      <View style={styles.imagePillarBadge}>
                        <MaterialIcons
                          name={pillars.find((p) => p.name === drill.pillar)?.icon || 'fitness-center'}
                          size={12}
                          color={pillars.find((p) => p.name === drill.pillar)?.color}
                        />
                        <Text
                          style={[
                            styles.imagePillarText,
                            {
                              color: pillars.find((p) => p.name === drill.pillar)?.color,
                            },
                          ]}
                        >
                          {drill.pillar}
                        </Text>
                      </View>

                      {/* Duration Badge */}
                      <View style={styles.durationBadge}>
                        <MaterialIcons name="timer" size={14} color={colors.textLight} />
                        <Text style={styles.durationText}>
                          {drill.duration_minutes} min
                        </Text>
                      </View>

                      {/* Video Thumbnail, Field Diagram, Image, or Icon */}
                      {(() => {
                        // Priority 1: Field diagram from tactical drills
                        if (drill.instructions && 
                            typeof drill.instructions === 'object' && 
                            (drill.instructions as any).field_diagram) {
                          return (
                            <Image
                              source={{ uri: (drill.instructions as any).field_diagram }}
                              style={styles.drillFieldDiagram}
                              contentFit="contain"
                              transition={200}
                            />
                          );
                        }
                        
                        // Priority 2: Video URL or local image file
                        if (drill.video_url) {
                          // Check if it's a local image file
                          if (drill.video_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                            return (
                              <Image
                                source={getLocalImageSource(drill.video_url)}
                                style={styles.drillFieldDiagram}
                                contentFit="cover"
                                transition={200}
                              />
                            );
                          }
                          
                          // Try to get video thumbnail for remote videos
                          const thumbnail = getVideoThumbnail(drill.video_url);
                          if (thumbnail) {
                            return (
                              <Image
                                source={{ uri: thumbnail }}
                                style={styles.drillFieldDiagram}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="memory-disk"
                                placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7R**0o#DgR4' }}
                              />
                            );
                          }
                          return (
                            <View style={styles.videoPlaceholderContainer}>
                              <MaterialIcons
                                name="play-circle-filled"
                                size={80}
                                color={pillars.find((p) => p.name === drill.pillar)?.color || colors.primary}
                              />
                              <Text style={styles.videoPlaceholderText}>Video Tutorial</Text>
                            </View>
                          );
                        }
                        
                        // Priority 3: Image from instructions (Physical drills)
                        if (drill.instructions && 
                            typeof drill.instructions === 'object' && 
                            (drill.instructions as any).image_url) {
                          const imageUrl = (drill.instructions as any).image_url;
                          // Check if it's a local asset path or remote URL
                          const isLocalAsset = imageUrl.startsWith('assets/');
                          return (
                            <Image
                              source={isLocalAsset ? getLocalImageSource(imageUrl) : { uri: imageUrl }}
                              style={styles.drillFieldDiagram}
                              contentFit="contain"
                              transition={200}
                            />
                          );
                        }
                        
                        // Priority 4: Default pillar icon
                        return (
                          <MaterialIcons
                            name={pillars.find((p) => p.name === drill.pillar)?.icon || 'fitness-center'}
                            size={64}
                            color={pillars.find((p) => p.name === drill.pillar)?.color + '40'}
                          />
                        );
                      })()}
                    </View>

                    {/* Drill Info */}
                    <View style={styles.drillInfo}>
                      <Text style={styles.drillName} numberOfLines={2}>
                        {drill.name}
                      </Text>
                      
                      {drill.subcategory && (
                        <View style={styles.subcategoryBadge}>
                          <Text style={styles.subcategoryEmoji}>💪</Text>
                          <Text style={styles.subcategoryText}>
                            {drill.subcategory}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.drillDescription} numberOfLines={2}>
                        {drill.description}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
          </View>
        )}
      </ScrollView>
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  performanceHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  performanceHubText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 4,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  subcategoryContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  modalItemActive: {
    backgroundColor: colors.primaryLight + '20',
  },
  modalItemText: {
    ...typography.body,
    color: colors.text,
  },
  modalItemTextActive: {
    fontWeight: '600',
  },
  drillsContainer: {
    padding: spacing.md,
  },
  drillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  drillCardWrapper: {
    width: isTablet ? '50%' : '100%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  drillCard: {
    overflow: 'hidden',
  },
  drillImage: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imagePillarBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  imagePillarText: {
    ...typography.caption,
    fontWeight: '600',
  },
  durationBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  durationText: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: '600',
  },
  drillInfo: {
    padding: spacing.md,
  },
  drillName: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subcategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  subcategoryEmoji: {
    fontSize: 14,
  },
  subcategoryText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  drillDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  drillFieldDiagram: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.9,
  },
  videoPlaceholderContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  formatsContainer: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  formatCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formatCardHeader: {
    height: 8,
  },
  formatCardContent: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  formatEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  formatName: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  formatDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  formatButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 180,
  },
  formatButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textLight,
    textAlign: 'center',
  },
  focusAreaHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  focusAreaEmoji: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  focusAreaTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  focusAreaSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  focusAreasContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  focusAreaCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  focusAreaIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusAreaIconText: {
    fontSize: 32,
  },
  focusAreaContent: {
    flex: 1,
    justifyContent: 'center',
  },
  focusAreaName: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  focusAreaDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
