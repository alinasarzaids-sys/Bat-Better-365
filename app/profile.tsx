
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { useRouter } from 'expo-router';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useAuth, useAlert } from '@/template';
import { profileService, ProfileData } from '@/services/profileService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [allAchievements, setAllAchievements] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLevelInfoModal, setShowLevelInfoModal] = useState(false);
  const [showCombatStatsModal, setShowCombatStatsModal] = useState(false);
  const [showTimelineInfoModal, setShowTimelineInfoModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editAge, setEditAge] = useState('');

  useEffect(() => {
    loadProfileData();
    loadAllAchievements();
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await profileService.getProfileData(user.id);
    if (error) {
      showAlert('Error', error);
    } else {
      setProfileData(data);
      if (data) {
        setEditFullName(data.profile.full_name || '');
        setEditAge(data.profile.age?.toString() || '');
      }
    }
    setLoading(false);
  };

  const loadAllAchievements = async () => {
    const { data } = await profileService.getAllAchievements();
    if (data) {
      setAllAchievements(data);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const updates: any = {};
    if (editFullName) updates.full_name = editFullName;
    if (editAge) updates.age = parseInt(editAge);
    
    const { error } = await profileService.updateProfile(user.id, updates);
    if (error) {
      showAlert('Error', error);
    } else {
      showAlert('Success', 'Profile updated successfully');
      setShowEditModal(false);
      loadProfileData();
    }
  };

  if (loading || !profileData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { profile, progress, achievements, recentSessions } = profileData;
  const totalXP = profileService.calculateTotalXP(progress);
  const nextLevel = profileService.getNextLevel(progress.skill_level);
  const levelProgress = profileService.calculateLevelProgress(totalXP, progress.skill_level);
  const totalPoints = totalXP;
  const unlockedAchievementIds = new Set(achievements.map((a) => a.achievement_id));

  const pillarData = [
    {
      name: 'Technical',
      icon: 'sports-cricket',
      color: colors.technical,
      points: progress.technical_points,
      percentage: totalPoints > 0 ? Math.round((progress.technical_points / totalPoints) * 100) : 0,
    },
    {
      name: 'Physical',
      icon: 'fitness-center',
      color: colors.physical,
      points: progress.physical_points,
      percentage: totalPoints > 0 ? Math.round((progress.physical_points / totalPoints) * 100) : 0,
    },
    {
      name: 'Mental',
      icon: 'psychology',
      color: colors.mental,
      points: progress.mental_points,
      percentage: totalPoints > 0 ? Math.round((progress.mental_points / totalPoints) * 100) : 0,
    },
    {
      name: 'Tactical',
      icon: 'lightbulb',
      color: colors.tactical,
      points: progress.tactical_points,
      percentage: totalPoints > 0 ? Math.round((progress.tactical_points / totalPoints) * 100) : 0,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textLight} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Player Profile</Text>
          <Text style={styles.headerSubtitle}>Your journey to cricket mastery</Text>
        </View>
        <Pressable onPress={() => setShowEditModal(true)} style={styles.editButton}>
          <MaterialIcons name="edit" size={20} color={colors.textLight} />
        </Pressable>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <MaterialIcons name="sports-cricket" size={48} color={colors.textLight} />
              </View>
              {achievements.length > 0 && (
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>{achievements.length}</Text>
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {profile.full_name || profile.username || 'Player'}
              </Text>
              {profile.age && (
                <Text style={styles.profileAge}>{profile.age} years old</Text>
              )}
              <Text style={styles.profileLevel}>{progress.skill_level} Player</Text>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <MaterialIcons name="emoji-events" size={28} color="#FFB800" />
                  <View style={styles.statTextRow}>
                    <Text style={styles.statValue}>{totalXP} </Text>
                    <Text style={styles.statLabel}>Total XP</Text>
                  </View>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons name="local-fire-department" size={28} color="#FF6B35" />
                  <View style={styles.statTextRow}>
                    <Text style={styles.statValue}>{progress.current_streak} </Text>
                    <Text style={styles.statLabel}>Day Streak</Text>
                  </View>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons name="check-circle" size={28} color="#52B788" />
                  <View style={styles.statTextRow}>
                    <Text style={styles.statValue}>{progress.total_sessions} </Text>
                    <Text style={styles.statLabel}>Sessions</Text>
                  </View>
                </View>
                <View style={styles.statCard}>
                  <MaterialIcons name="fitness-center" size={28} color="#4A90E2" />
                  <View style={styles.statTextRow}>
                    <Text style={styles.statValue}>{progress.total_sessions} </Text>
                    <Text style={styles.statLabel}>Drills</Text>
                  </View>
                </View>
              </View>

              {/* Level Progress */}
              <View style={styles.levelProgress}>
                <View style={styles.levelProgressLeft}>
                  <Text style={styles.levelProgressText}>
                    Next: {nextLevel.level}
                  </Text>
                  <Pressable 
                    onPress={() => setShowLevelInfoModal(true)}
                    style={styles.levelInfoButton}
                  >
                    <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                  </Pressable>
                </View>
                <Text style={styles.levelProgressPercent}>{Math.round(levelProgress)}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${levelProgress}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Combat Stats Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Combat Stats</Text>
            <Pressable onPress={() => setShowCombatStatsModal(true)} style={styles.infoButton}>
              <MaterialIcons name="info-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sectionDescription}>Your XP balance across the four training pillars</Text>
          <View style={styles.radarContainer}>
            <RadarChart progress={progress} />
          </View>
        </View>



        {/* Training Timeline Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="show-chart" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Training Timeline</Text>
            <Pressable onPress={() => setShowTimelineInfoModal(true)} style={styles.infoButton}>
              <MaterialIcons name="info-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sectionDescription}>Your training frequency over the past 2 weeks</Text>
          <View style={styles.timelineContainer}>
            <TrainingTimeline sessions={recentSessions} />
          </View>
        </View>

        {/* Recent Victories Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="military-tech" size={20} color={colors.success} />
            <Text style={styles.sectionTitle}>Recent Victories</Text>
          </View>
          {recentSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="flag" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyStateText}>No battles fought yet. Start your journey!</Text>
            </View>
          ) : (
            <View style={styles.sessionsList}>
              {recentSessions.map((session) => (
                <View key={session.id} style={styles.sessionCard}>
                  <MaterialIcons name="check-circle" size={20} color={colors.success} />
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    <Text style={styles.sessionDate}>
                      {new Date(session.completed_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.sessionDuration}>{session.duration_minutes} min</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name"
              value={editFullName}
              onChangeText={setEditFullName}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Age"
              value={editAge}
              onChangeText={setEditAge}
              keyboardType="number-pad"
            />
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveProfile}
              >
                <Text style={styles.modalButtonTextSave}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Combat Stats Info Modal */}
      <Modal
        visible={showCombatStatsModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCombatStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.levelInfoModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="auto-awesome" size={24} color={colors.primary} />
                <Text style={styles.modalTitle}>Combat Stats</Text>
              </View>
              <Pressable onPress={() => setShowCombatStatsModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 2000 }}
            >
              <Text style={styles.levelInfoDescription}>
                Your Combat Stats visualize your balanced development across the four essential pillars of cricket batting. Each pillar represents a crucial aspect of your game.
              </Text>
              
              <View style={styles.levelInfoSection}>
                <View style={styles.levelInfoSectionHeader}>
                  <Text style={styles.levelInfoSectionIcon}>📊</Text>
                  <Text style={styles.levelInfoSectionTitle}>Understanding the Radar Chart</Text>
                </View>
                
                <Text style={styles.levelInfoDescription}>
                  The radar chart shows your current strength in each pillar. A balanced shape indicates well-rounded development, while spikes show your strongest areas. Points are earned by completing drills in each category.
                </Text>
              </View>

              <View style={styles.levelInfoSection}>
                <View style={styles.levelInfoSectionHeader}>
                  <Text style={styles.levelInfoSectionIcon}>🎯</Text>
                  <Text style={styles.levelInfoSectionTitle}>The Four Pillars</Text>
                </View>
                
                <View style={styles.levelItem}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.technical }]} />
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Technical</Text>
                    <Text style={styles.levelBenefits}>
                      Batting technique, shot execution, footwork, stance, and fundamental skills. Master the mechanics of perfect stroke play.
                    </Text>
                    <Text style={[styles.levelRange, { marginTop: spacing.xs }]}>
                      Current: {progress.technical_points} XP
                    </Text>
                  </View>
                </View>
                
                <View style={styles.levelItem}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.physical }]} />
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Physical</Text>
                    <Text style={styles.levelBenefits}>
                      Strength, speed, agility, endurance, and fitness. Build the physical foundation for powerful and sustained performance.
                    </Text>
                    <Text style={[styles.levelRange, { marginTop: spacing.xs }]}>
                      Current: {progress.physical_points} XP
                    </Text>
                  </View>
                </View>
                
                <View style={styles.levelItem}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.mental }]} />
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Mental</Text>
                    <Text style={styles.levelBenefits}>
                      Focus, composure, visualization, confidence, and mental resilience. Develop the champion mindset to perform under pressure.
                    </Text>
                    <Text style={[styles.levelRange, { marginTop: spacing.xs }]}>
                      Current: {progress.mental_points} XP
                    </Text>
                  </View>
                </View>
                
                <View style={styles.levelItem}>
                  <View style={[styles.pillarDot, { backgroundColor: colors.tactical }]} />
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Tactical</Text>
                    <Text style={styles.levelBenefits}>
                      Match awareness, strategic thinking, situation analysis, and decision-making. Learn to read the game and make smart choices.
                    </Text>
                    <Text style={[styles.levelRange, { marginTop: spacing.xs }]}>
                      Current: {progress.tactical_points} XP
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.levelInfoSection}>
                <View style={styles.levelInfoSectionHeader}>
                  <Text style={styles.levelInfoSectionIcon}>💪</Text>
                  <Text style={styles.levelInfoSectionTitle}>Building Balance</Text>
                </View>
                
                <Text style={styles.levelInfoDescription}>
                  Elite players excel in all four pillars. While it is natural to be stronger in some areas, aim for balanced development by regularly training in your weaker pillars. A complete player dominates on all fronts.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Training Timeline Info Modal */}
      <Modal
        visible={showTimelineInfoModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowTimelineInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.levelInfoModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="show-chart" size={24} color={colors.primary} />
                <Text style={styles.modalTitle}>Training Timeline</Text>
              </View>
              <Pressable onPress={() => setShowTimelineInfoModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 2000 }}
            >
              <Text style={styles.levelInfoDescription}>
                The Training Timeline is a bar chart showing your daily training activity over the past 2 weeks. Each vertical bar represents one day, and the height shows how many training sessions you completed that day.
              </Text>
              
              <View style={styles.levelInfoSection}>
                <View style={styles.levelInfoSectionHeader}>
                  <Text style={styles.levelInfoSectionIcon}>📊</Text>
                  <Text style={styles.levelInfoSectionTitle}>How to Read the Chart</Text>
                </View>
                
                <Text style={styles.levelInfoDescription}>
                  • <Text style={styles.xpItemBold}>Green bars</Text> = Days you trained{"\n"}
                  • <Text style={styles.xpItemBold}>Gray bars</Text> = Rest days{"\n"}
                  • <Text style={styles.xpItemBold}>Taller bars</Text> = More sessions completed{"\n"}
                  • <Text style={styles.xpItemBold}>Y-axis</Text> = Number of sessions (0-4+){"\n"}
                  • <Text style={styles.xpItemBold}>X-axis</Text> = Date labels (every 3rd day shown)
                </Text>
              </View>

              <View style={styles.levelInfoSection}>
                <View style={styles.levelInfoSectionHeader}>
                  <Text style={styles.levelInfoSectionIcon}>🎯</Text>
                  <Text style={styles.levelInfoSectionTitle}>Why It Matters</Text>
                </View>
                
                <Text style={styles.levelInfoDescription}>
                  Consistency is the key to cricket improvement. This chart helps you:{"\n\n"}
                  • <Text style={styles.xpItemBold}>Track your training habits</Text> - See patterns in when you train most{"\n"}
                  • <Text style={styles.xpItemBold}>Identify gaps</Text> - Spot days where you could have trained{"\n"}
                  • <Text style={styles.xpItemBold}>Build streaks</Text> - Aim for consecutive training days{"\n"}
                  • <Text style={styles.xpItemBold}>Stay motivated</Text> - Visual progress keeps you accountable
                </Text>
              </View>

              <View style={styles.tipCard}>
                <MaterialIcons name="lightbulb" size={20} color={colors.warning} />
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>💡 Training Tip</Text>
                  <Text style={styles.tipText}>
                    Elite athletes train 4-6 days per week. Aim for consistent green bars with strategic rest days rather than sporadic intense sessions.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Level Info Modal */}
      <Modal
        visible={showLevelInfoModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowLevelInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.levelInfoModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="info" size={24} color={colors.primary} />
                <Text style={styles.modalTitle}>Player Level System</Text>
              </View>
              <Pressable onPress={() => setShowLevelInfoModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 2000 }}
              bounces={true}
            >
              <Text style={styles.levelInfoDescription}>
                Your player level represents your overall training dedication and skill development. As you complete drills and training sessions, you earn XP (Experience Points) that help you level up.
              </Text>
              
              <View style={styles.levelInfoSection}>
                <View style={styles.levelInfoSectionHeader}>
                  <Text style={styles.levelInfoSectionIcon}>🏏</Text>
                  <Text style={styles.levelInfoSectionTitle}>How to Get Points</Text>
                </View>
                
                <View style={styles.xpItem}>
                  <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.xpItemText}>
                    <Text style={styles.xpItemBold}>Drill completion:</Text> +10 XP
                  </Text>
                </View>
                
                <View style={styles.xpItem}>
                  <MaterialIcons name="star" size={20} color="#FFB800" />
                  <Text style={styles.xpItemText}>
                    <Text style={styles.xpItemBold}>Good rating (7+):</Text> +5 XP
                  </Text>
                </View>
                
                <View style={styles.xpItem}>
                  <MaterialIcons name="trending-up" size={20} color="#2196F3" />
                  <Text style={styles.xpItemText}>
                    <Text style={styles.xpItemBold}>Consistency (3+ sessions/week):</Text> +15 XP
                  </Text>
                </View>
                
                <View style={styles.xpItem}>
                  <MaterialIcons name="local-fire-department" size={20} color="#FF6B35" />
                  <Text style={styles.xpItemText}>
                    <Text style={styles.xpItemBold}>Streak (3+ days):</Text> +20 XP
                  </Text>
                </View>
              </View>
              
              <View style={styles.levelInfoSection}>
                <View style={styles.levelInfoSectionHeader}>
                  <Text style={styles.levelInfoSectionIcon}>✨</Text>
                  <Text style={styles.levelInfoSectionTitle}>Level Progression</Text>
                </View>
                
                <View style={styles.levelItem}>
                  <Text style={styles.levelIcon}>☀️</Text>
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Beginner</Text>
                    <Text style={styles.levelRange}>0 - 500 XP</Text>
                    <Text style={styles.levelBenefits}>New player{"\n"}Still building fundamentals</Text>
                  </View>
                </View>
                
                <View style={styles.levelItem}>
                  <Text style={styles.levelIcon}>⭐</Text>
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Amateur</Text>
                    <Text style={styles.levelRange}>500 - 1,500 XP</Text>
                    <Text style={styles.levelBenefits}>More consistent{"\n"}Better understanding</Text>
                  </View>
                </View>
                
                <View style={styles.levelItem}>
                  <Text style={styles.levelIcon}>🔥</Text>
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Semi-Pro</Text>
                    <Text style={styles.levelRange}>1,500 - 3,000 XP</Text>
                    <Text style={styles.levelBenefits}>Advanced skills{"\n"}Structured training</Text>
                  </View>
                </View>
                
                <View style={styles.levelItem}>
                  <Text style={styles.levelIcon}>🏆</Text>
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Pro</Text>
                    <Text style={styles.levelRange}>3,000 - 5,000 XP</Text>
                    <Text style={styles.levelBenefits}>High-level player{"\n"}Strong performance</Text>
                  </View>
                </View>
                
                <View style={styles.levelItem}>
                  <Text style={styles.levelIcon}>👑</Text>
                  <View style={styles.levelDetails}>
                    <Text style={styles.levelName}>Elite</Text>
                    <Text style={styles.levelRange}>5,000+ XP</Text>
                    <Text style={styles.levelBenefits}>Peak performance{"\n"}Consistent excellence</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Radar Chart Component
function RadarChart({ progress }: { progress: any }) {
  const size = 280;
  const center = size / 2;
  const maxRadius = size / 2 - 40;
  
  const maxValue = Math.max(
    progress.technical_points,
    progress.physical_points,
    progress.mental_points,
    progress.tactical_points,
    50
  );
  
  const pillars = [
    { name: 'Technical', value: progress.technical_points, angle: 0, color: colors.technical },
    { name: 'Physical', value: progress.physical_points, angle: 90, color: colors.physical },
    { name: 'Tactical', value: progress.tactical_points, angle: 180, color: colors.tactical },
    { name: 'Mental', value: progress.mental_points, angle: 270, color: colors.mental },
  ];
  
  const getPoint = (angle: number, radius: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };
  
  const dataPoints = pillars.map((pillar) => {
    const radius = (pillar.value / maxValue) * maxRadius;
    return getPoint(pillar.angle, radius);
  });
  
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');
  
  return (
    <Svg width={size} height={size}>
      {/* Grid circles */}
      {[0.25, 0.5, 0.75, 1].map((factor) => (
        <Circle
          key={factor}
          cx={center}
          cy={center}
          r={maxRadius * factor}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={1}
          fill="none"
        />
      ))}
      
      {/* Axes */}
      {pillars.map((pillar) => {
        const end = getPoint(pillar.angle, maxRadius);
        return (
          <Line
            key={pillar.name}
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={1}
          />
        );
      })}
      
      {/* Data polygon */}
      <Polygon
        points={polygonPoints}
        fill={colors.primary}
        fillOpacity={0.3}
        stroke={colors.primary}
        strokeWidth={2}
      />
      
      {/* Data points */}
      {dataPoints.map((point, index) => (
        <Circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={4}
          fill={colors.primary}
        />
      ))}
      
      {/* Labels */}
      {pillars.map((pillar) => {
        const labelRadius = maxRadius + 20;
        const point = getPoint(pillar.angle, labelRadius);
        return (
          <SvgText
            key={pillar.name}
            x={point.x}
            y={point.y}
            fill="#FFFFFF"
            fontSize={12}
            fontWeight="600"
            textAnchor="middle"
          >
            {pillar.name}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// Training Timeline Component
function TrainingTimeline({ sessions }: { sessions: any[] }) {
  const chartWidth = Dimensions.get('window').width - spacing.md * 2;
  const height = 200;
  const padding = 40;
  const innerWidth = chartWidth - padding * 2;
  const chartHeight = height - padding * 2;
  
  // Get last 14 days
  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (13 - i));
    return date;
  });
  
  // Count sessions per day
  const sessionCounts = dates.map((date) => {
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter((s) => {
      const sessionDate = new Date(s.completed_at).toISOString().split('T')[0];
      return sessionDate === dateStr;
    }).length;
  });
  
  const maxCount = Math.max(...sessionCounts, 4);
  const barWidth = innerWidth / dates.length - 4;
  
  return (
    <View style={styles.timelineChart}>
      <Svg width={chartWidth} height={height}>
        {/* Y-axis labels */}
        {[0, 1, 2, 3, 4].map((value) => {
          const y = padding + chartHeight - (value / 4) * chartHeight;
          return (
            <SvgText
              key={value}
              x={padding - 10}
              y={y + 4}
              fill={colors.textSecondary}
              fontSize={10}
              textAnchor="end"
            >
              {value}
            </SvgText>
          );
        })}
        
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map((value) => {
          const y = padding + chartHeight - (value / 4) * chartHeight;
          return (
            <Line
              key={value}
              x1={padding}
              y1={y}
              x2={padding + innerWidth}
              y2={y}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={1}
            />
          );
        })}
        
        {/* Bars */}
        {sessionCounts.map((count, index) => {
          const x = padding + index * (innerWidth / dates.length) + 2;
          const barHeight = (count / maxCount) * chartHeight;
          const y = padding + chartHeight - barHeight;
          
          return (
            <React.Fragment key={index}>
              <Line
                x1={x + barWidth / 2}
                y1={y}
                x2={x + barWidth / 2}
                y2={padding + chartHeight}
                stroke={count > 0 ? colors.primary : 'rgba(255, 255, 255, 0.1)'}
                strokeWidth={barWidth}
              />
            </React.Fragment>
          );
        })}
        
        {/* X-axis labels (show every 3rd date) */}
        {dates.map((date, index) => {
          if (index % 3 !== 0) return null;
          const x = padding + index * (innerWidth / dates.length) + barWidth / 2;
          const label = `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <SvgText
              key={index}
              x={x}
              y={padding + chartHeight + 20}
              fill={colors.textSecondary}
              fontSize={10}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
      
      {sessionCounts.every((c) => c === 0) && (
        <View style={styles.timelineEmpty}>
          <Text style={styles.timelineEmptyText}>No training data in the past 2 weeks</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  header: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: '#FFC1E0',
    fontWeight: '600',
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: spacing.xs,
  },
  editButton: {
    padding: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.md,
  },
  profileCard: {
    backgroundColor: '#4A5568',
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF8C42',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFB800',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A5568',
  },
  avatarBadgeText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...typography.h3,
    color: colors.textLight,
    fontWeight: '600',
  },
  profileAge: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: spacing.xs,
  },
  profileLevel: {
    ...typography.h4,
    color: colors.textLight,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#2D3748',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  statTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    ...typography.h3,
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 24,
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  levelProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  levelProgressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  levelInfoButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  levelProgressText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '500',
  },
  levelProgressPercent: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: '700',
  },
  progressBarContainer: {
    marginTop: spacing.xs,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#2D3748',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF8C42',
    borderRadius: borderRadius.sm,
  },
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoButton: {
    marginLeft: 'auto',
    padding: spacing.xs,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  radarContainer: {
    backgroundColor: '#2D3748',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: 320,
    justifyContent: 'center',
  },
  pillarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineContainer: {
    backgroundColor: '#2D3748',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 240,
  },
  timelineChart: {
    position: 'relative',
  },
  timelineEmpty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineEmptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sessionsList: {
    gap: spacing.sm,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  sessionDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sessionDuration: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  levelInfoModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: 0,
    width: '100%',
    maxWidth: 400,
    height: '90%',
  },
  modalScrollView: {
    flex: 1,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonSave: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
  },
  levelInfoDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  levelInfoSection: {
    marginBottom: spacing.lg,
  },
  levelInfoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  levelInfoSectionIcon: {
    fontSize: 20,
  },
  levelInfoSectionTitle: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: '600',
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  levelIcon: {
    fontSize: 24,
  },
  levelDetails: {
    flex: 1,
  },
  levelName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  levelRange: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  levelBenefits: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 16,
    fontSize: 11,
  },
  xpItem: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  xpItemText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  xpItemBold: {
    fontWeight: '600',
    color: colors.text,
  },
  tipCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
