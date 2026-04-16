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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeIcon as MaterialIcons } from '@/components/ui/SafeIcon';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { drillService } from '@/services/drillService';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { Drill } from '@/types';
import { getSupabaseClient } from '@/template';

const { width } = Dimensions.get('window');

// Field diagrams now use remote URLs - no static imports needed

export default function DrillStartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Match situation state
  const [runsNeeded, setRunsNeeded] = useState('20');
  const [ballsLeft, setBallsLeft] = useState('12');
  const [wickets, setWickets] = useState('9');
  const [requiredRunRate, setRequiredRunRate] = useState('10.0');
  const [calculatingRR, setCalculatingRR] = useState(false);
  
  // Field diagram modal
  const [showFieldDiagramModal, setShowFieldDiagramModal] = useState(false);
  
  // Scenario execution state
  const [scenarioStarted, setScenarioStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    loadDrillDetails();
  }, [params.id]);

  useEffect(() => {
    // Initialize match situation from drill data
    if (drill) {
      const matchSituation = getMatchSituation();
      if (matchSituation) {
        setRunsNeeded(matchSituation.runs_needed?.toString() || '20');
        setBallsLeft(matchSituation.balls_left?.toString() || '12');
        setWickets(matchSituation.wickets?.toString() || '9');
        setRequiredRunRate(matchSituation.required_run_rate?.toFixed(1) || '10.0');
      }
    }
  }, [drill]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const loadDrillDetails = async () => {
    if (!params.id) return;
    
    const { data } = await drillService.getDrillById(params.id as string);
    if (data) {
      setDrill(data);
    }
    setLoading(false);
  };

  const isTacticalDrill = () => {
    return drill?.pillar === 'Tactical' && drill?.instructions && typeof drill.instructions === 'object';
  };

  const getFieldDiagram = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return null;
    return drill.instructions.field_diagram || null;
  };

  const getScenarioDescription = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return null;
    return drill.instructions.scenario_description || null;
  };

  const getMatchSituation = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return null;
    return drill.instructions.match_situation || null;
  };

  const getSteps = () => {
    if (!drill?.instructions || typeof drill.instructions !== 'object') return [];
    if (Array.isArray(drill.instructions.how_to_execute)) {
      return drill.instructions.how_to_execute;
    }
    return [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateRequiredRunRate = async () => {
    const runs = parseInt(runsNeeded) || 0;
    const balls = parseInt(ballsLeft) || 1;
    
    if (balls === 0) {
      setRequiredRunRate('0.0');
      return;
    }

    setCalculatingRR(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('ai-coach-analysis', {
        body: {
          prompt: `Calculate the required run rate for a cricket match scenario:
- Runs needed: ${runs}
- Balls left: ${balls}

Please provide ONLY the required run rate as a decimal number (e.g., 10.5). No explanation, just the number.`,
          type: 'calculation'
        }
      });

      if (error) {
        console.error('AI calculation error:', error);
        // Fallback to simple calculation
        const rr = (runs / balls) * 6;
        setRequiredRunRate(rr.toFixed(1));
      } else if (data && data.result) {
        // Extract number from AI response
        const rrMatch = data.result.match(/[\d.]+/);
        if (rrMatch) {
          setRequiredRunRate(parseFloat(rrMatch[0]).toFixed(1));
        } else {
          // Fallback calculation
          const rr = (runs / balls) * 6;
          setRequiredRunRate(rr.toFixed(1));
        }
      } else {
        // Fallback calculation
        const rr = (runs / balls) * 6;
        setRequiredRunRate(rr.toFixed(1));
      }
    } catch (err) {
      console.error('RR calculation error:', err);
      // Fallback calculation
      const rr = (runs / balls) * 6;
      setRequiredRunRate(rr.toFixed(1));
    } finally {
      setCalculatingRR(false);
    }
  };

  const handleMatchSituationChange = () => {
    calculateRequiredRunRate();
  };

  const handleStartScenario = () => {
    if (drill?.pillar === 'Physical') {
      router.push(`/workout-tracking?id=${drill.id}` as any);
    } else if (drill?.pillar === 'Tactical') {
      // Start tactical scenario execution
      setScenarioStarted(true);
      setIsTimerRunning(true);
      setIsPaused(false);
    } else {
      console.log('Start session for drill:', drill?.id);
    }
  };

  const handleNextStep = () => {
    const steps = getSteps();
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };



  const handlePause = () => {
    setIsPaused(!isPaused);
    setIsTimerRunning(!isPaused);
  };

  const handleComplete = () => {
    // Complete the drill immediately - steps are optional
    router.push(`/tactical-complete?drillName=${encodeURIComponent(drill?.name || '')}&timeElapsed=${timeElapsed}` as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!drill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Drill not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const fieldDiagram = getFieldDiagram();
  const scenarioDescription = getScenarioDescription();
  const matchSituation = getMatchSituation();
  const steps = getSteps();
  const currentStepText = steps[currentStep] || '';

  // Check if field diagram is a URL (starts with http)
  const isRemoteUrl = fieldDiagram && fieldDiagram.startsWith('http');

  // Render tactical scenario execution (after starting)
  if (isTacticalDrill() && scenarioStarted) {
    const steps = getSteps();
    const currentStepText = steps[currentStep] || '';

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Back button in execution view */}
        <View style={styles.execHeader}>
          <Pressable onPress={() => { setScenarioStarted(false); setIsTimerRunning(false); }} style={styles.backButtonGeneric} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.execHeaderTitle}>{drill.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.executionScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Field Diagram */}
          {fieldDiagram && (
            <View style={styles.executionFieldContainer}>
              <Pressable onPress={() => setShowFieldDiagramModal(true)}>
                <Image
                  source={{ uri: fieldDiagram }}
                  style={styles.executionFieldDiagram}
                  contentFit="contain"
                  transition={200}
                />
                <View style={styles.zoomHint} pointerEvents="none">
                  <MaterialIcons name="zoom-in" size={20} color={colors.textSecondary} />
                  <Text style={styles.zoomHintText}>Tap to enlarge</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Match Situation Stats - Compact Version with Editable Fields */}
          <View style={styles.compactStatsRow}>
            {/* Runs Needed */}
            <View style={styles.compactStatItem}>
              <View style={styles.compactEditContainer}>
                <TextInput
                  style={[styles.compactStatValue, { color: colors.error }]}
                  value={runsNeeded}
                  onChangeText={setRunsNeeded}
                  onBlur={handleMatchSituationChange}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <View style={styles.compactSteppers}>
                  <Pressable 
                    onPress={() => {
                      setRunsNeeded((parseInt(runsNeeded) + 1).toString());
                      handleMatchSituationChange();
                    }}
                    style={styles.compactStepperButton}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={14} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      const newValue = Math.max(0, parseInt(runsNeeded) - 1);
                      setRunsNeeded(newValue.toString());
                      handleMatchSituationChange();
                    }}
                    style={styles.compactStepperButton}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={14} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.compactStatLabel}>runs needed</Text>
            </View>

            {/* Balls Left */}
            <View style={styles.compactStatItem}>
              <View style={styles.compactEditContainer}>
                <TextInput
                  style={[styles.compactStatValue, { color: '#2196F3' }]}
                  value={ballsLeft}
                  onChangeText={setBallsLeft}
                  onBlur={handleMatchSituationChange}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <View style={styles.compactSteppers}>
                  <Pressable 
                    onPress={() => {
                      setBallsLeft((parseInt(ballsLeft) + 1).toString());
                      handleMatchSituationChange();
                    }}
                    style={styles.compactStepperButton}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={14} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      const newValue = Math.max(0, parseInt(ballsLeft) - 1);
                      setBallsLeft(newValue.toString());
                      handleMatchSituationChange();
                    }}
                    style={styles.compactStepperButton}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={14} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.compactStatLabel}>balls left</Text>
            </View>

            {/* Wickets */}
            <View style={styles.compactStatItem}>
              <View style={styles.compactEditContainer}>
                <TextInput
                  style={[styles.compactStatValue, { color: colors.success }]}
                  value={wickets}
                  onChangeText={setWickets}
                  onBlur={handleMatchSituationChange}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <View style={styles.compactSteppers}>
                  <Pressable 
                    onPress={() => {
                      setWickets((parseInt(wickets) + 1).toString());
                      handleMatchSituationChange();
                    }}
                    style={styles.compactStepperButton}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={14} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      const newValue = Math.max(0, parseInt(wickets) - 1);
                      setWickets(newValue.toString());
                      handleMatchSituationChange();
                    }}
                    style={styles.compactStepperButton}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={14} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.compactStatLabel}>wickets</Text>
            </View>

            {/* Required Run Rate (Non-editable) */}
            <View style={styles.compactStatItem}>
              {calculatingRR ? (
                <ActivityIndicator size="small" color="#9C27B0" style={{ marginBottom: spacing.xs }} />
              ) : (
                <Text style={[styles.compactStatValue, { color: '#9C27B0' }]}>{requiredRunRate}</Text>
              )}
              <Text style={styles.compactStatLabel}>req. RR</Text>
            </View>
          </View>

          {/* Timer Section */}
          <View style={styles.timerSectionExecution}>
            <Text style={styles.timerTextLarge}>{formatTime(timeElapsed)}</Text>
            <View style={styles.timerProgressLarge}>
              <View
                style={[
                  styles.timerProgressBarLarge,
                  {
                    width: `${Math.min(
                      (timeElapsed / (drill.duration_minutes * 60)) * 100,
                      100
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.timerLabelLarge}>target: {drill.duration_minutes} minutes</Text>
          </View>

          {/* Step Execution */}
          <View style={styles.stepExecutionSection}>
            <View style={styles.stepExecutionHeader}>
              <Text style={styles.stepExecutionCounter}>
                Step {currentStep + 1} of {steps.length}
              </Text>
              {currentStep < steps.length - 1 && (
                <Pressable onPress={handleNextStep} style={styles.nextStepButtonExecution}>
                  <Text style={styles.nextStepTextExecution}>Next Step</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.stepExecutionDescription}>{currentStepText}</Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.executionFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable style={styles.pauseButton} onPress={handlePause}>
            <MaterialIcons name={isPaused ? 'play-arrow' : 'pause'} size={20} color={colors.text} />
            <Text style={styles.pauseButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </Pressable>

          <Pressable style={styles.completeButton} onPress={handleComplete}>
            <MaterialIcons name="check-circle" size={20} color={colors.textLight} />
            <Text style={styles.completeButtonText}>Complete</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Render tactical drill layout (before starting)
  if (isTacticalDrill() && fieldDiagram && scenarioDescription) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.execHeader}>
          <Pressable onPress={() => router.back()} style={styles.backButtonGeneric} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.execHeaderTitle} numberOfLines={1}>{drill.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Shield Icon */}
          <View style={styles.shieldContainer}>
            <View style={styles.shieldCircle}>
              <MaterialIcons name="shield" size={40} color={colors.textLight} />
            </View>
          </View>

          {/* Drill Title */}
          <Text style={styles.tacticalTitle}>{drill.name}</Text>

          {/* Scenario Description */}
          <Text style={styles.scenarioDescriptionText}>{scenarioDescription}</Text>

          {/* Field Setting Section */}
          <View style={styles.fieldSettingCard}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="place" size={20} color={colors.warning} />
              <Text style={styles.cardHeaderText}>Field Setting</Text>
            </View>
            {fieldDiagram && (
              <Pressable onPress={() => setShowFieldDiagramModal(true)}>
                <Image
                  source={{ uri: fieldDiagram }}
                  style={styles.fieldDiagramImage}
                  contentFit="contain"
                  transition={200}
                />
                <View style={styles.zoomHint} pointerEvents="none">
                  <MaterialIcons name="zoom-in" size={20} color={colors.textSecondary} />
                  <Text style={styles.zoomHintText}>Tap to enlarge</Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* Match Situation Section */}
          {matchSituation && (
            <View style={styles.matchSituationCard}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="adjust" size={20} color="#8B4513" />
                <Text style={styles.cardHeaderText}>Match Situation</Text>
              </View>
              
              <View style={styles.matchSituationBoxes}>
                {/* Runs Needed */}
                <View style={styles.statBox}>
                  <View style={styles.statInputContainer}>
                    <TextInput
                      style={[styles.statValue, { color: colors.error }]}
                      value={runsNeeded}
                      onChangeText={setRunsNeeded}
                      onBlur={handleMatchSituationChange}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <View style={styles.statSteppers}>
                      <Pressable 
                        onPress={() => {
                          setRunsNeeded((parseInt(runsNeeded) + 1).toString());
                          handleMatchSituationChange();
                        }}
                        style={styles.stepperButton}
                      >
                        <MaterialIcons name="keyboard-arrow-up" size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable 
                        onPress={() => {
                          const newValue = Math.max(0, parseInt(runsNeeded) - 1);
                          setRunsNeeded(newValue.toString());
                          handleMatchSituationChange();
                        }}
                        style={styles.stepperButton}
                      >
                        <MaterialIcons name="keyboard-arrow-down" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.statLabel}>runs{"\n"}needed</Text>
                </View>

                {/* Balls Left */}
                <View style={styles.statBox}>
                  <View style={styles.statInputContainer}>
                    <TextInput
                      style={[styles.statValue, { color: '#2196F3' }]}
                      value={ballsLeft}
                      onChangeText={setBallsLeft}
                      onBlur={handleMatchSituationChange}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <View style={styles.statSteppers}>
                      <Pressable 
                        onPress={() => {
                          setBallsLeft((parseInt(ballsLeft) + 1).toString());
                          handleMatchSituationChange();
                        }}
                        style={styles.stepperButton}
                      >
                        <MaterialIcons name="keyboard-arrow-up" size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable 
                        onPress={() => {
                          const newValue = Math.max(0, parseInt(ballsLeft) - 1);
                          setBallsLeft(newValue.toString());
                          handleMatchSituationChange();
                        }}
                        style={styles.stepperButton}
                      >
                        <MaterialIcons name="keyboard-arrow-down" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.statLabel}>balls{"\n"}left</Text>
                </View>

                {/* Wickets */}
                <View style={styles.statBox}>
                  <View style={styles.statInputContainer}>
                    <TextInput
                      style={[styles.statValue, { color: colors.success }]}
                      value={wickets}
                      onChangeText={setWickets}
                      onBlur={handleMatchSituationChange}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <View style={styles.statSteppers}>
                      <Pressable 
                        onPress={() => {
                          setWickets((parseInt(wickets) + 1).toString());
                          handleMatchSituationChange();
                        }}
                        style={styles.stepperButton}
                      >
                        <MaterialIcons name="keyboard-arrow-up" size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable 
                        onPress={() => {
                          const newValue = Math.max(0, parseInt(wickets) - 1);
                          setWickets(newValue.toString());
                          handleMatchSituationChange();
                        }}
                        style={styles.stepperButton}
                      >
                        <MaterialIcons name="keyboard-arrow-down" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.statLabel}>wickets</Text>
                </View>

                {/* Required Run Rate (Non-editable) */}
                <View style={styles.statBox}>
                  {calculatingRR ? (
                    <ActivityIndicator size="small" color="#9C27B0" style={{ marginVertical: 12 }} />
                  ) : (
                    <Text style={[styles.statValue, { color: '#9C27B0' }]}>{requiredRunRate}</Text>
                  )}
                  <Text style={styles.statLabel}>req.{"\n"}RR</Text>
                </View>
              </View>
            </View>
          )}

          {/* Timer Section */}
          <View style={styles.timerSection}>
            <Text style={styles.timerText}>{formatTime(timeElapsed)}</Text>
            <View style={styles.timerProgress}>
              <View
                style={[
                  styles.timerProgressBar,
                  {
                    width: `${Math.min(
                      (timeElapsed / (drill.duration_minutes * 60)) * 100,
                      100
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.timerLabel}>target: {drill.duration_minutes} minutes</Text>
          </View>

          {/* Step Navigation */}
          {steps.length > 0 && (
            <View style={styles.stepSection}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepCounter}>
                  Step {currentStep + 1} of {steps.length}
                </Text>
                {currentStep < steps.length - 1 && (
                  <Pressable onPress={handleNextStep} style={styles.nextStepButton}>
                    <Text style={styles.nextStepText}>Next Step</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.stepDescription}>{currentStepText}</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable style={styles.startScenarioButton} onPress={handleStartScenario}>
            <MaterialIcons name="play-arrow" size={24} color={colors.textLight} />
            <Text style={styles.startScenarioButtonText}>Start Scenario</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Render generic drill layout (non-tactical)
  const getPillarColor = (pillar: string) => {
    switch (pillar) {
      case 'Technical':
        return colors.technical;
      case 'Physical':
        return colors.physical;
      case 'Mental':
        return colors.mental;
      case 'Tactical':
        return colors.tactical;
      default:
        return colors.primary;
    }
  };

  const getPillarIcon = (pillar: string): keyof typeof MaterialIcons.glyphMap => {
    switch (pillar) {
      case 'Technical':
        return 'sports-cricket';
      case 'Physical':
        return 'fitness-center';
      case 'Mental':
        return 'psychology';
      case 'Tactical':
        return 'lightbulb';
      default:
        return 'star';
    }
  };

  const getEquipmentList = () => {
    if (!drill?.equipment || drill.equipment.length === 0) {
      return ['No equipment needed'];
    }
    return drill.equipment;
  };

  const handleBeginSession = () => {
    if (!drill) return;
    
    if (drill.pillar === 'Physical') {
      router.push(`/workout-tracking?id=${drill.id}` as any);
    } else if (drill.pillar === 'Mental') {
      // Start timer and navigate to mental completion after drill
      setIsTimerRunning(true);
      // For now, navigate directly to mental completion (in production, this would be after video/content)
      setTimeout(() => {
        router.push(`/mental-complete?drillId=${drill.id}&drillName=${encodeURIComponent(drill.name)}&timeElapsed=${timeElapsed}` as any);
      }, 100);
    } else if (drill.pillar === 'Technical') {
      // Navigate to technical tracking screen
      router.push(`/technical-tracking?id=${drill.id}` as any);
    } else {
      console.log('Begin session for drill:', drill.id);
      router.back();
    }
  };

  const pillarColor = getPillarColor(drill.pillar);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButtonGeneric}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pillar Icon */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: pillarColor }]}>
            <MaterialIcons
              name={getPillarIcon(drill.pillar)}
              size={48}
              color={colors.textLight}
            />
          </View>
        </View>

        {/* Drill Title */}
        <Text style={styles.drillTitle}>{drill.name}</Text>
        <Text style={styles.drillSubtitle}>{drill.subcategory || drill.pillar}</Text>

        {/* Objective Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#E3F2FD' }]}>
              <MaterialIcons name="flag" size={20} color="#2196F3" />
            </View>
            <Text style={styles.sectionTitle}>Objective</Text>
          </View>
          <Text style={styles.sectionContent}>
            {drill.description ||
              `A ${drill.pillar.toLowerCase()} training drill designed to improve your cricket skills and performance through focused practice.`}
          </Text>
        </View>

        {/* Time Required Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="access-time" size={20} color={colors.success} />
            </View>
            <Text style={styles.sectionTitle}>Time Required</Text>
          </View>
          <Text style={styles.sectionContent}>{drill.duration_minutes} minutes</Text>
        </View>

        {/* Equipment Needed Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#F3E5F5' }]}>
              <MaterialIcons name="fitness-center" size={20} color="#9C27B0" />
            </View>
            <Text style={styles.sectionTitle}>Equipment Needed</Text>
          </View>
          <View style={styles.equipmentContainer}>
            {getEquipmentList().map((equipment, index) => (
              <View key={index} style={styles.equipmentChip}>
                <Text style={styles.equipmentText}>{equipment}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Target Benefits Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="emoji-events" size={20} color={colors.warning} />
            </View>
            <Text style={styles.sectionTitle}>Target Benefits</Text>
          </View>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <MaterialIcons name="check-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>
                Improves {drill.pillar.toLowerCase()} skills and performance.
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialIcons name="check-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>
                Builds muscle memory and consistency in technique.
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialIcons name="check-circle" size={20} color={colors.success} />
              <Text style={styles.benefitText}>
                Enhances overall cricket performance for match situations.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Begin Session Button */}
      <View style={styles.footer}>
        <Pressable style={styles.beginButton} onPress={handleBeginSession}>
          <MaterialIcons name="play-arrow" size={24} color={colors.textLight} />
          <Text style={styles.beginButtonText}>Begin Session</Text>
        </Pressable>
      </View>

      {/* Field Diagram Modal - Works for all views */}
      <Modal
        visible={showFieldDiagramModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFieldDiagramModal(false)}
      >
        <View style={styles.fieldDiagramModalOverlay}>
          <Pressable 
            style={styles.fieldDiagramModalBackground}
            onPress={() => setShowFieldDiagramModal(false)}
          >
            <View style={styles.fieldDiagramModalContent}>
              <Pressable onPress={() => setShowFieldDiagramModal(false)} style={styles.fieldDiagramCloseButton}>
                <MaterialIcons name="close" size={32} color={colors.textLight} />
              </Pressable>
              {fieldDiagram && (
                <Image
                  source={{ uri: fieldDiagram }}
                  style={styles.fieldDiagramImageLarge}
                  contentFit="contain"
                  transition={200}
                />
              )}
            </View>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  execHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  execHeaderTitle: {
    flex: 1, fontSize: 15, fontWeight: '700', color: colors.text,
    textAlign: 'center', paddingHorizontal: spacing.sm,
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  
  // Tactical Drill Styles
  shieldContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  shieldCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D84315',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tacticalTitle: {
    ...typography.h1,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  scenarioDescriptionText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  fieldSettingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardHeaderText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  fieldDiagramImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: borderRadius.md,
  },
  zoomHint: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  zoomHintText: {
    ...typography.caption,
    color: colors.textLight,
    fontSize: 12,
  },
  fieldDiagramModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fieldDiagramModalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  fieldDiagramModalContent: {
    width: '100%',
    maxWidth: 600,
    aspectRatio: 1,
    position: 'relative',
  },
  fieldDiagramCloseButton: {
    position: 'absolute',
    top: -60,
    right: 0,
    zIndex: 10,
    padding: spacing.sm,
  },
  fieldDiagramImageLarge: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: borderRadius.lg,
  },
  matchSituationCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E8D4C0',
  },
  matchSituationBoxes: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 85,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  statValue: {
    ...typography.h1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 32,
  },
  statSteppers: {
    gap: 2,
  },
  stepperButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 6,
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timerText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FF6F00',
    marginBottom: spacing.sm,
  },
  timerProgress: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  timerProgressBar: {
    height: '100%',
    backgroundColor: '#FF6F00',
  },
  timerLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  stepSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepCounter: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  nextStepButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  nextStepText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  stepDescription: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  startScenarioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#D84315',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  startScenarioButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 18,
  },

  // Generic Drill Styles
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButtonGeneric: {
    padding: spacing.xs,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drillTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  drillSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  sectionContent: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
    paddingLeft: 56,
  },
  equipmentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingLeft: 56,
  },
  equipmentChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  equipmentText: {
    ...typography.bodySmall,
    color: '#1976D2',
    fontWeight: '500',
  },
  benefitsList: {
    gap: spacing.md,
    paddingLeft: 56,
  },
  benefitItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  benefitText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 24,
  },
  beginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  beginButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 18,
  },

  // Tactical Scenario Execution Styles
  executionScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  compactStatsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  compactStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  compactEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  compactStatValue: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 28,
  },
  compactSteppers: {
    gap: 1,
  },
  compactStepperButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 3,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactStatLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
  timerSectionExecution: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  timerTextLarge: {
    fontSize: 72,
    fontWeight: '700',
    color: '#8D6E63',
    marginBottom: spacing.md,
  },
  timerProgressLarge: {
    width: '100%',
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  timerProgressBarLarge: {
    height: '100%',
    backgroundColor: '#8D6E63',
  },
  timerLabelLarge: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
  },
  stepExecutionSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stepExecutionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  stepExecutionCounter: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  nextStepButtonExecution: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  nextStepTextExecution: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  stepExecutionDescription: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
    fontSize: 16,
  },
  executionFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pauseButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    background: 'linear-gradient(90deg, #52B788 0%, #4A90E2 100%)',
    backgroundColor: '#52B788',
    minWidth: 120,
  },
  completeButtonText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 15,
  },

  executionFieldContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  executionFieldDiagram: {
    width: '100%',
    aspectRatio: 1.5,
    backgroundColor: '#FAFAFA',
    borderRadius: borderRadius.md,
  },
  fieldDiagramPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  fieldDiagramPlaceholderText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
